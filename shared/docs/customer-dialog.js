// "New customer" from inside an order or an invoice: a small dialog that stores a customer through SlopData.store
// and hands the record back to the caller. Classic script, uses SlopUI. Exposes window.SlopDocs.customerDialog.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopDocs = g.SlopDocs || {});
  const UI = g.SlopUI;

  /** Small DOM builder (same as lines.js). */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, String(v));
    }
    for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return e;
  }

  /** Opens the dialog. onSaved(record) runs after the customer is stored. */
  function open(onSaved) {
    const name = h('input', { type: 'text', maxlength: 200, autocomplete: 'off' });
    const email = h('input', { type: 'email', maxlength: 200, autocomplete: 'off' });
    const phone = h('input', { type: 'tel', maxlength: 60, autocomplete: 'off' });
    const msg = h('p', { class: 'msg bad', role: 'status' });
    const body = h('div', null, UI.field('Name', name), UI.field('Email', email), UI.field('Phone', phone), msg);
    UI.dialog({
      title: 'New customer',
      body,
      buttons: [
        { label: 'Cancel' },
        {
          label: 'Add customer', primary: true,
          act: async () => {
            const n = name.value.trim();
            if (!n) { msg.textContent = 'Name is required.'; return false; }
            const r = await S.store.put('customers', { name: n, email: email.value.trim(), phone: phone.value.trim(), stage: 'customer' });
            if (!r.ok) { msg.textContent = r.message || 'Not saved'; return false; }
            UI.toast(`Added ${n}`);
            onSaved(r.value);
            return undefined;
          },
        },
      ],
    });
    setTimeout(() => name.focus(), 30);
  }

  NS.customerDialog = { open };
})(typeof window !== 'undefined' ? window : globalThis);
