// The customer form, in a SlopUI dialog. Saving with an invalid field keeps the dialog open and says what is wrong.
(function (g) {
  'use strict';
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const UI = g.SlopUI;
  const el = UI.el;

  /** Opens the form for a new customer (id null) or an existing one. */
  async function open(id) {
    let cur = {};
    if (id) {
      const r = await NS.customers.get(id);
      if (!r.ok || !r.value) { UI.toast(r.ok ? 'That customer no longer exists.' : NS.util.refusal(r)); return; }
      cur = r.value;
    }
    const f = {
      name: el('input', { type: 'text', value: cur.name || '', maxlength: 200, required: true, autocomplete: 'off' }),
      email: el('input', { type: 'email', value: cur.email || '', maxlength: 200, autocomplete: 'off' }),
      phone: el('input', { type: 'tel', value: cur.phone || '', maxlength: 60, autocomplete: 'off' }),
      address: el('textarea', { rows: 2, maxlength: 1000 }, cur.address || ''),
      categories: el('input', { type: 'text', value: (cur.categories || []).join(', '), maxlength: 400, autocomplete: 'off' }),
      stage: UI.select(NS.STAGES.map((s) => [s, NS.stageLabel(s)]), cur.stage || 'lead'),
      followUp: el('input', { type: 'date', value: cur.followUp || '' }),
    };
    const msg = el('p', { class: 'msg', role: 'alert' });
    const body = el('form', { class: 'crm-form', novalidate: true, onsubmit: (e) => e.preventDefault() },
      UI.field('Name', f.name), UI.field('Email', f.email), UI.field('Phone', f.phone), UI.field('Address', f.address),
      UI.field('Categories (comma separated)', f.categories), UI.field('Stage', f.stage), UI.field('Follow-up date', f.followUp), msg);
    UI.dialog({
      title: id ? 'Edit customer' : 'Add customer', body,
      buttons: [
        { label: 'Cancel' },
        { label: 'Save', primary: true, act: async () => {
          const changes = {
            name: f.name.value, email: f.email.value, phone: f.phone.value, address: f.address.value,
            categories: NS.util.tags(f.categories.value), stage: f.stage.value, followUp: f.followUp.value || null,
          };
          if (changes.followUp && !NS.util.isDate(changes.followUp)) { msg.textContent = 'Follow-up must be a real date.'; return false; }
          const r = await NS.customers.save(id, changes);
          if (!r.ok) { msg.textContent = NS.util.refusal(r); return false; }
          UI.toast(id ? 'Customer saved' : 'Customer added');
          return true;
        } },
      ],
    });
    setTimeout(() => f.name.focus(), 30);
  }

  NS.form = { open };
})(typeof window !== 'undefined' ? window : globalThis);
