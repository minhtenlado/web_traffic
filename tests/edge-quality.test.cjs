const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, Date };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/edge-quality.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { edgeHistoryQuality, edgeSystemHealth, edgeMinuteView, readEdgeMinuteForecast,
  readEdgeForecastComparison, alignForecastComparisonToHistory, readEdgeMinuteHistory, readEdgeCurrentCount, usesMinuteCountForecast, selectDisplayMinuteForecast, MINUTE_CAMERA_IDS } = context.exports;
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

test('minute history keeps observed and imputed provenance separate and ignores future or invalid rows', () => {
  const result = readEdgeMinuteHistory({ history: [
    { timestamp: 940, counts: { cam_01: 11, cam_02: 20 }, data_sources: { cam_01: 'observed', cam_02: 'imputed' } },
    { timestamp: 1001, counts: { cam_01: 99 }, data_sources: { cam_01: 'observed' } },
    { timestamp: '1970-01-12T13:46:00', counts: { cam_01: 15 }, data_sources: { cam_01: 'observed' } },
    { timestamp: 960, counts: { cam_01: 0, cam_02: 7, cam_03: 4 }, data_sources: { cam_01: 'observed', cam_02: 'missing', cam_03: 'unknown' } },
    { timestamp: '1970-01-01T07:16:20+07:00', counts: { cam_01: 15 }, data_sources: { cam_01: 'observed' } },
  ] }, now);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(row => row.timestamp), [940, 960, 980]);
  assert.deepEqual(result[0].counts.cam_01, { count: 11, source: 'observed' });
  assert.deepEqual(result[0].counts.cam_02, { count: 20, source: 'imputed' });
  assert.deepEqual(result[1].counts.cam_01, { count: 0, source: 'observed' });
  assert.deepEqual(result[1].counts.cam_02, { count: null, source: 'missing' });
});

test('current chart marker only accepts a fresh image YOLO observation', () => {
  const p = payload();
  p.cameras = { cam_01: { status: 'fresh', data_source: 'observed', observed_at: 999, vehicle_count: 0 } };
  assert.deepEqual(readEdgeCurrentCount(p, 'cam_01', now), { timestamp: 999, count: 0 });
  for (const camera of [
    { status: 'stale', data_source: 'observed', observed_at: 999, vehicle_count: 10 },
    { status: 'fresh', data_source: 'imputed', observed_at: 999, vehicle_count: 10 },
    { status: 'fresh', data_source: 'observed', observed_at: 900, vehicle_count: 10 },
    { status: 'fresh', data_source: 'observed', observed_at: 1001, vehicle_count: 10 },
  ]) {
    p.cameras.cam_01 = camera;
    assert.equal(readEdgeCurrentCount(p, 'cam_01', now), null);
  }
  assert.equal(readEdgeCurrentCount(p, 'cam_99', now), null);
});

test('minute forecast renders all five counts without converting count-derived proxy classes', () => {
  const result = readEdgeMinuteForecast(payload(), now);
  assert.equal(result.ready, true); assert.equal(result.points.length, 30);
  assert.equal(result.points[0].cam_05, 24); assert.equal(result.points[0].labels, undefined);
  const degraded = payload(); degraded.status.system_state = 'DEGRADED';
  assert.equal(readEdgeMinuteForecast(degraded, now).ready, true);
});

test('forecast comparison aligns the same target minute and calculates errors for the selected series', () => {
  const evaluation = { source: 'observed_only_visible_count', points: { '5': [
    { target_minute: '1970-01-12T13:46:00Z', observed_counts: { cam_01: 20 }, forecast_counts: { cam_01: 23 } },
    { target_minute: '1970-01-12T13:47:00Z', observed_counts: { cam_01: 0 }, forecast_counts: { cam_01: 2 } },
    { target_minute: '1970-01-12T13:48:00Z', observed_counts: { cam_01: null }, forecast_counts: { cam_01: 12 } },
  ] } };
  const result = readEdgeForecastComparison(evaluation, 'cam_01', 5);
  assert.equal(result.samples, 2);
  assert.equal(result.mae, 2.5);
  assert.equal(result.rmse, Math.sqrt(6.5));
  assert.deepEqual(result.points.map(point => point.actual), [20, 0]);
  assert.equal(readEdgeForecastComparison(evaluation, 'cam_02', 5).samples, 0);
  assert.equal(readEdgeForecastComparison(evaluation, 'cam_01', 10).samples, 0);
  assert.equal(readEdgeForecastComparison({ source: 'unknown', points: evaluation.points }, 'cam_01', 5).samples, 0);
});

