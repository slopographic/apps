// The live site (main, slopographic.com) stays indexable. The preview of the testing branch (slopographic.github.io) gets
// noindex only in its copy, made by .github/workflows/preview.yml; these checks make sure no noindex ever reaches the
// repo's own pages: every page in the sitemap is indexable, and noindex is kept to the pages that should never be in
// search results (the 404 and offline pages, Settings, and the "Moved" pages that send old addresses on).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE = 'https://slopographic.com';
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');
const pages = execFileSync('git', ['ls-files', '*.html'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter((f) => f && !f.startsWith('tests/'));
const robotsOf = (html) => ((html.match(/<meta\s+name="robots"\s+content="([^"]*)"/i) || [])[1] || '').toLowerCase();
const NOT_IN_RESULTS = new Set(['404.html', 'offline.html', 'settings/index.html']);
const isMoved = (html) => /<title>\s*Moved\b/i.test(html);

test('every page in the sitemap is indexable: no noindex or nofollow', () => {
  const urls = [...read('sitemap.xml').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(urls.length > 20, 'the sitemap lists the site');
  for (const u of urls) {
    const rel = u.replace(SITE + '/', '');
    const file = rel === '' ? 'index.html' : rel.endsWith('/') ? rel + 'index.html' : rel;
    assert.ok(existsSync(path.join(ROOT, file)), `${u}: no file ${file}`);
    const robots = robotsOf(read(file));
    assert.ok(!/noindex|nofollow|none/.test(robots), `${u} says robots "${robots}"`);
  }
});

test('noindex is only on the 404 and offline pages, Settings, and "Moved" pages, and none of them is in the sitemap', () => {
  const sitemap = read('sitemap.xml');
  for (const f of pages) {
    const html = read(f);
    if (!/noindex/.test(robotsOf(html))) continue;
    assert.ok(NOT_IN_RESULTS.has(f) || isMoved(html), `${f} says noindex: only pages kept out of results may (see this test)`);
    const url = SITE + '/' + f.replace(/index\.html$/, '');
    assert.ok(!sitemap.includes(`<loc>${url}</loc>`), `${f} says noindex but the sitemap lists it`);
  }
});

test('the preview copy is the only place that adds noindex to every page', () => {
  const wf = read('.github/workflows/preview.yml');
  assert.match(wf, /branches: \[testing\]/, 'the preview is made from the testing branch only');
  assert.match(wf, /noindex, nofollow/);
  assert.match(wf, /rm -rf CNAME/, 'the preview never takes the live domain');
});
