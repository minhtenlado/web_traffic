const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = { exports: {}, Number, Math, Object, Array, Map, Date, String, RegExp };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/history-range.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { historyStartKey, historyHourKey, historyWindow, flattenHistoryBuckets, parseHistoryResponse, historyRangeSeries,
  historyDayKey, historyDayStart, historyDays, HISTORY_RANGE_HOURS, HISTORY_FULL_DAY, HISTORY_KEEP_DAYS } = context.exports;

test('range options and Vietnam-time hour keys', () => {
  assert.deepEqual([...HISTORY_RANGE_HOURS], [2, 4, 8, 12]);
  assert.equal(HISTORY_FULL_DAY, 24);
  const now = Date.UTC(2026, 10, 22, 8, 30); // 15:30 +07
  assert.equal(historyStartKey(now, 2), 'h2026112213');
  assert.equal(historyStartKey(now, 12), 'h2026112203');
});

test('flatten keeps only well-formed rows inside the window', () => {
  const buckets = {
    h2026112214: { m00: { t: 1000, s: 'ooooo', c: { cam_01: 5, cam_02: -1 }, p: { h1: { cam_01: 6 }, x9: { cam_01: 1 } } },
      m01: { t: 1060, p: { h5: { cam_01: 7 } } }, m02: { t: 5000, c: { cam_01: 1 } }, bad: { t: 1100, c: { cam_01: 1 } } },
    junk: { m00: { t: 1001, c: { cam_01: 2 } } },
  };
  const rows = flattenHistoryBuckets(buckets, 900, 2000);
  assert.deepEqual(rows.map(row => row.t), [1000, 1060]);
  assert.deepEqual({ ...rows[0].c }, { cam_01: 5 });
  assert.deepEqual(Object.keys(rows[0].p), ['h1']);
  assert.deepEqual(parseHistoryResponse({ rows: [{ t: 7 }, { t: 5, c: { cam_01: 1 } }] }).map(row => row.t), [5]);
});

test('series break at gaps and metrics use observed minutes only', () => {
  const rows = [
    { t: 1000, s: 'ooooo', c: { cam_01: 10 }, p: { h5: { cam_01: 12 } } },
    { t: 1060, s: 'iiiii', c: { cam_01: 20 }, p: { h5: { cam_01: 50 } } },
    { t: 1300, s: 'ooooo', c: { cam_01: 8 }, p: { h5: { cam_01: 5 } } },
  ];
  const series = historyRangeSeries(rows, 'cam_01', 0, 5);
  assert.deepEqual(series.actual.map(p => p.value), [10, 20, null, 8]);
  assert.equal(series.actual[2].timestamp, 1120);
  assert.equal(series.samples, 2);
  assert.equal(series.mae, 2.5);
  assert.equal(Math.round(series.rmse * 1000) / 1000, Math.round(Math.sqrt((4 + 9) / 2) * 1000) / 1000);
  assert.equal(historyRangeSeries(rows, 'cam_01', 0, 30).samples, 0);
});

test('history is kept per calendar day: today and the 2 previous days, 00:00–23:59', () => {
  assert.equal(HISTORY_KEEP_DAYS, 3);
  const now = Date.UTC(2026, 10, 22, 17, 30); // 23/11 00:30 +07 — already the next day in Vietnam
  assert.equal(historyDayKey(now), '2026-11-23');
  assert.equal(historyDayStart('2026-11-23'), Date.UTC(2026, 10, 22, 17) / 1000);
  assert.equal(historyDayStart('2026-02-30'), null);
  assert.equal(historyDayStart('23/11/2026'), null);
  const days = historyDays(now);
  assert.deepEqual(days.map(day => day.key), ['2026-11-23', '2026-11-22', '2026-11-21']);
  assert.deepEqual(days.map(day => day.label), ['Hôm nay · 23/11', 'Hôm qua · 22/11', '21/11']);
  const yesterday = historyWindow(now, 2, '2026-11-22');
  assert.equal(yesterday.from, historyDayStart('2026-11-22'));
  assert.equal(yesterday.to, historyDayStart('2026-11-22') + 86399); // through 23:59:59
  assert.equal(yesterday.startKey, 'h2026112200');
  assert.equal(yesterday.endKey, 'h2026112223');
  assert.equal(historyWindow(now, 24, '2026-11-20'), null); // 4th day back: deleted
  assert.equal(historyWindow(now, 24, '2026-11-24'), null); // future day
  const recent = historyWindow(now, 2);
  assert.equal(recent.to, now / 1000);
  assert.equal(recent.from, now / 1000 - 2 * 3600);
  assert.equal(recent.startKey, 'h2026112222');
  assert.equal(recent.endKey, 'h2026112300');
  assert.equal(historyWindow(now, 24), null); // a whole day is requested by date
  assert.equal(historyWindow(now, 3), null);
  // At 00:00 the finished day is still offered as "Hôm qua" with its full 00:00–23:59 window.
  const midnight = Date.UTC(2026, 10, 23, 17, 0); // 24/11 00:00 +07
  assert.deepEqual(historyDays(midnight).map(day => day.key), ['2026-11-24', '2026-11-23', '2026-11-22']);
  assert.equal(historyWindow(midnight, 24, '2026-11-23').to, historyDayStart('2026-11-24') - 1);
});
