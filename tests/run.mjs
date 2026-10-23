#!/usr/bin/env node
// Slopographic test runner.
//   node tests/run.mjs            run every tests/**/*.test.html in headless Chromium
//   node tests/run.mjs paint      only pages whose path contains "paint"
//   --jobs=4                      run 4 pages at a time, each in its own browser context (default 1; SLOPTEST_JOBS too).
//                                 A page that fails then runs once more on its own: if it passes alone it counts as
//                                 passed and is listed as load-sensitive (its timing depends on the machine being idle)
//   --shard=2/8                   only the 2nd of 8 slices of the pages, balanced by tests/timings.json (CI runs the slices
//                                 as parallel jobs; see tests/shard.mjs)
//   --skip-node                   no Node tests (CI runs them in their own job)
//   --record-timings              write each page's seconds into tests/timings.json, for the shard balance
// Serves the repo root on a local port (no dependencies), opens each page, waits for
// window.__SLOPTEST__ (see tests/harness.js) and prints a report. Exit code 1 on failure.
// Also runs Node-only tests (tests/node/*.test.mjs and tests/seo/*.test.mjs) with `node --test`.
import http from 'node:http';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseShard, shardPages, pool, mergeTimings } from './shard.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2), flag = (name) => argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name) => { const f = flag(name); return f && f.includes('=') ? f.slice(f.indexOf('=') + 1) : null; };
const filter = argv.find((a) => !a.startsWith('--')) || '';
const JOBS = Math.max(1, Number(value('jobs') || process.env.SLOPTEST_JOBS || 1) || 1);
const SHARD = value('shard') ? parseShard(value('shard')) : null;
const TIMINGS = path.join(ROOT, 'tests', 'timings.json');
const THIRD_PARTY = /^https:\/\/([a-z0-9-]+\.)*(googlesyndication\.com|googletagmanager\.com|google-analytics\.com|doubleclick\.net)\//;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.pdf': 'application/pdf', '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf': 'font/ttf' };

async function findTests(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules' && e.name !== 'node') await findTests(p, out); }
    else if (e.name.endsWith('.test.html')) out.push(path.relative(ROOT, p));
  }
  return out;
}
function serve() {
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let f = path.join(ROOT, p);
      if (!f.startsWith(ROOT)) { res.writeHead(403).end(); return; }
      if ((await stat(f).catch(() => null))?.isDirectory()) f = path.join(f, 'index.html');
      const body = await readFile(f);
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch (e) { res.writeHead(404).end('not found'); }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}
async function loadPlaywright() {
  try { return await import('playwright'); } catch (e) { /* fall through */ }
  for (const p of ['/opt/node22/lib/node_modules/playwright', path.join(process.env.npm_config_prefix || '', 'lib/node_modules/playwright')]) {
    try { return createRequire(import.meta.url)(p); } catch (e) { /* try next */ }
  }
  throw new Error('Playwright not found. Run: npm i -D playwright && npx playwright install chromium');
}

const c = { g: (s) => `\x1b[32m${s}\x1b[0m`, r: (s) => `\x1b[31m${s}\x1b[0m`, d: (s) => `\x1b[2m${s}\x1b[0m`, b: (s) => `\x1b[1m${s}\x1b[0m` };
let failed = 0, passed = 0;

