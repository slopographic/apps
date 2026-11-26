// The speed rule's ratchet (tools/speed/budget.mjs) and the numbers kept from a Lighthouse report (tools/speed/measure.mjs):
// the median, the tolerance, the check against budgets, budgets that only ever go down, and the budgets file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GOALS, TOLERANCE, ENFORCED, TIMING, RECHECK, median, medianRun, limitOf, meetsGoal, compare, ratchet, formatBudgets, parseBudgets, spread, recheckItems, settle } from '../../tools/speed/budget.mjs';
import { metricsOf, lighthouseFlags, playwrightChrome, METRICS, AUDITS } from '../../tools/speed/measure.mjs';

const m = (o = {}) => ({ score: 80, fcp: 800, lcp: 1500, cls: 0.02, tbt: 100, si: 1200, bytes: 300000, requests: 40, ...o });

test('the goals: LCP 500 ms on desktop, 2.5 s on mobile, CLS 0.1 on both', () => {
  assert.deepEqual(GOALS, { desktop: { lcp: 500, cls: 0.1 }, mobile: { lcp: 2500, cls: 0.1 } });
  assert.ok(meetsGoal('desktop', 'lcp', 500) && !meetsGoal('desktop', 'lcp', 501) && !meetsGoal('desktop', 'tbt', 0));
});

test('median: the middle number, the mean of the two middle ones, nulls left out', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([null, 7, undefined, NaN]), 7);
  assert.equal(median([]), null);
  assert.deepEqual(medianRun([m({ lcp: 900, cls: 0.0123 }), m({ lcp: 1100, cls: 0.02 }), m({ lcp: 5000, cls: 0.5 })]), m({ lcp: 1100, cls: 0.02 }));
  assert.equal(medianRun([{ lcp: null }, { lcp: null }]).lcp, null);
});

test('the limit is the budget plus the larger of the absolute and relative tolerance', () => {
  assert.equal(limitOf('lcp', 400), 400 + TOLERANCE.lcp.abs);
  assert.equal(limitOf('lcp', 10000), 10000 + 10000 * TOLERANCE.lcp.rel);
  assert.ok(ENFORCED.includes('lcp') && ENFORCED.includes('cls') && !ENFORCED.includes('score'));
});

test('compare: within tolerance passes, past it fails, a page with no budget fails', () => {
  const budgets = { 'a/': { desktop: m(), mobile: m({ lcp: 3000 }) } };
  assert.deepEqual(compare({ 'a/': { desktop: m({ lcp: limitOf('lcp', 1500) }) } }, budgets), []);
  const worse = compare({ 'a/': { desktop: m({ lcp: limitOf('lcp', 1500) + 1, bytes: 400000 }) } }, budgets);
  assert.deepEqual(worse.map((p) => [p.kind, p.metric]), [['worse', 'lcp'], ['worse', 'bytes']]);
  assert.equal(worse[0].budget, 1500);
  assert.deepEqual(compare({ 'new/': { desktop: m() }, 'a/': { tablet: m() } }, budgets).map((p) => [p.page, p.preset, p.kind]), [['a/', 'tablet', 'missing'], ['new/', 'desktop', 'missing']]);
});

test('compare: a page that meets the goal passes even past its budget; a score drop alone never fails', () => {
  const budgets = { 'a/': { desktop: m({ lcp: 100, cls: 0 }) } };
  assert.deepEqual(compare({ 'a/': { desktop: m({ lcp: 480, cls: 0.09, score: 1 }) } }, budgets), []);
  assert.equal(compare({ 'a/': { desktop: m({ lcp: 520 }) } }, budgets)[0].metric, 'lcp');
});

test('compare: a number the run could not get, or a failed run, is a problem', () => {
  const budgets = { 'a/': { desktop: m() } };
  assert.deepEqual(compare({ 'a/': { desktop: m({ lcp: null }) } }, budgets).map((p) => [p.kind, p.metric]), [['unmeasured', 'lcp']]);
  assert.equal(compare({ 'a/': { desktop: { error: 'NO_FCP' } } }, budgets)[0].message, 'NO_FCP');
});

