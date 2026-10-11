// The shared config format (shared/config): validation, import and export, the built-in settings and numbering kinds,
// and the AI prompt and reply helpers. Runs the real scripts in one vm context, with a stub apply or a fake store.
// Run: node tests/run.mjs config   (or node --test tests/node/config.test.mjs)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadInto, plain } from './fx-env.mjs';

const CORE = ['config/schema.js', 'config/validate.js', 'config/template.js', 'config/io.js', 'config/prompt.js'];
const APPS = [{ id: 'tables' }, { id: 'slides' }, { id: 'orders' }];

async function config({ files = CORE, extra = {} } = {}) {
  const ctx = await loadInto(files, { SLOP_APPS: APPS, Blob, File, ...extra });
  return ctx.SlopConfig;
}

/** A template file for the tables app, as an object. Override any envelope key with over. */
const templateFile = (over = {}) => ({
  format: 'slop-config', version: 1, kind: 'template', app: 'tables', name: 'Budget',
  created: '2026-10-11T09:00:00Z',
  data: { pages: [{ name: 'Sheet 1', blocks: [{ type: 'table', rows: [['Item', 'Cost'], ['Rent', 900]] }] }] },
  ...over,
});

/** Registers the tables template kind with a stub apply that records its calls. */
function stubTemplate(C, apply = () => {}) {
  const calls = [];
  C.registerKind('template', 'tables', C.templateSchema, (data, ctx) => { calls.push({ data, ctx }); return apply(data, ctx); });
  return calls;
}

test('a valid template file validates and comes back as a clean value', async () => {
  const C = await config();
  stubTemplate(C);
  const r = C.validate(JSON.stringify(templateFile()), { app: 'tables' });
  assert.equal(r.ok, true, C.errorText(r.errors));
  assert.equal(r.errors.length, 0);
  assert.equal(r.value.data.pages[0].name, 'Sheet 1');
  assert.deepEqual(plain(r.value.data.pages[0].blocks[0].rows[1]), ['Rent', 900]);
});

test('an unknown key in a strict kind is rejected, and the error names its path', async () => {
  const C = await config();
  stubTemplate(C);
  const file = templateFile();
  file.data.pages[0].blocks[0].colour = 'red';
  const r = C.validate(file);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === 'data.pages[0].blocks[0].colour' && /not a known key/.test(e.message)), JSON.stringify(r.errors));
  assert.equal(r.value, null);
});

test('an unknown envelope key and a wrong version are rejected with their paths', async () => {
  const C = await config();
  stubTemplate(C);
  const r = C.validate({ ...templateFile({ version: 2 }), extra: true });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === 'extra'), JSON.stringify(r.errors));
  assert.ok(r.errors.some((e) => e.path === 'version' && /reads version 1/.test(e.message)), JSON.stringify(r.errors));
});

test('oversize data is rejected: a file over 5 MB, and more than 200 pages', async () => {
  const C = await config();
  stubTemplate(C);
  const big = C.validate('x'.repeat(6 * 1024 * 1024));
  assert.equal(big.ok, false);
  assert.match(big.errors[0].message, /larger than 5 MB/);

  const bigBody = C.registerKind('big', 'tables', { fields: { body: C.F.text({ max: 6e6 }) } }, () => {});
  assert.equal(bigBody, undefined);
  const heavy = C.validate({ format: 'slop-config', version: 1, kind: 'big', app: 'tables', name: 'Big', created: '2026-10-11T09:00:00Z', data: { body: 'a'.repeat(5.5e6) } });
  assert.equal(heavy.ok, false);
  assert.match(heavy.errors[0].message, /larger than 5 MB/);

  const pages = Array.from({ length: 201 }, (_, i) => ({ name: `P${i}`, blocks: [] }));
  const many = C.validate(templateFile({ data: { pages } }));
  assert.equal(many.ok, false);
  assert.ok(many.errors.some((e) => e.path === 'data.pages' && /at most 200 items/.test(e.message)), JSON.stringify(many.errors));
});

test('code and markup in text are refused', async () => {
  const C = await config();
  stubTemplate(C);
  const file = templateFile();
  file.data.pages[0].name = 'Sheet <script>alert(1)</script>';
  const r = C.validate(file);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === 'data.pages[0].name' && /code or markup/.test(e.message)));
});

