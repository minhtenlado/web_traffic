const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = { exports: {}, Number, Math, Object, Array, Map, Date, String, RegExp };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/history-range.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, context);
const { historyStartKey, flattenHistoryBuckets, parseHistoryResponse, historyRangeSeries, HISTORY_RANGE_HOURS } = context.exports;

test('range options and Vietnam-time hour keys', () => {
  assert.deepEqual([...HISTORY_RANGE_HOURS], [2, 4, 8, 12, 24]);
  const now = Date.UTC(2026, 10, 22, 8, 30); // 15:30 +07
  assert.equal(historyStartKey(now, 2), 'h2026112213');
  assert.equal(historyStartKey(now, 24), 'h2026112115');
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