test('recheck: only page presets over on timing are measured again, once each, at most max', () => {
  const budgets = { 'a/': { mobile: m(), desktop: m() }, 'b/': { mobile: m() }, 'c/': { mobile: m() } };
  const problems = compare({
    'a/': { mobile: m({ si: 2400, lcp: 2500 }), desktop: m({ bytes: 900000 }) },
    'b/': { mobile: m({ requests: 90 }) },
    'c/': { mobile: m({ cls: 0.5 }) },
    'new/': { mobile: m() },
  }, budgets);
  assert.deepEqual(recheckItems(problems), [{ page: 'a/', preset: 'mobile' }, { page: 'c/', preset: 'mobile' }]);
  assert.deepEqual(recheckItems(problems, 1), [{ page: 'a/', preset: 'mobile' }]);
  assert.deepEqual(TIMING, ['fcp', 'lcp', 'si', 'tbt', 'cls']);
  assert.ok(RECHECK.runs >= 5 && RECHECK.runs % 2 === 1, 'an odd number of runs alone, so the median is one of them');
});

test('settle: over beside another Chrome but within budget alone is load-sensitive; over in both fails; bytes never get a second chance', () => {
  const budgets = { 'a/': { mobile: m({ lcp: 2000 }) }, 'b/': { mobile: m() } };
  // a/: Speed Index jumped (1.2 s -> 2.4 s, the slow paint of a bimodal page) in the main pass, back alone; its LCP is slower in both
  const first = compare({ 'a/': { mobile: m({ si: 2400, lcp: 3000, bytes: 999999 }) }, 'b/': { mobile: m({ si: 2400 }) } }, budgets);
  assert.deepEqual(first.map((p) => p.page + p.metric), ['a/lcp', 'a/si', 'a/bytes', 'b/si']);
  const again = { 'a/': { mobile: m({ si: 1250, lcp: 2900 }) } };
  const { problems, sensitive } = settle(first, again);
  assert.deepEqual(sensitive.map((p) => [p.page, p.metric, p.value, p.again]), [['a/', 'si', 2400, 1250]]);
  assert.deepEqual(problems.map((p) => [p.page, p.metric, p.again]), [['a/', 'lcp', 2900], ['a/', 'bytes', undefined], ['b/', 'si', undefined]],
    'b/ was not measured again (past max): it fails as measured');
  // alone it meets the goal: not a failure; alone it could not be measured: still a failure
  assert.equal(settle(compare({ 'a/': { mobile: m({ lcp: 3000 }) } }, budgets), { 'a/': { mobile: m({ lcp: 2400 }) } }).problems.length, 0);
  assert.equal(settle(compare({ 'a/': { mobile: m({ lcp: 3000 }) } }, budgets), { 'a/': { mobile: { error: 'NO_LCP' } } }).problems.length, 1);
  assert.equal(settle(compare({ 'a/': { mobile: m({ lcp: 3000 }) } }, budgets), { 'a/': { mobile: m({ lcp: null }) } }).problems[0].again, null);
  assert.deepEqual(settle(first), { problems: first, sensitive: [] }, 'with no recheck nothing changes');
});

test('the ratchet lowers budgets and never raises one', () => {
  const budgets = { 'a/': { desktop: m() } };
  const next = ratchet(budgets, { 'a/': { desktop: m({ lcp: 900, tbt: 5000, score: 95, bytes: 1 }) } });
  assert.deepEqual(next['a/'].desktop, m({ lcp: 900, score: 95, bytes: 1 }));
  for (let i = 0; i < 200; i++) {
    const got = Object.fromEntries(Object.keys(m()).map((k) => [k, Math.round(Math.random() * 2 * m()[k])]));
    const n = ratchet(budgets, { 'a/': { desktop: got } })['a/'].desktop;
    for (const k of Object.keys(m())) {
      if (k === 'score') assert.ok(n[k] >= budgets['a/'].desktop[k]);
      else assert.ok(n[k] <= budgets['a/'].desktop[k], `${k}: ${n[k]} > ${budgets['a/'].desktop[k]}`);
    }
  }
  assert.deepEqual(budgets, { 'a/': { desktop: m() } }, 'the old budgets are not changed in place');
});

