/* The desktop app's file lookup for its own protocol (main/protocol.js): an app:// URL path to a file of the bundled
 * site, its MIME type, and the byte range a media element asks for. Pure (no fs, no Electron), so tests/node can run it.
 *   sitePath(root, pathname)   → { file, slash } for a path inside root, or null for anything that would leave it: a ".."
 *                                or "." segment (also when written %2e%2e or behind an encoded slash), a dot file, a
 *                                backslash or a NUL. slash: the path ended in "/" (a folder: its index.html is served).
 *   mimeOf(file)               → the Content-Type for a file name ('application/octet-stream' when unknown)
 *   parseRange(header, size)   → { start, end } (inclusive) for "bytes=a-b", "bytes=a-" or "bytes=-n"; null when there is
 *                                no usable header (serve the whole file); 'invalid' when it asks past the end (416).
 *   OPEN_PREFIX                the folder of the files the person opened with the app (main/open.js serves them) */
'use strict';
const path = require('node:path');

const OPEN_PREFIX = '/__open/';

function sitePath(root, pathname) {
  let p;
  try { p = decodeURIComponent(String(pathname || '/')); } catch (e) { return null; }   // a broken %-escape
  if (p.includes('\0') || p.includes('\\')) return null;
  const segs = p.split('/').filter(Boolean);
  if (segs.some((s) => s === '..' || s === '.' || s.startsWith('.'))) return null;
  const base = path.resolve(root);
  const file = path.join(base, ...segs);
  if (file !== base && !file.startsWith(base + path.sep)) return null;   // belt and braces: never outside the root
  return { file, slash: p.endsWith('/') };
}

const MIME = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
  webmanifest: 'application/manifest+json; charset=utf-8', map: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8', csv: 'text/csv; charset=utf-8',
  xml: 'application/xml; charset=utf-8', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', ico: 'image/x-icon', bmp: 'image/bmp',
  wasm: 'application/wasm', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg',
  m4a: 'audio/mp4', flac: 'audio/flac', pdf: 'application/pdf', zip: 'application/zip', glb: 'model/gltf-binary',
  gltf: 'model/gltf+json', onnx: 'application/octet-stream', bin: 'application/octet-stream',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  psd: 'image/vnd.adobe.photoshop', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff',
};
function mimeOf(file) {
  const m = /\.([a-z0-9]+)$/i.exec(String(file || ''));
  return (m && MIME[m[1].toLowerCase()]) || 'application/octet-stream';
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start, end;
  if (m[1] === '') { const n = Number(m[2]); if (!n) return 'invalid'; start = Math.max(0, size - n); end = size - 1; }
  else { start = Number(m[1]); end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1); }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

module.exports = { sitePath, mimeOf, parseRange, OPEN_PREFIX, MIME };
