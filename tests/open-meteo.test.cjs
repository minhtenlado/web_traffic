const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
function load(file) {
  const exports = {};
  const context = { exports, URLSearchParams, Date, Number, Math, Error };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, context, { filename: file });
  return exports;
}

const weather = load('src/lib/open-meteo.ts');
const sample = {
  utc_offset_seconds: 25200,
  current: {
    time: '2026-10-26T00:15', interval: 900, temperature_2m: 26.3,
    relative_humidity_2m: 88, precipitation: 0, rain: 0,
    weather_code: 2, wind_speed_10m: 8.7,
  },
};

test('Open-Meteo URL requests Hàng Xanh current weather variables and explicit local units', () => {
  const url = new URL(weather.openMeteoCurrentUrl());
  assert.equal(url.searchParams.get('latitude'), '10.801');
  assert.equal(url.searchParams.get('longitude'), '106.714');
  assert.equal(url.searchParams.get('timezone'), 'Asia/Ho_Chi_Minh');
  assert.equal(url.searchParams.get('temperature_unit'), 'celsius');
  assert.equal(url.searchParams.get('current'), 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m');
});

test('current values retain units, observation period and Vietnam timezone offset', () => {
  const parsed = weather.parseOpenMeteoCurrent(sample);
  assert.equal(parsed.temperatureC, 26.3);
  assert.equal(parsed.humidityPercent, 88);
  assert.equal(parsed.precipitationMm, 0);
  assert.equal(parsed.intervalSeconds, 900);
  assert.equal(parsed.windSpeedKmh, 8.7);
  assert.equal(parsed.weatherCode, 2);
  assert.equal(Date.parse(parsed.sourceTime), Date.parse('2026-10-25T17:15:00Z'));
  assert.equal(weather.describeWeatherCode(2), 'Mây rải rác');
  assert.equal(weather.describeWeatherCode(65), 'Có mưa');
});

test('invalid or incomplete observations are rejected instead of filled with defaults', () => {
  for (const payload of [
    {},
    { ...sample, current: { ...sample.current, relative_humidity_2m: 101 } },
    { ...sample, current: { ...sample.current, temperature_2m: null } },
    { ...sample, current: { ...sample.current, interval: -1 } },
  ]) assert.throws(() => weather.parseOpenMeteoCurrent(payload));
});

test('fetch uses the exact endpoint, avoids cached responses, and rejects HTTP errors', async () => {
  let request;
  const parsed = await weather.fetchOpenMeteoCurrent(async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => sample };
  });
  assert.equal(request.url, weather.openMeteoCurrentUrl());
  assert.equal(request.options.cache, 'no-store');
  assert.equal(parsed.humidityPercent, 88);
  await assert.rejects(weather.fetchOpenMeteoCurrent(async () => ({ ok: false, status: 503 })), /503/);
});
