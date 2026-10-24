/* Slop Docs — ui/hf: the Header and footer panel (Format ▸ Header and footer…, the palette, or a double-click in the top
 * or bottom margin of a page). A docked panel beside the pages: the header and footer text (several lines are several
 * paragraphs), its alignment, Page number and Page count fields ({page} and {pages}), a different first page, and the
 * distance from the page edge. The pages follow as you type; Cancel puts back what was there. The text is laid out on
 * every page (layout/index.js), printed, and written to PDF, DOCX (w:hdr, w:ftr) and .sdoc. Classic script. */
(function () {
  'use strict';
  const S = window.SlopDocs;
  const E = () => window.SlopDocEngine;
  const UI = () => window.SlopUI;
  const ALIGN = [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']];
  let open = null;

  /** Puts the panel's values into the open document (no undo step: the panel's Cancel is the way back). */
  function apply(values) {
    S.doc = E().HF.applyHF(S.doc, values);
    S.file.dirty = true;
    S.relayout();
    S.emit('change');
  }

  function areaField(name, label, blocks) {
    const U = UI(), cur = E().HF.hfText(blocks);
    const ta = U.el('textarea', { class: 'sui-input hf-text', rows: 2, 'data-area': name, 'aria-label': label + ' text', placeholder: 'Empty' });
    ta.value = cur.text;
    const al = U.select(ALIGN, cur.align);
    al.setAttribute('aria-label', label + ' alignment'); al.dataset.hfAlign = name;
    const ins = (tok) => () => {
      const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
      ta.value = ta.value.slice(0, a) + tok + ta.value.slice(b);
      ta.selectionStart = ta.selectionEnd = a + tok.length;
      ta.focus();
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const btn = (text, tok, title) => U.el('button', { type: 'button', class: 'sui-btn hf-ins', title, onclick: ins(tok) }, text);
    return U.el('fieldset', { class: 'hf-area', 'data-area': name },
      U.el('legend', null, label), ta,
      U.el('div', { class: 'hf-row' }, al,
        btn('Page number', '{page}', 'Insert the page number field'),
        btn('Page count', '{pages}', 'Insert the number of pages'),
        btn('Page X of Y', 'Page {page} of {pages}', 'Insert "Page 1 of 3"')));
  }

  S.openHF = function (focus) {
    const U = UI();
    if (!U || !S.doc) return null;
    if (open) { open.close(false); open = null; }
    const before = { header: S.doc.header, footer: S.doc.footer, section: S.doc.section };
    const d = S.doc, m = d.section.margin;
    const first = U.check('Different first page', !!d.section.differentFirst);
    const gapH = U.number(Math.round(m.header), 0, 288), gapF = U.number(Math.round(m.footer), 0, 288);
    const areas = {
      header: areaField('header', 'Header', d.header.default), footer: areaField('footer', 'Footer', d.footer.default),
      headerFirst: areaField('headerFirst', 'First page header', d.header.first), footerFirst: areaField('footerFirst', 'First page footer', d.footer.first),
    };
    (areas[focus] || areas.header).querySelector('textarea').setAttribute('autofocus', ''); // the dialog focuses it when it opens
    const firstBox = U.el('div', { class: 'hf-first' }, areas.headerFirst, areas.footerFirst);
    const body = U.el('div', { class: 'hf-panel' },
      areas.header, areas.footer, first.el, firstBox,
      U.el('div', { class: 'hf-row hf-gaps' }, U.field('Header from top', gapH, 'pt'), U.field('Footer from bottom', gapF, 'pt')),
      U.el('p', { class: 'sui-p hf-note' }, '{page} is the page number and {pages} the number of pages. Both are filled in on every page, in print and in the PDF.'));
    const read = () => {
      const v = { differentFirst: first.input.checked, headerGap: Number(gapH.value), footerGap: Number(gapF.value) };
      for (const k of Object.keys(areas)) v[k] = { text: areas[k].querySelector('textarea').value, align: areas[k].querySelector('select').value };
      return v;
    };
    const sync = () => { firstBox.hidden = !first.input.checked; apply(read()); };
    body.addEventListener('input', sync);
    body.addEventListener('change', sync);
    firstBox.hidden = !first.input.checked;
    let done = false;
    const dlg = U.dialog({
      title: 'Header and footer', body, dock: 'right', cls: 'hf-dlg',
      buttons: [{ label: 'Cancel', act: () => { done = true; S.doc = { ...S.doc, ...before }; S.relayout(); S.emit('change'); } }, { label: 'Done', primary: true, act: () => { done = true; apply(read()); } }],
      onClose: () => { open = null; if (!done) apply(read()); if (S.focusIme) S.focusIme(); },
    });
    open = dlg;
    return dlg;
  };

  /** A double-click in a page's top or bottom margin opens the panel on that area. */
  function wire() {
    const host = document.getElementById('pages');
    if (!host) return;
    host.addEventListener('dblclick', (e) => {
      const pg = e.target.closest('.page');
      if (!pg || !S.layout) return;
      const p = S.layout.pages[+pg.dataset.pi], r = pg.getBoundingClientRect(), y = (e.clientY - r.top) / S.R.k();
      if (!p) return;
      const firstPage = p.kind === 'first';
      if (y < p.body.top) { e.preventDefault(); S.openHF(firstPage ? 'headerFirst' : 'header'); }
      else if (y > p.body.bottom) { e.preventDefault(); S.openHF(firstPage ? 'footerFirst' : 'footer'); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
