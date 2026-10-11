/* Slopographic font packs: the manifest rules and the SHA-256 check. Pure functions, no DOM, so Node tests
 * can load it (module.exports) and the browser gets window.SlopLibraryManifest. Classic script.
 * A pack is one licence, one size and a list of font files, each with its own URL and SHA-256.
 * Packs whose URL host is not in packs.json "hosts", whose licence is not in LICENCES, or whose
 * numbers do not add up are dropped with a message; the rest still list. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SlopLibraryManifest = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /** Licences a pack may declare. Anything else is refused before the dialog offers it. */
  const LICENCES = {
    'OFL-1.1': 'SIL Open Font License 1.1',
    'Apache-2.0': 'Apache License 2.0',
    'MIT': 'MIT License',
    'CC0-1.0': 'CC0 1.0 (public domain dedication)'
  };
  const FONT_EXT = /\.(woff2|woff|ttf|otf)$/i;
  const MAX_FILE = 15 * 1024 * 1024;
  const MAX_PACK = 40 * 1024 * 1024;
  const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
  const FILE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/;
  const SHA = /^[0-9a-f]{64}$/;
  const WEIGHT = /^(\d{3}(\s\d{3})?)$/;

  /** True when url is https and its host is one of the allowed hosts (exact match). */
  function allowedUrl(url, hosts) {
    try {
      const u = new URL(url);
      return u.protocol === 'https:' && Array.isArray(hosts) && hosts.includes(u.hostname);
    } catch (e) { return false; }
  }

  /** Checks one pack. Returns { pack } (normalised copy) or { error }. */
  function checkPack(p, hosts) {
    if (!p || typeof p !== 'object') return { error: 'pack is not an object' };
    const who = `pack "${p.id}"`;
    if (typeof p.id !== 'string' || !ID.test(p.id)) return { error: 'pack id must be lowercase letters, digits and dashes' };
    if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80) return { error: `${who}: name missing` };
    if (!Object.prototype.hasOwnProperty.call(LICENCES, p.licence)) return { error: `${who}: licence "${p.licence}" is not on the open-licence list` };
    if (!Array.isArray(p.files) || !p.files.length || p.files.length > 64) return { error: `${who}: needs 1 to 64 files` };
    const files = [], names = new Set();
    let total = 0;
    for (const f of p.files) {
      if (!f || typeof f !== 'object') return { error: `${who}: file entry is not an object` };
      if (typeof f.name !== 'string' || !FILE.test(f.name) || !FONT_EXT.test(f.name)) return { error: `${who}: file name "${f.name}" must be a font (.woff2, .woff, .ttf, .otf)` };
      if (names.has(f.name)) return { error: `${who}: duplicate file ${f.name}` };
      names.add(f.name);
      if (!allowedUrl(f.url, hosts)) return { error: `${who}: ${f.name} must be an https URL on an allowed host` };
      if (!Number.isInteger(f.size) || f.size < 1 || f.size > MAX_FILE) return { error: `${who}: ${f.name} size is out of range` };
      if (typeof f.sha256 !== 'string' || !SHA.test(f.sha256)) return { error: `${who}: ${f.name} needs a lowercase sha256` };
      if (typeof f.family !== 'string' || !f.family.trim() || f.family.length > 60) return { error: `${who}: ${f.name} needs a family name` };
      const weight = String(f.weight || '400');
      if (!WEIGHT.test(weight)) return { error: `${who}: ${f.name} weight must be 400 or "100 900"` };
      const style = f.style === 'italic' ? 'italic' : 'normal';
      total += f.size;
      files.push({ name: f.name, url: f.url, size: f.size, sha256: f.sha256, family: f.family.trim(), weight, style });
    }
    if (total > MAX_PACK) return { error: `${who}: larger than 40 MB` };
    if (p.size !== total) return { error: `${who}: declared size ${p.size} does not match the files (${total})` };
    return { pack: { id: p.id, name: p.name.trim(), licence: p.licence, licenceUrl: typeof p.licenceUrl === 'string' ? p.licenceUrl : '', description: typeof p.description === 'string' ? p.description.slice(0, 300) : '', size: total, files } };
  }

  /** Validates the whole manifest. Returns { packs, errors, hosts }. Never throws. */
  function validate(manifest) {
    const errors = [], packs = [];
    if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.packs)) return { packs, errors: ['packs.json needs a "packs" list'], hosts: [] };
    const hosts = Array.isArray(manifest.hosts) ? manifest.hosts.filter((h) => typeof h === 'string') : [];
    const ids = new Set();
    for (const p of manifest.packs) {
      const r = checkPack(p, hosts);
      if (r.error) { errors.push(r.error); continue; }
      if (ids.has(r.pack.id)) { errors.push(`duplicate pack id ${r.pack.id}`); continue; }
      ids.add(r.pack.id); packs.push(r.pack);
    }
    return { packs, errors, hosts };
  }

  /** Lowercase hex SHA-256 of an ArrayBuffer, via crypto.subtle. */
  async function sha256Hex(buffer) {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', buffer));
    let s = '';
    for (const b of d) s += b.toString(16).padStart(2, '0');
    return s;
  }

  /** Checks downloaded bytes against the manifest entry: exact length and SHA-256. Resolves { ok, reason }. */
  async function verifyBytes(buffer, file) {
    if (!buffer || buffer.byteLength !== file.size) return { ok: false, reason: `${file.name}: got ${buffer ? buffer.byteLength : 0} bytes, expected ${file.size}` };
    const got = await sha256Hex(buffer);
    return got === file.sha256 ? { ok: true } : { ok: false, reason: `${file.name}: SHA-256 does not match the manifest` };
  }

  function formatSize(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }

  return { LICENCES, validate, checkPack, allowedUrl, sha256Hex, verifyBytes, formatSize };
});
