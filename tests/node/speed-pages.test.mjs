// The pages the speed check measures (tools/speed/pages.mjs): every sitemap URL, every app page in shared/apps.js and the
// site pages outside the sitemap, each once, and each a file in the checkout.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { sitemapPaths, appPaths, allPages, readApps, discoverPages, FIXED, ROOT } from '../../tools/speed/pages.mjs';

test('sitemap URLs become site paths, the root the empty path', () => {
  const xml = '<urlset><url><loc>https://slopographic.com/</loc></url><url><loc> https://slopographic.com/pdf/sign-pdf/ </loc></url></urlset>';
  assert.deepEqual(sitemapPaths(xml), ['', 'pdf/sign-pdf/']);
});

test('app paths keep relative pages only, with a trailing slash', () => {
  const apps = [{ path: 'pdf/' }, { path: 'games/snake' }, { path: '#detector' }, { path: 'https://example.com/' }, { path: '' }, { path: 'x/?a=1' }, { path: 'play.html' }];
  assert.deepEqual(appPaths(apps), ['pdf/', 'games/snake/', 'x/', 'play.html']);
});

test('every page is listed once, in name order, the homepage first', () => {
  assert.deepEqual(allPages({ sitemap: ['b/', '', 'a/'], apps: ['a/', 'c/'], fixed: ['', 'settings/'] }), ['', 'a/', 'b/', 'c/', 'settings/']);
});

const pages = discoverPages();
const sitemap = sitemapPaths(readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8'));

test('the site pages include every URL in sitemap.xml, and each is a file in the checkout', () => {
  assert.ok(sitemap.length > 100, 'sitemap looks empty');
  const set = new Set(pages);
  const missing = sitemap.filter((p) => !set.has(p));
  assert.deepEqual(missing, [], 'sitemap URLs with no page file');
});

test('the site pages include every app in shared/apps.js and the fixed site pages', () => {
  const apps = appPaths(readApps());
  assert.ok(apps.length > 30, 'registry looks empty');
  const set = new Set(pages);
  assert.deepEqual(apps.filter((p) => !set.has(p)), [], 'apps with no page');
  assert.deepEqual(FIXED.filter((p) => !set.has(p)), []);
  for (const p of ['', 'settings/', 'how-it-works/', 'all-tools/', 'compare/', 'best/']) assert.ok(set.has(p), p || '/');
});

test('every page is once in the list, and each page path points at an index.html', () => {
  assert.equal(new Set(pages).size, pages.length);
  for (const p of pages) assert.ok(existsSync(path.join(ROOT, p, p.endsWith('.html') ? '' : 'index.html')), p);
});
