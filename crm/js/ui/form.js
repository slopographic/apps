// The customer form, in a SlopUI dialog with six sections: Contact, Company, Addresses, Tags and groups, Notes and
// Follow-up. Each field shows its own message next to it. Saving with a bad field keeps the dialog open at that field.
// Reset puts the values back from when the form opened (SlopFormReset, shared).
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const FIELD_NAMES = ['name', 'company', 'department', 'title', 'website', 'followUp', 'notes', 'photo', 'stage'];
  const sub = (title, ...kids) => el('div', { class: 'sub' }, el('span', { class: 'sub-t' }, title), kids);

  /** Removes every message from the form. */
  function clearErrors(form) {
    for (const e of form.querySelectorAll('.fld-err')) e.textContent = '';
    for (const i of form.querySelectorAll('[aria-invalid="true"]')) i.removeAttribute('aria-invalid');
  }

  /** Shows one message per field key, marks those inputs, and moves focus to the first one. */
  function showErrors(form, errs) {
    clearErrors(form);
    for (const [key, msg] of Object.entries(errs)) {
      const err = form.querySelector(`[data-err="${key}"]`);
      if (err) err.textContent = msg;
      const input = form.querySelector(`[data-key="${key}"]`);
      if (input) input.setAttribute('aria-invalid', 'true');
    }
    const first = form.querySelector('[aria-invalid="true"]');
    if (first) first.focus();
  }

  /** The messages for a refused save: the field errors the store names, else the refusal text under the form. */
  function serverErrors(r) {
    const list = r.errors || [];
    const out = {};
    for (const e of list) if (FIELD_NAMES.includes(e.field)) out[e.field] = e.message;
    if (!list.length || Object.keys(out).length < list.length) out.form = NS.util.refusal(r);
    return out;
  }

  /** Opens the form for a new customer (id null) or an existing one. */
  async function open(id) {
    let cur = {};
    if (id) {
      const r = await NS.customers.get(id);
      if (!r.ok || !r.value) { UI.toast(r.ok ? 'That customer no longer exists.' : NS.util.refusal(r)); return; }
      cur = r.value;
    }
    const P = NS.parts;
    const v = NS.fields.toForm(cur);
    const bind = (input, key, ev = 'input') => { input.addEventListener(ev, () => { v[key] = input.value; }); return input; };
    const text = (key, max = 200) => bind(el('input', { type: 'text', value: v[key], maxlength: max, autocomplete: 'off' }), key);
    const stage = bind(UI.select(NS.STAGES.map((s) => [s, NS.stageLabel(s)]), v.stage), 'stage', 'change');
    const followUp = bind(el('input', { type: 'date', value: v.followUp }), 'followUp');
    const cats = el('input', { type: 'text', value: v.categories.join(', '), maxlength: 400, autocomplete: 'off' });
    cats.addEventListener('input', () => { v.categories = NS.util.tags(cats.value); });
    const notes = el('textarea', { rows: 5, maxlength: 5000 }, v.notes);
    notes.addEventListener('input', () => { v.notes = notes.value; });

    const body = el('form', { class: 'crm-form', novalidate: true, onsubmit: (e) => e.preventDefault(),
      oninput: () => clearErrors(body), onchange: () => clearErrors(body) },
    P.section('Contact',
      P.fld('name', 'Name', text('name')),
      P.photo(v),
      sub('Phone numbers', P.entries('phone', v.phones)),
      sub('Email addresses', P.entries('email', v.emails))),
    P.section('Company',
      P.fld('company', 'Company', text('company')),
      P.fld('department', 'Department', text('department')),
      P.fld('title', 'Job title', text('title')),
      P.fld('website', 'Website', text('website', 300), 'Optional, for example example.com')),
    P.section('Addresses', sub('Postal addresses', P.entries('address', v.addresses))),
    P.section('Tags and groups',
      el('p', { class: 'note' }, 'Tags are coloured and shared by all customers. Categories are free text on this customer only.'),
      sub('Tags', P.labelPicker('tag', v.tagIds, (ids) => { v.tagIds = ids; })),
      sub('Groups', P.labelPicker('group', v.groupIds, (ids) => { v.groupIds = ids; })),
      P.fld('categories', 'Categories (comma separated)', cats, 'Kept as before. Use tags for colours and filters.')),
    P.section('Notes',
      P.fld('notes', 'Notes', notes, 'One line per note. Start a line with a date such as [2026-10-11] to date it.')),
    P.section('Follow-up',
      P.fld('stage', 'Pipeline stage', stage),
      P.fld('followUp', 'Follow-up date', followUp, 'Shows on the Follow-ups tab.')),
    el('p', { class: 'msg fld-err', 'data-err': 'form', role: 'alert' }));

    const save = async () => {
      const errs = NS.fields.validate(v);
      if (Object.keys(errs).length) { showErrors(body, errs); return false; }
      const r = await NS.customers.save(id, NS.fields.toChanges(v));
      if (!r.ok) { showErrors(body, serverErrors(r)); return false; }
      UI.toast(id ? 'Customer saved' : 'Customer added');
      return true;
    };
    SlopFormReset.snapshot(body);
    UI.dialog({
      title: id ? 'Edit customer' : 'Add customer', cls: 'crm-dlg', body,
      buttons: [{ label: 'Cancel' }, SlopFormReset.dialogButton(body), { label: 'Save', primary: true, act: save }],
    });
  }

  NS.form = { open };
})(typeof window !== 'undefined' ? window : globalThis);
