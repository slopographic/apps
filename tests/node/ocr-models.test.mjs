// Text recognition models (the OCR family of the shared model chooser): the index entries, the script table that maps each
// language to the models that read it, the ranking per language, the language list and its search, and the suggestion of a
// better model after a first read.
// Run: node --test tests/node/ocr-models.test.mjs
// Covers: aitools/ocr-models.js, shared/ocr/languages.js, shared/ocr/family.js, shared/ocr/suggest.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const O = require('../../aitools/ocr-models.js');
const R = require('../../aitools/model-registry.js');
globalThis.SlopOcrModels = O;
const { ocrLanguages, ocrLanguageName } = await import('../../shared/ocr/languages.js');
const { ocrFamily } = await import('../../shared/ocr/family.js');
const { suggestModel, scriptsIn, unread } = await import('../../shared/ocr/suggest.js');

const ids = (list) => list.map((r) => r.model.id);

test('every OCR model is in the model index, valid, and its cdn files are on the pinned commit', () => {
  assert.deepEqual(R.problems(), []);
  for (const m of O.MODELS) {
    if (m.id === O.QUICK) assert.deepEqual(R.byId(m.id).files, m.files, 'the bundled model is the same in both lists');
    else assert.equal(R.byId(m.id), m, m.id + ' in the index');
    assert.equal(m.tool, 'ocr');
    assert.equal(m.licence, 'Apache-2.0');
    const onnx = m.files.filter((f) => f.name.endsWith('.onnx')), txt = m.files.filter((f) => f.name.endsWith('.txt'));
    assert.equal(onnx.length, 2, m.id + ': a detector and a recogniser');
    assert.equal(onnx.filter((f) => f.name.endsWith('_det_infer.onnx')).length, 1, m.id + ': one detector');
    assert.equal(txt.length, 1, m.id + ': one dictionary');
    for (const f of m.files) {
      if (m.id === O.QUICK) continue;
      assert.ok(f.url.startsWith(O.CDN), `${m.id}/${f.name} is on the pinned cdn commit`);
      assert.match(f.url, /\/slopographic\/cdn\/[0-9a-f]{40}\/models\/ocr\//);
      assert.ok(R.allowedUrl(f.url));
    }
  }
  assert.equal(O.QUICK, 'ppocr-v4');
  assert.ok(R.TOOLS.find((t) => t.id === 'ocr').models.includes('ppocr-v4'));
});

test('one table maps each language to its script group', () => {
  assert.deepEqual(O.scriptOf('sv'), ['latin']);
  assert.deepEqual(O.scriptOf('de'), ['latin']);
  assert.deepEqual(O.scriptOf('ru'), ['cyrillic']);
  assert.deepEqual(O.scriptOf('sr').sort(), ['cyrillic', 'latin']);
  assert.deepEqual(O.scriptOf('fa'), ['arabic']);
  assert.deepEqual(O.scriptOf('hi'), ['devanagari']);
  assert.deepEqual(O.scriptOf('ja'), ['cjk']);
  assert.deepEqual(O.scriptOf('zh-Hant'), ['cjk']);
  assert.deepEqual(O.scriptOf('ko'), ['korean']);
  assert.deepEqual(O.scriptOf('xx'), []);
  for (const m of O.MODELS) assert.deepEqual(m.languages, [...new Set(m.scripts.flatMap((s) => O.SCRIPTS[s].languages))], m.id);
  // every script group has its model, and the Latin one reads Romanian and Latvian too
  for (const s of Object.keys(O.SCRIPTS)) assert.ok(O.MODELS.some((m) => m.scripts.includes(s)), s);
  assert.deepEqual(O.scriptOf('ro'), ['latin']);
  assert.equal(O.modelOfScript('latin').id, 'ppocr-v6-small');
  assert.equal(O.modelOfScript('cjk').id, 'ppocr-v6-small');
});

test('ranking: the script model first for its languages, the quick model last where it reads the language', () => {
  assert.deepEqual(ids(O.rank('sv')), ['ppocr-v6-small']);
  assert.equal(O.rank('sv')[0].badges[0], 'recommended');
  assert.equal(O.modelFor('sv').id, 'ppocr-v6-small');
  assert.equal(O.modelFor('uk').id, 'ppocr-v5-cyrillic');
  assert.equal(O.modelFor('ar').id, 'ppocr-v5-arabic');
  assert.equal(O.modelFor('ja').id, 'ppocr-v6-small');
  assert.equal(O.modelFor('xx'), null);
  const zh = ids(O.rank('zh'));
  assert.equal(zh[0], 'ppocr-v6-small');
  assert.equal(zh[zh.length - 1], 'ppocr-v4');
  assert.deepEqual(ids(O.rank('en')), ['ppocr-v6-small', 'ppocr-v4']);
  assert.ok(!ids(O.rank('ar')).includes('ppocr-v4'), 'the Chinese and English model is not offered for Arabic');
  // no language yet: every model, the quick one first
  const auto = ids(O.rank('auto'));
  assert.equal(auto[0], 'ppocr-v4');
  assert.equal(auto.length, O.MODELS.length);
});

test('the language list: names from the site list, search, the browser locale, the family object', () => {
  const L = ocrLanguages(O);
  assert.equal(L.name('sv'), 'Swedish');
  assert.equal(ocrLanguageName('zh-Hant'), 'Chinese (traditional)');
  assert.equal(L.name('auto'), 'Detect automatically');
  assert.equal(L.LANGUAGES.length, O.CODES.length);
  assert.ok(L.LANGUAGES.every((l) => l.name && l.name !== l.code), 'every language has a name');
  assert.deepEqual(L.filter('swe').map((l) => l.code), ['sv']);
  assert.deepEqual(L.filter('trad').map((l) => l.code), ['zh-Hant']);
  assert.equal(L.filter('')[0].code, 'auto');
  assert.equal(L.fromLocale('sv-SE'), 'sv');
  assert.equal(L.fromLocale('nb-NO'), 'no');
  assert.equal(L.fromLocale('zh-TW'), 'zh-Hant');
  assert.equal(L.fromLocale('xx'), null);
  const F = ocrFamily(O);
  assert.equal(F.id, 'ocr');
  assert.equal(F.catalog, O);
  assert.equal(F.languages.name('ru'), 'Russian');
});

const line = (text, score = 0.95, w = 400, h = 40) => ({ text, score, box: { x: 0, y: 0, w, h } });

test('suggestion after a first read: another script, accents, unclear lines, or nothing', () => {
  const s = (lines, model = 'ppocr-v4', locale = null) => suggestModel(lines, { model, catalog: O, locale });
  // Korean letters, kana, Arabic: that script's model
  assert.deepEqual(s([line('안녕하세요 세계', 0.9, 300)]), { language: 'ko', model: 'ppocr-v5-korean', script: 'korean', reason: 'script' });
  assert.equal(s([line('日本語のテキスト')]).model, 'ppocr-v6-small');
  assert.equal(s([line('مرحبا بالعالم', 0.9, 300)], 'ppocr-v6-small').model, 'ppocr-v5-arabic');
  assert.equal(s([line('Привет мир, как дела', 0.95, 400)], 'ppocr-v6-small', 'uk').language, 'uk', 'the browser language when it is in that script');
  // Latin text with accents read by the quick model: the Latin model, for the browser's language
  assert.deepEqual(s([line('Räksmorgas pa Aland är gott')], 'ppocr-v4', 'sv'), { language: 'sv', model: 'ppocr-v6-small', script: 'latin', reason: 'accents' });
  assert.equal(s([line('Grosse Strasse, déja vu')]).model, 'ppocr-v6-small');
  // plain English on the quick model: nothing to say
  assert.equal(s([line('Invoice 2026-0042 total 1,250.00')], 'ppocr-v4', 'en'), null);
  // empty lines or low scores: unclear, with the browser language's model when there is one
  const garbled = [line(' CbeWb *e eWe 3THx', 0.81), line('', 0, 500)];
  assert.deepEqual(s(garbled, 'ppocr-v4', 'ru'), { language: 'ru', model: 'ppocr-v5-cyrillic', script: 'cyrillic', reason: 'unclear' });
  assert.deepEqual(s(garbled), { language: null, model: null, script: null, reason: 'unclear' });
  // lines the engine found but read as nothing count as unread (the Latin model on Russian reads only the digits)
  assert.equal(suggestModel([line(', 12 2026', 0.99, 120)], { model: 'ppocr-v6-small', catalog: O, skipped: 2 }).reason, 'unclear');
  assert.equal(suggestModel([line(', 12 2026', 0.99, 120)], { model: 'ppocr-v6-small', catalog: O, skipped: 0 }), null);
  // the right model already: nothing
  assert.equal(s([line('Съешь же ещё этих мягких булок')], 'ppocr-v5-cyrillic'), null);
  assert.equal(s([line('日本語のテキスト')], 'ppocr-v6-small'), null);
});

test('scriptsIn counts letters per script, unread spots lines far shorter than their box', () => {
  assert.deepEqual(scriptsIn('abc Жж').map((x) => x.script), ['latin', 'cyrillic']);
  assert.equal(unread(line('   ', 0.9, 500, 40)), true);
  assert.equal(unread(line('ab', 0.9, 500, 40)), true);
  assert.equal(unread(line('a fine line of text', 0.9, 500, 40)), false);
  assert.equal(unread(line('日本', 0.9, 80, 40)), false);
});
