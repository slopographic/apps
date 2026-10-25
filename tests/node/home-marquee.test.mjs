// The capability strip under the homepage hero (tools/seo/marquee.mjs): the labels come from the app registry and the
// converter pages, and index.html holds what the generator writes (tools/seo/write.mjs puts it between the markers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capability, capabilities, entries, buildMarquee, marquee } from '../../tools/seo/marquee.mjs';
import { registryWindow } from '../../tools/seo/site.mjs';
import { PAGES } from '../../convert/js/core/pages.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('a label is the short part of the app title', () => {
  assert.equal(capability({ name: 'PhotoSlop', title: 'PhotoSlop: photo editor' }), 'photo editor');
  assert.equal(capability({ name: 'Slop OCR', title: 'OCR: read text from images and scans' }), 'OCR');
  assert.equal(capability({ name: 'Slop Contacts', title: 'Contacts (address book)' }), 'Contacts');
  assert.equal(capability({ name: 'Slop Colors', title: 'Colour picker, palette generator and contrast checker' }), 'Colour picker');
  assert.equal(capability({ name: 'Slop Workflows', title: 'Batch workflows across apps' }), 'Batch workflows');
  assert.equal(capability({ name: 'Slop Notes' }), 'Slop Notes');
});

test('the strip lists every app once, in registry order, with File convert as its number of conversions', () => {
  const apps = [
    { id: 'a', kind: 'app', name: 'A', path: 'a/', title: 'A: photo editor' },
    { id: 'g', kind: 'game', name: 'G', path: 'g/', title: 'A game' },
    { id: 'b', kind: 'app', name: 'B', path: 'b/', title: 'B: Photo editor' }, { id: 'h', kind: 'app', name: 'H', path: '#h', title: 'Hash view' },
    { id: 'convert', kind: 'app', name: 'File convert', path: 'convert/', title: 'File converter' },
  ];
  assert.deepEqual(capabilities(apps, 12), ['photo editor', '12 conversions']);
  assert.deepEqual(capabilities(apps, 0), ['photo editor', 'File converter']);
  const real = capabilities(registryWindow().SLOP_APPS, PAGES.length);
  assert.ok(real.length > 40, String(real.length));
  assert.ok(real.includes(`${PAGES.length} conversions`));
  assert.ok(real.every((l) => l.length > 1 && l.length <= 40), real.join(' | '));
});

test('the html: a labelled list of links to the apps (one tab stop) and an aria-hidden copy kept out of the tab order', () => {
  const html = buildMarquee([{ id: 'pdf', path: 'pdf/', label: 'PDF tools' }, { id: 'x', path: 'x/', label: 'a < b' }]);
  assert.match(html, /^<div class="hx-marquee" data-controls>/);   // a strip of moving links: Sloppo keeps off it all
  assert.equal((html.match(/<ul class="mq-list"/g) || []).length, 2);
  assert.match(html, /<ul class="mq-list" aria-label="What the apps do" data-i18n-attr="aria-label:hero.marquee"><li><a href="pdf\/" data-id="pdf" tabindex="0">PDF tools<\/a><\/li><li><a href="x\/" data-id="x" tabindex="-1">a &lt; b<\/a><\/li><\/ul>/);
  const copy = html.slice(html.indexOf('aria-hidden="true"'));
  assert.match(copy, /^aria-hidden="true"><li><a href="pdf\/" data-id="pdf" tabindex="-1">PDF tools<\/a>/);
  assert.ok(!/tabindex="0"/.test(copy));
});

test('every strip entry links to its app\'s own page, from the registry', () => {
  const win = registryWindow(), list = entries(win.SLOP_APPS, PAGES.length);
  for (const e of list) {
    const a = win.SLOP_APPS.find((x) => x.id === e.id);
    assert.ok(a && a.kind === 'app' && e.path === a.path && !a.path.startsWith('#'), e.id);
  }
  assert.deepEqual(list.map((e) => e.label), capabilities(win.SLOP_APPS, PAGES.length));
});

test('index.html holds the strip the generator writes (run node tools/seo/write.mjs after changing the apps)', () => {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /<!-- site:marquee -->\n([\s\S]*?)\n<!-- \/site:marquee -->/.exec(html);
  assert.ok(m, 'the marquee markers are in index.html');
  assert.equal(m[1], marquee());
});
