// What the desktop app carries and how it is named: the bundled site leaves out the repository's own folders, the other
// languages' SEO copies and the website-only root files; the name, id, installers and update feed come from the brand;
// the site's download links point at exactly the installers the build makes; under app:// no service worker registers.
// Covers: desktop/lib/bundle-list.js
// Covers: desktop/scripts/bundle.mjs
// Covers: desktop/lib/brand.js
// Covers: desktop/builder.config.js
// Covers: shared/desktop/download.js
// Covers: shared/pwa.js
// Covers: settings/updates.js
// Covers: tools/whitelabel/emit.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { plan, languages } from '../../desktop/scripts/bundle.mjs';
import { brandJson } from '../../tools/whitelabel/emit.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const { bundled, langDirsOf } = require('../../desktop/lib/bundle-list.js');
const B = require('../../desktop/lib/brand.js');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

test('bundled: the pages and what they load stay; repository, SEO copies and website-only files go', () => {
  const langs = ['sv', 'de', 'pt-br'];
  for (const f of ['index.html', 'pdf/index.html', 'shared/pwa.js', 'vendor/pdfjs/pdf.min.js', 'manifest.webmanifest', '404.html', 'favicon.svg', 'LICENSE', 'assets/icons/icon-512.png'])
    assert.ok(bundled(f, langs), f);
  for (const f of ['tests/run.mjs', 'tools/check-rules.mjs', '.github/workflows/rules.yml', '.gitignore', 'desktop/main/main.js', 'sv/index.html', 'pt-br/pdf/index.html',
    'best/free-crm-software/index.html', 'compare/index.html', 'sitemap.xml', 'robots.txt', 'ads.txt', 'CNAME', 'docs-1280-dark.png', 'package.json', 'README.md', '../x', '/etc/passwd'])
    assert.ok(!bundled(f, langs), f);
  assert.deepEqual(langDirsOf([{ code: 'en' }, { code: 'sv' }, { code: 'pt-BR' }], 'en'), ['sv', 'pt-br']);
});

