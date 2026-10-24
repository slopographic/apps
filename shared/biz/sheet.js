// A printable business sheet (a customer statement, a price list): the company block from the settings on the left, the
// title and its dates on the right. Styles in shared/biz/sheet.css (.doc-sheet, its parts, and the print rules that show only
// the sheet). Classic script, loaded after biz.js. SlopBiz.sheet = { head(settings, title, meta), lines(text) }.
(function (g) {
  'use strict';
  const B = (g.SlopBiz = g.SlopBiz || {});

  /** The non-empty lines of a multi-line text (an address). */
  const lines = (t) => String(t || '').split('\n').map((x) => x.trim()).filter(Boolean);

  /** The sheet head: the company (name, address lines, tax number) and the title with its meta lines ('Date 2026-10-24'). */
  function head(settings, title, meta = []) {
    const h = B.h, s = settings || {};
    return h('header', { class: 'sheet-head' },
      h('div', null, h('b', { text: s.companyName || 'Your company' }), ...lines(s.address).map((x) => h('div', { text: x })), s.taxNumber ? h('div', { text: `Tax number ${s.taxNumber}` }) : null),
      h('div', { class: 'sheet-title' }, h('h2', { text: title }), ...meta.filter(Boolean).map((x) => h('div', { text: x }))));
  }

  B.sheet = { head, lines };
})(typeof window !== 'undefined' ? window : globalThis);
