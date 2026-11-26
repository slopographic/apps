// A static server for the speed check: the checkout over http the way GitHub Pages serves it, text compressed with gzip,
// cache-control max-age=600, dir/ served as dir/index.html, dir without a slash redirected to dir/, 404.html for a missing
// file. Used by tools/speed/run.mjs; tests/node/speed-run.test.mjs checks it.
//   const { url, close } = await serve(root, port)   port 0 picks a free one
//   serve(root, 0, { slow: ['pdf/'] })   test only: pdf/'s page starts with SLOW_SCRIPT (a page made slower on purpose)
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

export const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.pdf': 'application/pdf', '.onnx': 'application/octet-stream',
};
/** Whether Pages compresses a content type (text, scripts, JSON, SVG, manifests, wasm). */
export const compressible = (type) => /^text\/|javascript|json|xml|svg|manifest|wasm/.test(type);

/** What a slow page starts with: the main thread busy for 1 s before anything shows (4 s on Lighthouse's mobile CPU). */
export const SLOW_SCRIPT = '<script>for(const t=performance.now();performance.now()-t<1000;);</script>';
/** A page's html with SLOW_SCRIPT first in its head (or first of all). */
export const slowed = (html) => (/<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (h) => h + SLOW_SCRIPT) : SLOW_SCRIPT + html);

const gzipCache = new Map();
async function send(req, res, file, status = 200, slow = false) {
  let body = await readFile(file);
  if (slow) body = Buffer.from(slowed(body.toString('utf8')));
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  res.setHeader('content-type', type);
  res.setHeader('cache-control', 'max-age=600');
  res.setHeader('vary', 'Accept-Encoding');
  if (compressible(type) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const key = (slow ? 'slow:' : '') + file;
    let gz = gzipCache.get(key);
    if (!gz) gzipCache.set(key, (gz = zlib.gzipSync(body, { level: 6 })));
    res.setHeader('content-encoding', 'gzip');
    res.writeHead(status).end(req.method === 'HEAD' ? undefined : gz);
  } else res.writeHead(status).end(req.method === 'HEAD' ? undefined : body);
}

async function handle(root, req, res, slow) {
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { return res.writeHead(400).end(); }
  const file = path.join(root, rel);
  if (!file.startsWith(root)) return res.writeHead(403).end();
  const st = await stat(file).catch(() => null);
  if (st && st.isDirectory()) {
    if (!rel.endsWith('/')) return res.writeHead(301, { location: rel + '/' }).end();
    const index = path.join(file, 'index.html');
    if (await stat(index).catch(() => null)) return send(req, res, index, 200, slow.has(rel.slice(1)));
  } else if (st) return send(req, res, file);
  const notFound = path.join(root, '404.html');
  if (await stat(notFound).catch(() => null)) return send(req, res, notFound, 404);
  res.writeHead(404).end();
}

/** Serves root on port (0: a free one); the pages in slow ('' the homepage, 'pdf/') start with SLOW_SCRIPT. Resolves
 * { url, port, close() }. */
export function serve(root, port = 0, { slow = [] } = {}) {
  const abs = path.resolve(root);
  const slowSet = new Set(slow);
  const server = http.createServer((req, res) => handle(abs, req, res, slowSet).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }));
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const p = server.address().port;
      resolve({ url: `http://127.0.0.1:${p}/`, port: p, close: () => new Promise((r) => { server.closeAllConnections?.(); server.close(r); }) });
    });
  });
}
