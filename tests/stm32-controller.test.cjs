const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function load(file, overrides = {}) {
  const exports = {};
  const context = { exports, require, Request, Response, AbortSignal, console, structuredClone,
    crypto: require('node:crypto').webcrypto, ...overrides };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, context, { filename: file });
  return exports;
}
const controller = load('src/lib/controller.ts');
function state(mode = 'auto', currentPhase = 'ns_green') {
  return { source: 'STM32', mode, currentPhase, hold: false, countdown: 3,
    phaseDurations: { green: 30, yellow: 3, left: 10, allred: 2 }, timestamp: 123 };
}
test('accepts firmware telemetry; rejects old/invalid state', () => {
  for (const mode of ['auto', 'manual', 'setting', 'emergency']) {
    for (const phase of controller.CONTROLLER_PHASES) assert.equal(controller.isControllerSignal(state(mode, phase)), true);
  }
  for (const invalid of [null, {}, { ...state(), source: 'simulator' },
    { ...state(), currentPhase: 'phase_3' }, { ...state(), countdown: -1 },
    { ...state(), phaseDurations: { green: 100, yellow: 3, left: 10, allred: 2 } }]) {
    assert.equal(controller.isControllerSignal(invalid), false);
  }
});
test('stale/absent status is offline even if cloud still says online', () => {
  assert.equal(controller.isControllerOnline(null, 100000), false);
  assert.equal(controller.isControllerOnline({ online: true, lastSeen: 99 }, 100000), true);
  assert.equal(controller.isControllerOnline({ online: true, lastSeen: 96 }, 100000), true); // tolerate the 8s HTTP fallback
  assert.equal(controller.isControllerOnline({ online: true, lastSeen: 96 }, 100000, 3000), false); // strict command TTL
  assert.equal(controller.isControllerOnline({ online: true, lastSeen: 89 }, 100000), false);
});
test('emergency clear reports the STM32 interlock and unsupported-firmware recovery path', () => {
  assert.match(controller.emergencyCommandFeedback(false, 'REJECTED', 'STM32 từ chối hủy: hãy nhả công tắc KHẨN CẤP vật lý trên mạch rồi thử lại'), /nhả công tắc.*PB4/);
  assert.match(controller.emergencyCommandFeedback(false, 'REJECTED', 'Kết quả thực thi STM32'), /Nhả PB4.*cập nhật firmware.*CLEAR_EMERGENCY/);
  assert.match(controller.emergencyCommandFeedback(false, 'TIMEOUT'), /PB3 giữ 3 giây.*CLEAR_EMERGENCY/);
  assert.match(controller.emergencyCommandFeedback(false, 'APPLIED'), /đã xác nhận hủy.*AUTO/);
});
test('API authenticates, queues by ID, rejects stale control telemetry and unsupported commands', async () => {
  const writes = []; let authenticated = true; let controlStatus = { online: true, controlEnabled: true, lastSeen: Date.now() / 1000 }; let currentMode = 'auto';
  const route = load('src/app/api/signal/route.ts', {
    require: (name) => name === 'next/server' ? { NextResponse: { json: (v, init) => new Response(JSON.stringify(v), init) } }
      : name.endsWith('/controller') ? controller
      : name.endsWith('/auth') ? { session: async () => authenticated ? { id: 'test', role: 'admin' } : null, sameOrigin: () => true }
      : name.endsWith('/audit') ? { appendAuditEvent: async () => {} }
      : { database: () => ({ ref: (url) => ({
        get: async () => ({ val: () => url.endsWith('controllerStatus') ? controlStatus
          : url.endsWith('fuzzyStatus') ? { autoEnabled: false }
          : url.endsWith('signalState') ? { mode: currentMode, timestamp: Math.floor(Date.now() / 1000), localControl: false }
          : url.endsWith('fuzzyControl') ? { mode: 'AUTO' }
          : { mode: currentMode, timestamp: Math.floor(Date.now() / 1000) } }),
        transaction: async (callback) => { writes.push({ url, data: callback(null) }); return { committed: true }; },
      }) }) },
  });
  const request = (body) => new Request('https://localhost/api/signal', { method: 'POST', body: JSON.stringify({ id: 'test-id', timestamp: Date.now(), ...body }) });
  authenticated = false;
  assert.equal((await route.POST(request({ action: 'next' }))).status, 401);
  assert.equal(writes.length, 0);
  authenticated = true;
  for (const body of [{ action: 'set_mode', mode: 'manual' }, { action: 'next' }, { action: 'emergency' }, { action: 'set_duration', phase: 'allred', duration: 2 }]) {
    assert.equal((await route.POST(request(body))).status, 202);
  }
  assert.ok(writes.every((w) => w.url.startsWith('traffic/commands/')));
  assert.ok(writes.every((w) => w.data.actor === 'test' && w.data.status === 'PENDING'));
  controlStatus = { online: true, controlEnabled: true, lastSeen: Date.now() / 1000 };
  assert.equal((await route.POST(request({ action: 'clear_emergency' }))).status, 409);
  currentMode = 'emergency';
  assert.equal((await route.POST(request({ action: 'clear_emergency' }))).status, 202);
  assert.equal(writes.at(-1).data.action, 'clear_emergency');
  currentMode = 'auto';
  const before = writes.length;
  controlStatus = { readOnlyTelemetry: true, controlEnabled: false };
  assert.equal((await route.POST(request({ action: 'next' }))).status, 423);
  assert.equal(writes.length, before);
  controlStatus = { online: true, controlEnabled: true, lastSeen: Date.now() / 1000 - 4 };
  assert.equal((await route.POST(request({ action: 'next' }))).status, 423);
  assert.equal(writes.length, before);
  controlStatus = { online: true, controlEnabled: true, lastSeen: Date.now() / 1000 };
  for (const body of [{ action: 'override' }, { action: 'set_free_flush' }, { action: 'set_mode', mode: 'invalid' }, { action: 'set_duration', phase: 'left', duration: 31 }, { action: 'next', timestamp: 1 }]) {
    assert.equal((await route.POST(request(body))).status, 400);
  }
  assert.equal(writes.length, before);
});
test('Firebase nested put/patch events produce complete telemetry snapshots', () => {
  let source;
  class FakeSource {
    constructor() { this.listeners = {}; source = this; }
    addEventListener(event, callback) { this.listeners[event] = callback; }
    close() {}
  }
  const events = [];
  const firebase = load('src/lib/firebase.ts', {
    window: {}, document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    EventSource: FakeSource, setInterval: () => 1, clearInterval: () => {}, setTimeout: () => 1, clearTimeout: () => {},
  });
  const cleanup = firebase.initUnifiedFirebase((path, data) => events.push({ path, data }));
  source.listeners.put({ data: JSON.stringify({ path: '/', data: { traffic: { signalState: state() } } }) });
  source.listeners.patch({ data: JSON.stringify({ path: '/traffic', data: { 'signalState/countdown': 2 } }) });
  const update = events.at(-1);
  assert.equal(update.path, '/traffic/signalState');
  assert.equal(controller.isControllerSignal(update.data), true);
  assert.equal(update.data.countdown, 2);
  source.listeners.put({ data: JSON.stringify({ path: '/traffic/signalState/countdown', data: 1 }) });
  assert.equal(events.at(-1).data.countdown, 1);
  assert.equal(update.data.countdown, 2); // previous store snapshot is immutable
  const edge = { schema_version: 1, source: 'genio350-production-edge', generated_at: 100,
    status: { online: true, validation_status: 'experimental_unvalidated' }, weather: null, cameras: {}, forecasts: [] };
  source.listeners.put({ data: JSON.stringify({ path: '/traffic/edgeAI', data: edge }) });
  assert.equal(events.at(-1).path, '/traffic/edgeAI');
  assert.equal(events.at(-1).data.source, 'genio350-production-edge');
  cleanup();
});
test('cloud auth uses inline configuration without accessing local files', async () => {
  const crypto = require('node:crypto');
  const salt = 'test-salt';
  const account = { id: 'test', username: 'test', fullName: 'Test', email: '', role: 'admin', salt,
    hash: crypto.scryptSync('test-password', salt, 64).toString('hex') };
  const env = { TRAFFIC_AUTH_JSON: JSON.stringify({ secret: 'x'.repeat(32), users: [account] }) };
  const auth = load('src/lib/server/auth.ts', { Buffer, process: { env }, require: (name) =>
    name === 'next/headers' ? { cookies: async () => ({ get: () => null }) } :
    name === './firebase' ? { database: () => ({ ref: () => ({ get: async () => ({ val: () => null }) }) }) } :
    name === 'node:fs' ? { readFileSync: () => { throw new Error('Cloud must not read local files'); } } : require(name) });
  const authenticated = await auth.authenticate('test', 'test-password');
  assert.equal(authenticated.id, 'test');
  assert.equal(await auth.authenticate('test', 'wrong-password'), null);
  assert.equal(await auth.authenticate('unknown', 'test-password'), null);
  assert.equal('hash' in authenticated, false);
  assert.ok(auth.sessionToken(authenticated).includes('.'));
});
test('cloud Firebase uses inline credentials without accessing local files', () => {
  let options;
  const firebase = load('src/lib/server/firebase.ts', {
    process: { env: { FIREBASE_ADMIN_KEY_JSON: JSON.stringify({ project_id: 'test-project' }) } },
    require: (name) => name === 'firebase-admin/app' ? {
      getApps: () => [], cert: (value) => value, initializeApp: (value) => { options = value; return 'test-app'; },
    } : name === 'firebase-admin/database' ? { getDatabase: (app) => app } : {
      readFileSync: () => { throw new Error('Cloud must not read local files'); },
    },
  });
  assert.equal(firebase.database(), 'test-app');
  assert.equal(options.credential.project_id, 'test-project');
});
test('data API batches allowed paths in one response and keeps auth and the allow-list', async () => {
  let authenticated = true; const reads = [];
  const values = { realtime: { cam_01: { vehicle_count: 3 } }, 'traffic/signalState': state(),
    'system/hardware': { cpu: 1 }, 'system/status': { online: true }, 'system/board_status': null,
    'system/alertAcknowledgements': { a1: { acknowledgedAt: 5, actor: { id: 'secret', name: 'Hidden' } } } };
  const serverFirebase = load('src/lib/server/firebase.ts', { require: (name) => name === 'node:fs' ? {} : require(name) });
  const route = load('src/app/api/data/route.ts', {
    URL, require: (name) => name.endsWith('/auth') ? { session: async () => authenticated ? { id: 'test', role: 'viewer' } : null }
      : { publicAcknowledgements: serverFirebase.publicAcknowledgements, database: () => ({ ref: (url) => ({
        get: async () => { reads.push(url); if (url === 'traffic/edgeAI') throw new Error('read failed'); return { val: () => values[url] ?? null }; },
      }) }) },
  });
  const get = (query) => route.GET(new Request(`https://example.test/api/data?${query}`));
  const batch = await get('paths=realtime,system,traffic/signalState,traffic/edgeAI');
  assert.equal(batch.status, 200);
  assert.equal(batch.headers.get('Cache-Control'), 'no-store');
  const body = await batch.json();
  assert.deepEqual(Object.keys(body), ['realtime', 'system', 'traffic/signalState']); // failed read is left out
  assert.equal(body.realtime.cam_01.vehicle_count, 3);
  assert.deepEqual(body.system.alertAcknowledgements, { a1: { acknowledgedAt: 5 } }); // actor never leaves the server
  assert.equal(body['traffic/signalState'].countdown, 3);
  assert.equal((await get('path=traffic/signalState').then((response) => response.json())).countdown, 3);
  const readsBefore = reads.length;
  assert.equal((await get('paths=realtime,traffic/commands')).status, 403);
  assert.equal((await get('paths=')).status, 403);
  assert.equal((await get('path=traffic/commands')).status, 403);
  assert.equal(reads.length, readsBefore); // nothing is read for a rejected request
  assert.equal((await get('paths=traffic/edgeAI')).status, 502);
  authenticated = false;
  assert.equal((await get('paths=realtime')).status, 401);
});
