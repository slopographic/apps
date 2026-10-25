// The customer detail panel: photo and name, contact details (every phone, email and address with its label), tags and
// groups, pipeline stage and follow-up, categories, dated notes, and the orders and invoices of this customer (read from
// the shared collections). Re-drawn whenever the store changes.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);
  const money = (minor, cur, loc) => NS.util.money(minor, cur, loc);
  const sect = (title, ...kids) => el('section', { class: 'd-sec' }, el('h3', { class: 'h3' }, title), ...kids);
  const kv = (k, v) => el('div', { class: 'kv' }, el('dt', null, k), el('dd', null, v));
  const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
  const webHref = (w) => (/^https?:\/\//i.test(w) ? w : `https://${w}`);

  function header(c) {
    return el('div', { class: 'd-head' }, NS.parts.avatar(c, 'av av-lg'),
      el('div', { class: 'd-title' }, el('h2', { class: 'h2' }, c.name), el('span', { class: `stage s-${c.stage}` }, NS.stageLabel(c.stage))),
      el('button', { type: 'button', class: 'd-close', 'aria-label': 'Close details', title: 'Close', onclick: () => NS.app.close() }, '×'));
  }

  /** Every phone, email and address with its label, then the company facts and the website. */
  function contact(c) {
    const F = NS.fields;
    const lines = (kind, link) => F.rowsOf(c, kind).filter((r) => r.value).map((r) => kv(cap(r.label),
      link ? el('a', { href: `${link}:${r.value}` }, r.value) : r.value));
    const phones = lines('phone', 'tel'), emails = lines('email', 'mailto'), addresses = lines('address', null);
    const facts = [['Company', c.company], ['Department', c.department], ['Job title', c.title]].filter(([, v]) => v).map(([k, v]) => kv(k, v));
    const web = c.website ? [kv('Website', el('a', { href: webHref(c.website), rel: 'noopener' }, c.website))] : [];
    const any = phones.length || emails.length || addresses.length || facts.length || web.length;
    return sect('Contact details',
      el('dl', { class: 'kvs' }, phones, emails, addresses, facts, web,
        c.contactId ? kv('Source', 'Imported from Slop Contacts') : null),
      any ? null : el('p', { class: 'note' }, 'No contact details yet. Use Edit to add them.'));
  }

  /** Tags and groups: each change is saved at once. */
  function tagsAndGroups(c) {
    const save = (field) => async (ids) => {
      const r = await NS.customers.save(c.id, { [field]: ids });
      if (!r.ok) UI.toast(NS.util.refusal(r));
    };
    return sect('Tags and groups',
      el('p', { class: 'note' }, 'Tags are coloured labels shared by all customers. Groups are named sets used to filter the list.'),
      el('h4', { class: 'sub-t' }, 'Tags'), NS.parts.labelPicker('tag', c.tagIds, save('tagIds')),
      el('h4', { class: 'sub-t' }, 'Groups'), NS.parts.labelPicker('group', c.groupIds, save('groupIds')));
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
      el('p', { class: 'note' }, 'Free text, separated by commas, on this customer only. Tags above are the coloured ones.'),
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
      el('span', { class: 'amt' }, money(d.total || 0, d.currency || cur.currency, loc)))));
  }

  /** Schedules a call or meeting with this customer: an event in Slop Calendar that links to the customer. */
  function schedule(c) {
    const day = el('input', { type: 'date', id: 'dSchedDay', value: NS.util.today(), 'aria-label': 'Day' });
    const time = el('input', { type: 'time', id: 'dSchedTime', value: '10:00', 'aria-label': 'Start time' });
    const kind = el('select', { id: 'dSchedKind', 'aria-label': 'Kind' }, el('option', { value: 'call' }, 'Call'), el('option', { value: 'meeting' }, 'Meeting'));
    const go = async () => {
      if (!NS.util.isDate(day.value) || !/^\d{2}:\d{2}$/.test(time.value)) { UI.toast('Pick a day and a time.'); return; }
      const T = g.SlopTime, tz = T.deviceZone(), start = T.dayTimeToUtc(day.value, time.value, tz);
      const word = kind.value === 'meeting' ? 'Meeting' : 'Call';
      const r = await g.SlopData.store.put('events', { title: `${word} ${c.name}`, allDay: false, start, end: start + 30 * 60000, tz,
        kind: kind.value, customerId: c.id, color: 'teal', freq: 'none' });
      UI.toast(r.ok ? `${word} scheduled. See it in Slop Calendar or in Follow-ups.` : NS.util.refusal(r));
    };
    return sect('Schedule',
      el('p', { class: 'note' }, 'Adds an event to Slop Calendar, linked to this customer. The time is in this device\'s zone.'),
      el('div', { class: 'inline' }, day, time, kind, el('button', { type: 'button', class: 'btn', onclick: go }, 'Schedule')));
  }

  // The record's main buttons (Edit details, Delete customer) at the foot of the detail panel, the suite rule
  // (shared/frame/HANDOFF.md; the shared footer, shared/frame/panel.js): in reach however long the record is.
  let fp = null;
  function foot(list) {
    if (!fp && g.SlopFramePanel) fp = g.SlopFramePanel.create($('view-customer'), { bare: true });
    if (fp) fp.footer(list);
  }

  async function render() {
    const body = $('dBody');
    const id = NS.state.current;
    foot([]);
    if (!id) { body.replaceChildren(el('p', { class: 'empty' }, 'Select a customer to see details')); return; }
    const r = await NS.customers.get(id);
    if (!r.ok) { body.replaceChildren(el('p', { class: 'msg', role: 'alert' }, NS.util.refusal(r))); return; }
    if (!r.value) { body.replaceChildren(el('p', { class: 'empty' }, 'This customer is not here any more.')); return; }
    const c = r.value, cur = NS.state.settings;
    const h = await NS.history.of(id);
    if (!h.ok) { body.replaceChildren(el('p', { class: 'msg', role: 'alert' }, NS.util.refusal(h))); return; }
    body.replaceChildren(header(c), contact(c), tagsAndGroups(c), pipeline(c), categories(c), notes(c, cur.locale), schedule(c),
      sect('Orders', docList(h.value.orders, cur, cur.locale, 'Orders', 'No orders for this customer yet.')),
      sect('Invoices', docList(h.value.invoices, cur, cur.locale, 'Invoices', 'No invoices for this customer yet.')));
    foot([{ el: el('button', { type: 'button', class: 'btn primary', onclick: () => NS.form.open(c.id) }, 'Edit details') },
      { el: el('button', { type: 'button', class: 'btn danger', onclick: () => NS.menu.removeCustomer(c) }, 'Delete customer') }]);
  }

  NS.views = NS.views || {};
  NS.views.customer = { render };
})(typeof window !== 'undefined' ? window : globalThis);
