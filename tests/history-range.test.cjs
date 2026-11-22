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
  HISTORY_RANGE_HOURS, HISTORY_OFFSET_HOURS, HISTORY_RETENTION_HOURS } = context.exports;

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

test('3-day retention: windows can end now, 1 day or 2 days ago, never beyond 72 h', () => {
  assert.equal(HISTORY_RETENTION_HOURS, 72);
  assert.deepEqual([...HISTORY_OFFSET_HOURS], [0, 24, 48]);
  const now = Date.UTC(2026, 10, 22, 8, 30); // 22/11 15:30 +07
  assert.equal(historyHourKey(now), 'h2026112215');
  const today = historyWindow(now, 24, 0);
  assert.equal(today.to, now / 1000);
  assert.equal(today.from, now / 1000 - 24 * 3600);
  assert.equal(today.startKey, 'h2026112115');
  assert.equal(today.endKey, 'h2026112215');
  const twoDaysAgo = historyWindow(now, 24, 48);
  assert.equal(twoDaysAgo.startKey, 'h2026111915');
  assert.equal(twoDaysAgo.endKey, 'h2026112015');
  assert.equal(twoDaysAgo.from, now / 1000 - 72 * 3600); // oldest minute still kept
  assert.equal(historyWindow(now, 2, 48).startKey, 'h2026112013');
  assert.equal(historyWindow(now, 24, 72), null);   // beyond retention
  assert.equal(historyWindow(now, 3, 0), null);     // unsupported range
  assert.equal(historyWindow(now, 24, 12), null);   // unsupported offset
});

test('coverage counts minutes with data and forecasts and lists the gaps', () => {
  const { historyCoverage } = context.exports;
  const base = 1_800_000_000 - (1_800_000_000 % 60);
  const rows = [
    { t: base, s: 'ooooo', c: { cam_01: 5 } },
    { t: base + 60, s: 'ioooo', c: { cam_01: 6 }, p: { h1: { cam_01: 6 } } },
    // base+120 .. base+240 missing (3 minutes)
    { t: base + 300, s: 'ooooo', c: { cam_01: 7 }, p: { h1: { cam_01: 8 } } },
    { t: base + 360, s: 'moooo', c: { cam_02: 1 }, p: { h1: { cam_01: 9 } } },
  ];
  const coverage = historyCoverage(rows, 'cam_01', 0, 1, base, base + 360 + 120);
  assert.equal(coverage.minutes, 7);
  assert.equal(coverage.actual, 3);
  assert.equal(coverage.imputed, 1);
  assert.equal(coverage.forecast, 3);
  assert.deepEqual(coverage.noData.map(span => [...span]), [[base + 120, base + 240], [base + 360, base + 360]]);
  assert.deepEqual(coverage.noForecast.map(span => [...span]), [[base, base], [base + 120, base + 240]]);
  // The newest two minutes are not published yet and are not counted as missing.
  assert.equal(historyCoverage(rows, 'cam_01', 0, 1, base, base + 360 + 60).minutes, 6);
  // Nothing stored at all: the whole window is one gap.
  const empty = historyCoverage([], 'cam_01', 0, 1, base, base + 600);
  assert.equal(empty.actual, 0);
  assert.deepEqual(empty.noData.map(span => [...span]), [[base, base + 480]]);
});
