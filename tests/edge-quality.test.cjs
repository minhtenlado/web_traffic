const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, Date };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/edge-quality.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { edgeHistoryQuality, edgeSystemHealth, edgeMinuteView, readEdgeMinuteForecast, usesMinuteCountForecast, MINUTE_CAMERA_IDS } = context.exports;
const now = 1_000_000;
const status = () => ({ online: true, system_state: 'ONLINE', sample_interval_seconds: 60,
  history_steps: 120, history_contiguous_steps: 120, history_required: 120, history_observed_steps: 100, history_imputed_steps: 20,
  history_missing_steps: 0, history_quality_eligible: true, clock_synchronized: true, history_ready: true, weather_status: 'available' });
const payload = () => ({ generated_at: 999, status: status(), forecast: { valid: true, issued_at: 960,
  points: Array.from({ length: 30 }, (_, i) => ({ horizon: i + 1, target_minute: new Date((1020 + i * 60) * 1000).toISOString(),
    counts: Object.fromEntries(MINUTE_CAMERA_IDS.map((id, j) => [id, 20 + j])), labels: { cam_01: 'ket_xe' } })) } });

test('health expires with elapsed time without a new Firebase event and rejects future heartbeat', () => {
  const p = payload();
  assert.equal(edgeSystemHealth(p, now).state, 'ONLINE');
  assert.equal(edgeSystemHealth(p, 1_030_000).state, 'OFFLINE');
  assert.equal(edgeSystemHealth({ ...p, generated_at: 1001 }, now).state, 'OFFLINE');
  assert.equal(edgeSystemHealth({ ...p, generated_at: undefined, timestamp: 999 }, now).state, 'OFFLINE');
  p.status.online = false;
  assert.equal(edgeSystemHealth(p, now).fresh, false);
});

test('online heartbeat preserves explicit WARMUP and DEGRADED and rejects unsynchronized clock', () => {
  for (const state of ['WARMUP', 'DEGRADED', 'OFFLINE']) {
    const p = payload(); p.status.system_state = state;
    assert.equal(edgeSystemHealth(p, now).state, state);
  }
  const p = payload(); p.status.clock_synchronized = false;
  assert.equal(edgeSystemHealth(p, now).state, 'DEGRADED');
});

test('40 observed plus 20 imputed restore a 60/120 window without relabeling as observed', () => {
  const s = { ...status(), history_steps: 60, history_observed_steps: 40, history_imputed_steps: 20, history_ready: false };
  const q = edgeHistoryQuality(s);
  assert.equal(q.known, true); assert.equal(q.observed, 40); assert.equal(q.imputed, 20);
  assert.equal(q.imputedRatio, 1 / 3);
  assert.equal(edgeSystemHealth({ generated_at: 999, status: s }, now).state, 'WARMUP');
});

test('unknown, malformed and inconsistent quality counters cannot authorize minute forecast', () => {
  for (const mutate of [s => delete s.history_observed_steps, s => s.history_missing_steps = 1,
    s => s.history_imputed_steps = -1, s => s.history_imputed_steps = '20', s => s.history_quality_eligible = false,
    s => delete s.history_quality_eligible]) {
    const s = status(); mutate(s); assert.equal(edgeHistoryQuality(s).eligible, false);
  }
  const legacy = edgeHistoryQuality({ history_steps: 720, history_required: 720 });
  assert.equal(legacy.interval, 10); assert.equal(legacy.known, false); assert.equal(legacy.observed, null);
  assert.equal(legacy.eligible, true);
});

test('minute zero is a valid observation; missing, unknown source and future time never become zero', () => {
  const r = { timestamp: 960, vehicle_count: 0, data_source: 'observed' };
  assert.equal(edgeMinuteView(r, now).count, 0);
  for (const value of [{ ...r, data_source: 'missing' }, { ...r, data_source: undefined },
    { ...r, timestamp: 1001 }, { ...r, vehicle_count: null }]) assert.equal(edgeMinuteView(value, now).count, null);
  const imputed = edgeMinuteView({ ...r, vehicle_count: 21, data_source: 'imputed', confidence: .72,
    imputation_method: 'time_of_day_historical_baseline' }, now);
  assert.equal(imputed.source, 'imputed'); assert.equal(imputed.count, 21); assert.equal(imputed.confidence, .72);
  assert.match(imputed.label, /Ước lượng/);
  assert.equal(edgeMinuteView({ ...r, timestamp: '1970-01-01T07:16:00+07:00' }, now).timestamp, 960);
  assert.equal(edgeMinuteView({ ...r, timestamp: '1970-01-01T00:16:00' }, now).timestamp, null);
});

test('minute forecast renders all five counts without converting count-derived proxy classes', () => {
  const result = readEdgeMinuteForecast(payload(), now);
  assert.equal(result.ready, true); assert.equal(result.points.length, 30);
  assert.equal(result.points[0].cam_05, 24); assert.equal(result.points[0].labels, undefined);
  const degraded = payload(); degraded.status.system_state = 'DEGRADED';
  assert.equal(readEdgeMinuteForecast(degraded, now).ready, true);
});

test('V3 count payload selects the numeric forecast while legacy class-only data stays separate', () => {
  assert.equal(usesMinuteCountForecast(payload()), true);
  assert.equal(usesMinuteCountForecast({ status: { history_required: 120 }, forecast: { valid: false } }), true);
  assert.equal(usesMinuteCountForecast({ status: { history_required: 720 }, forecasts: [{ predicted_class: 'Dong' }] }), false);
  assert.equal(usesMinuteCountForecast({ forecast: { points: [{ counts: { cam_05: 2 } }] } }), true);
});

test('stale, incomplete, unsynchronized or malformed minute forecast is hidden', () => {
  for (const mutate of [p => p.generated_at = 900, p => p.forecast.issued_at = 900,
    p => p.status.history_steps = 119, p => p.status.clock_synchronized = false,
    p => p.status.history_quality_eligible = false, p => p.status.history_gaps_detected = true,
    p => p.status.history_fresh = false, p => p.status.system_state = 'WARMUP', p => p.status.weather_status = 'unavailable',
    p => delete p.forecast.points[0].counts.cam_05, p => p.forecast.points[0].counts.cam_01 = null,
    p => p.forecast.points[0].counts.cam_01 = -1, p => p.forecast.points[0].counts.cam_01 = Infinity,
    p => p.forecast.points[0].counts.cam_01 = 1.5, p => p.status.history_contiguous_steps = 119,
    p => p.forecast.points[1].horizon = 1, p => p.forecast.points[1].target_minute = p.forecast.points[0].target_minute,
    p => p.forecast.points.pop()]) {
    const p = payload(); mutate(p); assert.equal(readEdgeMinuteForecast(p, now).ready, false);
  }
});
