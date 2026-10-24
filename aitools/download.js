/* Slop AI Tools: downloads one model file and checks it, as one piece or in parts. No DOM and no storage: the fetch, the
 * SHA-256 and the host check are passed in, so a Node test runs it with fakes (module.exports); the browser gets
 * window.SlopAIDownload. Classic script. Used by models.js (install).
 *   fetchFile(f, deps) -> Promise<ArrayBuffer>
 *     f: { name, size, sha256, url } or { name, size, sha256, parts: [{ url, size, sha256 }] } (an index entry)
 *     deps: { fetch, sha256Hex(buf), allowedUrl(url), signal, onBytes(loaded) }
 * A file in parts (GitHub refuses files over 100 MB, so big models are kept in pieces of 90 MiB) is downloaded part after
 * part; each part must have its exact length and SHA-256, then the joined bytes must have the file's length and SHA-256.
 * Any mismatch, a redirect to another host or a cancel (signal) rejects, and nothing is kept. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SlopAIDownload = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const cancelled = () => Object.assign(new Error('Download cancelled'), { name: 'AbortError' });

  /** Reads a response body, telling onBytes(n) the bytes read so far of this response. */
  async function bodyOf(r, onBytes, signal) {
    if (!r.body || !r.body.getReader) { const b = await r.arrayBuffer(); onBytes(b.byteLength); return new Uint8Array(b); }
    const reader = r.body.getReader(), chunks = [];
    let n = 0;
    for (;;) {
      if (signal && signal.aborted) { try { reader.cancel(); } catch (e) { /* already closed */ } throw cancelled(); }
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); n += value.byteLength; onBytes(n);
    }
    const out = new Uint8Array(n);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.byteLength; }
    return out;
  }

  /** One URL: fetched, host checked after redirects, length and SHA-256 checked. Returns the bytes (Uint8Array). */
  async function piece(url, want, label, deps, onBytes) {
    if (deps.signal && deps.signal.aborted) throw cancelled();
    let r;
    try { r = await deps.fetch(url, { credentials: 'omit', redirect: 'follow', cache: 'no-cache', signal: deps.signal }); }
    catch (e) { if (deps.signal && deps.signal.aborted) throw cancelled(); throw new Error(`${label}: ${e.message || 'network error'}`); }
    if (!r.ok) throw new Error(`${label}: HTTP ${r.status}`);
    if (!deps.allowedUrl(r.url || url)) throw new Error(`${label}: redirected to a host that is not allowed`);
    const bytes = await bodyOf(r, onBytes, deps.signal);
    if (bytes.byteLength !== want.size) throw new Error(`${label}: ${bytes.byteLength} bytes, expected ${want.size}`);
    if ((await deps.sha256Hex(bytes)) !== want.sha256) throw new Error(`${label}: SHA-256 does not match the index`);
    return bytes;
  }

  async function fetchFile(f, deps) {
    const onBytes = deps.onBytes || (() => {});
    if (!f.parts) return (await piece(f.url, f, f.name, deps, onBytes)).buffer;
    const all = new Uint8Array(f.size);
    let at = 0;
    for (let i = 0; i < f.parts.length; i++) {
      const p = f.parts[i], base = at;
      if (base + p.size > f.size) throw new Error(`${f.name}: the parts are longer than the file`);
      const bytes = await piece(p.url, p, `${f.name} part ${i + 1} of ${f.parts.length}`, deps, (n) => onBytes(base + n));
      all.set(bytes, base);
      at += bytes.byteLength;
    }
    if (at !== f.size) throw new Error(`${f.name}: ${at} bytes after joining, expected ${f.size}`);
    if ((await deps.sha256Hex(all)) !== f.sha256) throw new Error(`${f.name}: SHA-256 of the joined parts does not match the index`);
    return all.buffer;
  }

  return { fetchFile };
});
