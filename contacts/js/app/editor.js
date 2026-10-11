/* Slop Contacts: the contact editor (a SlopUI dialog). Name parts, display name, organisation, title, any number
 * of phones, e-mails and addresses (each with a TYPE), birthday, website, groups, note. Save normalises the contact. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const el = UI.el;
  const PHONE_TYPES = ['CELL', 'HOME', 'WORK', 'MAIN', 'FAX', 'HOME,FAX', 'WORK,FAX', 'PAGER', 'CAR', 'OTHER'];
  const MAIL_TYPES = ['', 'HOME', 'WORK', 'OTHER'];

  const TYPE_LABEL = { '': '(no type)', CELL: 'Mobile', HOME: 'Home', WORK: 'Work', MAIN: 'Main', FAX: 'Fax', 'HOME,FAX': 'Home fax',
    'WORK,FAX': 'Work fax', PAGER: 'Pager', CAR: 'Car', OTHER: 'Other' };
  /** Select options for a list of type values, keeping the current value even when it is unusual. */
  function typeOptions(list, current) {
    const all = list.includes(current) ? list : [current, ...list];
    return all.map((v) => [v, TYPE_LABEL[v] || v.charAt(0) + v.slice(1).toLowerCase()]);
  }
  const input = (value, label, type = 'text', ph = '') => el('input', { class: 'sui-input', type, value: value || '', 'aria-label': label, placeholder: ph || null, autocomplete: 'off' });
  const removeBtn = (label, row) => { const b = el('button', { type: 'button', class: 'sui-btn ed-rm', 'aria-label': label, title: label }, '×'); b.addEventListener('click', () => row.remove()); return b; };
  const section = (title, ...kids) => el('fieldset', { class: 'ed-sec' }, el('legend', null, title), ...kids);

  function phoneRow(p) {
    const cur = (p && p.types || []).join(',');
    const row = el('div', { class: 'ed-row ed-phone' }, UI.select(typeOptions(PHONE_TYPES, cur), cur), input(p && p.value, 'Phone number', 'tel', '+44 7700 900123'));
    row.append(removeBtn('Remove phone', row));
    return row;
  }
  function mailRow(e) {
    const cur = (e && e.types || []).join(',');
    const row = el('div', { class: 'ed-row ed-mail' }, UI.select(typeOptions(MAIL_TYPES, cur), cur), input(e && e.value, 'E-mail address', 'email', 'name@example.com'));
    row.append(removeBtn('Remove e-mail', row));
    return row;
  }
  function adrRow(a) {
    const cur = (a && a.types || []).join(',');
    const row = el('div', { class: 'ed-adr' },
      UI.select(typeOptions(MAIL_TYPES, cur), cur),
      input(a && a.street, 'Street'), input(a && a.locality, 'City'), input(a && a.region, 'State or region'),
      input(a && a.postal, 'Postal code'), input(a && a.country, 'Country'));
    row.append(removeBtn('Remove address', row));
    row.dataset.po = a && a.po || ''; row.dataset.ext = a && a.ext || '';
    return row;
  }
  /** Add-buttons that append a row to a container. */
  const adder = (label, box, make) => { const b = el('button', { type: 'button', class: 'sui-btn ed-add' }, label); b.addEventListener('click', () => { box.append(make()); }); return b; };

  /** Build the form for a contact. Returns { body, read() } where read() gives the edited contact. */
  function form(c) {
    const n = c.name;
    const fields = {
      prefix: input(n.prefix, 'Prefix'), given: input(n.given, 'Given name'), additional: input(n.additional, 'Middle name'),
      family: input(n.family, 'Family name'), suffix: input(n.suffix, 'Suffix'),
      fn: input(c.fn, 'Display name'), org: input(c.org, 'Organisation'), dept: input(c.dept, 'Department'),
      title: input(c.title, 'Job title'), bday: input(c.bday, 'Birthday', 'text', 'YYYY-MM-DD'), url: input(c.url, 'Website', 'url', 'example.com'),
      groups: input(c.groups.join(', '), 'Groups, comma separated'),
    };
    const note = el('textarea', { class: 'sui-input ed-note', rows: 3, 'aria-label': 'Note' }, c.note);
    const phones = el('div', { class: 'ed-list' }, c.phones.map(phoneRow));
    const mails = el('div', { class: 'ed-list' }, c.emails.map(mailRow));
    const adrs = el('div', { class: 'ed-list' }, c.adr.map(adrRow));
    const body = el('div', { class: 'ed' },
      section('Name', el('div', { class: 'ed-grid' }, UI.field('Prefix', fields.prefix), UI.field('Given', fields.given),
        UI.field('Middle', fields.additional), UI.field('Family', fields.family), UI.field('Suffix', fields.suffix)),
        UI.field('Display name', fields.fn)),
      section('Work', el('div', { class: 'ed-grid' }, UI.field('Organisation', fields.org), UI.field('Department', fields.dept), UI.field('Job title', fields.title))),
      section('Phones', phones, adder('+ Add phone', phones, () => phoneRow(null))),
      section('E-mails', mails, adder('+ Add e-mail', mails, () => mailRow(null))),
      section('Addresses', adrs, adder('+ Add address', adrs, () => adrRow(null))),
      section('More', el('div', { class: 'ed-grid' }, UI.field('Birthday', fields.bday), UI.field('Website', fields.url)),
        UI.field('Groups', fields.groups), UI.field('Note', note)));
    const read = () => {
      const oldFn = SC.model.composed(c);
      const name = {};
      for (const k of SC.model.NAME_KEYS) name[k] = fields[k].value;
      const newComposed = SC.model.composed({ name });
      const fn = fields.fn.value.trim() === oldFn && oldFn ? newComposed : fields.fn.value;
      return SC.model.normalise({
        ...c, name, fn, org: fields.org.value, dept: fields.dept.value, title: fields.title.value,
        bday: fields.bday.value, url: fields.url.value, note: note.value, groups: fields.groups.value.split(','),
        phones: [...phones.querySelectorAll('.ed-phone')].map((r) => ({ types: splitType(r.querySelector('select').value), value: r.querySelector('input').value })),
        emails: [...mails.querySelectorAll('.ed-mail')].map((r) => ({ types: splitType(r.querySelector('select').value), value: r.querySelector('input').value })),
        adr: [...adrs.querySelectorAll('.ed-adr')].map((r) => {
          const i = [...r.querySelectorAll('input')].map((x) => x.value);
          return { types: splitType(r.querySelector('select').value), po: r.dataset.po, ext: r.dataset.ext, street: i[0], locality: i[1], region: i[2], postal: i[3], country: i[4] };
        }),
      });
    };
    return { body, read };
  }
  const splitType = (v) => String(v || '').split(',').filter(Boolean);

  /** Open the editor for a contact id, or a new contact when id is null. */
  function open(id) {
    const existing = id ? S.byId(id) : null;
    const base = existing || SC.model.blank();
    const f = form(base);
    UI.dialog({
      title: existing ? 'Edit contact' : 'New contact', cls: 'ed-dlg', body: f.body,
      buttons: [
        ...(existing ? [{ label: 'Delete', danger: true, act: async () => {
          const ok = await UI.confirm('Delete this contact?', `“${SC.model.displayName(existing)}” is removed from this list. Undo is not available.`, 'Delete', { danger: true });
          if (!ok) return false;
          S.setList(S.list.filter((c) => c.id !== existing.id), { dirty: true });
          S.setSel([...S.sel].filter((x) => x !== existing.id));
        } }] : []),
        { label: 'Cancel' },
        { label: 'Save', primary: true, act: () => {
          const c = f.read();
          if (!SC.model.hasContent(c) && !c.phones.length && !c.emails.length) { UI.toast('Add a name, a phone or an e-mail'); return false; }
          if (existing) S.replaceMany([c]); else S.setList([...S.list, c]);
          return undefined;
        } },
      ],
    });
  }

  SC.editor = { open, form, phoneRow, mailRow, adrRow };
})();
