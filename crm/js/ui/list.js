// The Customers tab: search, stage and category filters, one row per customer, and row menus (right-click, Actions).
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);

  /** Pure: the customers that match the search text, stage and category. */
  function filter(list, f) {
    const q = String(f.q || '').trim().toLowerCase();
    return list.filter((c) => (!f.stage || c.stage === f.stage) && (!f.cat || (c.categories || []).includes(f.cat)) &&
      (!q || [c.name, c.email, c.phone, c.address].some((v) => String(v || '').toLowerCase().includes(q))));
  }

  function row(c) {
    const sub = [c.email, c.phone].filter(Boolean).join(' · ') || 'No contact details';
    return el('li', { class: 'row', role: 'listitem', 'data-id': c.id, 'data-name': c.name, 'data-stage': c.stage },
      el('button', { type: 'button', class: 'row-open', onclick: () => NS.app.show('customer', c.id) },
        el('b', null, c.name), el('span', { class: 'row-sub' }, sub),
        c.categories && c.categories.length ? el('span', { class: 'chips' }, c.categories.map((t) => el('span', { class: 'chip' }, t))) : null),
      el('span', { class: `stage s-${c.stage}` }, NS.stageLabel(c.stage)),
      el('button', { type: 'button', class: 'btn small', 'aria-label': `Actions for ${c.name}`,
        onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); UI.menu(NS.menu.items(c), r.left, r.bottom + 4); } }, 'Actions ▾'));
  }

  /** Keeps the chosen category when the options are rebuilt. */
  function fillCategories(sel, cats) {
    const keep = sel.value;
    sel.replaceChildren(el('option', { value: '' }, 'All categories'), ...cats.map((t) => el('option', { value: t }, t)));
    sel.value = cats.includes(keep) ? keep : '';
  }

  async function render() {
    const r = await NS.customers.load();
    if (!r.ok) { $('cSummary').textContent = NS.util.refusal(r); return; }
    const all = r.value;
    fillCategories($('cCat'), NS.customers.categoriesOf(all));
    const list = filter(all, { q: $('cSearch').value, stage: $('cStage').value, cat: $('cCat').value });
    $('cRows').replaceChildren(...list.map(row));
    $('cEmpty').hidden = list.length > 0;
    $('cEmpty').textContent = all.length ? 'No customers match these filters.' : 'No customers yet. Add one, or import your contacts from Slop Contacts.';
    $('cSummary').textContent = `${list.length} of ${all.length} customer${all.length === 1 ? '' : 's'}`;
  }

  function mount() {
    for (const id of ['cSearch']) $(id).addEventListener('input', render);
    for (const id of ['cStage', 'cCat']) $(id).addEventListener('change', render);
    $('cStage').replaceChildren(el('option', { value: '' }, 'All stages'), ...NS.STAGES.map((s) => el('option', { value: s }, NS.stageLabel(s))));
    $('cAdd').addEventListener('click', () => NS.form.open(null));
    $('cImport').addEventListener('click', () => NS.importUi.open());
    g.SlopCtx.bind($('cRows'), (t) => {
      const li = t && t.closest && t.closest('[data-id]');
      return li ? NS.menu.items({ id: li.dataset.id, name: li.dataset.name, stage: li.dataset.stage }) : null;
    });
  }

  NS.views = NS.views || {};
  NS.views.customers = { mount, render };
  NS.filterCustomers = filter;
})(typeof window !== 'undefined' ? window : globalThis);
