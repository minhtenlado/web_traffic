const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, Date, Number, Object };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/tcn-forecast.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText, context);
const { readTCNChart, TCN_OUTPUT_CAMERAS } = context.exports;
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
