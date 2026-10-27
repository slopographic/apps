// The app words at run time (shared/i18n/apps/<code>.js, written by tools/seo/apptables.mjs from the SEO tables): the
// registry's titles and taglines in the chosen language through one helper (shared/apps.js slopAppTitle / slopAppTagline,
// shared/app-labels.js slopAppLabel), English where a language has none, brand names kept; the homepage strip and
// footer words; the generated files up to date. The owner's case: the homepage in German showed "HTML to PDF converter".
// Run: node --test tests/node/app-words.test.mjs
// Covers: shared/apps.js, shared/app-labels.js, shared/i18n/i18n.js, tools/seo/apptables.mjs, tools/seo/marquee.mjs, tools/seo/footnav.mjs, tools/seo/write.mjs
// Covers: shared/i18n/apps/en.js, shared/i18n/apps/ar.js, shared/i18n/apps/de.js, shared/i18n/apps/es.js, shared/i18n/apps/fr.js, shared/i18n/apps/it.js
// Covers: shared/i18n/apps/ja.js, shared/i18n/apps/ko.js, shared/i18n/apps/nl.js, shared/i18n/apps/pl.js, shared/i18n/apps/pt-BR.js, shared/i18n/apps/ru.js
// Covers: shared/i18n/apps/sv.js, shared/i18n/apps/tr.js, shared/i18n/apps/uk.js, shared/i18n/apps/zh-CN.js, shared/i18n/apps/zh-TW.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runtimeParts, runtimeWords, DIR } from '../../tools/seo/apptables.mjs';
import { marquee } from '../../tools/seo/marquee.mjs';
import { footNav } from '../../tools/seo/footnav.mjs';
import { context } from '../../tools/seo/lang.mjs';
import { table } from '../../shared/seo/i18n.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => readFileSync(path.join(ROOT, f), 'utf8');
const de = table('de');

/** A page's scripts in a vm: profile, i18n (starting in lang), the chrome, the app words a page in lang loads, the registry. */
function boot(lang, { naming } = {}) {
  const store = new Map();
  const ctx = { localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) } };
  ctx.window = ctx;
  vm.createContext(ctx);
  const i18n = read('shared/i18n/i18n.js').replace(/\/\*profile:defaultLang\*\/'en'/, `/*profile:defaultLang*/'${lang}'`);
  let apps = read('shared/apps.js');
  if (naming) apps = apps.replace(/\/\*profile:naming\*\/'brand'/, `/*profile:naming*/'${naming}'`);
  vm.runInContext(read('shared/profile/profile.js'), ctx);
  vm.runInContext(i18n, ctx);
  for (const c of ['en', lang]) if (existsSync(path.join(ROOT, DIR, c + '.js'))) vm.runInContext(read(DIR + c + '.js'), ctx);
  vm.runInContext(apps, ctx);
  vm.runInContext(read('shared/app-labels.js'), ctx);
  return ctx;
}
const app = (w, id) => w.SLOP_APPS.find((a) => a.id === id);

test('German: the title and tagline of the HTML to PDF converter come from the SEO tables (the owner\'s case)', () => {
  const w = boot('de');
  assert.equal(w.SlopI18n.get(), 'de');
  const a = app(w, 'html2pdf');
  assert.equal(a.title, 'HTML to PDF converter', 'the registry stays English');
  assert.equal(w.slopAppTitle(a), de.get('seo.reg.html2pdf.title'));
  assert.notEqual(w.slopAppTitle('html2pdf'), 'HTML to PDF converter');
  assert.equal(w.slopAppTagline(a), de.get('seo.reg.html2pdf.tagline'));
  assert.equal(w.slopAppLabel(a, false), de.get('seo.reg.html2pdf.title'), 'the homepage card');
  assert.equal(w.slopAppLabel(app(w, 'docs'), false), de.get('seo.reg.docs.title'));
});