test('validate never throws: broken input gives ok: false with errors', async () => {
  const C = await config();
  stubTemplate(C);
  for (const input of [undefined, null, 42, '{', '[]', {}, { format: 'slop-config' }]) {
    const r = C.validate(input);
    assert.equal(r.ok, false);
    assert.ok(Array.isArray(r.errors) && r.errors.length > 0);
  }
});

test('a broken file applies nothing: apply is not called, and the errors say why', async () => {
  const C = await config();
  const calls = stubTemplate(C);
  const broken = [
    templateFile({ version: 2 }),
    templateFile({ app: 'slides' }),
    templateFile({ data: { pages: [{ name: 'A', blocks: [{ type: 'chart' }] }] } }),
    templateFile({ name: '' }),
  ];
  for (const file of broken) {
    const res = await C.importText(JSON.stringify(file), { app: 'tables' });
    assert.equal(res.ok, false);
    assert.equal(res.applied, false);
  }
  assert.equal(calls.length, 0, 'apply must not run for a broken file');

  const good = await C.importText(JSON.stringify(templateFile()), { app: 'tables' });
  assert.equal(good.ok, true);
  assert.equal(calls.length, 1);
});

test('a valid settings file applies through the stub apply, with the importing app in ctx', async () => {
  const C = await config();
  const calls = [];
  C.registerKind('settings', '*', { fields: { defaultCurrency: C.F.currency({}), defaultTaxRate: C.F.num({ min: 0, max: 100 }) } },
    (data, ctx) => { calls.push({ data, ctx }); });
  const file = { format: 'slop-config', version: 1, kind: 'settings', app: 'orders', name: 'Shop', created: '2026-10-11T09:00:00Z', data: { defaultCurrency: 'EUR', defaultTaxRate: 20 } };
  const res = await C.importFile(new Blob([JSON.stringify(file)], { type: 'application/json' }), { app: 'tables' });
  assert.equal(res.ok, true, C.errorText(res.errors));
  assert.equal(res.applied, true);
  assert.equal(calls.length, 1);
  assert.deepEqual(plain(calls[0].data), { defaultCurrency: 'EUR', defaultTaxRate: 20 });
  assert.equal(calls[0].ctx.app, 'orders');
  assert.equal(calls[0].ctx.importer, 'tables');
});

test('an apply that throws rolls back: undo steps run in reverse, and the result says so', async () => {
  const C = await config();
  const log = [];
  C.registerKind('template', 'tables', C.templateSchema, (data, ctx) => {
    ctx.undo(() => log.push('undo first'));
    ctx.undo(() => log.push('undo second'));
    throw new Error('disk full');
  });
  const res = await C.importText(JSON.stringify(templateFile()), { app: 'tables' });
  assert.equal(res.ok, false);
  assert.equal(res.applied, false);
  assert.equal(res.rolledBack, true);
  assert.match(res.errors[0].message, /disk full/);
  assert.deepEqual(log, ['undo second', 'undo first']);
});

test('a file for another app is refused, and the error says which app owns the kind', async () => {
  const C = await config();
  stubTemplate(C);
  const sameKindOtherApp = C.validate(templateFile({ app: 'slides' }), { app: 'slides' });
  assert.equal(sameKindOtherApp.ok, false);
  assert.ok(sameKindOtherApp.errors.some((e) => /belongs to tables, not to "slides"/.test(e.message)), JSON.stringify(sameKindOtherApp.errors));

  const wrongImporter = C.validate(templateFile(), { app: 'orders' });
  assert.equal(wrongImporter.ok, false);
  assert.ok(wrongImporter.errors.some((e) => e.path === 'app' && /mismatched app/.test(e.message)));
});

test('shared kinds import into any app, and an app outside the registry is refused', async () => {
  const C = await config();
  C.registerKind('settings', '*', { fields: { defaultCurrency: C.F.currency({}) } }, () => {});
  const file = (app) => ({ format: 'slop-config', version: 1, kind: 'settings', app, name: 'S', created: '2026-10-11T09:00:00Z', data: { defaultCurrency: 'GBP' } });
  assert.equal(C.validate(file('orders'), { app: 'tables' }).ok, true);
  const unknown = C.validate(file('nowhere'));
  assert.equal(unknown.ok, false);
  assert.ok(unknown.errors.some((e) => e.path === 'app' && /not an app in the registry/.test(e.message)));
});

