// Import SIE (the Journal tab's "Import SIE…" button and File menu): reads an SIE file with the shared reader
// (shared/finance/sie.js, loaded when it is first used), makes the plan (core/sie-import.js), shows it and asks first:
// the accounts that will be added, the ones that get another code (and the code can be changed), the names that differ
// (kept unless the box is ticked), the opening balances and the vouchers. Then it adds the accounts and posts the entries
// one by one through SlopData.ledger, and shows what was imported and what was skipped, with the reason for each.
(function (g) {
  'use strict';
  const S = g.SlopData, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const $ = (id) => document.getElementById(id);
  const ACTION = { add: 'New', same: 'Already here', rename: 'Already here, other name', map: 'New code', merge: 'Joined to parent', conflict: 'Code taken' };
  let reader = null;

  const list = async (name) => { const r = await S.store.list(name, { includeDeleted: true }); return r.ok ? r.value : []; };
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /** The plan for a file: the model, the plan and what the person can change. */
  async function prepare(file) {
    reader = reader || await import(new URL('../shared/finance/sie.js', document.baseURI).href);
    const model = reader.readSie(new Uint8Array(await file.arrayBuffer()));
    if (!model.accounts.length && !model.vouchers.length) throw new Error(model.warnings[0] || 'No accounts or vouchers were found. Is this an SIE file?');
    const [chart, journal, s] = await Promise.all([list('accounts'), list('journal'), NS.util.settings()]);
    const ctx = { chart, sources: new Set(journal.map((j) => j.source)), digits: S.money.digits(model.currency), mapping: {} };
    return { model, ctx, base: s.base, plan: NS.sieImport.plan(model, ctx) };
  }

  /** The ask-first dialog. Resolves to { renames, opening, vouchers } or null when cancelled. */
  function ask(job, file) {
    const { model } = job;
    return new Promise((resolve) => {
      const body = el('div', { class: 'sie-plan' });
      const opts = { renames: false, opening: true, vouchers: true };
      const draw = () => {
        const p = job.plan = NS.sieImport.plan(model, job.ctx);
        const by = (a) => p.accounts.filter((x) => x.action === a);
        const ib = p.entries.filter((e) => e.what === 'Opening balances'), vs = p.entries.filter((e) => e.what !== 'Opening balances');
        const remap = p.accounts.filter((a) => a.action === 'map' || a.action === 'merge' || a.action === 'conflict');
        const head = `${model.company || file.name}${model.orgNo ? ` (${model.orgNo})` : ''}, SIE type ${model.type}, ${model.currency}`;
        const box = (key, label) => el('label', { class: 'check' }, el('input', { type: 'checkbox', checked: opts[key], 'data-opt': key, onchange: (e) => { opts[key] = e.target.checked; } }), ` ${label}`);
        body.replaceChildren(...[
          el('p', { class: 'note' }, head),
          model.currency !== job.base ? el('p', { class: 'msg', role: 'note' }, `The amounts are in ${model.currency} and the books are in ${job.base}. Each entry is converted at the stored ${model.currency} rate on its date; an entry with no rate is skipped. Add the rate in the Rates tab first.`) : null,
          el('p', null, `Accounts: ${plural(by('add').length + by('map').length, 'new account')}, ${plural(by('same').length + by('rename').length, 'account')} already in the chart.`),
          remap.length ? el('div', { class: 'tablewrap' }, el('table', { class: 'grid-t' }, el('thead', null, el('tr', null, el('th', null, 'SIE'), el('th', null, 'Name'), el('th', null, 'Code here'), el('th', null, 'Why'))),
            el('tbody', null, remap.map((a) => el('tr', { class: a.action === 'conflict' ? 'bk-open' : '' }, el('td', null, a.sie), el('td', null, a.name),
              el('td', null, el('input', { value: a.code || '', size: 5, maxlength: 4, inputmode: 'numeric', 'aria-label': `Code here for SIE account ${a.sie}`, 'data-sie': a.sie,
                onchange: (e) => { job.ctx.mapping[a.sie] = e.target.value.trim(); draw(); } })),
              el('td', null, `${ACTION[a.action]}. ${a.note || ''}`)))))) : null,
          by('rename').length ? box('renames', `Use the file’s names for ${plural(by('rename').length, 'account')} named differently here (${by('rename').slice(0, 3).map((a) => `${a.code} ${a.here} → ${a.name}`).join('; ')}${by('rename').length > 3 ? '; …' : ''})`) : null,
          ib.length ? box('opening', `Post the opening balances (${plural(ib[0].input.lines.length, 'account')}, dated ${ib[0].input.date})`) : null,
          vs.length ? box('vouchers', `Post ${plural(vs.length, 'voucher')} as journal entries (${vs[0].input.date} to ${vs[vs.length - 1].input.date})`) : el('p', null, 'No vouchers to post.'),
          p.skipped.length ? el('p', { class: 'note' }, `Skipped: ${plural(p.skipped.length, 'item')} (${p.skipped.slice(0, 3).map((x) => `${x.what}: ${x.why}`).join('; ')}${p.skipped.length > 3 ? '; …' : ''}).`) : null,
          model.warnings.length ? el('p', { class: 'note' }, `Notes from the file: ${model.warnings.slice(0, 3).join(' ')}`) : null,
          el('p', { class: 'note' }, 'Posted entries cannot be changed or deleted, only reversed. A second import of the same file adds nothing.')].filter(Boolean));   // the DOM writes null as text
      };
      draw();
      UI.dialog({ title: `Import SIE: ${file.name}`, body, cls: 'sie-dlg', onClose: (okd) => { if (!okd) resolve(null); },
        buttons: [{ label: 'Cancel' }, { label: 'Import', primary: true, act: () => {
          // codes typed but not yet committed (Enter presses Import straight away)
          for (const i of body.querySelectorAll('input[data-sie]')) job.ctx.mapping[i.dataset.sie] = i.value.trim();
          job.plan = NS.sieImport.plan(model, job.ctx);
          resolve({ ...opts });
          return undefined;
        } }] });
    });
  }

  /** Adds the accounts, renames when asked, posts the entries. Returns { added, renamed, posted, skipped }. */
  async function apply(job, opts) {
    const p = job.plan, skipped = p.skipped.slice();
    let added = 0, renamed = 0, posted = 0;
    const have = new Set((await list('accounts')).map((a) => a.code));
    for (const a of p.accounts) {
      if ((a.action === 'add' || a.action === 'map') && !have.has(a.code)) {
        const r = await NS.accounts.add({ code: a.code, name: a.name.slice(0, 200), type: a.type });
        if (r.ok) { added++; have.add(a.code); } else skipped.push({ what: `Account ${a.sie}`, why: NS.util.refusal(r) });
      } else if (a.action === 'rename' && opts.renames) {
        const r = await NS.accounts.rename(a.code, a.name.slice(0, 200));
        if (r.ok) renamed++; else skipped.push({ what: `Account ${a.sie} name`, why: NS.util.refusal(r) });
      }
    }
    for (const e of p.entries) {
      const isIb = e.what === 'Opening balances';
      if ((isIb && !opts.opening) || (!isIb && !opts.vouchers)) { skipped.push({ what: e.what, why: 'not chosen' }); continue; }
      const r = await S.ledger.postJournal(e.input);
      if (r.ok) posted++; else skipped.push({ what: e.what, why: NS.util.refusal(r) });
    }
    return { added, renamed, posted, skipped };
  }

  function report(res, file) {
    const lines = res.skipped.map((x) => el('li', null, `${x.what}: ${x.why}`));
    UI.dialog({ title: 'SIE imported', cls: 'sie-dlg', buttons: [{ label: 'Done', primary: true }],
      body: el('div', { class: 'sie-report', role: 'status' },
        el('p', null, `From ${file.name}: ${plural(res.added, 'account')} added, ${plural(res.renamed, 'account')} renamed, ${res.posted} journal ${res.posted === 1 ? 'entry' : 'entries'} posted.`),
        res.skipped.length ? el('p', null, `Skipped (${res.skipped.length}):`) : el('p', null, 'Nothing was skipped.'),
        res.skipped.length ? el('ul', { class: 'sie-skipped' }, lines.slice(0, 100), res.skipped.length > 100 ? el('li', null, `and ${res.skipped.length - 100} more`) : null) : null) });
  }

  /** The whole import of one file: read, ask, apply, report. Resolves to the result (or null when cancelled). */
  async function importFile(file) {
    let job;
    try { job = await prepare(file); } catch (e) { UI.alert('Not imported', (e && e.message) || String(e)); return null; }
    const opts = await ask(job, file);
    if (!opts) return null;
    const res = await apply(job, opts);
    report(res, file);
    if (NS.app && NS.app.render) await NS.app.render();
    return res;
  }

  /** Import SIE…: a part of the one intake of its own ('ledger.sie', shared/intake). */
  const pickSie = () => g.SlopIntake.pick({ to: 'ledger.sie', multiple: false, accept: '.se,.si,.sie,.txt' });
  function mount() {
    if (!$('jImportSie')) return;
    g.SlopIntake.register({ id: 'ledger.sie', main: false, paste: false, toast: false, limit: 1, accept: { any: true, noun: 'an SIE file' }, process: async (f) => { await importFile(f); return f.name; } });
    $('jImportSie').addEventListener('click', pickSie);
  }

  NS.views = NS.views || {};
  NS.views.sie = { mount };
  NS.sieView = { importFile, prepare, apply, pick: pickSie };
})(typeof window !== 'undefined' ? window : globalThis);