test('brand names stay as they are in every language; only the descriptive words translate', () => {
  const w = boot('de');
  assert.equal(w.slopAppName('pdf'), 'Slop PDF');
  assert.equal(w.slopAppLabel(app(w, 'pdf'), true), 'Slop PDF');
  assert.match(w.slopAppTitle('photoslop'), /^PhotoSlop: /);
  assert.equal(w.slopAppLabel(app(w, 'photoslop'), true), 'PhotoSlop');
});

test('a language without app words (Swahili) reads the registry\'s English; so does English itself', () => {
  for (const code of ['sw', 'en']) {
    const w = boot(code);
    assert.equal(w.SlopI18n.get(), code);
    assert.ok(!w.SlopI18n.APP_LANGS.includes('sw'));
    assert.equal(w.slopAppTitle('html2pdf'), 'HTML to PDF converter', code);
    assert.equal(w.slopAppTagline(app(w, 'html2pdf')), 'Print an HTML file to PDF with a header and QR code. Nothing uploaded.', code);
    assert.equal(w.slopAppLabel(app(w, 'docs'), false), 'Document editor', code);
  }
});

test('plain names: the title is the plain name; a plain description of its own stays, the brand one translates', () => {
  const w = boot('de', { naming: 'plain' });
  assert.equal(w.slopAppTitle('photoslop'), 'Image Editor');
  assert.equal(w.slopAppLabel(app(w, 'photoslop'), false), 'Image Editor');
  assert.equal(w.slopAppTagline(app(w, 'photoslop')), 'Edit photos with layers, masks and filters.', 'its own plain description (PLAIN)');
  assert.equal(w.slopAppTagline(app(w, 'pdf')), de.get('seo.reg.pdf.tagline'), 'the brand tagline, translated');
});

test('the runtime words: titles, taglines and the strip in German, English only the strip and the footer', () => {
  const dw = new Map(runtimeWords('de')), ew = new Map(runtimeWords('en'));
  assert.equal(dw.get('seo.reg.html2pdf.title'), de.get('seo.reg.html2pdf.title'));
  assert.equal(dw.get('seo.mq.photoslop'), de.get('seo.reg.photoslop.title').split(': ')[1]);
  assert.ok([...dw.keys()].some((k) => k.startsWith('seo.foot.best.')), 'the round-ups in the footer');
  assert.ok(![...ew.keys()].some((k) => k.startsWith('seo.reg.')), 'English titles come from the registry');
  assert.match(ew.get('seo.mq.convert'), /^\d+ conversions$/);
  assert.equal(ew.get('seo.foot.best.free-ai-image-upscalers'), 'Free AI image upscalers');
  assert.notEqual(dw.get('seo.foot.best.free-ai-image-upscalers'), 'Free AI image upscalers');
});

test('the generated files are up to date, one per SEO language, and this test names each (rule 2)', () => {
  const me = read('tests/node/app-words.test.mjs');
  for (const p of runtimeParts()) {
    assert.equal(read(p.file), p.text, `${p.file} is stale: run node tools/seo/write.mjs`);
    if (p.file.startsWith(DIR)) assert.ok(me.includes(p.file), `add "Covers: ${p.file}" to this test`);
  }
  const files = readdirSync(path.join(ROOT, DIR)).sort();
  assert.deepEqual(files, runtimeParts().filter((p) => p.file.startsWith(DIR)).map((p) => p.file.slice(DIR.length)).sort());
  assert.ok(files.length >= 17);
});

test('the strip in a language copy is in that language, each label keyed so the root page follows a switch', () => {
  const root = marquee(), dm = marquee(context('de'));
  assert.match(root, /data-id="html2pdf" tabindex="-1" data-i18n="seo\.mq\.html2pdf">HTML to PDF converter</);
  assert.ok(dm.includes(`data-i18n="seo.mq.html2pdf">${de.get('seo.reg.html2pdf.title')}<`));
  assert.ok(!/>\d+ conversions</.test(dm), 'the English count stays out of German');
  const foot = footNav(context('de'));
  assert.match(foot, /<a href="\/best\/free-ai-image-upscalers\/" data-i18n="seo\.foot\.best\.free-ai-image-upscalers">/);
  assert.ok(!foot.includes('>Free AI image upscalers<'));
});