test('historical forecast chart fills display gaps and scores only original forecast pairs', () => {
  const start = 1_000_020;
  const history = Array.from({ length: 4 }, (_, index) => ({ timestamp: start + index * 60, counts: {} }));
  const aligned = alignForecastComparisonToHistory(history, [
    { timestamp: start - 60, actual: 2, forecast: 99 },
    { timestamp: start, actual: 10, forecast: 12 },
    { timestamp: start + 120, actual: 20, forecast: 17 },
    { timestamp: start + 240, actual: 1, forecast: 99 },
  ]);
  assert.deepEqual(aligned.points, [
    { timestamp: start, predicted: 12, filled: false },
    { timestamp: start + 60, predicted: 14.5, filled: true },
    { timestamp: start + 120, predicted: 17, filled: false },
    { timestamp: start + 180, predicted: null, filled: false },
  ]);
  assert.equal(aligned.samples, 2);
  assert.equal(aligned.filledSamples, 1);
  assert.equal(aligned.mae, 2.5);
  assert.equal(aligned.rmse, Math.sqrt(6.5));
});

test('historical forecast chart leaves edges without real forecasts empty and fills internal gaps', () => {
  const start = 1_000_020;
  const history = Array.from({ length: 5 }, (_, index) => ({ timestamp: start + index * 60, counts: {} }));
  const aligned = alignForecastComparisonToHistory(history, [
    { timestamp: start + 60, actual: 10, forecast: 12 },
    { timestamp: start + 180, actual: 20, forecast: 18 },
  ]);
  assert.deepEqual(aligned.points.map(point => point.predicted), [null, 12, 15, 18, null]);
  assert.deepEqual(aligned.points.map(point => point.filled), [false, false, true, false, false]);
  assert.equal(aligned.samples, 2);
  assert.equal(aligned.filledSamples, 1);
});

test('forecast comparison can populate five independent camera panels at one shared horizon', () => {
  assert.equal(MINUTE_CAMERA_IDS.length, 5);
  const evaluation = { source: 'observed_only_visible_count', points: { '15': [
    { target_minute: '1970-01-12T13:46:00Z', observed_counts: Object.fromEntries(MINUTE_CAMERA_IDS.map((id, i) => [id, 10 + i])),
      forecast_counts: Object.fromEntries(MINUTE_CAMERA_IDS.map((id, i) => [id, 11 + i * 2])) },
  ] } };
  const panels = MINUTE_CAMERA_IDS.map(id => readEdgeForecastComparison(evaluation, id, 15));
  assert.equal(panels.length, 5);
  assert.ok(panels.every(panel => panel.samples === 1));
  assert.deepEqual(panels.map(panel => panel.mae), [1, 2, 3, 4, 5]);
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

test('combined chart holds the latest valid forecast through transient readiness loss and drops expired points', () => {
  const valid = readEdgeMinuteForecast(payload(), now);
  assert.equal(valid.ready, true);
  const transientInvalid = readEdgeMinuteForecast({ ...payload(), status: { ...status(), weather_status: 'unavailable' } }, now);
  assert.equal(transientInvalid.ready, false);

  const held = selectDisplayMinuteForecast(transientInvalid, valid, 1_030);
  assert.equal(held.held, true);
  assert.equal(held.forecast.issuedAt, valid.issuedAt);
  assert.equal(held.points.length, 29);
  assert.ok(held.points.every(point => point.timestamp > 1_030));

  const live = selectDisplayMinuteForecast(valid, valid, 1_030);
  assert.equal(live.held, false);
  assert.equal(live.forecast.issuedAt, valid.issuedAt);

  const expired = selectDisplayMinuteForecast(transientInvalid, valid, 3_000);
  assert.equal(expired.forecast, null);
  assert.deepEqual(expired.points, []);
  assert.equal(expired.held, false);
});
