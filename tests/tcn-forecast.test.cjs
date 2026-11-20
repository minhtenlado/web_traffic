const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, Date, Number, Object };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/tcn-forecast.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, context);
const { readTCNChart, appendTCNForecastRun, buildTCNForecastComparison, TCN_OUTPUT_CAMERAS } = context.exports;
function fixture() {
  const row = timestamp => ({ timestamp, time: '12:00:00', ...Object.fromEntries(TCN_OUTPUT_CAMERAS.map(c => [c, 18.5])) });
  return { schema_version: 4, kind: 'vehicle_count', experimental: true, advisory_only: true,
    status: 'EXPERIMENTAL', generated_at: 12001, valid_until: 12040,
    history: Array.from({length:120}, (_, i) => row(12000-(119-i)*60)),
    predictions: Array.from({length:30}, (_, i) => row(12060+i*60)) };
}
test('count forecast accepts full 120/30 contract and preserves count over label range', () => {
  const r = readTCNChart(fixture(), 12002);
  assert.equal(r.status, 'EXPERIMENTAL'); assert.equal(r.rawPredictions.length, 30);
  assert.equal(r.rawPredictions[0].cam_01, 18.5);
});
test('expired, stalled worker, future publication and legacy class output stay hidden', () => {
  const f = fixture();
  for (const [d, now] of [[f,12041],[f,12022],[f,12000], [{...f,kind:'traffic_class'},12002],
    [{...f,schema_version:3},12002],[{...f,advisory_only:false},12002],[{...f,status:'NOT_READY'},12002]]) {
    assert.equal(readTCNChart(d,now).rawPredictions.length, 0);
  }
});
test('missing camera, nonfinite count, negative count and cadence errors reject payload', () => {
  for (const modify of [f => delete f.predictions[0].cam_04, f => f.predictions[0].cam_01=Infinity,
    f => f.predictions[0].cam_01=-1, f => f.predictions[1].timestamp+=1, f => f.predictions.pop()]) {
    const f=fixture(); modify(f); assert.equal(readTCNChart(f,12002).rawPredictions.length,0);
  }
});
test('null historical samples remain gaps, Firebase numeric-key objects are supported', () => {
  const f=fixture(); f.history[0].cam_01=null;
  f.predictions=Object.fromEntries(f.predictions.map((p,i)=>[i,p]));
  const r=readTCNChart(f,12002); assert.equal(r.rawHistory[0].cam_01,null); assert.equal(r.rawPredictions.length,30);
});

test('historical forecasts are accumulated once per minute and reset on a new edge session', () => {
  const f=readTCNChart({...fixture(), runtime_session_id:'boot-a'},12002);
  const first=appendTCNForecastRun([],f);
  assert.equal(first.length,1);
  assert.equal(appendTCNForecastRun(first,f).length,1);
  const next=readTCNChart({...fixture(), generated_at:12061, valid_until:12090,
    history:Array.from({length:120},(_,i)=>({timestamp:12060-(119-i)*60,time:'12:00:00',cam_01:18,cam_02:18,cam_03:18,cam_04:18})),
    predictions:Array.from({length:30},(_,i)=>({timestamp:12120+i*60,time:'12:00:00',cam_01:18,cam_02:18,cam_03:18,cam_04:18})), runtime_session_id:'boot-b'},12062);
  const reset=appendTCNForecastRun(first,next);
  assert.equal(reset.length,1);
  assert.equal(reset[0].sessionId,'boot-b');
});

test('selected historical horizon aligns only matured predictions with actual timestamps', () => {
  const history=Array.from({length:120},(_,i)=>({timestamp:12000-(119-i)*60,time:'12:00:00',cam_01:18.5}));
  const makeRun=(origin,value)=>({originTimestamp:origin,sessionId:'boot-a',predictions:Array.from({length:30},(_,i)=>({timestamp:origin+(i+1)*60,cam_01:value}))});
  const runs=[makeRun(11700,20),makeRun(11640,24),makeRun(11940,99)];
  const result=buildTCNForecastComparison(history,runs,'cam_01',5);
  assert.equal(result.historicalPredictions.length,2);
  assert.deepEqual(Array.from(result.historicalPredictions.map(p=>p.timestamp)),[11940,12000]);
  assert.equal(result.matchCount,2);
  assert.equal(result.mae,3.5);
  assert.equal(result.rmse,Math.sqrt((5.5**2+1.5**2)/2));
  assert.equal(result.combined.at(-1).predicted,18.5);
  assert.equal(result.combined.length,120);
});
