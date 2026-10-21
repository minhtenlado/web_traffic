const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const dir = path.join(os.homedir(), '.config', 'traffic-light');
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const file = path.join(dir, 'auth.json');
if (!fs.existsSync(file)) {
  const password = crypto.randomBytes(18).toString('base64url');
  const salt = crypto.randomBytes(16).toString('hex');
  const account = { id: 'U00', username: 'phanhuynh', fullName: 'Phan Huỳnh Văn Đô', email: '', role: 'admin', salt,
    hash: crypto.scryptSync(password, salt, 64).toString('hex') };
  fs.writeFileSync(file, JSON.stringify({ secret: crypto.randomBytes(32).toString('hex'), users: [account] }), { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'access.txt'), `Username: phanhuynh\nPassword: ${password}\n`, { mode: 0o600 });
}
const lines = [`TRAFFIC_AUTH_FILE=${file}`, `FIREBASE_ADMIN_KEY_PATH=${path.join(process.cwd(), 'trafic-42620-firebase-adminsdk-fbsvc-f91ac01927.json')}`];
const env = '.env.local';
const previous = fs.existsSync(env) ? fs.readFileSync(env, 'utf8').split('\n').filter((line) => !/^(TRAFFIC_AUTH_FILE|FIREBASE_ADMIN_KEY_PATH)=/.test(line)) : [];
fs.writeFileSync(env, [...previous,...lines,''].join('\n'), { mode: 0o600 });
fs.chmodSync(env, 0o600);
console.log('Auth provisioned. Credentials:', path.join(dir, 'access.txt'));
