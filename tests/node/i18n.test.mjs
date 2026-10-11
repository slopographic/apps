// SlopI18n: the language list, t() with English fallback and {var} filling, the stored choice, apply() on a small fake
// DOM, and every data-i18n key on the homepage and Settings existing in English. Run: node --test tests/node/i18n.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadInto, plain } from './fx-env.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const memStorage = (seed = {}) => {
  const m = new Map(Object.entries(seed));
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const EN = {
  'nav.apps': 'Apps',
  'nav.status': 'Status',
  'greet': 'Hi {name}, {n} left, {missing} stays',
};

/** The global instance, loaded the way a page loads it (profile, then i18n, then strings). */
async function global(seed = {}) {
  const storage = memStorage(seed);
  const ctx = await loadInto(['profile/profile.js', 'i18n/i18n.js', 'i18n/strings.js'], { localStorage: storage });
  return { I: ctx.SlopI18n, storage };
}
/** A fresh instance with its own two-language list and storage. */
function instance({ seed = {}, en = EN, xx } = {}) {
  const storage = memStorage(seed);
  return ctxFor(storage, en, xx);
}
let ctxFor;
async function setup() {
  const ctx = await loadInto(['profile/profile.js', 'i18n/i18n.js'], { localStorage: memStorage() });
  ctxFor = (storage, en, xx) => {
    const languages = [{ code: 'en', name: 'English', dir: 'ltr', complete: true }, { code: 'xx', name: 'Test', dir: 'rtl', complete: false }];
    const I = ctx.SlopI18n.create({ languages, storage });
    I.add('en', en);
    if (xx) I.add('xx', xx);
    return I;
  };
}
await setup();

test('the language list is data: English first, codes unique, each with a name and a text direction', async () => {
  const { I } = await global();
  const list = plain(I.LANGS);
  assert.equal(list[0].code, 'en');
  assert.equal(list[0].name, 'English');
  assert.equal(list[0].dir, 'ltr');
  assert.equal(list[0].complete, true);
  assert.equal(new Set(list.map((l) => l.code)).size, list.length, 'codes are unique');
  for (const l of list) {
    assert.match(l.code, /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/, `code ${l.code}`);
    assert.ok(typeof l.name === 'string' && l.name.length > 0, `name of ${l.code}`);
    assert.ok(['ltr', 'rtl'].includes(l.dir), `dir of ${l.code}`);
  }
  assert.equal(I.DEFAULT, 'en');
  assert.equal(Object.isFrozen(I.LANGS), true);
  I.langs().pop();
  assert.equal(I.langs().length, I.LANGS.length, 'langs() gives a copy');
});

test('with nothing stored the choice is English; an unknown stored code falls back to English', async () => {
  const { I } = await global();
  assert.equal(I.get(), 'en');
  const bad = instance({ seed: { 'slop-profile': JSON.stringify({ v: 1, data: { lang: { mode: 'zz' } } }) } });
  assert.equal(bad.get(), 'en');
});

test('set refuses a code that is not in the list and stores nothing', async () => {
  const I = instance({ en: EN });
  const r = plain(I.set('zz'));
  assert.equal(r.ok, false);
  assert.equal(I.get(), 'en');
});

test('set stores the choice in SlopProfile under lang/mode, and get reads it back', async () => {
  const storage = memStorage();
  const I = instance({ en: EN, xx: { 'nav.apps': 'Xx apps' } });
  assert.deepEqual(plain(I.set('xx')), { ok: true, code: 'xx' });
  const o = JSON.parse(storage.m.get('slop-profile'));
  assert.equal(o.data.lang.mode, 'xx');
  assert.equal(I.get(), 'xx');
  assert.deepEqual(plain(I.set('en')), { ok: true, code: 'en' });
  assert.equal(I.get(), 'en');
});

test('t() gives the chosen language, falls back to English key by key, and then to the key itself', async () => {
  const seed = { 'slop-profile': JSON.stringify({ v: 1, data: { lang: { mode: 'xx' } } }) };
  const I = instance({ seed, en: EN, xx: { 'nav.apps': 'Xx apps' } });
  assert.equal(I.get(), 'xx');
  assert.equal(I.t('nav.apps'), 'Xx apps');
  assert.equal(I.t('nav.status'), 'Status', 'missing in xx, so English');
  assert.equal(I.t('no.such.key'), 'no.such.key', 'missing everywhere, so the key');
});

