const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, overrides = {}) {
  const exports = {};
  const context = { exports, Date, console, structuredClone, require: name => overrides.modules?.[name] || (name.startsWith('.')
    ? load(path.relative(root, path.resolve(root, path.dirname(file), name + '.ts')), overrides) : require(name)), ...overrides };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context, { filename: file });
  return exports;
}
const status = load('src/lib/traffic-status.ts');
const constants = load('src/lib/constants.ts');
const hardware = load('src/lib/hardware-telemetry.ts');
const now = 1000000;
function record(label = 'Ket_xe') {
  const counts = { Duong_vang: 0, Binh_thuong: 0, Dong_xe: 0, Sap_ket: 0, Ket_xe: 0 };
  counts[label] = 10;
  return { status: 'ONLINE', last_update: 990, valid_until: 1035, count: 12, mapped_label: label, mapped_idx: 4,
    aggregation: { label, window_size: 10, sample_count: 10, counts, status: 'READY', winner_votes: 10 } };
}
test('eight votes shows stable label even when raw label differs', () => {
  const r = record(); r.raw_mapped_label = 'Duong_vang';
  r.aggregation.counts = { ...r.aggregation.counts, Ket_xe: 8, Duong_vang: 2 };
  assert.equal(status.cameraView(r, now).text, 'Rất đông');
});
test('missing, cached, future and invalid camera cannot look online/free-flow', () => {
  for (const r of [undefined, { status: 'ONLINE' }, { ...record(), last_update: 940 },
    { ...record(), last_update: 1010 }, { ...record(), status: 'ERROR' }, { ...record(), valid_until: 999 }]) {
    assert.equal(status.cameraView(r, now).fresh, false);
    assert.equal(status.cameraView(r, now).label, null);
    assert.equal(status.cameraView(r, now).count, null);
  }
});
test('warmup exposes fresh count but no inferred state; malformed histogram is rejected', () => {
  const r = record(); r.aggregation.sample_count = 8; r.aggregation.status = 'COLLECTING';
  const v = status.cameraView(r, now);
  assert.equal(v.fresh, true); assert.equal(v.count, 12); assert.equal(v.ready, false);
  assert.match(v.text, /8\/10/);
  const bad = record(); bad.aggregation.counts.Ket_xe = 11;
  assert.equal(status.cameraView(bad, now).ready, false);
});
test('routes agree with stabilized cameras and absent XVNT is unknown', () => {
  const routes = status.buildRouteStats({ cam_01: record('Duong_vang'), cam_02: record(), cam_04: record('Dong_xe') }, now);
  assert.equal(routes.find(r => r.id === 'dien_bien_phu').status, 'Rất đông');
  assert.equal(routes.find(r => r.id === 'dien_bien_phu').vehicleCount, 24);
  const absent = routes.find(r => r.id === 'xo_viet_nghe_tinh');
  assert.equal(absent.hasData, false); assert.equal(absent.status, 'Chưa đủ dữ liệu');
});
test('camera 5 is an active AI input and contributes to the XVNT route', () => {
  const routes = status.buildRouteStats({ cam_05: record() }, now);
  const xvnt = routes.find(r => r.id === 'xo_viet_nghe_tinh');
  assert.equal(xvnt.vehicleCount, 12);
  assert.equal(xvnt.status, 'Rất đông');
  assert.equal(status.ACTIVE_CAMERA_IDS.length, 5);
  assert.ok(status.ACTIVE_CAMERA_IDS.includes('cam_05'));
  assert.ok(!status.ACTIVE_CAMERA_IDS.includes('cam_06'));
  assert.ok(!status.ACTIVE_CAMERA_IDS.includes('cam_07'));
  const camera5 = constants.CAMERAS.find(c => c.id === 'cam_05');
  assert.match(camera5.url, /ImageHandler\.ashx\?id=5d9ddd49766c880017188c94/);
  assert.ok(!camera5.url.includes('expandcameraplayer'));
});
test('fresh Genio inference exposes its own count and edge class without treating it as legacy ground truth', () => {
  const payload = { generated_at: 999, status: { online: true } };
  const record = { status: 'fresh', observed_at: 998, vehicle_count: 13, label: 'Khong_ket',
    label_source: 'yolo_classification_unverified' };
  assert.equal(status.edgePayloadIsFresh(payload, 1_000_000), true);
  const view = status.edgeCameraView(record, true, 1_000_000);
  assert.equal(view.fresh, true);
  assert.equal(view.count, 13);
  assert.equal(view.labelInfo.text, 'Thông thoáng');
  assert.match(view.labelSource, /unverified/);
  assert.equal(status.cameraView(record, 1_000_000).fresh, false);
});
test('Genio classifier display labels preserve legacy classes and IDs', () => {
  const expected = { Khong_ket: 'Thông thoáng', Dong: 'Trung bình', Ket_nhe: 'Đông đúc', Ket_nang: 'Rất đông' };
  for (const [legacy, text] of Object.entries(expected)) {
    const view = status.edgeCameraView({ status: 'fresh', observed_at: 999, vehicle_count: 4, label: legacy }, true, 1_000_000);
    assert.equal(view.label, legacy);
    assert.equal(view.labelInfo.text, text);
  }
});
test('stable Genio state is selected only in display mode and unknown never falls back to raw', () => {
  const stable = { mode: 'display', data_status: 'VALID', data_valid: true, stable_state: 'Ket_nhe',
    stable_confidence: 0.82, last_valid_timestamp: 998, observation_age_seconds: 2 };
  const live = status.edgeCameraView({ status: 'unavailable', vehicle_count: 13, label: 'Ket_nang',
    classification_stability: stable }, true, 1_000_000);
  assert.equal(live.fresh, true);
  assert.equal(live.label, 'Ket_nhe');
  assert.equal(live.labelInfo.text, 'Đông đúc');
  assert.equal(live.rawLabel, 'Ket_nang');
  const unknown = status.edgeCameraView({ status: 'fresh', observed_at: 999, vehicle_count: 13, label: 'Ket_nang',
    classification_stability: { ...stable, data_status: 'STALE', data_valid: false, stable_state: null } }, true, 1_000_000);
  assert.equal(unknown.label, null);
  assert.equal(unknown.labelInfo, null);
  const shadow = status.edgeCameraView({ status: 'fresh', observed_at: 999, vehicle_count: 13, label: 'Ket_nang',
    classification_stability: { ...stable, mode: 'shadow' } }, true, 1_000_000);
  assert.equal(shadow.label, 'Ket_nang');
  assert.equal(shadow.labelInfo.text, 'Rất đông');
});
test('Genio camera output becomes stale on old, future or offline payloads', () => {
  const nowMs = 1_000_000;
  const current = { status: 'fresh', observed_at: 999, vehicle_count: 13, label: 'Ket_nang' };
  assert.equal(status.edgeCameraView(current, false, nowMs).fresh, false);
  const reused = status.edgeCameraView({ ...current, status: 'reused' }, true, nowMs);
  assert.equal(reused.fresh, true); assert.equal(reused.newObservation, false);
  assert.equal(status.edgeCameraView({ ...current, observed_at: 900 }, true, nowMs).fresh, false);
  assert.equal(status.edgeCameraView({ ...current, observed_at: 1001 }, true, nowMs).available, false);
  const badLabel = status.edgeCameraView({ ...current, label: 'not-a-class' }, true, nowMs);
  assert.equal(badLabel.fresh, true);
  assert.equal(badLabel.label, null);
  assert.equal(badLabel.count, 13);
});
test('alerts use stabilized state, persist acknowledgement and resolve with condition', () => {
  const alerts = status.buildCameraAlerts({ cam_01: record() }, [], now);
  assert.equal(alerts.length, 1);
  alerts[0].acknowledged = true;
  assert.equal(status.buildCameraAlerts({ cam_01: record() }, alerts, now)[0].acknowledged, true);
  assert.equal(status.buildCameraAlerts({ cam_01: record('Duong_vang') }, alerts, now).length, 0);
  const stale = status.buildCameraAlerts({ cam_01: record() }, alerts, now + 50000);
  assert.equal(stale.length, 1); assert.equal(stale[0].type, 'camera_error');
});
test('Genio telemetry uses its sampled timestamp and expires instead of refreshing on Firebase receipt', () => {
  const sampledAt = Date.parse('2026-10-25T15:40:00.000Z');
  const sample = hardware.genioTelemetry({ echoTimestamp: sampledAt / 1000 + 2, sampleAgeMs: 2000,
    temperatureC: 46.8, cpuPercent: 20.2, ramPercent: 25.6, dataUsedPercent: 30.6, linuxUptimeSeconds: 1180 });
  assert.equal(sample.observedAt, sampledAt);
  assert.equal(sample.temperature, 46.8);
  assert.equal(sample.source, 'Genio 350 · GINFO qua UART STM32');
  assert.equal(hardware.telemetryIsFresh(sample, sampledAt + 19000), true);
  assert.equal(hardware.telemetryIsFresh(sample, sampledAt + 21000), false);
  assert.equal(hardware.genioTelemetry({ echoTimestamp: sampledAt / 1000, sampleAgeMs: -1, temperatureC: 38 }), null);
});
test('SSE nested camera patches, deletes and system polling normalize full immutable snapshots', async () => {
  let source; const intervals = []; const events = [];
  class FakeSource {
    constructor() { this.listeners = {}; source = this; }
    addEventListener(event, callback) { this.listeners[event] = callback; }
    close() {}
  }
  const firebase = load('src/lib/firebase.ts', {
    window: {}, EventSource: FakeSource, setInterval: f => (intervals.push(f), intervals.length), clearInterval() {}, setTimeout() {},
    fetch: async url => ({ ok: true, json: async () => url.includes('path=system') ? { status: { online: true, last_heartbeat: 999 } } : {} }),
  });
  const cleanup = firebase.initUnifiedFirebase((path, data) => events.push({ path, data }));
  const emit = (kind, path, data) => source.listeners[kind]({ data: JSON.stringify({ path, data }) });
  emit('put', '/', { realtime: { cam_01: record() } });
  const first = events.at(-1);
  emit('patch', '/realtime/cam_01', { 'aggregation/counts/Ket_xe': 8, 'aggregation/counts/Duong_vang': 2 });
  assert.equal(events.at(-1).path, '/realtime');
  assert.equal(events.at(-1).data.cam_01.aggregation.counts.Ket_xe, 8);
  assert.equal(first.data.realtime.cam_01.aggregation.counts.Ket_xe, 10);
  emit('put', '/realtime/cam_01', null);
  assert.equal('cam_01' in events.at(-1).data, false);
  emit('put', '/traffic/edgeAI', edgePayload({ cam_01: stableCamera() }));
  emit('patch', '/traffic', { edgeAI: null });
  assert.equal(events.at(-1).path, '/traffic/edgeAI');
  assert.equal(events.at(-1).data, null);
  await intervals[1]();
  assert.equal(events.find(e => e.path === '/system').data.status.last_heartbeat, 999);
  cleanup();
});

