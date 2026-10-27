/* The desktop app's own protocol: app://<host>/ serves the bundled site (resources/site/) as the website serves it, so
 * root-relative paths (/shared/…), fetch, IndexedDB, OPFS, WebGPU, WASM and workers behave as on https. Registered as
 * standard + secure + supportFetchAPI + corsEnabled + stream before the app is ready (PRIVILEGES).
 * No COOP/COEP headers: the website sends none (aitools/workers/ort.js, shared/cutout/worker.js run single-threaded for
 * that), and require-corp would block the CDN files (models, wasm, fonts) the pages fetch from jsDelivr.
 * No service worker: the files are on disk already (shared/pwa.js does not register one under app:).
 *   SCHEME, HOST, ORIGIN, PRIVILEGES
 *   serve(request, { root, opened })  → Promise<Response>: the file, its folder's index.html, a redirect that adds the
 *       folder's slash, a 206 range for media, 404.html with status 404, or 403 for a path that leaves the root.
 *       opened(token) → a file path the person opened with the app (main/open.js), served at /__open/<token>.
 *   register(protocol, root, opened)  protocol.handle for the scheme (call when the app is ready) */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const { sitePath, mimeOf, parseRange, OPEN_PREFIX } = require('../lib/paths');

const SCHEME = 'app';
const HOST = 'slop';
const ORIGIN = `${SCHEME}://${HOST}`;
const PRIVILEGES = { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true, codeCache: true };

const statOf = (f) => fs.promises.stat(f).catch(() => null);
const text = (status, body) => new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8' } });

/** A file as a Response: whole, or the part a Range header asks for. */
function fileResponse(file, st, request, type) {
  const headers = { 'content-type': type || mimeOf(file), 'accept-ranges': 'bytes', 'cache-control': 'no-cache' };
  const r = parseRange(request.headers.get('range'), st.size);
  if (r === 'invalid') return new Response(null, { status: 416, headers: { 'content-range': `bytes */${st.size}` } });
  const range = r || { start: 0, end: st.size - 1 };
  const len = st.size ? range.end - range.start + 1 : 0;
  if (request.method === 'HEAD' || !len) return new Response(null, { status: r ? 206 : 200, headers: { ...headers, 'content-length': String(len) } });
  const body = Readable.toWeb(fs.createReadStream(file, { start: range.start, end: range.end }));
  if (r) headers['content-range'] = `bytes ${range.start}-${range.end}/${st.size}`;
  return new Response(body, { status: r ? 206 : 200, headers: { ...headers, 'content-length': String(len) } });
}

async function notFound(root) {
  const page = path.join(root, '404.html');
  const st = await statOf(page);
  if (!st) return text(404, 'Not found');
  return new Response(await fs.promises.readFile(page), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function serve(request, { root, opened }) {
  const url = new URL(request.url);
  if (url.host !== HOST) return text(404, 'Not found');
  if (url.pathname.startsWith(OPEN_PREFIX)) {   // a file the person opened with the app
    const file = opened && opened(url.pathname.slice(OPEN_PREFIX.length));
    const st = file && (await statOf(file));
    return st && st.isFile() ? fileResponse(file, st, request) : text(404, 'Not found');
  }
  const hit = sitePath(root, url.pathname);
  if (!hit) return text(403, 'Forbidden');
  let file = hit.file, st = await statOf(file);
  if (st && st.isDirectory()) {
    if (!hit.slash) return new Response(null, { status: 301, headers: { location: url.pathname + '/' + url.search } });
    file = path.join(file, 'index.html');
    st = await statOf(file);
  }
  if (!st || !st.isFile()) return notFound(root);
  return fileResponse(file, st, request);
}

function register(protocol, root, opened) {
  protocol.handle(SCHEME, (request) => serve(request, { root, opened }).catch((e) => text(500, String((e && e.message) || e))));
}

module.exports = { SCHEME, HOST, ORIGIN, PRIVILEGES, serve, register };
