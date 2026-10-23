/* Slopographic test harness: a tiny describe/it/expect that runs in the browser.
 * Each tests/<app>.test.html loads the app's code plus this file, registers tests,
 * then calls SlopTest.run(). tests/run.mjs opens every page in headless Chromium,
 * reads window.__SLOPTEST__ and prints a report. Open a test page in any browser to
 * see the results on screen too. */
(function () {
  'use strict';
  const suites = [];
  let current = null;
  // Pages that run side by side (tests/run.mjs --jobs) are slower: the runner adds ?timeoutScale=N and every timeout grows N times.
  const SCALE = Math.max(1, Number(new URLSearchParams(location.search).get('timeoutScale')) || 1);
  function describe(name, fn) { const s = { name, tests: [], before: [], after: [] }; suites.push(s); const prev = current; current = s; try { fn(); } finally { current = prev; } }
  function it(name, fn, { timeout = 15000 } = {}) { (current || describe('(root)', () => {}) || suites[suites.length - 1]).tests.push({ name, fn, timeout }); }
  function beforeEach(fn) { current.before.push(fn); }
  function afterEach(fn) { current.after.push(fn); }
  const fmt = (v) => { try { return typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v, (k, x) => (typeof x === 'number' && !isFinite(x) ? String(x) : x)); } catch (e) { return String(v); } };
  function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepEqual(a[k], b[k]));
  }
  class AssertionError extends Error {}
  function expect(actual) {
    const fail = (msg) => { throw new AssertionError(msg); };
    const api = {
      toBe: (e) => { if (actual !== e) fail(`expected ${fmt(actual)} to be ${fmt(e)}`); },
      toEqual: (e) => { if (!deepEqual(actual, e)) fail(`expected ${fmt(actual)} to equal ${fmt(e)}`); },
      toBeTruthy: () => { if (!actual) fail(`expected ${fmt(actual)} to be truthy`); },
      toBeFalsy: () => { if (actual) fail(`expected ${fmt(actual)} to be falsy`); },
      toBeCloseTo: (e, eps = 1e-6) => { if (Math.abs(actual - e) > eps) fail(`expected ${actual} to be within ${eps} of ${e}`); },
      toBeGreaterThan: (e) => { if (!(actual > e)) fail(`expected ${actual} > ${e}`); },
      toBeGreaterThanOrEqual: (e) => { if (!(actual >= e)) fail(`expected ${actual} >= ${e}`); },
      toBeLessThan: (e) => { if (!(actual < e)) fail(`expected ${actual} < ${e}`); },
      toBeLessThanOrEqual: (e) => { if (!(actual <= e)) fail(`expected ${actual} <= ${e}`); },
      toContain: (e) => { if (!(actual && actual.includes && actual.includes(e))) fail(`expected ${fmt(actual)} to contain ${fmt(e)}`); },
      toMatch: (re) => { if (!re.test(String(actual))) fail(`expected ${fmt(actual)} to match ${re}`); },
      toHaveLength: (n) => { if (!actual || actual.length !== n) fail(`expected length ${n}, got ${actual && actual.length}`); },
      toBeInstanceOf: (C) => { if (!(actual instanceof C)) fail(`expected instance of ${C.name}`); },
      toThrow: (re) => { let threw = false; try { actual(); } catch (err) { threw = true; if (re && !re.test(err.message)) fail(`threw "${err.message}", expected ${re}`); } if (!threw) fail('expected function to throw'); },
      async rejects(re) { let threw = false; try { await actual; } catch (err) { threw = true; if (re && !re.test(err.message)) fail(`rejected with "${err.message}", expected ${re}`); } if (!threw) fail('expected promise to reject'); },
    };
    api.not = {};
    for (const k of Object.keys(api)) if (k !== 'not' && k !== 'rejects') api.not[k] = (...a) => { let ok = false; try { api[k](...a); } catch (e) { ok = true; } if (!ok) fail(`expected not.${k}(${a.map(fmt).join(', ')}) for ${fmt(actual)}`); };
    return api;
  }
  /** Pixel helper: [r,g,b,a] at (x, y) of a canvas. */
  function pixel(canvas, x, y) { return [...canvas.getContext('2d', { willReadFrequently: true }).getImageData(x, y, 1, 1).data]; }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function waitFor(pred, { timeout = 10000, step = 30 } = {}) { const t0 = performance.now(); for (;;) { const v = await pred(); if (v) return v; if (performance.now() - t0 > timeout * SCALE) throw new AssertionError('waitFor timed out'); await sleep(step); } }

  async function run({ name = document.title } = {}) {
    const results = [];
    const errors = [];
    addEventListener('error', (e) => errors.push(String(e.message)));
    addEventListener('unhandledrejection', (e) => errors.push(String(e.reason && e.reason.message || e.reason)));
    for (const s of suites) for (const t of s.tests) {
      const t0 = performance.now();
      let status = 'pass', message = '';
      try {
        for (const b of s.before) await b();
        await Promise.race([Promise.resolve().then(t.fn), new Promise((_, rej) => setTimeout(() => rej(new AssertionError(`timed out after ${t.timeout * SCALE}ms`)), t.timeout * SCALE))]);
        for (const a of s.after) await a();
      } catch (e) { status = 'fail'; message = (e && e.message) || String(e); if (!(e instanceof AssertionError) && e && e.stack) message += '\n' + e.stack.split('\n').slice(1, 3).join('\n'); }
      results.push({ suite: s.name, test: t.name, status, message, ms: Math.round(performance.now() - t0) });
    }
    const report = { name, passed: results.filter((r) => r.status === 'pass').length, failed: results.filter((r) => r.status === 'fail').length, results, errors };
    window.__SLOPTEST__ = report;
    render(report);
    return report;
  }
  function render(r) {
    const box = document.createElement('div');
    box.id = 'sloptest-report';
    box.style.cssText = 'position:fixed;inset:auto 0 0 0;max-height:60vh;overflow:auto;z-index:2147483647;background:#0a0a0a;color:#f1ede4;font:12px/1.5 ui-monospace,Menlo,monospace;padding:12px 16px;border-top:2px solid ' + (r.failed ? '#ff4f6e' : '#d4ff3a');
    box.innerHTML = `<b>${r.name}</b> — <span style="color:#d4ff3a">${r.passed} passed</span>${r.failed ? `, <span style="color:#ff4f6e">${r.failed} failed</span>` : ''}<br>` +
      r.results.map((x) => `<div style="color:${x.status === 'pass' ? '#9fd640' : '#ff4f6e'}">${x.status === 'pass' ? '✓' : '✗'} ${x.suite} › ${x.test} <span style="opacity:.5">${x.ms}ms</span>${x.message ? `<pre style="margin:2px 0 6px 16px;white-space:pre-wrap;color:#ffb3c0">${x.message.replace(/</g, '&lt;')}</pre>` : ''}</div>`).join('');
    document.body.append(box);
  }
  window.SlopTest = { describe, it, beforeEach, afterEach, expect, run, pixel, sleep, waitFor };
})();
