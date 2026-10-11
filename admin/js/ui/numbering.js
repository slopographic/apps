// The Numbering tab: one card per sequence (invoices, orders). Prefix and padding change the look of the next
// number; the next number can only move forward. Issued numbers are never changed.
(function (g) {
  'use strict';
  const NS = (g.SlopAdmin = g.SlopAdmin || {});
  const UI = g.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);
  const LABEL = { invoice: 'Invoices', order: 'Orders' };

  function card(seq) {
    const f = { prefix: el('input', { type: 'text', maxlength: 20, value: seq.prefix || '', 'data-field': 'prefix', autocomplete: 'off' }),
      pad: el('input', { type: 'number', min: 1, max: 12, step: 1, inputmode: 'numeric', value: seq.pad, 'data-field': 'pad' }),
      next: el('input', { type: 'number', min: 1, step: 1, inputmode: 'numeric', value: seq.next, 'data-field': 'next' }) };
    const shown = el('b', { class: 'preview' }, NS.numbering.preview(seq));
    const msg = el('p', { class: 'msg', role: 'alert' });
    const update = () => {
      const p = { id: seq.id, prefix: f.prefix.value, pad: f.pad.value, next: f.next.value };
      shown.textContent = NS.numbering.preview({ prefix: p.prefix, pad: Number(p.pad) || 1, next: Number(p.next) || 1 });
    };
    for (const k of Object.keys(f)) f[k].addEventListener('input', update);
    return el('section', { class: 'card', 'data-seq': seq.id },
      el('h2', { class: 'h3' }, LABEL[seq.id] || seq.id),
      el('p', { class: 'note' }, 'Next number: ', shown),
      el('div', { class: 'grid3' },
        UI.field('Prefix', f.prefix), UI.field('Digits (padding)', f.pad), UI.field(`Next number (issued so far: ${seq.next - 1})`, f.next)),
      el('div', { class: 'toolbar' }, el('button', { type: 'button', class: 'btn primary', onclick: async () => {
        msg.textContent = '';
        const r = await NS.numbering.save(seq.id, { prefix: f.prefix.value, pad: f.pad.value, next: f.next.value });
        if (!r.ok) { msg.textContent = `Not saved. ${NS.util.refusal(r)}`; return; }
        UI.toast(`${LABEL[seq.id] || seq.id} numbering saved`);
      } }, 'Save numbering')),
      msg);
  }

  async function render() {
    const r = await NS.numbering.list();
    if (!r.ok) { $('nCards').replaceChildren(el('p', { class: 'msg', role: 'alert' }, NS.util.refusal(r))); return; }
    $('nCards').replaceChildren(...r.value.map(card));
  }

  NS.views = NS.views || {};
  NS.views.numbering = { render };
})(typeof window !== 'undefined' ? window : globalThis);
