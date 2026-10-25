const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadAudit(initial = {}) {
  const records = { ...initial };
  let nextId = 0;
  const makeSnapshot = () => ({
    forEach(callback) {
      for (const [key, value] of Object.entries(records)) {
        if (callback({ key, val: () => value }) === true) break;
      }
    },
  });
  const database = () => ({ ref(path) {
    assert.equal(path, 'system/auditLog');
    return {
      push: async (value) => { records[`new-${++nextId}`] = value; },
      get: async () => makeSnapshot(),
      child: (key) => ({ remove: async () => { delete records[key]; } }),
    };
  } });
  const source = fs.readFileSync('src/lib/server/audit.ts', 'utf8');
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, { exports: module.exports, require: (name) => {
    if (name === './firebase') return { database };
    return require(name);
  }, Date, Math, Number, Object, Promise, String }, { filename: 'src/lib/server/audit.ts' });
  return { api: module.exports, records };
}

test('audit reads sort and cap records without requiring a Firebase ordered index', async () => {
  const { api } = loadAudit({
    older: { timestamp: 100, action: 'old' },
    newest: { timestamp: 300, action: 'new' },
    middle: { timestamp: 200, action: 'middle' },
  });
  const events = await api.readRecentAuditEvents(2);
  assert.equal(Array.from(events, (event) => event.action).join(','), 'new,middle');
});

test('audit append records actor and removes excess oldest records', async () => {
  const initial = Object.fromEntries(Array.from({ length: 501 }, (_, index) => [
    `event-${index}`, { timestamp: index + 1, action: `event-${index}` },
  ]));
  const { api, records } = loadAudit(initial);
  const request = new Request('https://example.test/api/auth', { headers: { 'x-real-ip': '192.0.2.10' } });
  await api.appendAuditEvent(request, { id: 'admin-1', username: 'admin', fullName: 'Admin', role: 'admin' }, 'auth', 'Đăng nhập');
  assert.equal(Object.keys(records).length, 500);
  assert.equal(records['event-0'], undefined);
  const latest = Object.values(records).find((value) => value.action === 'Đăng nhập');
  assert.equal(latest.actor.id, 'admin-1');
  assert.equal(latest.ip, '192.0.2.10');
  assert.equal(latest.source, 'web_admin');
});