test('the bundle plan over this checkout: every page folder of the registry, no other-language folder', () => {
  const files = plan(ROOT);
  const set = new Set(files);
  const { langs, rootLang } = languages(ROOT);
  assert.ok(langs.length > 1 && rootLang);
  assert.ok(set.has('index.html') && set.has('drive/index.html') && set.has('shared/apps.js') && set.has('brand/brand.json'));
  const others = langDirsOf(langs, rootLang);
  assert.ok(!files.some((f) => others.includes(f.split('/')[0])), 'no language folder');
  assert.ok(!files.some((f) => /^(tests|tools|desktop|\.github)\//.test(f)));
  const win = {};
  vm.runInNewContext(read('shared/apps.js'), { window: win, Object, Array, JSON });
  for (const a of win.SLOP_APPS.filter((x) => x.kind === 'app' && x.status !== 'building')) {
    const page = a.path.replace(/^\//, '') + 'index.html';
    if (set.has(page) || !files.length) continue;
    assert.fail(`${a.id}: ${page} is not bundled`);
  }
});

test('the brand: name, app id and release home from the profile; GITHUB_REPOSITORY wins for the feed', () => {
  const b = B.loadBrand(ROOT, undefined, {});
  const brand = JSON.parse(read('brand/brand.json'));
  assert.equal(b.name, brand.name);
  assert.equal(b.slug, B.slugOf(brand.name));
  assert.match(b.appId, /^com\.[a-z0-9]+\.[a-z0-9]+$/);
  assert.equal(b.repo, 'apps');
  const ci = B.loadBrand(ROOT, undefined, { GITHUB_REPOSITORY: 'someone/fork' });
  assert.deepEqual([ci.owner, ci.repo], ['someone', 'fork']);
  assert.equal(B.slugOf('Acme Tools!'), 'Acme-Tools');
});

test('the electron-builder configuration: installers, associations, signing only with secrets, store builds', () => {
  const b = { name: 'Acme Tools', slug: 'Acme-Tools', appId: 'com.acme.tools', origin: 'https://tools.acme.example', owner: 'acme', repo: 'apps' };
  const c = B.builderConfig(b, {});
  assert.equal(c.productName, 'Acme Tools');
  assert.deepEqual(c.publish, [{ provider: 'github', owner: 'acme', repo: 'apps', releaseType: 'release' }]);
  assert.equal(c.nsis.artifactName, 'Acme-Tools-Setup.exe');
  assert.equal(c.dmg.artifactName, 'Acme-Tools.dmg');
  assert.equal(c.mac.artifactName, 'Acme-Tools-mac.zip');
  assert.equal(c.appImage.artifactName, 'Acme-Tools.AppImage');
  assert.deepEqual(c.mac.target.map((x) => x.target), ['dmg', 'zip'], 'the zip is what the mac updater downloads');
  assert.equal(c.mac.identity, '-', 'unsigned: ad-hoc');
  assert.equal(c.mac.notarize, false);
  assert.ok(c.fileAssociations.some((f) => f.ext.includes('pdf')) && c.fileAssociations.some((f) => f.ext.includes('psd')));
  assert.deepEqual(c.extraResources, [{ from: '.site', to: 'site' }], 'the site beside app.asar');
  assert.ok(!c.files.some((f) => /tests|tools|site/.test(f)));
  const signed = B.builderConfig(b, { CSC_LINK: 'x', APPLE_ID: 'a' });
  assert.equal(signed.mac.identity, undefined);
  assert.equal(signed.mac.notarize, true);
  const mas = B.builderConfig(b, { DESKTOP_STORE: 'mas' });
  assert.equal(mas.publish, null, 'a store build has no update feed');
  assert.deepEqual(mas.mac.target.map((x) => x.target), ['mas']);
  assert.match(read('desktop/' + mas.mas.entitlements), /com\.apple\.security\.app-sandbox/);
  assert.match(read('desktop/' + mas.mas.entitlementsInherit), /com\.apple\.security\.inherit/);
  const appx = B.builderConfig(b, { DESKTOP_STORE: 'appx', APPX_PUBLISHER: 'CN=1234' });
  assert.deepEqual(appx.win.target.map((x) => x.target), ['appx']);
  assert.equal(appx.appx.publisher, 'CN=1234');
  assert.equal(appx.publish, null);
  const real = require('../../desktop/builder.config.js');
  assert.equal(real.productName, JSON.parse(read('brand/brand.json')).name);
});

test('the site\'s download links name the installers the build makes; a brand without a release has none', () => {
  const brand = JSON.parse(read('brand/brand.json'));
  const ctx = { window: {}, document: { currentScript: null }, navigator: { userAgent: '' }, URL, fetch: null };
  ctx.window = ctx;
  vm.runInNewContext(read('shared/desktop/download.js'), ctx);
  const D = ctx.SlopDesktopDownload;
  assert.equal(D.links(null).length, 0);
  if (brand.desktop) {
    const names = B.artifactNames(B.slugOf(brand.name));
    assert.deepEqual(brand.desktop.files, { windows: names.windows, mac: names.mac, linux: names.linux });
    const l = D.links(brand.desktop, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)');
    assert.equal(l[0].os, 'Mac', 'this system first');
    assert.ok(l.every((x) => x.href.startsWith(brand.desktop.release.replace(/\/$/, '') + '/download/')));
    assert.equal(D.links(brand.desktop, 'Mozilla/5.0 (Linux; Android 14)').filter((x) => x.mine).length, 0);
  }
  // a white-label build writes brand.json from its profile: no "desktop" unless the profile has one
  const out = JSON.parse(JSON.stringify(brandJson(brand, { name: 'Acme', tagline: '', colors: {}, footer: '', links: {} })));
  assert.equal(out.desktop, undefined);
});

test('under app:// the service worker is not registered and no install button shows', () => {
  const button = { hidden: true, addEventListener() {} };
  let registered = 0;
  const win = {
    location: { protocol: 'app:', search: '', href: 'app://h/' },
    navigator: { serviceWorker: { register: () => { registered++; return Promise.resolve(); } } },
    addEventListener() {}, matchMedia: () => ({ matches: false }), localStorage: { getItem: () => null, setItem() {} },
  };
  const ctx = { window: win, document: { readyState: 'complete', querySelectorAll: () => [button], getElementById: () => null, head: { append() {} }, createElement: () => ({}) }, URLSearchParams, URL, setTimeout };
  vm.runInNewContext(read('shared/pwa.js'), ctx);
  assert.equal(win.SlopPWA.mount({ install: '#pwa-install' }), false);
  assert.equal(registered, 0);
  assert.equal(button.hidden, true);
  assert.match(read('settings/index.html'), /id="desktop-download"[^>]*hidden/);
  assert.match(read('settings/updates.js'), /SlopDesktopDownload\.mount/);
});