const stableCamera = (label = 'Ket_nhe', at = 998) => ({ status: 'fresh', observed_at: at, vehicle_count: 13, label: 'Ket_nang',
  classification_stability: { mode: 'display', data_status: 'VALID', data_valid: true,
    stable_state: label, last_valid_timestamp: at, observation_age_seconds: 2 } });
const edgePayload = (cameras) => ({ generated_at: 999, status: { online: true }, cameras });
test('stable label expiry is evaluated locally and cannot revive a stale detector count', () => {
  const r = stableCamera();
  const old = { ...r, classification_stability: { ...r.classification_stability, last_valid_timestamp: 900 } };
  const view = status.edgeCameraView(old, true, now);
  assert.equal(view.label, null); assert.equal(view.count, 13);
  const labelOnly = status.edgeCameraView({ ...r, status: 'unavailable', observed_at: undefined }, true, now);
  assert.equal(labelOnly.label, 'Ket_nhe'); assert.equal(labelOnly.count, null);
  assert.equal(status.edgeCameraView(r, false, now).label, null);
});
test('all camera views, routes and alerts prefer current edge data and share the four labels', () => {
  const legacy = { cam_01: record(), cam_05: record() };
  const edge = edgePayload({ cam_01: stableCamera('Dong') });
  const v = status.selectedCameraView('cam_01', legacy, edge, now);
  assert.equal(v.source, 'edge'); assert.equal(v.label, 'Dong'); assert.equal(v.text, 'Trung bình');
  const routes = status.buildRouteStats(legacy, now, edge);
  assert.equal(routes.find(r => r.id === 'hang_xanh').status, 'Trung bình');
  assert.equal(routes.find(r => r.id === 'hang_xanh').vehicleCount, 13);
  assert.equal(routes.find(r => r.id === 'xo_viet_nghe_tinh').hasData, false);
  const alerts = status.buildCameraAlerts(legacy, [], now, edge);
  assert.equal(alerts.some(a => a.id === 'alert-cam_01-cong'), false);
  assert.equal(alerts.some(a => a.id === 'alert-cam_05-err'), true);
  for (const state of ['Khong_ket', 'Dong', 'Ket_nhe', 'Ket_nang']) {
    const e = edgePayload({cam_01: stableCamera(state)});
    assert.equal(status.buildRouteStats({}, now, e).find(r => r.id === 'hang_xanh').status, status.EDGE_TRAFFIC_LABELS[state].text);
  }
});
test('display warmup, stale payload and removed edge camera cannot fall back to legacy or raw labels', () => {
  const r = stableCamera(); r.classification_stability.data_valid = false;
  const legacy = {cam_01: record()};
  for (const e of [edgePayload({cam_01:r}), edgePayload({}), {}, {...edgePayload({cam_01:stableCamera()}), generated_at:900}]) {
    assert.equal(status.selectedCameraView('cam_01', legacy, e, now).label, null);
    assert.equal(status.buildRouteStats(legacy, now, e).find(r=>r.id==='hang_xanh').hasStatus, false);
  }
});
test('legacy display translates by original model semantics while retaining legacy keys', () => {
  const mapping = {Duong_vang:'Thông thoáng', Binh_thuong:'Thông thoáng', Dong_xe:'Trung bình', Sap_ket:'Đông đúc', Ket_xe:'Rất đông'};
  for (const [key,text] of Object.entries(mapping)) {
    const input = record(key);
    assert.equal(status.selectedCameraView('cam_01', {cam_01:input}, null, now).text,text);
    assert.equal(input.mapped_label,key);
  }
});
test('chart timestamps deduplicate reused frames and heartbeat updates, and accept a new observation', () => {
  const r = stableCamera(); let e = edgePayload({cam_01:r});
  let history = status.appendCameraHistory([], {}, e, now);
  assert.equal(history.length,1); assert.equal(history[0].timestamp,998); assert.equal(history[0].hang_xanh,13);
  e = {...e,generated_at:1000,cameras:{cam_01:{...r,status:'reused'}}};
  assert.equal(status.appendCameraHistory(history, {}, e, now).length,1);
  e = {...e,cameras:{cam_01:{...r,observed_at:999,vehicle_count:17}}};
  history = status.appendCameraHistory(history, {}, e, now);
  assert.equal(history.length,2); assert.equal(history[1].hang_xanh,17);
  assert.equal(status.appendCameraHistory(history, {}, {...e,generated_at:900}, now).length,2);
});

