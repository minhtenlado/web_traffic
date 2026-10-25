const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');

function loadAuth() {
  const records = {};
  const salt = 'static-account-salt';
  const password = 'correct horse battery staple';
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const config = {
    secret: 'a'.repeat(48),
    users: [{ id: 'admin-1', username: 'admin', fullName: 'Admin', email: '', role: 'admin', salt, hash }],
  };
  const rootPath = 'system/webAdminUsers';
  const snapshot = (value) => ({
    val: () => value,
    forEach(callback) {
      for (const [key, childValue] of Object.entries(value || {})) {
        if (callback({ key, val: () => childValue }) === true) break;
      }
    },
  });
  const database = () => ({ ref(path) {
    const getValue = () => path === rootPath ? records : records[path.slice(`${rootPath}/`.length)];
    return {
      get: async () => snapshot(getValue()),
      transaction: async (update) => {
        const current = getValue() ?? null;
        const next = update(current);
        if (next === undefined) return { committed: false, snapshot: snapshot(current) };
        records[path.slice(`${rootPath}/`.length)] = next;
        return { committed: true, snapshot: snapshot(next) };
      },
    };
  } });
  const source = fs.readFileSync('src/lib/server/auth.ts', 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(js, {
    exports: module.exports,
    require: (name) => {
      if (name === './firebase') return { database };
      if (name === 'next/headers') return { cookies: async () => ({ get: () => undefined }) };
      return require(name);
    },
    process: { env: { TRAFFIC_AUTH_JSON: JSON.stringify(config) } },
    Buffer, Date, JSON, Map, Number, Object, Promise, String, Uint8Array,
  }, { filename: 'src/lib/server/auth.ts' });
  return { api: module.exports, records, password };
}

test('admin-created operator is stored hashed, listed, and can log in', async () => {
  const { api, records } = loadAuth();
  const created = await api.createOperatorAccount({
    username: 'operator_01', fullName: 'Nhân viên trực', email: 'operator@example.test',
    password: 'initial password 123',
  });
  assert.equal(created.role, 'operator');
  assert.equal(created.username, 'operator_01');
  const stored = Object.values(records)[0];
  assert.equal(stored.password, undefined);
  assert.match(stored.hash, /^[a-f0-9]{128}$/);
  assert.notEqual(stored.hash, 'initial password 123');
  const authenticated = await api.authenticate('operator_01', 'initial password 123');
  assert.equal(authenticated.role, 'operator');
  assert.equal(await api.authenticate('operator_01', 'wrong password'), null);
  const listed = await api.configuredUsers();
  assert.equal(listed.length, 2);
  assert.equal(listed.find((user) => user.username === 'operator_01').id, created.id);
  assert.equal(Object.hasOwn(listed.find((user) => user.username === 'operator_01'), 'hash'), false);
});

test('operator creation rejects usernames already configured or stored', async () => {
  const { api } = loadAuth();
  const input = { username: 'admin', fullName: 'Duplicate', email: '', password: 'initial password 123' };
  await assert.rejects(api.createOperatorAccount(input), (error) => error.name === 'AccountExistsError');
  await api.createOperatorAccount({ ...input, username: 'operator_02' });
  await assert.rejects(api.createOperatorAccount({ ...input, username: 'operator_02' }), (error) => error.name === 'AccountExistsError');
});

test('existing server-configured admin credentials remain valid', async () => {
  const { api, password } = loadAuth();
  const user = await api.authenticate('admin', password);
  assert.equal(user.id, 'admin-1');
  assert.equal(user.role, 'admin');
});
