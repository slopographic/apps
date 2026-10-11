#!/usr/bin/env node
// Slopographic test runner.
//   node tests/run.mjs            run every tests/**/*.test.html in headless Chromium
//   node tests/run.mjs paint      only pages whose path contains "paint"
// Serves the repo root on a local port (no dependencies), opens each page, waits for
// window.__SLOPTEST__ (see tests/harness.js) and prints a report. Exit code 1 on failure.
// Also runs Node-only tests (tests/node/*.test.mjs) with `node --test`.
import http from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const filter = process.argv[2] || '';
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

const nodeDir = path.join(ROOT, 'tests', 'node');
const nodeTests = (await readdir(nodeDir).catch(() => [])).filter((f) => f.endsWith('.test.mjs') && f.includes(filter)).map((f) => path.join(nodeDir, f));
if (nodeTests.length) {
  console.log(c.b('\nNode tests'));
  const r = spawnSync(process.execPath, ['--test', ...nodeTests], { stdio: 'inherit' });
  if (r.status !== 0) failed++;
}

const pages = (await findTests(path.join(ROOT, 'tests'))).filter((p) => p.includes(filter)).sort();
if (pages.length) {
  const { chromium } = await loadPlaywright();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  for (const p of pages) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage();
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
    const errs = consoleErrors.filter((m) => !/favicon|net::ERR_|Failed to load resource/.test(m));
    console.log(`\n${c.b(report.name || p)} ${c.d(p + ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + 's')}`);
    for (const r of report.results) {
      console.log(`  ${r.status === 'pass' ? c.g('✓') : c.r('✗')} ${r.suite} › ${r.test} ${c.d(r.ms != null ? r.ms + 'ms' : '')}`);
      if (r.message) console.log(c.r('      ' + r.message.split('\n').join('\n      ')));
    }
    if (errs.length) { console.log(c.r(`  ✗ console errors (${errs.length}):`)); for (const m of errs.slice(0, 5)) console.log(c.r('      ' + m)); report.failed++; }
    passed += report.passed; failed += report.failed;
    await ctx.close();
  }
  await browser.close();
  server.close();
}
console.log(`\n${failed ? c.r(`${failed} failed`) : c.g('all green')} · ${passed} passed across ${pages.length} page${pages.length === 1 ? '' : 's'}${nodeTests.length ? ` + ${nodeTests.length} node file${nodeTests.length === 1 ? '' : 's'}` : ''}`);
process.exit(failed ? 1 : 0);
