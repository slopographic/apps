// "New customer" from inside an order: a small dialog that stores a customer and hands it back to the caller.
(function (g) {
  'use strict';
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const h = U.h;

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
            const r = await NS.orders.addCustomer({ name: n, email: email.value.trim(), phone: phone.value.trim() });
            if (!r.ok) { msg.textContent = U.refusal(r); return false; }
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
