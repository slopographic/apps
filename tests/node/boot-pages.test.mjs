// The boot cover (shared/boot/boot.js) is on every app page, right after the theme script whose colours it uses, and
// on no content page (their HTML is complete as sent, and a cover would only delay it).
// Covers: shared/boot/boot.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const THEME = /<script src="([^"]*)shared\/theme\/theme\.js"[^>]*data-app="([^"]+)"[^>]*><\/script>\n?/;
const CONTENT = new Set(['site', 'home', 'settings']);
const REDIRECTS = new Set(['cutout/index.html', 'slopedit/index.html']);   // old names that only send you on

async function pages() {
  const out = [];
  for (const d of await readdir(ROOT, { withFileTypes: true })) {
    if (!d.isDirectory() || /^(\.|node_modules|tests|vendor)/.test(d.name)) continue;
    for (const rel of [`${d.name}/index.html`, ...(await readdir(path.join(ROOT, d.name), { withFileTypes: true })).filter((x) => x.isDirectory()).map((x) => `${d.name}/${x.name}/index.html`)]) {
      const html = await readFile(path.join(ROOT, rel), 'utf8').catch(() => null);
      const m = html && html.match(THEME);
      if (m) out.push({ rel, html, m });
    }
  }
  return out;
}

test('every app page loads the boot cover right after the theme script, from the same place', async () => {
  const apps = (await pages()).filter((p) => !CONTENT.has(p.m[2]) && !REDIRECTS.has(p.rel));
  assert.ok(apps.length > 50, 'the app pages are found: ' + apps.length);
  for (const { rel, html, m } of apps) {
    const after = html.slice(m.index + m[0].length);
    assert.match(after, new RegExp('^\\s*<script src="' + m[1].replace(/\./g, '\\.') + 'shared/boot/boot\\.js"'), rel);
  }
});

test('content pages do not load it', async () => {
  for (const { rel, html, m } of (await pages()).filter((p) => CONTENT.has(p.m[2]))) assert.doesNotMatch(html, /shared\/boot\/boot\.js/, rel);
});
