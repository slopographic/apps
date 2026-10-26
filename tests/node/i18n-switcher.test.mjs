// The header's language menu (shared/i18n/switcher.js): its rows come from the language list (data), each language by
// its own name with the current one checked, and a choice goes through the one setter SlopI18n.set, so it is stored in
// the profile like the Settings picker's. Also the engine's {placeholders} on marked elements (data-i18n-vars, {brand})
// and the header strings in every language. Run: node --test tests/node/i18n-switcher.test.mjs
// Covers: shared/i18n/switcher.js, shared/i18n/i18n.js, shared/i18n/strings.js, shared/i18n/sv.js, shared/i18n/de.js,
//   shared/i18n/es.js, shared/i18n/fr.js, shared/i18n/it.js, shared/i18n/pt-BR.js, shared/i18n/ar.js, settings/language.js,
//   shell/header.js, shell/shell.js, shell/notify.js, shared/tour/mount.js, shared/ui/hbtn.js, shared/ui/menubutton.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadInto, plain } from './fx-env.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LANG_FILES = ['es', 'fr', 'de', 'pt-BR', 'it', 'ar', 'sv'].map((c) => `i18n/${c}.js`);
const memStorage = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
async function page(seed = {}, extra = {}) {
  const storage = memStorage(seed);
  const ctx = await loadInto(['profile/profile.js', 'i18n/i18n.js', 'i18n/strings.js', ...LANG_FILES, 'i18n/switcher.js'], { localStorage: storage, ...extra });
  return { ctx, I: ctx.SlopI18n, S: ctx.SlopLangSwitch, storage };
}
const stored = (storage) => JSON.parse(storage.getItem('slop-profile') || 'null');

test('the menu lists every language from the list, in list order, each by its own name, the current one checked', async () => {
  const { I, S } = await page();
  const rows = plain(S.items(I));
  assert.deepEqual(rows.map((r) => r.value), plain(I.LANGS).map((l) => l.code), 'from the data, not a copy of it');
  assert.deepEqual(rows.map((r) => r.label), ['English', 'Español', 'Français', 'Deutsch', 'Português (Brasil)', 'Italiano', 'العربية', 'Svenska']);
  assert.deepEqual(rows.filter((r) => r.checked).map((r) => r.value), ['en']);
  assert.equal(rows.find((r) => r.value === 'ar').dir, 'rtl');
  assert.ok(rows.every((r) => r.lang === r.value), 'each row says its own language');
});

test('a language added to the list shows in the menu with no change to the switcher', async () => {
  const { ctx, S } = await page();
  const list = [{ code: 'en', name: 'English', dir: 'ltr', complete: true }, { code: 'nb', name: 'Norsk bokmål', dir: 'ltr', complete: false }];
  const I = ctx.SlopI18n.create({ languages: list, storage: memStorage({ 'slop-profile': JSON.stringify({ v: 1, data: { lang: { mode: 'nb' } } }) }) });
  assert.deepEqual(plain(S.items(I)).map((r) => [r.value, r.label, r.checked]), [['en', 'English', false], ['nb', 'Norsk bokmål', true]]);
});

test('the button text is the short code', async () => {
  const { S } = await page();
  assert.equal(S.short('en'), 'EN');
  assert.equal(S.short('pt-BR'), 'PT');
  assert.equal(S.short('ar'), 'AR');
  assert.equal(S.short('sv'), 'SV');
});

test('a choice goes through SlopI18n.set (the Settings picker\'s setter) and is stored in the profile', async () => {
  const calls = [];
  const fake = { set: (c) => { calls.push(c); return { ok: true, code: c }; } };
  const { S: S0 } = await page();
  assert.deepEqual(plain(S0.pick(fake, 'sv')), { ok: true, code: 'sv' });
  assert.deepEqual(calls, ['sv'], 'the one setter, nothing of its own');

  const { I, S, storage } = await page();
  assert.equal(S.pick(I, 'sv').ok, true);
  assert.equal(stored(storage).data.lang.mode, 'sv', 'stored where Settings stores it');
  assert.equal(I.get(), 'sv');
  assert.deepEqual(plain(S.items(I)).filter((r) => r.checked).map((r) => r.value), ['sv']);
  assert.equal(I.t('shell.theme'), 'Tema');
  // a new page over the same storage starts in Swedish
  const again = await page({ 'slop-profile': storage.getItem('slop-profile') });
  assert.equal(again.I.get(), 'sv');
  // an unknown code is refused and nothing changes
  assert.equal(S.pick(I, 'xx').ok, false);
  assert.equal(I.get(), 'sv');
  // back to English (the default choice) clears the override, as in Settings
  S.pick(I, 'en');
  assert.ok(!stored(storage).data.lang);
});

