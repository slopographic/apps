// The page controller for the Orders and Invoices editors: the paper view with its in-place editing, the Page / Form switch
// (the form is the fallback on phones and for screen readers), and the layout pick (the template, or random from the
// document's seed, with a new seed). The app owns the state and the saving; this module only draws and forwards. Classic
// script, after paper.js, paper-edit.js and doc-view.js. Exposes window.SlopDocs.page.
(function (g) {
  'use strict';
  const NS = (g.SlopDocs = g.SlopDocs || {});
  const h = NS.paper.h;
  const PHONE = '(max-width: 699px)';

  /** o: {
   *    root: the editor view (elements with data-form-only are hidden in Page mode),
   *    host: the element that holds the paper,
   *    modes: the element for the Page / Form buttons, layout: the element for the layout pick,
   *    doc(): the document to draw (see SlopDocs.view.build), canEdit(): bool,
   *    customers(): [{ id, name }], field(name, index, value): the app saves the change and repaints (see editor.js),
   *    seed(): the app makes a new seed for the document
   *  }
   *  Returns { paint(), setMode(mode) }. The mode starts as Form on a phone and Page elsewhere. */
  function mount(o) {
    const formOnly = [...o.root.querySelectorAll('[data-form-only]')];
    NS.paperEdit.attach(o.host, {
      canEdit: () => !!o.canEdit(), customers: () => o.customers(),
      commit: (name, index, text) => o.field(name, index, text), refresh: () => paint(),
    });

    const pageBtn = h('button', { type: 'button', class: 'btn small', text: 'Page', dataset: { mode: 'page' } });
    const formBtn = h('button', { type: 'button', class: 'btn small', text: 'Form', dataset: { mode: 'form' } });
    o.modes.replaceChildren(h('span', { class: 'note', text: 'View' }), pageBtn, formBtn);
    const sel = h('select', { 'aria-label': 'PDF and print layout' },
      h('option', { value: '', text: 'Random from the seed' }),
      ...NS.layouts.LAYOUTS.map((l) => h('option', { value: l.id, text: `${l.name}: ${l.description}` })));
    const note = h('span', { class: 'note pp-layout-note', role: 'status' });
    const reseed = h('button', { type: 'button', class: 'btn small', text: 'New seed' });
    o.layout.replaceChildren(h('label', null, 'Layout ', sel), reseed, note);
    sel.addEventListener('change', () => o.field('layout', null, sel.value));
    reseed.addEventListener('click', () => o.field('seed', null, ''));

    function setMode(mode) {
      const page = mode === 'page';
      o.host.hidden = !page;
      for (const el of formOnly) el.hidden = page;
      pageBtn.setAttribute('aria-pressed', String(page));
      formBtn.setAttribute('aria-pressed', String(!page));
    }
    pageBtn.addEventListener('click', () => setMode('page'));
    formBtn.addEventListener('click', () => setMode('form'));

    /** Draws the paper for the current document. Cheap enough to run after every change. */
    function paint() {
      const d = o.doc();
      if (!d) return;
      const view = NS.view.build(d);
      o.host.replaceChildren(NS.paper.build(view, { editable: !!o.canEdit() }));
      const editable = !!o.canEdit();
      sel.value = d.pdfLayout || '';
      sel.disabled = !editable;
      reseed.disabled = !editable;
      note.textContent = `Layout: ${NS.layouts.describe(view.style)}`;
    }

    setMode(g.matchMedia && g.matchMedia(PHONE).matches ? 'form' : 'page');
    return { paint, setMode };
  }

  NS.page = { mount };
})(typeof window !== 'undefined' ? window : globalThis);
