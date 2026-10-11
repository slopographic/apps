/* Slop Contacts: the card in edit mode. The same card turns into a form in place: photo, name, company, department,
 * title, phones, e-mails, addresses (each with a label), birthday, website, groups and notes. Save writes the contact
 * through the list; Cancel asks first when something changed. New contacts use the same form. Adds SlopContacts.cardEdit. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const el = UI.el;
  const LABELS = ['mobile', 'work', 'home', 'other'];
  const DATE_RX = /^(\d{4}-\d{2}-\d{2}|--\d{2}-\d{2})$/;
  let snapshot = '';

  /** Text field with a caption. */
  const field = (label, input) => el('label', { class: 'ed-f' }, el('span', { class: 'ed-k' }, label), input);
  const text = (value, attrs = {}) => el('input', { type: 'text', value: value || '', maxlength: 300, autocomplete: 'off', spellcheck: 'false', ...attrs });

  /** Rows of labelled values: a label menu, the value and Remove. get() gives { types, value } for each filled row. */
  function multi(kind, items, addText) {
    const rows = [];
    const box = el('div', { class: 'ed-multi' });
    const list = el('div', { class: 'ed-rows' });
    const labelMenu = (label) => {
      const opts = LABELS.includes(label) ? LABELS : [...LABELS, label].filter(Boolean);
      return el('select', { class: 'ed-label', 'aria-label': `${kind} label` }, opts.map((o) => el('option', { value: o, selected: o === label }, o)));
    };
    const addRow = (it) => {
      const sel = labelMenu(it ? SC.customerMap.labelOf(it.types, kind) : SC.customerMap.DEFAULT[kind]);
      const input = kind === 'address' ? el('textarea', { rows: 2, maxlength: 1000, 'aria-label': 'Address' }, it ? it.street : '')
        : text(it ? it.value : '', { 'aria-label': kind, type: kind === 'email' ? 'email' : 'text', maxlength: kind === 'email' ? 200 : 60, inputmode: kind === 'phone' ? 'tel' : 'text' });
      const row = el('div', { class: 'ed-row' }, sel, input, el('button', { type: 'button', class: 'text-btn', onclick: () => { row.remove(); rows.splice(rows.indexOf(entry), 1); } }, 'Remove'));
      const entry = { sel, input };
      rows.push(entry);
      list.append(row);
    };
    for (const it of items) addRow(it);
    box.append(list, el('button', { type: 'button', class: 'text-btn ed-add', onclick: () => { addRow(null); rows[rows.length - 1].input.focus(); } }, addText));
    const get = () => rows.map((r) => ({ types: SC.customerMap.typesOf(r.sel.value), value: r.input.value.trim(), street: r.input.value.trim() }))
      .filter((r) => r.value)
      .map((r) => (kind === 'address' ? { types: r.types, street: r.street } : { types: r.types, value: r.value }));
    return { el: box, get };
  }

  /** The form's values as a contact. */
  function collect(c, f) {
    const tags = [...new Set(f.groups.value.split(',').map((s) => s.trim()).filter(Boolean))];
    const act = SC.activity.split(c ? c.note : '').activity;
    return SC.model.normalise({
      ...(c || {}), id: c ? c.id : undefined, stage: c ? c.stage : 'lead', followUp: c ? c.followUp : '',
      name: { prefix: '', given: '', additional: '', family: '', suffix: '' }, fn: f.name.value.trim(),
      org: f.org.value.trim(), dept: f.dept.value.trim(), title: f.title.value.trim(), bday: f.bday.value.trim(),
      url: f.url.value.trim(), groups: tags, photo: f.photo.get(), phones: f.phones.get(), emails: f.emails.get(), adr: f.addrs.get(),
      note: SC.activity.join(f.notes.value, act),
    });
  }
  /** Everything the form holds, for the unsaved-change check. */
  const dirty = (f) => JSON.stringify([f.name.value, f.org.value, f.dept.value, f.title.value, f.bday.value, f.url.value, f.groups.value,
    f.notes.value, f.photo.get(), f.phones.get(), f.emails.get(), f.addrs.get()]) !== snapshot;

  /** Draws the form for c (null = a new contact). */
  function render(c) {
    const body = document.getElementById('cardBody');
    const base = c || SC.model.blank();
    const plain = SC.activity.split(c ? c.note : '').plain;
    const photo = SC.photoUi.field(base);
    const f = {
      photo,
      name: text(base.fn === 'No name' && !c ? '' : base.fn, { 'aria-label': 'Name', required: false }),
      org: text(base.org, { 'aria-label': 'Company' }), dept: text(base.dept, { 'aria-label': 'Department' }), title: text(base.title, { 'aria-label': 'Job title' }),
      phones: multi('phone', base.phones, '+ add phone'), emails: multi('email', base.emails, '+ add e-mail'),
      addrs: multi('address', base.adr, '+ add address'),
      bday: text(base.bday, { 'aria-label': 'Birthday', placeholder: 'YYYY-MM-DD or --MM-DD' }),
      url: text(base.url, { 'aria-label': 'Website', type: 'url' }),
      groups: text(base.groups.join(', '), { 'aria-label': 'Groups, comma separated', maxlength: 600 }),
      notes: el('textarea', { rows: 4, maxlength: 5000, 'aria-label': 'Notes' }, plain),
    };
    const msg = el('p', { class: 'ed-msg', role: 'alert' });
    const save = () => {
      const bday = f.bday.value.trim();
      if (bday && !DATE_RX.test(bday)) { msg.textContent = 'Birthday: use YYYY-MM-DD, or --MM-DD when the year is not known.'; return; }
      const next = collect(c, f);
      if (!c) {
        if (!next.fn && !next.org && !next.phones.length && !next.emails.length) { msg.textContent = 'Give the contact a name, company, phone or e-mail.'; return; }
        next.id = SC.records.newId();
        S.setList([...S.list, next]);
        S.open = next.id;
      } else {
        S.replaceMany([next]);
      }
      S.mode = 'view';
      S.emit('render');
    };
    const cancel = async () => {
      if (dirty(f) && !(await UI.confirm('Discard changes?', 'This contact has changes that are not saved. Discard them?', 'Discard', { danger: true }))) return;
      if (!c) S.open = null;
      S.mode = 'view';
      S.emit('render');
    };
    const form = el('form', { class: 'ed-form', novalidate: true, onsubmit: (e) => { e.preventDefault(); save(); } },
      el('div', { class: 'card-bar' }, el('button', { type: 'button', class: 'text-btn', onclick: cancel }, 'Cancel'),
        el('span', { class: 'card-bar-t' }, c ? 'Edit' : 'New contact'), el('button', { type: 'submit', class: 'btn primary' }, 'Save')),
      el('div', { class: 'card-scroll ed-scroll' },
        el('div', { class: 'card-head' }, photo.el),
        el('div', { class: 'ed-grid' },
          field('Name', f.name), field('Company', f.org), field('Department', f.dept), field('Job title', f.title)),
        el('fieldset', { class: 'ed-set' }, el('legend', null, 'Phone'), f.phones.el),
        el('fieldset', { class: 'ed-set' }, el('legend', null, 'E-mail'), f.emails.el),
        el('fieldset', { class: 'ed-set' }, el('legend', null, 'Address'), f.addrs.el),
        el('div', { class: 'ed-grid' }, field('Birthday', f.bday), field('Website', f.url), field('Groups (comma separated)', f.groups)),
        el('label', { class: 'ed-f' }, el('span', { class: 'ed-k' }, 'Notes'), f.notes),
        el('p', { class: 'ed-hint' }, 'Dated notes are kept as they are. Add them in Activity on the card.'),
        msg));
    body.replaceChildren(form);
    snapshot = JSON.stringify([f.name.value, f.org.value, f.dept.value, f.title.value, f.bday.value, f.url.value, f.groups.value,
      f.notes.value, f.photo.get(), f.phones.get(), f.emails.get(), f.addrs.get()]);
    if (!c) setTimeout(() => f.name.focus(), 30);
  }

  SC.cardEdit = { render };
})();
