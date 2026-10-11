// The sample buttons' behaviour, shared by Slop Invoices and Slop Orders: Random sample (one document, no dialog),
// Random samples… (SlopUI options dialog, with a progress bar for five or more) and Delete all samples (SlopUI.confirm).
// Each takes getIO(), an async function that returns the app's io (see samples-run.js). Classic script. Exposes
// SlopDocs.samples.quick, .options and .deleteAll.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopDocs = g.SlopDocs || {});
  const M = NS.model;
  const UI = g.SlopUI;
  const samples = (NS.samples = NS.samples || {});
  const PROGRESS_AT = 5;
  const WORDS = { invoice: ['invoice', 'invoices'], order: ['order', 'orders'] };
  const plural = (kind, n) => (n === 1 ? WORDS[kind][0] : WORDS[kind][1]);
  const para = (text) => UI.el('p', { class: 'sui-p' }, text);
  const block = (lines) => UI.el('div', null, lines.map(para));

  /** Totals per currency for the summary, as text ("12.00 USD · 3.50 EUR"). */
  function totalsText(created, io) {
    const sums = new Map();
    for (const c of created) sums.set(c.currency, (sums.get(c.currency) || 0) + c.total);
    return [...sums].map(([cur, v]) => S.money.formatMinor(v, cur, io.locale)).join(' · ') || '0';
  }

  /** The summary lines after a batch: what was made, the totals, what was added to the catalogue, what was refused. */
  function summaryLines(kind, res, io) {
    const d = res.value;
    const n = d.created.length;
    const out = [`Created ${n} sample ${plural(kind, n)}. ${kind === 'invoice' ? 'They are drafts, so the number comes when each is issued.' : 'They are drafts, and each took its order number.'}`];
    if (n) out.push(`Total: ${totalsText(d.created, io)}.`);
    out.push(`Customers added: ${d.newCustomers}. Products added: ${d.newProducts}.`);
    out.push(`Seed ${d.seed}: the same seed, count and dates give the same documents.`);
    if (d.failed.length) out.push(`Not created: ${d.failed.length}. First: ${d.failed[0].message}`);
    return out;
  }

  /** One sample document now, with the default options (a random seed, the last 90 days, the base currency). */
  async function quick({ kind, getIO, onDone }) {
    const io = await getIO();
    const res = await samples.run({ kind, count: 1, seed: samples.newSeed(), from: M.addDays(io.today, -90), to: io.today, currency: io.base, missing: { customers: true, products: true }, io });
    if (!res.ok) { UI.alert('Not created', res.message); return null; }
    if (!res.value.created.length) { UI.alert('Not created', res.value.failed[0].message); return null; }
    const made = res.value.created[0];
    UI.toast(`Sample ${kind} created${made.number ? ` ${made.number}` : ''}`);
    if (onDone) onDone(made);
    return made;
  }

  /** The options dialog: count, seed, currency, date range, and whether to create missing customers and products. */
  async function options({ kind, getIO, onDone }) {
    const io = await getIO();
    const currencies = [...new Set([io.base, ...(S.locale.currencies() || [])])];
    const count = UI.number(5, 1, samples.MAX_DOCS, 1);
    const seed = UI.el('input', { class: 'sui-input', type: 'text', maxlength: '40', placeholder: 'Blank for a new seed', autocomplete: 'off', spellcheck: 'false' });
    const cur = UI.select(currencies.map((c) => [c, c]), io.base);
    const from = UI.el('input', { class: 'sui-input', type: 'date', value: M.addDays(io.today, -90) });
    const to = UI.el('input', { class: 'sui-input', type: 'date', value: io.today });
    const mc = UI.check('Create missing customers (saved, marked as samples)', true);
    const mp = UI.check('Create missing products (saved, marked as samples)', true);
    const note = UI.el('p', { class: 'sui-p', role: 'status' });
    const bar = UI.el('progress', { class: 'sample-progress', max: String(count.value), value: '0', hidden: true, 'aria-label': 'Creating samples' });
    const body = UI.el('div', { class: 'sample-options' },
      UI.field(`Documents (${samples.MAX_DOCS} at most)`, count),
      UI.field('Seed', seed, 'Same seed, same output'),
      UI.field('Currency', cur),
      UI.field('From', from), UI.field('To', to),
      mc.el, mp.el, note, bar);
    const dlg = UI.dialog({
      title: `Random ${plural(kind, 2)}`, body,
      buttons: [{ label: 'Cancel' }, {
        label: 'Create', primary: true,
        act: async () => {
          const n = Number(count.value);
          const o = { kind, count: n, seed: samples.normalizeSeed(seed.value), from: from.value, to: to.value, currency: cur.value };
          const bad = samples.checkOptions(o);
          if (bad) { note.textContent = bad; return false; }
          if (n >= PROGRESS_AT) { bar.max = n; bar.value = 0; bar.hidden = false; }
          body.querySelectorAll('input, select').forEach((x) => { x.disabled = true; });
          note.textContent = `Creating ${plural(kind, n)}…`;
          const res = await samples.run({ ...o, missing: { customers: mc.input.checked, products: mp.input.checked }, io,
            onProgress: (done) => { bar.value = done; note.textContent = done < n ? `Creating ${done + 1} of ${n}…` : 'Done.'; } });
          dlg.close(true);
          if (!res.ok) { UI.alert('Not created', res.message); return false; }
          UI.alert('Samples created', block(summaryLines(kind, res, io)));
          if (onDone) onDone(res.value);
          return false;
        },
      }],
    });
  }

  /** Confirms, then removes every live sample of the kind (see samples-run.js removeSamples). */
  async function deleteAll({ kind, getIO, onDone }) {
    const text = kind === 'invoice'
      ? 'Delete every sample invoice that is still a draft. Issued sample invoices stay (void them to remove them). Sample customers and products that nothing else uses are deleted too. Real records are not touched.'
      : 'Cancel every sample order that is not yet fulfilled. Orders cannot be deleted (their numbers stay used), so they stay in the list as cancelled. Sample customers and products that nothing else uses are deleted too. Real records are not touched.';
    if (!(await UI.confirm('Delete all samples', text, 'Delete all samples', { danger: true }))) return;
    const io = await getIO();
    const res = await samples.removeSamples(io);
    if (!res.ok) { UI.alert('Not deleted', res.message); return; }
    const v = res.value;
    const lines = [`${kind === 'invoice' ? 'Deleted' : 'Cancelled'} ${v.documents} sample ${plural(kind, v.documents)}. Customers removed: ${v.customers}. Products removed: ${v.products}.`];
    if (v.kept.length) lines.push(`Kept ${v.kept.length}: ${v.kept.slice(0, 5).join('; ')}`);
    UI.alert('Samples deleted', block(lines));
    if (onDone) onDone(v);
  }

  Object.assign(samples, { quick, options, deleteAll, summaryLines });
})(typeof window !== 'undefined' ? window : globalThis);
