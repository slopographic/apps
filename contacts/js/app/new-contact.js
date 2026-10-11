/* Slop Contacts: the quick form for a new contact (name, phone, e-mail, company). It makes the contact, opens it in
 * the card and leaves the full form for the rest. Adds SlopContacts.newContact. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const el = UI.el;

  function open() {
    const f = {
      name: el('input', { type: 'text', maxlength: 200, autocomplete: 'off', 'aria-label': 'Name' }),
      phone: el('input', { type: 'tel', maxlength: 60, autocomplete: 'off', 'aria-label': 'Phone' }),
      email: el('input', { type: 'email', maxlength: 200, autocomplete: 'off', 'aria-label': 'E-mail' }),
      org: el('input', { type: 'text', maxlength: 200, autocomplete: 'off', 'aria-label': 'Company' }),
    };
    const msg = el('p', { class: 'sui-p msg', role: 'alert' });
    UI.dialog({ title: 'New contact', body: el('form', { class: 'quick-form', novalidate: true, onsubmit: (e) => e.preventDefault() },
      UI.field('Name', f.name), UI.field('Phone', f.phone), UI.field('E-mail', f.email), UI.field('Company', f.org), msg),
    buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, act: () => {
      const phone = f.phone.value.trim(), email = f.email.value.trim();
      const c = SC.model.normalise({ id: SC.records.newId(), fn: f.name.value.trim(), org: f.org.value.trim(), stage: 'lead',
        phones: phone ? [{ value: phone, types: ['CELL'] }] : [], emails: email ? [{ value: email, types: ['WORK'] }] : [] });
      if (!f.name.value.trim() && !c.org && !phone && !email) { msg.textContent = 'Give the contact a name, company, phone or e-mail.'; return false; }
      S.setList([...S.list, c]);
      S.setSel([]);
      S.open = c.id; S.mode = 'view';
      S.emit('render');
      return true;
    } }] });
    setTimeout(() => f.name.focus(), 30);
  }

  SC.newContact = { open };
})();