test('the ratchet adds new pages, re-records reset pages, drops pages gone from the site, ignores failed runs', () => {
  const budgets = { 'a/': { desktop: m() }, 'gone/': { desktop: m() } };
  const results = { 'a/': { desktop: m({ lcp: 9000 }), mobile: m() }, 'new/': { desktop: m({ lcp: 7 }) }, 'err/': { desktop: { error: 'x' } } };
  const next = ratchet(budgets, results, { reset: ['a/'], pages: ['a/', 'new/', 'err/'] });
  assert.deepEqual(Object.keys(next), ['a/', 'new/']);
  assert.equal(next['a/'].desktop.lcp, 9000);
  assert.deepEqual(next['a/'].mobile, m());
  assert.equal(next['new/'].desktop.lcp, 7);
  assert.ok(ratchet(budgets, results)['gone/'], 'without the page list nothing is dropped');
});

test('budgets.json round-trips, one line per page and preset', () => {
  const pages = { '': { desktop: m(), mobile: m() }, 'pdf/': { desktop: m() } };
  const text = formatBudgets({ lighthouse: '13.5.0' }, pages);
  assert.equal(text.split('\n').filter((l) => l.includes('"lcp"')).length, 3);
  assert.deepEqual(parseBudgets(JSON.parse(text)), pages);
  assert.match(text, /"\|desktop": \{"score":80/);
});

test('the numbers kept from a Lighthouse report', () => {
  const audit = (v) => ({ numericValue: v });
  const lhr = { categories: { performance: { score: 0.873 } }, audits: {
    'first-contentful-paint': audit(812.4), 'largest-contentful-paint': audit(1490.6), 'cumulative-layout-shift': audit(0.01234),
    'total-blocking-time': audit(51), 'speed-index': audit(1203), 'total-byte-weight': audit(300123), 'network-requests': { details: { items: [1, 2, 3] } } } };
  assert.deepEqual(metricsOf(lhr), { score: 87, fcp: 812, lcp: 1491, cls: 0.012, tbt: 51, si: 1203, bytes: 300123, requests: 3 });
  assert.deepEqual(Object.keys(metricsOf(lhr)), METRICS);
  assert.equal(metricsOf({ categories: {}, audits: { 'largest-contentful-paint': { numericValue: undefined } } }).lcp, null);
});

test('Lighthouse runs performance only, with the scoring audits and the two for bytes and requests', () => {
  const f = lighthouseFlags(9222);
  assert.equal(f.port, 9222);
  assert.deepEqual(f.onlyCategories, ['performance']);
  for (const a of ['first-contentful-paint', 'largest-contentful-paint', 'cumulative-layout-shift', 'total-blocking-time', 'speed-index', 'total-byte-weight', 'network-requests']) assert.ok(AUDITS.includes(a), a);
  assert.equal(f.throttlingMethod, undefined, 'simulated throttling, Lighthouse\'s default');
});

test('Playwright\'s newest Chromium is found in its cache', () => {
  const home = mkdtempSync(path.join(os.tmpdir(), 'speed-'));
  const saved = process.env.PLAYWRIGHT_BROWSERS_PATH;
  delete process.env.PLAYWRIGHT_BROWSERS_PATH;
  try {
    assert.equal(playwrightChrome(home), null);
    for (const b of ['chromium-1100/chrome-linux', 'chromium-1248/chrome-linux64']) {
      mkdirSync(path.join(home, '.cache/ms-playwright', b), { recursive: true });
      writeFileSync(path.join(home, '.cache/ms-playwright', b, 'chrome'), '');
    }
    assert.equal(playwrightChrome(home), path.join(home, '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'));
  } finally { if (saved !== undefined) process.env.PLAYWRIGHT_BROWSERS_PATH = saved; }
});

test('the noise: the worst run above its median, and the single runs past the tolerance', () => {
  const runs = { 'a/': { mobile: [m({ lcp: 3000 }), m({ lcp: 3300 }), m({ lcp: 4000 })] }, 'b/': { desktop: [m({ lcp: 300 }), m({ lcp: 490 }), m({ lcp: null })] } };
  const s = spread(runs);
  assert.equal(s.lcp.runs, 5);
  assert.equal(s.lcp.abs, 700);
  assert.equal(s.lcp.rel, 0.24);
  assert.equal(s.lcp.past, 1, '4000 is past 3300 + 15%; 490 on desktop meets the goal');
  assert.deepEqual(s.bytes, { runs: 6, abs: 0, rel: 0, past: 0 });
});
