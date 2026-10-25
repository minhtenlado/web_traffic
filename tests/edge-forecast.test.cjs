const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = { exports: {}, Number, Math, Set, Array, Object };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/edge-forecast.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { edgeHistoryProgress, edgeTcnRecovery, groupEdgeForecasts } = context.exports;

test('history progress reports remaining input and clamps displayed progress', () => {
  assert.deepEqual({ ...edgeHistoryProgress({ history_steps: 239, history_required: 720 }) },
    { steps: 239, required: 720, remaining: 481, percent: 33 });
  assert.equal(edgeHistoryProgress({ history_steps: 800, history_required: 720 }).percent, 100);
  assert.deepEqual({ ...edgeHistoryProgress({ history_steps: -1, history_required: 0 }) },
    { steps: 0, required: 0, remaining: 0, percent: 0 });
});

test('groups only supported camera, horizon, class and finite confidence rows', () => {
  const rows = [
    { camera_id: 'cam_01', horizon_minutes: 5, predicted_class: 'Ket_nhe', confidence: 0.82 },
    { camera_id: 'cam_04', horizon_minutes: 30, predicted_class: 'Ket_nang', confidence: 1 },
    { camera_id: 'cam_05', horizon_minutes: 15, predicted_class: 'Dong', confidence: 0.7 },
    { camera_id: 'cam_01', horizon_minutes: 10, predicted_class: 'Dong', confidence: 0.7 },
    { camera_id: 'cam_02', horizon_minutes: 15, predicted_class: 'unknown', confidence: 0.7 },
    { camera_id: 'cam_03', horizon_minutes: 15, predicted_class: 'Dong', confidence: Infinity },
  ];
  const grouped = groupEdgeForecasts(rows);
  assert.equal(grouped[5].length, 1);
  assert.equal(grouped[5][0].predicted_class, 'Ket_nhe');
  assert.equal(grouped[15].length, 0);
  assert.equal(grouped[30].length, 1);
  assert.deepEqual(groupEdgeForecasts(null), { 5: [], 15: [], 30: [] });
});

const readyStatus = {
  tcn_state: 'FORECASTING', history_steps: 720, history_required: 720,
  weather_status: 'AVAILABLE', forecast_status: 'EXPERIMENTAL',
};

test('shows forecasting only with fresh telemetry and a complete valid input history', () => {
  const recovery = edgeTcnRecovery(readyStatus, true);
  assert.equal(recovery.label, 'Đang dự báo');
  assert.equal(recovery.forecastReady, true);
  for (const steps of [0, 719, 721, NaN, Infinity]) {
    assert.equal(edgeTcnRecovery({ ...readyStatus, history_steps: steps }, true).forecastReady, false);
  }
  assert.equal(edgeTcnRecovery({ ...readyStatus, history_required: 0 }, true).forecastReady, false);
  assert.equal(edgeTcnRecovery({ ...readyStatus, weather_status: 'UNAVAILABLE' }, true).forecastReady, false);
  assert.equal(edgeTcnRecovery({ ...readyStatus, forecast_status: 'WAITING_FOR_VALID_HISTORY' }, true).forecastReady, false);
  assert.equal(edgeTcnRecovery(readyStatus, false).forecastReady, false);
  assert.equal(edgeTcnRecovery(null, false).label, 'Chưa đủ dữ liệu');
});

test('recovery and interrupted history override any cached forecast readiness', () => {
  const restoring = edgeTcnRecovery({ ...readyStatus, tcn_state: 'RESTORING', history_reason: 'loading_snapshot' }, true);
  assert.equal(restoring.label, 'Đang khôi phục');
  assert.equal(restoring.forecastReady, false);
  assert.equal(restoring.reason, 'Đang kiểm tra lịch sử đã lưu.');
  const interrupted = edgeTcnRecovery({ ...readyStatus, tcn_state: 'INSUFFICIENT_DATA', history_reason: 'history_gap' }, true);
  assert.equal(interrupted.label, 'Chưa đủ dữ liệu');
  assert.equal(interrupted.forecastReady, false);
  assert.match(interrupted.reason, /gián đoạn/);
  assert.equal(edgeTcnRecovery({ ...readyStatus, tcn_state: 'UNKNOWN' }, true).forecastReady, false);
});

test('legacy telemetry stays compatible without treating stale restore status as current', () => {
  const { tcn_state, ...legacy } = readyStatus;
  assert.equal(edgeTcnRecovery(legacy, true).forecastReady, true);
  const disconnected = edgeTcnRecovery({ ...readyStatus, tcn_state: 'RESTORING' }, false);
  assert.equal(disconnected.state, 'INSUFFICIENT_DATA');
  assert.match(disconnected.reason, /bản tin mới/);
});
