// A payment reminder from a customer statement: the subject and message (SlopData.statement.reminder: the tone follows how
// late the oldest open invoice is) in a dialog, to edit, copy, or open in the person's email app addressed to the customer
// (a mailto: link; nothing is sent from here).
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const h = U.h;
  const TONE = { friendly: 'A friendly reminder', firm: 'Overdue: a firmer reminder', final: 'Final reminder' };

  /** The mailto: link for an address, subject and body. */
  const mailto = (to, subject, body) => `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  /** Opens the dialog for a statement (st) of a customer, with the settings for the company name and money format. */
  function open(st, customer, settings) {
    const r = S.statement.reminder(st, { customer: customer.name, company: settings.companyName }, (m) => U.money(m, st.currency, settings.locale));
    if (r.tone === 'none') { UI.toast('Nothing is owed, so there is nothing to remind.'); return null; }
    const subject = h('input', { type: 'text', value: r.subject, class: 'sui-input' });
    const body = h('textarea', { rows: 12, class: 'sui-input rem-body' });
    body.value = r.body;
    const mail = h('a', { class: 'btn primary', href: mailto(customer.email, r.subject, r.body), text: customer.email ? `Open in email (${customer.email})` : 'Open in email' });
    const sync = () => { mail.href = mailto(customer.email, subject.value, body.value); };
    subject.addEventListener('input', sync);
    body.addEventListener('input', sync);
    const copy = h('button', { type: 'button', class: 'btn', text: 'Copy message', onclick: async () => {
      try { await navigator.clipboard.writeText(`${subject.value}\n\n${body.value}`); UI.toast('Reminder copied'); } catch (e) { body.select(); UI.toast('Select the text and copy it'); }
    } });
    UI.dialog({
      title: TONE[r.tone],
      body: h('div', { class: 'rem' }, customer.email ? null : h('p', { class: 'note', text: `${customer.name} has no email address. Add one in Slop CRM, or copy the message.` }),
        UI.field('Subject', subject), UI.field('Message', body), h('div', { class: 'toolbar' }, mail, copy)),
      buttons: [{ label: 'Close' }],
    });
    return { tone: r.tone, subject, body, mail };
  }

  NS.reminder = { open, mailto };
})(typeof window !== 'undefined' ? window : globalThis);