test('store synchronizes edge camera totals, routes, alerts and chart without legacy overwrites', async () => {
  let receive;
  class FixedDate extends Date { static now() { return now; } }
  const store = load('src/lib/store.ts', {
    Date: FixedDate,
    fetch: async () => ({ok:true,json:async()=>({acknowledgements:{}})}),
    modules: {'./firebase': {initUnifiedFirebase: callback => { receive = callback; return () => {}; },firebaseGet:async()=>({})}},
  }).useTrafficStore;
  store.getState().initFirebase();
  receive('/', {realtime:{cam_01:record()},traffic:{edgeAI:edgePayload({cam_01:stableCamera('Dong')})}});
  assert.equal(store.getState().metrics.totalVehicles,13);
  assert.equal(store.getState().routeStats.find(r=>r.id==='hang_xanh').status,'Trung bình');
  assert.equal(store.getState().chartHistory.length,1);
  receive('/realtime',{cam_01:record('Ket_xe')});
  assert.equal(store.getState().metrics.totalVehicles,13);
  assert.equal(store.getState().chartHistory.length,1);
  store.getState().tick();
  assert.equal(store.getState().routeStats.find(r=>r.id==='hang_xanh').status,'Trung bình');
  receive('/traffic/edgeAI',edgePayload({cam_01:stableCamera('Ket_nang',999)}));
  assert.equal(store.getState().chartHistory.length,2);
  assert.equal(store.getState().alerts.find(a=>a.id==='alert-cam_01-cong').message,'Camera 1: Rất đông');
  receive('/traffic/edgeAI',null);
  assert.equal(store.getState().metrics.totalVehicles,null);
  assert.equal(store.getState().routeStats.find(r=>r.id==='hang_xanh').hasStatus,false);
  assert.equal(store.getState().isBoardOffline,true);
  await Promise.resolve();
});