test('t() fills {name} placeholders and leaves unknown ones in place', async () => {
  const I = instance({ en: EN });
  assert.equal(I.t('greet', { name: 'Ana', n: 3 }), 'Hi Ana, 3 left, {missing} stays');
  assert.equal(I.t('greet'), 'Hi {name}, {n} left, {missing} stays');
  assert.equal(I.t('nav.apps', { name: 'x' }), 'Apps', 'vars on a plain string do nothing');
});

test('t() on the global instance gives the English strings the pages use', async () => {
  const { I } = await global();
  assert.equal(I.t('nav.apps'), 'Apps');
  assert.equal(I.t('footer.code_license'), 'Code MIT');
  assert.equal(I.t('settings.language_saved', { name: 'English' }), 'Saved. English is the language of the app text.');
});

test('apply() sets lang and dir on the root, replaces data-i18n text and data-i18n-attr attributes', async () => {
  const seed = { 'slop-profile': JSON.stringify({ v: 1, data: { lang: { mode: 'xx' } } }) };
  const I = instance({ seed, en: EN, xx: { 'nav.apps': 'Xx apps' } });
  const root = fakeEl('html');
  const apps = fakeEl('a', { 'data-i18n': 'nav.apps' }, 'Apps');
  const status = fakeEl('a', { 'data-i18n': 'nav.status' }, 'Status');
  const aria = fakeEl('button', { 'data-i18n-attr': 'aria-label:nav.apps;title:nav.status' }, '');
  const keep = fakeEl('p', { 'data-i18n': 'no.such.key' }, 'Kept');
  const nodes = { '[data-i18n]': [apps, status, keep], '[data-i18n-attr]': [aria] };
  const doc = { documentElement: root, querySelectorAll: (sel) => nodes[sel] || [] };
  const I2 = I.create({ document: doc, languages: I.LANGS, storage: memStorage(seed) });
  I2.add('en', EN);
  I2.add('xx', { 'nav.apps': 'Xx apps' });
  I2.apply();
  assert.equal(root.attrs.lang, 'xx');
  assert.equal(root.attrs.dir, 'ltr', 'xx is listed as rtl in the test list only through its own entry');
  assert.equal(apps.textContent, 'Xx apps');
  assert.equal(status.textContent, 'Status', 'missing in xx, so English text');
  assert.equal(keep.textContent, 'Kept', 'missing everywhere, so the element keeps its own text');
  assert.equal(aria.attrs['aria-label'], 'Xx apps');
  assert.equal(aria.attrs.title, 'Status');
});

test('a right-to-left language sets dir="rtl" on the root', async () => {
  const seed = { 'slop-profile': JSON.stringify({ v: 1, data: { lang: { mode: 'xx' } } }) };
  const root = fakeEl('html');
  const doc = { documentElement: root, querySelectorAll: () => [] };
  const ctx = await loadInto(['profile/profile.js', 'i18n/i18n.js'], { localStorage: memStorage(seed) });
  const I = ctx.SlopI18n.create({ document: doc, languages: [{ code: 'en', name: 'English', dir: 'ltr' }, { code: 'xx', name: 'Test', dir: 'rtl' }], storage: memStorage(seed) });
  I.apply();
  assert.equal(root.attrs.dir, 'rtl');
});

test('every data-i18n key on the homepage and Settings has an English string', async () => {
  const { I } = await global();
  const missing = [];
  for (const f of ['index.html', 'settings/index.html']) {
    const html = await readFile(path.join(ROOT, f), 'utf8');
    for (const m of html.matchAll(/data-i18n(?:-attr)?="([^"]+)"/g)) {
      for (const pair of m[1].split(';')) {
        const key = pair.includes(':') ? pair.slice(pair.indexOf(':') + 1) : pair;
        if (I.t(key) === key) missing.push(`${f}: ${key}`);
      }
    }
  }
  assert.deepEqual(missing, []);
});

/** A minimal element: attributes, textContent. Enough for apply(). */
function fakeEl(tag, attrs = {}, text = '') {
  const el = { tag, attrs: { ...attrs }, textContent: text };
  el.getAttribute = (n) => (Object.prototype.hasOwnProperty.call(el.attrs, n) ? el.attrs[n] : null);
  el.setAttribute = (n, v) => { el.attrs[n] = String(v); };
  return el;
}
