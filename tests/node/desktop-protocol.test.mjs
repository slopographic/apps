// The desktop app's protocol (desktop/README.md): an app:// path resolves only inside the bundled site, folders get their
// index.html (and their slash), a missing page gets 404.html, media gets byte ranges, and /__open/<token> serves only a
// file the person opened with the app. Runs the real handler on a temporary site folder; no Electron needed.
// Covers: desktop/lib/paths.js
// Covers: desktop/main/protocol.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { sitePath, mimeOf, parseRange } = require('../../desktop/lib/paths.js');
const P = require('../../desktop/main/protocol.js');

test('sitePath: inside the root only; "..", dot files, backslashes and NUL are refused, however they are written', () => {
  const root = path.resolve('/srv/site');
  assert.deepEqual(sitePath(root, '/pdf/'), { file: path.join(root, 'pdf'), slash: true });
  assert.deepEqual(sitePath(root, '/shared/pwa.js'), { file: path.join(root, 'shared', 'pwa.js'), slash: false });
  assert.deepEqual(sitePath(root, '/'), { file: root, slash: true });
  assert.equal(sitePath(root, '/a%20b.txt').file, path.join(root, 'a b.txt'));
  for (const bad of ['/../etc/passwd', '/pdf/../../x', '/%2e%2e/x', '/a%2F..%2F..%2Fx', '/..%5Cx', '/a\\b', '/x%00.js', '/.git/config', '/./a', '/%E0%A4%A']) {
    assert.equal(sitePath(root, bad), null, bad);
  }
});

test('mimeOf and parseRange', () => {
  assert.equal(mimeOf('a/b.mjs'), 'text/javascript; charset=utf-8');
  assert.equal(mimeOf('x.WASM'), 'application/wasm');
  assert.equal(mimeOf('manifest.webmanifest'), 'application/manifest+json; charset=utf-8');
  assert.equal(mimeOf('noext'), 'application/octet-stream');
  assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=50-500', 100), { start: 50, end: 99 });
  assert.equal(parseRange(null, 100), null);
  assert.equal(parseRange('items=1-2', 100), null);
  assert.equal(parseRange('bytes=100-', 100), 'invalid');
  assert.equal(parseRange('bytes=5-2', 100), 'invalid');
});

test('the scheme is privileged as the website needs it (fetch, storage, streams), with no isolation headers', () => {
  for (const k of ['standard', 'secure', 'supportFetchAPI', 'corsEnabled', 'stream']) assert.equal(P.PRIVILEGES[k], true, k);
  assert.equal(P.ORIGIN, `${P.SCHEME}://${P.HOST}`);
});

test('serve: files, folders, redirects, 404.html, ranges and opened files', async (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'desk-site-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, 'pdf'));
  writeFileSync(path.join(root, 'index.html'), '<h1>home</h1>');
  writeFileSync(path.join(root, 'pdf', 'index.html'), '<h1>pdf</h1>');
  writeFileSync(path.join(root, '404.html'), '<h1>gone</h1>');
  writeFileSync(path.join(root, 'clip.webm'), Buffer.alloc(100, 7));
  const outside = path.join(root, '..', path.basename(root) + '-opened.csv');
  writeFileSync(outside, 'a,b\n1,2\n');
  t.after(() => rmSync(outside, { force: true }));
  const opened = (token) => (token === 'tok1' ? outside : null);
  const get = (p, headers = {}) => P.serve(new Request(P.ORIGIN + p, { headers }), { root, opened });

  let r = await get('/');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.equal(await r.text(), '<h1>home</h1>');
  r = await get('/pdf/');
  assert.equal(await r.text(), '<h1>pdf</h1>');
  r = await get('/pdf?x=1');
  assert.equal(r.status, 301);
  assert.equal(r.headers.get('location'), '/pdf/?x=1');
  r = await get('/nope/');
  assert.equal(r.status, 404);
  assert.equal(await r.text(), '<h1>gone</h1>');
  r = await get('/clip.webm', { range: 'bytes=10-19' });
  assert.equal(r.status, 206);
  assert.equal(r.headers.get('content-range'), 'bytes 10-19/100');
  assert.equal((await r.arrayBuffer()).byteLength, 10);
  r = await get('/clip.webm', { range: 'bytes=200-' });
  assert.equal(r.status, 416);
  r = await get('/__open/tok1');
  assert.equal(await r.text(), 'a,b\n1,2\n');
  r = await get('/__open/guess');
  assert.equal(r.status, 404);
  r = await get('/%2e%2e/' + path.basename(outside));
  assert.ok(r.status === 403 || r.status === 404, 'never the file outside the root');
  r = await P.serve(new Request(`${P.SCHEME}://elsewhere/index.html`), { root, opened });
  assert.equal(r.status, 404);
});
