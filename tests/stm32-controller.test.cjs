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
  assert.equal(controller.isControllerOnline({ online: true, lastSeen: 96 }, 100000), false);
});
test('API authenticates, queues by ID, rejects unsupported commands', async () => {
  const writes = []; let authenticated = true;
  const route = load('src/app/api/signal/route.ts', {
    require: (name) => name === 'next/server' ? { NextResponse: { json: (v, init) => new Response(JSON.stringify(v), init) } }
      : name.endsWith('/controller') ? controller
      : name.endsWith('/auth') ? { session: async () => authenticated ? { id: 'test', role: 'admin' } : null, sameOrigin: () => true }
      : { database: () => ({ ref: (url) => ({ transaction: async (callback) => { writes.push({ url, data: callback(null) }); return { committed: true }; } }) }) },
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
  const before = writes.length;
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
    window: {}, EventSource: FakeSource, setInterval: () => 1, clearInterval: () => {},
    setTimeout: () => 1,
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
  cleanup();
});
test('cloud auth uses inline configuration without accessing local files', () => {
  const crypto = require('node:crypto');
  const salt = 'test-salt';
  const account = { id: 'test', username: 'test', fullName: 'Test', email: '', role: 'admin', salt,
    hash: crypto.scryptSync('test-password', salt, 64).toString('hex') };
  const env = { TRAFFIC_AUTH_JSON: JSON.stringify({ secret: 'x'.repeat(32), users: [account] }) };
  const auth = load('src/lib/server/auth.ts', { Buffer, process: { env }, require: (name) =>
    name === 'next/headers' ? { cookies: async () => ({ get: () => null }) } :
    name === 'node:fs' ? { readFileSync: () => { throw new Error('Cloud must not read local files'); } } : require(name) });
  assert.equal(auth.authenticate('test', 'test-password').id, 'test');
  assert.equal(auth.authenticate('test', 'wrong-password'), null);
  assert.equal(auth.authenticate('unknown', 'test-password'), null);
  assert.equal('hash' in auth.authenticate('test', 'test-password'), false);
  assert.ok(auth.sessionToken(auth.authenticate('test', 'test-password')).includes('.'));
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
