// The customer detail panel: contact details, pipeline stage, follow-up date, categories, dated notes, and the
// orders and invoices of this customer (read from the shared collections). Re-drawn whenever the store changes.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);
  const money = (minor, cur, loc) => NS.util.money(minor, cur, loc);
  const sect = (title, ...kids) => el('section', { class: 'd-sec' }, el('h3', { class: 'h3' }, title), ...kids);

  function header(c) {
    return el('div', { class: 'd-head' }, el('h2', { class: 'h2' }, c.name), el('span', { class: `stage s-${c.stage}` }, NS.stageLabel(c.stage)));
  }

  function contact(c) {
    const line = (k, v) => (v ? el('div', { class: 'kv' }, el('dt', null, k), el('dd', null, v)) : null);
    return sect('Contact details',
      el('dl', { class: 'kvs' },
        c.email ? el('div', { class: 'kv' }, el('dt', null, 'Email'), el('dd', null, el('a', { href: `mailto:${c.email}` }, c.email))) : null,
        c.phone ? el('div', { class: 'kv' }, el('dt', null, 'Phone'), el('dd', null, el('a', { href: `tel:${c.phone}` }, c.phone))) : null,
        line('Address', c.address),
        c.contactId ? line('Source', 'Imported from Slop Contacts') : null,
        !c.email && !c.phone && !c.address ? el('p', { class: 'note' }, 'No contact details yet. Use Edit to add them.') : null));
  }

  function pipeline(c) {
    const stage = el('select', { id: 'dStage', 'aria-label': 'Pipeline stage', onchange: (e) => NS.menu.moveTo(c.id, e.target.value) },
      NS.STAGES.map((s) => el('option', { value: s, selected: s === c.stage }, NS.stageLabel(s))));
    const follow = el('input', { type: 'date', id: 'dFollow', value: c.followUp || '', 'aria-label': 'Follow-up date',
      onchange: async (e) => {
        const v = e.target.value;
        if (v && !NS.util.isDate(v)) { UI.toast('Use a real date.'); return; }
        const r = await NS.customers.setFollowUp(c.id, v);
        if (!r.ok) UI.toast(NS.util.refusal(r));
      } });
    return sect('Pipeline',
      el('label', { class: 'field' }, el('span', null, 'Stage'), stage),
      el('label', { class: 'field' }, el('span', null, 'Follow-up date'), follow),
      c.followUp ? el('button', { type: 'button', class: 'btn small', onclick: () => NS.customers.setFollowUp(c.id, null) }, 'Clear follow-up') : null);
  }

  function categories(c) {
    const input = el('input', { type: 'text', id: 'dCats', value: (c.categories || []).join(', '), maxlength: 400, 'aria-label': 'Categories, comma separated' });
    return sect('Categories',
      el('p', { class: 'note' }, 'Tags such as “wholesale” or “repeat”, separated by commas.'),
      el('div', { class: 'inline' }, input, el('button', { type: 'button', class: 'btn', onclick: async () => {
        const r = await NS.customers.save(c.id, { categories: NS.util.tags(input.value) });
        UI.toast(r.ok ? 'Categories saved' : NS.util.refusal(r));
      } }, 'Save')));
  }

  function notes(c, loc) {
    const date = el('input', { type: 'date', id: 'dNoteDate', value: NS.util.today(), 'aria-label': 'Note date' });
    const text = el('textarea', { id: 'dNoteText', rows: 3, maxlength: 2000, 'aria-label': 'Note text', placeholder: 'What happened?' });
    const add = async () => {
      if (!NS.util.isDate(date.value)) { UI.toast('Pick the date of the note.'); return; }
      const r = await NS.customers.addNote(c.id, text.value, date.value);
      UI.toast(r.ok ? 'Note added' : NS.util.refusal(r));
    };
    const list = NS.notes.newestFirst(NS.notes.parse(c.notes));
    return sect('Notes',
      el('div', { class: 'note-form' }, date, text, el('button', { type: 'button', class: 'btn primary', onclick: add }, 'Add note')),
      list.length ? el('ul', { class: 'notes', 'aria-label': 'Notes' }, list.map((n) => el('li', null,
        el('span', { class: 'note-date' }, n.date ? NS.util.date(n.date, loc) : 'Earlier'), el('span', { class: 'note-text' }, n.text)))) :
        el('p', { class: 'empty' }, 'No notes yet.'));
  }

  function docList(rows, cur, loc, title, empty) {
    if (!rows.length) return el('p', { class: 'empty' }, empty);
    return el('ul', { class: 'docs', 'aria-label': title }, rows.map((d) => el('li', null,
      el('b', null, d.number || 'Draft'), el('span', { class: 'row-sub' }, `${NS.util.date(d.date, loc)} · ${d.status}`),
      el('span', { class: 'amt' }, money(d.total || 0, d.currency || cur.defaultCurrency, loc)))));
  }

  async function render() {
    const body = $('dBody');
    const id = NS.state.current;
    if (!id) { body.replaceChildren(el('p', { class: 'empty' }, 'Select a customer to see details')); return; }
    const r = await NS.customers.get(id);
    if (!r.ok) { body.replaceChildren(el('p', { class: 'msg', role: 'alert' }, NS.util.refusal(r))); return; }
    if (!r.value) { body.replaceChildren(el('p', { class: 'empty' }, 'This customer is not here any more.')); return; }
    const c = r.value, cur = NS.state.settings;
    const h = await NS.history.of(id);
    if (!h.ok) { body.replaceChildren(el('p', { class: 'msg', role: 'alert' }, NS.util.refusal(h))); return; }
    body.replaceChildren(header(c), pipeline(c), contact(c), categories(c), notes(c, cur.locale),
      sect('Orders', docList(h.value.orders, cur, cur.locale, 'Orders', 'No orders for this customer yet.')),
      sect('Invoices', docList(h.value.invoices, cur, cur.locale, 'Invoices', 'No invoices for this customer yet.')),
      el('div', { class: 'd-actions' },
        el('button', { type: 'button', class: 'btn', onclick: () => NS.form.open(c.id) }, 'Edit details'),
        el('button', { type: 'button', class: 'btn danger', onclick: () => NS.menu.removeCustomer(c) }, 'Delete customer')));
  }

  NS.views = NS.views || {};
  NS.views.customer = { render };
})(typeof window !== 'undefined' ? window : globalThis);
