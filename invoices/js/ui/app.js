// Slop Invoices boot: opens the shared store, mounts the views, routes the #hash (list, new, i/<id>, p/<id>, data),
// and redraws the list when the store reports a change. The editor is not redrawn under the person typing.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const UI = g.SlopUI;
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['list', 'edit', 'print', 'data'];
  let timer = 0;

  /** Shows one view and marks its tab. The invoice tab exists only while an invoice is open. */
  function show(name, arg) {
    if (!VIEWS.includes(name)) return undefined;
    NS.state.view = name;
    for (const v of VIEWS) {
      const el = $(`view-${v}`);
      if (el) el.hidden = v !== name;
      const t = $(`tab-${v}`);
      if (t) { t.setAttribute('aria-selected', String(v === name)); t.tabIndex = v === name ? 0 : -1; }
    }
    $('tab-edit').hidden = name !== 'edit';
  if (window.SlopLayouts) SlopLayouts.refresh('invoices');
    $('tab-print').hidden = name !== 'print';
    const view = NS.views[name];
    return view && view.onShow ? view.onShow(arg) : undefined;
  }

  /** The route for the current hash: list, new, i/<id>, p/<id> or data. */
  function parse() {
    const h = location.hash.slice(1);
    if (h === 'data') return { view: 'data' };
    if (h === 'new') return { view: 'edit', arg: null };
    if (h.startsWith('i/') && h.length > 2) return { view: 'edit', arg: h.slice(2) };
    if (h.startsWith('p/') && h.length > 2) return { view: 'print', arg: h.slice(2) };
    return { view: 'list' };
  }

  /** Moves to a route. Hash changes run route(). */
  function go(path) { location.hash = path; }

  async function route() {
    const t = parse();
    const onInvoice = NS.state.view === 'edit';
    const staying = t.view === 'edit' && t.arg === NS.editor.id();
    if (onInvoice && NS.editor.isDirty() && !staying) {
      const yes = await UI.confirm('Leave without saving', 'This invoice has unsaved changes. Leave anyway?', 'Leave', { danger: true });
      if (!yes) { history.replaceState(null, '', `#${NS.editor.route()}`); return; }
      NS.editor.clean();
    }
    show(t.view, t.arg);
  }

  function redrawList() {
    clearTimeout(timer);
    timer = setTimeout(() => { if (NS.state.view === 'list' && NS.views.list) NS.views.list.refresh(); }, 40);
  }

  async function boot() {
    const ready = await S.store.ready();
    if (!ready.ok) {
      $('boot').textContent = `Storage is not available here: ${NS.util.refusal(ready)}. Nothing can be saved in this window.`;
      return;
    }
    $('boot').hidden = true;
    for (const name of VIEWS) if (NS.views[name] && NS.views[name].mount) NS.views[name].mount();
    NS.commands.init();
    if (g.SlopHub) { try { SlopHub.register('invoices'); } catch (e) { /* the hub is optional */ } }
    for (const t of document.querySelectorAll('.tab')) {
      t.addEventListener('click', () => go(t.dataset.view === 'edit' ? NS.editor.route() : t.dataset.view));
    }
    S.store.subscribe(redrawList);
    addEventListener('hashchange', route);
    await route();
  }

  NS.state = { view: 'list' };
  NS.app = { show, go, route, boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
