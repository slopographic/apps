// The paper view: one document drawn as a page on the screen (and as the print sheet), from the same view that the PDF
// uses (shared/docs/doc-view.js) and the same template (shared/docs/pdf-layouts.js). Fields that can be edited are
// buttons with data-edit (field), data-index (line) and data-value (the raw text an editor starts with); paper-edit.js
// turns a click into an input. Classic script. Exposes window.SlopDocs.paper.
(function (g) {
  'use strict';
  const NS = (g.SlopDocs = g.SlopDocs || {});

  /** Small DOM builder: h(tag, attrs, ...children). Text is escaped by the DOM. */
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'dataset') Object.assign(e.dataset, v);
      else if (v === true) e.setAttribute(k, '');
      else e.setAttribute(k, String(v));
    }
    for (const c of kids.flat()) {
      if (c === null || c === undefined || c === false || c === '') continue;
      e.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return e;
  }

  /** A field on the page: an editable button when editing is on, plain text otherwise. */
  function field(on, name, label, shown, raw, index) {
    if (!on) return h('span', { class: 'pp-val', text: shown });
    return h('button', {
      type: 'button', class: 'pe', text: shown || '–', 'aria-label': label,
      dataset: { edit: name, value: raw ?? '', ...(index === undefined ? {} : { index: String(index) }) },
    });
  }

  const FIELD_LABEL = { description: 'description', qty: 'quantity', unitPrice: 'unit price', taxRate: 'tax %', discount: 'discount %' };   // i18n-ignore: the document's own printed words (the paper and the PDF stay in the document's words)

  /** The page for one view. opts.editable: show the editable fields (default: the view's editable). */
  function build(view, opts = {}) {
    const st = view.style;
    const on = opts.editable !== undefined ? !!opts.editable && view.editable : view.editable;
    const co = view.company;
    const w = (k, v) => (g.SlopI18n ? g.SlopI18n.t(k, v) : k);   // the words of the editing controls (the page's printed words stay the document's)
    const coName = field(on, 'company', w('biz.pg.company'), co.name, co.name);
    const coBlock = h('div', { class: 'pp-co' }, h('h1', { class: 'pp-coname' }, coName),
      co.lines.map((l) => h('p', { class: 'pp-addr', text: l })),
      co.taxNumber ? h('p', { class: 'pp-addr', text: `Tax number ${co.taxNumber}` }) : null);   // i18n-ignore: the document's own printed words (the paper and the PDF stay in the document's words)
    /** The number and the dates as a list (each label keeps a space after it, so the text reads "Due 2026-11-10"). */
    const metaList = () => {
      const rows = [h('div', null, h('dt', { text: 'Number ' }), h('dd', { class: 'mono', text: view.number }))];   // i18n-ignore: the document's own printed words (the paper and the PDF stay in the document's words)
      for (const m of view.meta) rows.push(h('div', null, h('dt', { text: `${m.label} ` }), h('dd', null, field(on && !!m.field, m.field, w('biz.pg.date_of', { label: m.label }), m.value, m.value))));
      return h('dl', { class: 'pp-meta' }, rows);
    };
    const title = (withMeta) => h('div', { class: 'pp-title' }, h('h2', { class: 'pp-doctitle', text: view.title.toUpperCase() }),
      withMeta ? metaList() : null,
      view.statusText ? h('p', { class: 'pp-status', text: view.statusText.toUpperCase() }) : null);
    const b = view.bill;
    const billName = field(on, 'customer', w('biz.pg.customer'), b.name || w('biz.pg.no_customer'), b.customerId);
    const bill = h('section', { class: 'pp-bill' }, h('h3', { class: 'pp-label', text: b.title }),
      h('p', { class: 'pp-name' }, billName), b.lines.map((l) => h('p', { class: 'pp-addr', text: l })));
    const head = st.sidebar
      ? h('div', { class: 'pp-side' }, coBlock, bill, metaList())
      : h('header', { class: 'pp-head' }, coBlock, title(true));
    const rows = view.rows.map((r) => h('tr', { class: r.bad ? 'bad' : '' },
      h('td', { class: 'pp-desc' }, field(on, 'description', w('biz.pg.desc_n', { n: String(r.index + 1) }), r.description, r.raw.description, r.index)),
      h('td', { class: 'n' }, field(on, 'qty', w('biz.pg.qty_n', { n: String(r.index + 1) }), r.qty, r.raw.qty, r.index)),
      h('td', { class: 'n' }, field(on, 'unitPrice', w('biz.pg.price_n', { n: String(r.index + 1) }), r.unit, r.raw.unitPrice, r.index)),
      view.hasDiscount ? h('td', { class: 'n' }, field(on, 'discount', w('biz.pg.disc_n', { n: String(r.index + 1) }), r.disc, r.raw.discount, r.index)) : null,
      h('td', { class: 'n' }, field(false, '', '', r.tax)),
      h('td', { class: 'n strong' }, field(false, '', '', r.total))));
    const table = h('table', { class: `pp-table t-${st.table}` },
      h('thead', null, h('tr', null, h('th', { text: 'Description' }), h('th', { class: 'n', text: 'Qty' }), h('th', { class: 'n', text: 'Unit price' }),   // i18n-ignore: the document's own printed words (the paper and the PDF stay in the document's words)
        view.hasDiscount ? h('th', { class: 'n', text: 'Disc.' }) : null, h('th', { class: 'n', text: 'Tax' }), h('th', { class: 'n', text: 'Total' }))),   // i18n-ignore: the document's own printed words (the paper and the PDF stay in the document's words)
      h('tbody', null, rows));
    const sums = h('dl', { class: `pp-sums tb-${st.totals}` }, view.totals.flatMap((t) => [
      h('dt', { class: t.strong ? 'grand' : '', text: t.label }), h('dd', { class: t.strong ? 'grand' : '', text: t.value })]),
      view.totalsNote ? h('p', { class: 'pp-note', text: view.totalsNote }) : null);
    const notes = view.notes.text || on
      ? h('section', { class: 'pp-notes' }, h('h3', { class: 'pp-label', text: 'Notes' }),   // i18n-ignore: the document's own printed words (the paper and the PDF stay in the document's words)
        h('p', null, field(on, 'notes', w('biz.pg.notes'), view.notes.text || w('biz.pg.add_note'), view.notes.text)))
      : null;
    const main = h('div', { class: 'pp-main' }, st.sidebar ? title(false) : bill, table, sums, notes);
    const foot = h('footer', { class: 'pp-foot' }, h('span', { text: [co.name, co.taxNumber && `Tax number ${co.taxNumber}`].filter(Boolean).join('  ·  ') }));   // i18n-ignore: the document's own printed words (the paper and the PDF stay in the document's words)
    return h('article', { class: `paper l-${st.id} f-${st.family} ta-${st.titleAlign} hd-${st.header} ${st.sidebar ? 'has-side' : ''}`,
      style: `--accent:${st.accent.css}`, 'aria-label': `${view.title} ${view.number}` },
      st.sidebar ? h('div', { class: 'pp-grid' }, head, main) : h('div', { class: 'pp-body' }, head, main),
      foot);
  }

  NS.paper = { build, h, FIELD_LABEL };
})(typeof window !== 'undefined' ? window : globalThis);
