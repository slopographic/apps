// Line cards for an order: product, description, quantity, unit price, tax %, discount %, line total, and the
// totals box (computed by SlopData.money through SlopDocs.model). Edits go to the editor through onEdit(i, patch).
(function (g) {
  'use strict';
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const h = U.h;

  const money = (minor, o) => U.money(minor, o.currency, o.locale);

  /** Reads one typed field into a line value; null when the text is not valid (the card then says why). */
  function parseField(field, text, currency) {
    if (field === 'qty') return /^\d+$/.test(String(text).trim()) ? Number(text) : null;
    if (field === 'unitPrice') return M.amountFromText(text, currency);
    if (field === 'taxRate' || field === 'discount') return M.bpFromPercent(text);
    return String(text);
  }

  function productSelect(line, o) {
    const sel = h('select', { 'aria-label': 'Product', disabled: o.readOnly, dataset: { f: 'product' } },
      h('option', { value: '', text: 'Custom line (no product)' }),
      ...o.products.map((p) => h('option', { value: p.id, selected: p.id === line.productId, text: `${p.sku} · ${p.name} · ${money(p.price, o)}` })));
    return sel;
  }

  function card(line, i, o) {
    const inp = (f, label, value, extra = {}) => h('label', { class: extra.wide ? 'wide' : '' }, label,
      h('input', { type: extra.type || 'text', value, disabled: o.readOnly, inputmode: extra.inputmode, maxlength: extra.maxlength, dataset: { f } }));
    const c = h('div', { class: 'line-card', dataset: { i: String(i) } },
      h('div', { class: 'line-grid' },
        h('label', { class: 'wide' }, 'Product', productSelect(line, o)),
        inp('description', 'Description', line.description, { wide: true, maxlength: 300 }),
        inp('qty', 'Qty', line.qty ?? '', { inputmode: 'numeric' }),
        inp('unitPrice', `Unit price (${o.currency})`, line.unitPrice == null ? '' : M.amountText(line.unitPrice, o.currency), { inputmode: 'decimal' }),
        inp('taxRate', 'Tax %', M.percentText(line.taxRate ?? 0), { inputmode: 'decimal' }),
        inp('discount', 'Discount %', M.percentText(line.discount || 0), { inputmode: 'decimal' })),
      h('div', { class: 'line-foot' }, h('span', { class: 'num', dataset: { role: 'total' } }),
        o.readOnly ? null : h('button', { type: 'button', class: 'btn small danger', dataset: { f: 'remove' }, text: 'Remove line' })),
      h('p', { class: 'line-err', role: 'status', dataset: { role: 'err' } }));
    paintCard(c, line, o);
    return c;
  }

  /** Refreshes one card's total, error text and invalid marking from its line. */
  function paintCard(c, line, o) {
    const errs = M.lineErrors(line);
    c.querySelector('[data-role="total"]').textContent = `Line total ${money(M.lineTotal(line), o)}`;
    c.querySelector('[data-role="err"]').textContent = errs.length ? `Fix: ${errs.join('; ')}` : '';
    c.classList.toggle('bad', errs.length > 0);
  }

  /** Draws every line card into box. o: { products, currency, locale, readOnly, onEdit(i, patch), onProduct(i, product), onRemove(i) }. */
  function draw(box, lines, o) {
    box.replaceChildren(...lines.map((l, i) => card(l, i, o)));
    if (!lines.length) box.append(h('p', { class: 'empty', text: 'No lines yet. Add one.' }));
    if (box.dataset.bound) return;
    box.dataset.bound = '1';
    box.addEventListener('input', (e) => {
      const c = e.target.closest('.line-card');
      if (!c || !e.target.dataset.f || e.target.dataset.f === 'product') return;
      const i = Number(c.dataset.i);
      const f = e.target.dataset.f;
      const patch = { [f]: parseField(f, e.target.value, box.__o.currency) };
      box.__o.onEdit(i, patch);
      paintCard(c, box.__lines[i], box.__o);
    });
    box.addEventListener('change', (e) => {
      const c = e.target.closest('.line-card');
      if (!c || e.target.dataset.f !== 'product') return;
      const id = e.target.value;
      box.__o.onProduct(Number(c.dataset.i), id ? box.__o.products.find((p) => p.id === id) : null);
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('[data-f="remove"]');
      if (b) box.__o.onRemove(Number(b.closest('.line-card').dataset.i));
    });
  }

  /** Keeps the latest lines and options on the box for the listeners (they are bound once). */
  function bind(box, lines, o) { box.__lines = lines; box.__o = o; }

  /** Totals box: subtotal, tax by rate, total. Says so when a line is not complete yet. */
  function drawTotals(box, lines, o) {
    const t = M.totals(lines);
    box.replaceChildren();
    if (!t) { box.append(h('p', { class: 'note', text: 'Totals appear when every line is complete.' })); return; }
    const dl = h('dl', null);
    const add = (label, value, cls) => dl.append(h('dt', { class: cls, text: label }), h('dd', { class: cls, text: value }));
    add('Subtotal (before tax)', money(t.subtotal, o));
    for (const r of t.byRate) add(`Tax ${M.percentText(r.rate) || '0'}% on ${money(r.net, o)}`, money(r.tax, o));
    add('Total', money(t.total, o), 'grand');
    box.append(dl);
  }

  NS.lines = { draw: (box, lines, o) => { bind(box, lines, o); draw(box, lines, o); }, bind, drawTotals, paintCard, money };
})(typeof window !== 'undefined' ? window : globalThis);
