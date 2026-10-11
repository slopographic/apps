// Slop Code stays local: no fetch, XMLHttpRequest or network URLs in code/ outside comments, and every file in
// code/ (JS, CSS, HTML) has at most 300 lines. Run with: node tests/run.mjs code
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CODE = path.join(ROOT, 'code');

async function files(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await files(p, out);
    else if (/\.(js|mjs|css|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** The source with comments blanked out (strings and template literals are kept, so URLs in strings are seen). */
export function stripComments(src, file) {
  const html = file.endsWith('.html');
  let out = '', i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (html && src.startsWith('<!--', i)) { const e = src.indexOf('-->', i + 4); i = e < 0 ? n : e + 3; out += ' '; continue; }
    if (!html && c === '/' && d === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; out += ' '; continue; }
    if (!html && c === '/' && d === '/') { const e = src.indexOf('\n', i); i = e < 0 ? n : e; continue; }
    if (!html && (c === '"' || c === "'" || c === '`')) {
      let j = i + 1;
      while (j < n && src[j] !== c) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1); i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

const all = await files(CODE);

test('code/ has files to check', () => {
  assert.ok(all.length >= 10, `found ${all.length} files`);
});

test('code/ makes no network calls outside comments (fetch, XMLHttpRequest, http(s) URLs)', async () => {
  const bad = [];
  for (const f of all) {
    const code = stripComments(await readFile(f, 'utf8'), f);
    const hits = code.match(/\bfetch\s*\(|\bXMLHttpRequest\b|\bWebSocket\b|\bsendBeacon\b|https?:\/\/|\/\/[a-z0-9.-]+\.[a-z]{2,}\//gi) || [];
    if (hits.length) bad.push(`${path.relative(ROOT, f)}: ${[...new Set(hits)].join(', ')}`);
  }
  assert.deepEqual(bad, []);
});

test('every file in code/ has at most 300 lines', async () => {
  const long = [];
  for (const f of all) {
    const lines = (await readFile(f, 'utf8')).split('\n').length;
    if (lines > 300) long.push(`${path.relative(ROOT, f)} (${lines})`);
  }
  assert.deepEqual(long, []);
});