test('the header strings are in every language: Theme, Install, Tours, Notifications, Language', async () => {
  const { I, S } = await page();
  const keys = ['shell.language', 'shell.language_now', 'shell.theme', 'shell.theme_system', 'shell.more', 'shell.install', 'shell.install_title',
    'shell.tours', 'shell.tours_title', 'shell.tour', 'shell.tour_title', 'shell.notifications', 'shell.notifications_new', 'shell.clear_all'];
  const en = Object.fromEntries(keys.map((k) => [k, I.t(k)]));
  assert.equal(en['shell.tours_title'], 'Guided tours for each app');
  for (const code of ['sv', 'de', 'es', 'fr', 'it', 'pt-BR', 'ar']) {
    S.pick(I, code);
    for (const k of keys) assert.notEqual(I.t(k), k, `${code} ${k}`);
  }
  S.pick(I, 'sv');
  assert.equal(I.t('shell.tours'), 'Guider');
  assert.equal(I.t('shell.notifications_new', { n: 3 }), 'Aviseringar, 3 nya');
  assert.equal(I.t('shell.language_now', { name: 'Svenska' }), 'Språk: Svenska');
});

test('{brand} is the brand profile\'s name, and data-i18n-vars fills placeholders on marked elements', async () => {
  const { I, ctx } = await page();
  assert.equal(I.t('shell.install_title'), 'Install Slopographic', 'this site, before brand.js');
  ctx.SlopBrand = { config: { name: 'Acme Tools' } };
  assert.equal(I.t('shell.install_title'), 'Install Acme Tools', 'a white-label build names its own brand');
  const el = (attrs, text = '') => ({ attrs: { ...attrs }, textContent: text, getAttribute(n) { return n in this.attrs ? this.attrs[n] : null; }, setAttribute(n, v) { this.attrs[n] = String(v); } });
  const root = el({}), tour = el({ 'data-i18n-attr': 'title:shell.tour_title', 'data-i18n-vars': '{"app":"Slop PDF"}' }), inst = el({ 'data-i18n': 'shell.install_title' });
  const nodes = { '[data-i18n]': [inst], '[data-i18n-attr]': [tour] };
  const J = ctx.SlopI18n.create({ storage: memStorage({ 'slop-profile': JSON.stringify({ v: 1, data: { lang: { mode: 'sv' } } }) }), document: { documentElement: root, querySelectorAll: (s) => nodes[s] || [] } });
  J.add('en', { 'shell.tour_title': 'Start the {app} tour', 'shell.install_title': 'Install {brand}' });
  J.add('sv', { 'shell.tour_title': 'Starta guiden för {app}', 'shell.install_title': 'Installera {brand}' });
  J.apply();
  assert.equal(tour.attrs.title, 'Starta guiden för Slop PDF');
  assert.equal(inst.textContent, 'Installera Acme Tools');
  assert.equal(root.attrs.lang, 'sv');
});

test('the shell loads the switcher and the header mounts it; the header strings are marked for SlopI18n', async () => {
  const read = (f) => readFile(path.join(ROOT, f), 'utf8');
  assert.match(await read('shell/shell.js'), /shared\/i18n\/switcher\.js/);
  const header = await read('shell/header.js');
  assert.match(header, /SlopLangSwitch\.button\(\)/);
  assert.match(header, /data-i18n="shell\.theme"/);
  assert.match(await read('shared/ui/hbtn.js'), /FOLD = \['\.sh-lang'/, 'on a phone it folds into More first');
  assert.match(await read('index.html'), /data-i18n="shell\.install"/);
  assert.match(await read('shared/tour/mount.js'), /'shell\.tours', 'shell\.tours_title'/);
  assert.match(await read('shell/notify.js'), /shell\.notifications_new/);
  assert.match(await read('settings/language.js'), /slop-lang/, 'the Settings picker follows a choice made in the header');
  assert.match(await read('shared/ui/menubutton.js'), /o\.anchor/);
});
