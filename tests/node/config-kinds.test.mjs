// The shared config format (shared/config): validation, import and export, the built-in settings and numbering kinds,
// and the AI prompt and reply helpers. Runs the real scripts in one vm context, with a stub apply or a fake store.
// Run: node tests/run.mjs config   (or node --test tests/node/config.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadInto, plain } from './fx-env.mjs';
import { CORE, APPS, config, templateFile, stubTemplate, fakeStore } from './config-env.mjs';

test('buildPrompt names every field and allowed value, and its example is a valid file', async () => {
  const C = await config({ files: [...CORE, 'config/kinds.js'], extra: { SlopData: { store: fakeStore() } } });
  const text = C.buildPrompt('numbering', 'slop', 'Use INV-2026- for invoices');
  for (const word of ['sequences', 'id', 'prefix', 'pad', 'invoice', 'order', 'at most 12', 'Use INV-2026- for invoices']) {
    assert.ok(text.includes(word), `prompt should mention ${word}`);
  }
  assert.ok(text.includes('"invoice", "order"'), 'allowed values are listed');
  const example = text.slice(text.indexOf('An example of a valid file'), text.indexOf('What the person wants'));
  const r = C.parseAiReply(example, { app: 'slop' });
  assert.equal(r.ok, true, C.errorText(r.errors));

  const settings = C.buildPrompt('settings', 'slop', '');
  assert.ok(settings.includes('defaultCurrency') && settings.includes('defaultTaxRate') && settings.includes('locale'));

  assert.throws(() => C.buildPrompt('nope', 'slop', ''), /no kind/);
});

test('buildPrompt for a template lists block types and the page limit', async () => {
  const C = await config();
  stubTemplate(C);
  const text = C.buildPrompt('template', 'tables', '');
  assert.ok(text.includes('"heading", "text", "list", "table"'));
  assert.ok(text.includes('at most 200 items'));
  assert.ok(text.includes('pages'));
});

test('settings kind: the apply writes through the store in one transaction, and export reads it back', async () => {
  const store = fakeStore();
  const C = await config({ files: [...CORE, 'config/kinds.js'], extra: { SlopData: { store } } });
  const file = { format: 'slop-config', version: 1, kind: 'settings', app: 'slop', name: 'Company', created: '2026-10-11T09:00:00Z',
    data: { defaultCurrency: 'EUR', locale: 'de-DE', defaultTaxRate: 19.5 } };
  const res = await C.importText(JSON.stringify(file), { app: 'tables' });
  assert.equal(res.ok, true, C.errorText(res.errors));
  assert.equal(store.transactions, 1);
  assert.deepEqual(store.rows.settings.get('main'), { id: 'main', defaultCurrency: 'EUR', locale: 'de-DE', defaultTaxRate: 1950, paymentTermsDays: 30 });

  const exported = await C.exportKind('settings', 'tables', 'Company');
  const data = JSON.parse(await exported.text()).data;
  assert.deepEqual(data, { defaultCurrency: 'EUR', locale: 'de-DE', defaultTaxRate: 19.5 });
});

test('numbering kind: the format changes and the counter is kept', async () => {
  const store = fakeStore();
  const C = await config({ files: [...CORE, 'config/kinds.js'], extra: { SlopData: { store } } });
  const file = { format: 'slop-config', version: 1, kind: 'numbering', app: 'slop', name: 'Numbers', created: '2026-10-11T09:00:00Z',
    data: { sequences: [{ id: 'invoice', prefix: 'INV-2026-', pad: 6 }] } };
  const res = await C.importText(JSON.stringify(file), { app: 'tables' });
  assert.equal(res.ok, true, C.errorText(res.errors));
  assert.deepEqual(store.rows.numbering.get('invoice'), { id: 'invoice', prefix: 'INV-2026-', pad: 6, next: 7 });
  assert.deepEqual(store.rows.numbering.get('order'), { id: 'order', prefix: 'ORD-', pad: 4, next: 3 });
});

test('numbering kind: an unknown sequence is refused before the store is touched', async () => {
  const store = fakeStore();
  const C = await config({ files: [...CORE, 'config/kinds.js'], extra: { SlopData: { store } } });
  const file = { format: 'slop-config', version: 1, kind: 'numbering', app: 'slop', name: 'N', created: '2026-10-11T09:00:00Z',
    data: { sequences: [{ id: 'credit', prefix: 'CN-', pad: 4 }] } };
  const res = await C.importText(JSON.stringify(file));
  assert.equal(res.ok, false);
  assert.equal(store.transactions, 0);
});

test('a store failure in the middle of numbering rolls the whole apply back', async () => {
  const store = fakeStore();
  store.rows.numbering.delete('order'); // the second sequence is missing, so the store refuses
  const C = await config({ files: [...CORE, 'config/kinds.js'], extra: { SlopData: { store } } });
  const file = { format: 'slop-config', version: 1, kind: 'numbering', app: 'slop', name: 'N', created: '2026-10-11T09:00:00Z',
    data: { sequences: [{ id: 'invoice', prefix: 'NEW-', pad: 4 }, { id: 'order', prefix: 'ORD-', pad: 4 }] } };
  const res = await C.importText(JSON.stringify(file));
  assert.equal(res.ok, false);
  assert.equal(res.rolledBack, true);
  assert.match(res.errors[0].message, /no numbering sequence order/);
  assert.equal(store.rows.numbering.get('invoice').prefix, 'INV-');
});

test('settings apply without SlopData on the page says so, and applies nothing', async () => {
  const C = await config({ files: [...CORE, 'config/kinds.js'] });
  const file = { format: 'slop-config', version: 1, kind: 'settings', app: 'slop', name: 'S', created: '2026-10-11T09:00:00Z', data: { defaultCurrency: 'EUR' } };
  const res = await C.importText(JSON.stringify(file));
  assert.equal(res.ok, false);
  assert.match(res.errors[0].message, /data store is not loaded/);
});


test('the dialogs load without SlopUI on the page: menu items and the AI hook are wired', async () => {
  const ctx = await loadInto([...CORE, 'config/dialog.js', 'config/dialog-ai.js'], { SLOP_APPS: APPS, Blob, File });
  const D = ctx.SlopConfigDialog;
  assert.equal(typeof D.open, 'function');
  assert.deepEqual(plain(D.menuItems({ app: 'tables' }).map((i) => i.label)), ['Import config…', 'Export config…', 'Make one with AI…']);
  assert.equal(typeof D.makeAi, 'function');
  assert.throws(() => D.open('nope'), /unknown dialog/);
});
