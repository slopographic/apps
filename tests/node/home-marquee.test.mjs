// The capability strip under the homepage hero (tools/seo/marquee.mjs): the labels come from the app registry and the
// converter pages, and index.html holds what the generator writes (tools/seo/write.mjs puts it between the markers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { capability, capabilities, buildMarquee, marquee } from '../../tools/seo/marquee.mjs';
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
    { id: 'a', kind: 'app', name: 'A', title: 'A: photo editor' },
    { id: 'g', kind: 'game', name: 'G', title: 'A game' },
    { id: 'b', kind: 'app', name: 'B', title: 'B: Photo editor' },
    { id: 'convert', kind: 'app', name: 'File convert', title: 'File converter' },
  ];
  assert.deepEqual(capabilities(apps, 12), ['photo editor', '12 conversions']);
  assert.deepEqual(capabilities(apps, 0), ['photo editor', 'File converter']);
  const real = capabilities(registryWindow().SLOP_APPS, PAGES.length);
  assert.ok(real.length > 40, String(real.length));
  assert.ok(real.includes(`${PAGES.length} conversions`));
  assert.ok(real.every((l) => l.length > 1 && l.length <= 40), real.join(' | '));
});

test('the html: a labelled list and an aria-hidden copy for the loop, text escaped', () => {
  const html = buildMarquee(['PDF tools', 'a < b']);
  assert.match(html, /^<div class="hx-marquee">/);
  assert.equal((html.match(/<ul class="mq-list"/g) || []).length, 2);
  assert.match(html, /<ul class="mq-list" aria-label="What the apps do" data-i18n-attr="aria-label:hero.marquee"><li>PDF tools<\/li><li>a &lt; b<\/li><\/ul>/);
  assert.match(html, /<ul class="mq-list" aria-hidden="true"><li>PDF tools<\/li>/);
});

test('index.html holds the strip the generator writes (run node tools/seo/write.mjs after changing the apps)', () => {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const m = /<!-- site:marquee -->\n([\s\S]*?)\n<!-- \/site:marquee -->/.exec(html);
  assert.ok(m, 'the marquee markers are in index.html');
  assert.equal(m[1], marquee());
});
