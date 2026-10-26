// The string tables of the shared chrome, the shared components and every app (tools/i18n): the checker finds nothing
// (every key in every shipped language, the same {placeholders}, keys the code asks for exist), COVERAGE.md is up to
// date, no app loses translated coverage (the ratchet, tests/node/i18n-coverage.baseline.json), and every table file is
// named in tests/i18n/tables.covers.txt. Also the checker's own rules on small tables, and the extractor's heuristics.
// Covers: tools/i18n/i18n.mjs, tools/i18n/check.mjs, tools/i18n/coverage.mjs, tools/i18n/tables.mjs, tools/i18n/scan.mjs
// Run: node --test tests/node/i18n-tables.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { check, compare, placeholders } from '../../tools/i18n/check.mjs';
import { scan, render, levels, losses, raise, OUT, BASELINE } from '../../tools/i18n/coverage.mjs';
import { ROOT, COVERS, coversText, langs, apps, appTables } from '../../tools/i18n/tables.mjs';
import { scanJs, scanHtml, wordy } from '../../tools/i18n/scan.mjs';

const rows = scan();
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');

test('the tables are sound (node tools/i18n/i18n.mjs --check)', () => {
  assert.deepEqual(check(), []);
});

test('COVERAGE.md and tables.covers.txt are up to date (node tools/i18n/i18n.mjs coverage)', () => {
  assert.equal(read(OUT), render(rows));
  assert.equal(read(COVERS), coversText());
});

test('no app or shared table loses translated coverage in any language (the ratchet)', () => {
  const base = JSON.parse(read(BASELINE));
  const lost = rows.filter((r) => base[r.id]).map((r) => [r.id, losses(levels(r), base[r.id])]).filter(([, l]) => l.length);
  assert.deepEqual(lost, [], 'raise coverage, or put new text in the tables; node tools/i18n/i18n.mjs coverage --baseline records a gain');
});

test('the shared chrome and the shared components are complete in every language', () => {
  for (const id of ['chrome', 'ui']) {
    const r = rows.find((x) => x.id === id);
    for (const l of langs()) assert.equal(r.langs[l.code], r.keys, `${id} in ${l.code}`);
  }
});

test('the PDF editor ships English and Swedish tables, loaded from its page head', () => {
  const t = appTables(apps().find((a) => a.id === 'pdf'));
  assert.ok(t.langs.includes('en') && t.langs.includes('sv'), 'en and sv');
  assert.ok(t.tables.en.size > 300, 'the English tables hold the app');
  const head = read('pdf/index.html').split('</head>')[0];
  assert.match(head, /shared\/i18n\/i18n\.js[\s\S]*i18n\/index\.js/, 'i18n.js, then the index, in the head');
});

test('compare(): a missing key, a changed placeholder, an extra key and a bad plural form are problems', () => {
  const en = new Map([['a.x', 'Delete {n} pages'], ['a.y', 'Close'], ['a.x#one', 'Delete {n} page']]);
  assert.deepEqual(compare('t', en, new Map([['a.x', 'Ta bort {n} sidor'], ['a.y', 'Stäng'], ['a.x#one', 'Ta bort {n} sida'], ['a.x#few', 'x {n}']])), []);
  const bad = compare('t', en, new Map([['a.x', 'Ta bort {count} sidor'], ['a.z', 'z'], ['a.x#lots', 'x'], ['a.x#many', 'x']]));
  assert.ok(bad.some((m) => /missing a\.y/.test(m)));
  assert.ok(bad.some((m) => /a\.x has \{count\}/.test(m)));
  assert.ok(bad.some((m) => /a\.z is not an English key/.test(m)));
  assert.ok(bad.some((m) => /a\.x#lots: not a plural category/.test(m)));
  assert.ok(bad.some((m) => /a\.x#many has \{\}/.test(m)));
  assert.equal(placeholders('{b} and {a}'), 'a,b');
});

test('the ratchet keeps the best coverage and reports a loss', () => {
  const r = { id: 'x', keys: 10, hard: 10, langs: { en: 10, sv: 5 } };
  assert.deepEqual(levels(r), { en: 50, sv: 25 });
  assert.deepEqual(losses({ en: 50, sv: 20 }, { en: 50, sv: 25 }), ['sv: 20%, was 25%']);
  assert.deepEqual(raise([r], { x: { sv: 40 } }).x, { en: 50, sv: 40 }, 'never lowered');
});

test('the extractor finds UI text and skips ids, keys, selectors, paths and code', () => {
  const js = [
    "SlopUI.toast('Saved to Drive');",
    "var o = { label: 'Rotate right', id: 'rotate-right', cls: 'sui-btn sf-btn' };",
    "el.title = 'Zoom in';",
    "h('button', { class: 'x' }, 'Try a sample');",
    "console.warn('Something broke here');",
    "throw new Error('Bad input value');",
    "document.querySelector('.menu-b');",
    "var k = t('pdf.menu.open'); var f = 'shared/i18n/i18n.js';",
    "if (mode === 'Single page') go(); // i18n-ignore",
    'var re = /Not a string/g;',
  ].join('\n');
  const found = scanJs(js).map((s) => s.text);
  assert.deepEqual(found, ['Saved to Drive', 'Rotate right', 'Zoom in', 'Try a sample']);
  const html = '<head><title>Skip</title></head><body><h1>Drop PDFs here</h1><b data-i18n="x.y">Done</b><button aria-label="Close panel"><svg><text>no</text></svg></button><script>var x = "No";</script></body>';
  assert.deepEqual(scanHtml(html).map((s) => s.text), ['Close panel', 'Drop PDFs here']);
  for (const s of ['Rotate', 'Open PDFs or images…', 'to move']) assert.equal(wordy(s), true, s);
  for (const s of ['pdf.menu.open', 'rotate-right', 'camelCase', 'PDF', 'Ctrl+S', '../x/y.js', 'sui-btn sf-btn', 'use strict']) assert.equal(wordy(s), false, s);
});