const nodeDirs = [path.join(ROOT, 'tests', 'node'), path.join(ROOT, 'tests', 'seo')];
const nodeTests = (await Promise.all(nodeDirs.map(async (d) => (await readdir(d).catch(() => [])).filter((f) => f.endsWith('.test.mjs') && f.includes(filter)).map((f) => path.join(d, f))))).flat();
if (nodeTests.length && !flag('skip-node')) {
  console.log(c.b('\nNode tests'));
  const r = spawnSync(process.execPath, ['--test', ...nodeTests], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}

let pages = (await findTests(path.join(ROOT, 'tests'))).filter((p) => p.includes(filter)).sort();
const timings = JSON.parse(await readFile(TIMINGS, 'utf8').catch(() => '{}'));
if (SHARD) {
  pages = shardPages(pages, SHARD.count, timings)[SHARD.index - 1];
  console.log(c.b(`\nShard ${SHARD.index}/${SHARD.count}: ${pages.length} pages, ${JOBS} at a time`));
}
const took = {};
/** Opens one test page in its own context and returns its report as printed lines (a page prints all at once, so pages
 *  that run side by side never mix their output). */
async function runPage(browser, base, p, scale) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
  // Ad and analytics scripts are answered with an empty script: the tests check that the app adds them (their tags and URLs),
  // and the real ones would make results depend on third-party servers (AdSense throws on a test page) and send ad requests.
  await ctx.route(THIRD_PARTY, (r) => r.fulfill({ status: 200, contentType: 'text/javascript', body: '' }));
  const page = await ctx.newPage();
  if (scale > 1) await page.addInitScript((n) => { window.__SLOPTEST_SCALE__ = n; }, scale); // harness timeouts (tests/harness.js)
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  const t0 = Date.now();
  let report = null;
  try {
    await page.goto(base + p.split(path.sep).join('/'));
    await page.waitForFunction(() => window.__SLOPTEST__, null, { timeout: 300000, polling: 250 });
    report = await page.evaluate(() => window.__SLOPTEST__);
  } catch (e) { report = { name: p, passed: 0, failed: 1, results: [{ suite: 'runner', test: 'page loaded and finished', status: 'fail', message: e.message }], errors: [] }; }
  const secs = (Date.now() - t0) / 1000;
  took[p] = secs;
  const errs = consoleErrors.filter((m) => !/favicon|net::ERR_|Failed to load resource|Content Security Policy|Fetch API cannot load/.test(m));
  const out = [`\n${c.b(report.name || p)} ${c.d(p + ' · ' + secs.toFixed(1) + 's')}`];
  for (const r of report.results) {
    out.push(`  ${r.status === 'pass' ? c.g('✓') : c.r('✗')} ${r.suite} › ${r.test} ${c.d(r.ms != null ? r.ms + 'ms' : '')}`);
    if (r.message) out.push(c.r('      ' + r.message.split('\n').join('\n      ')));
  }
  if (errs.length) { out.push(c.r(`  ✗ console errors (${errs.length}):`)); for (const m of errs.slice(0, 5)) out.push(c.r('      ' + m)); report.failed++; }
  await ctx.close();
  return { out, passed: report.passed, failed: report.failed };
}
if (pages.length) {
  const { chromium } = await loadPlaywright();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const again = [], alone = [];
  await pool(pages, JOBS, async (p) => {
    const r = await runPage(browser, base, p, Math.min(JOBS, 4));
    if (r.failed && JOBS > 1) { again.push(p); console.log(r.out.join('\n') + c.d('\n  (runs again on its own after the others)')); return; }
    console.log(r.out.join('\n'));
    passed += r.passed; failed += r.failed;
  });
  for (const p of again.sort()) {
    const r = await runPage(browser, base, p, 1);
    console.log(c.b('\nAgain, on its own:') + r.out.join('\n'));
    passed += r.passed; failed += r.failed;
    if (!r.failed) alone.push(p);
  }
  if (alone.length) console.log(c.d(`\nLoad-sensitive (failed beside other pages, passed alone): ${alone.join(', ')}`));
  await browser.close();
  server.close();
  if (flag('record-timings')) await writeFile(TIMINGS, JSON.stringify(mergeTimings(timings, took), null, 1) + '\n');
}
console.log(`\n${failed ? c.r(`${failed} failed`) : c.g('all green')} · ${passed} passed across ${pages.length} page${pages.length === 1 ? '' : 's'}${nodeTests.length && !flag('skip-node') ? ` + ${nodeTests.length} node file${nodeTests.length === 1 ? '' : 's'}` : ''}`);
process.exit(failed ? 1 : 0);