test('exportFile names the file <name>.slop.json, validates, and refuses data that is not valid', async () => {
  const C = await config();
  stubTemplate(C);
  const file = C.exportFile('template', 'tables', 'Q3 / budget: v2', templateFile().data, { description: 'Quarterly' });
  assert.match(file.name, /^Q3 .*\.slop\.json$/);
  assert.ok(!/[/:]/.test(file.name));
  const back = await C.importFile(file, { app: 'tables' });
  assert.equal(back.ok, true, C.errorText(back.errors));
  assert.throws(() => C.exportFile('template', 'tables', 'x', { pages: [] }), /cannot export template/);
});

test('parseAiReply extracts the JSON from prose and a code fence, and ignores braces inside strings', async () => {
  const C = await config();
  stubTemplate(C);
  const reply = `Sure! Here is the file you asked for:\n\`\`\`json\n${JSON.stringify(templateFile({ name: 'Budget } {x' }), null, 2)}\n\`\`\`\nLet me know if you want changes {really}.`;
  const r = C.parseAiReply(reply, { app: 'tables' });
  assert.equal(r.ok, true, C.errorText(r.errors));
  assert.equal(r.value.name, 'Budget } {x');
});

test('parseAiReply rejects invalid JSON, and replies with no object, with a message', async () => {
  const C = await config();
  stubTemplate(C);
  const bad = C.parseAiReply('Here: {"format": "slop-config", version: 1}');
  assert.equal(bad.ok, false);
  assert.equal(bad.value, null);
  assert.match(bad.errors[0].message, /JSON in the reply is not valid/);

  const none = C.parseAiReply('I cannot do that.');
  assert.equal(none.ok, false);
  assert.match(none.errors[0].message, /no complete JSON object/);

  const empty = C.parseAiReply('   ');
  assert.match(empty.errors[0].message, /empty/);

  const unclosed = C.parseAiReply('{"format": "slop-config"');
  assert.equal(unclosed.ok, false);
});

test('parseAiReply still runs the validator on a parsed object (wrong kind is caught)', async () => {
  const C = await config();
  stubTemplate(C);
  const r = C.parseAiReply(JSON.stringify(templateFile({ kind: 'settings' })), { app: 'tables' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.path === 'kind'), JSON.stringify(r.errors));
});

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

test('registration rejects a bad schema and a duplicate kind', async () => {
  const C = await config();
  assert.throws(() => C.registerKind('bad name', 'tables', { fields: {} }, () => {}), /bad kind name/);
  assert.throws(() => C.registerKind('x', 'tables', { fields: { a: { type: 'nope' } } }, () => {}), /no valid type/);
  C.registerKind('x', 'tables', { fields: {} }, () => {});
  assert.throws(() => C.registerKind('x', 'tables', { fields: {} }, () => {}), /already registered/);
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

/** A small in-memory stand-in for SlopData.store: transact() works on a copy and commits only when the body succeeds. */
function fakeStore() {
  const rows = {
    settings: new Map([['main', { id: 'main', defaultCurrency: 'USD', locale: 'en-US', defaultTaxRate: 0, paymentTermsDays: 30 }]]),
    numbering: new Map([['invoice', { id: 'invoice', prefix: 'INV-', pad: 4, next: 7 }], ['order', { id: 'order', prefix: 'ORD-', pad: 4, next: 3 }]]),
  };
  const store = {
    rows,
    transactions: 0,
    async get(name, key) { return { ok: true, value: rows[name].get(key) ?? null }; },
    async list(name) { return { ok: true, value: [...rows[name].values()] }; },
    async transact(fn) {
      store.transactions++;
      const copy = { settings: new Map(rows.settings), numbering: new Map(rows.numbering) };
      const api = {
        get: async (n, k) => ({ ok: true, value: copy[n].get(k) ?? null }),
        put: async (n, rec) => { copy[n].set(rec.id, { ...rec }); return { ok: true, value: rec }; },
        fail: (r) => r,
      };
      const r = await fn(api);
      if (r && r.ok === false) return r;
      rows.settings = copy.settings;
      rows.numbering = copy.numbering;
      return { ok: true, value: r && r.value };
    },
  };
  return store;
}
