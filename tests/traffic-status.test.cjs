const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, overrides = {}) {
  const exports = {};
  const context = { exports, Date, console, structuredClone, require: name => name.startsWith('.')
    ? load(path.relative(root, path.resolve(root, path.dirname(file), name + '.ts')), overrides) : require(name), ...overrides };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context, { filename: file });
  return exports;
}
const status = load('src/lib/traffic-status.ts');
const constants = load('src/lib/constants.ts');
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
  assert.equal(status.cameraView(r, now).text, 'Kẹt xe');
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
  assert.equal(routes.find(r => r.id === 'dien_bien_phu').status, 'Kẹt xe');
  assert.equal(routes.find(r => r.id === 'dien_bien_phu').vehicleCount, 24);
  const absent = routes.find(r => r.id === 'xo_viet_nghe_tinh');
  assert.equal(absent.hasData, false); assert.equal(absent.status, 'Chưa đủ dữ liệu');
});
test('camera 5 is an active AI input and contributes to the XVNT route', () => {
  const routes = status.buildRouteStats({ cam_05: record() }, now);
  const xvnt = routes.find(r => r.id === 'xo_viet_nghe_tinh');
  assert.equal(xvnt.vehicleCount, 12);
  assert.equal(xvnt.status, 'Kẹt xe');
  assert.equal(status.ACTIVE_CAMERA_IDS.length, 5);
  assert.ok(status.ACTIVE_CAMERA_IDS.includes('cam_05'));
  assert.ok(!status.ACTIVE_CAMERA_IDS.includes('cam_06'));
  assert.ok(!status.ACTIVE_CAMERA_IDS.includes('cam_07'));
  const camera5 = constants.CAMERAS.find(c => c.id === 'cam_05');
  assert.match(camera5.url, /ImageHandler\.ashx\?id=5d9ddd49766c880017188c94/);
  assert.ok(!camera5.url.includes('expandcameraplayer'));
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
  await intervals[1]();
  assert.equal(events.find(e => e.path === '/system').data.status.last_heartbeat, 999);
  cleanup();
});
