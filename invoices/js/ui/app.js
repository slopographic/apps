// Slop Invoices boot: opens the shared store, mounts the views, routes the #hash (list, new, i/<id>, p/<id>, data),
// and redraws the list when the store reports a change. The editor is not redrawn under the person typing.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const UI = g.SlopUI;
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['list', 'edit', 'print', 'data'];
  let timer = 0, tabs = null;

  /** Shows one view and marks its tab (SlopTabs, shared/ui/tabs.js). The invoice and print tabs exist only while one is open. */
  function show(name, arg) {
    if (!VIEWS.includes(name)) return undefined;
    NS.state.view = name;
    document.querySelector('.app').dataset.view = name;
    $('tab-edit').hidden = name !== 'edit';
    $('tab-print').hidden = name !== 'print';
    tabs.show(name);
    if (window.SlopLayouts) SlopLayouts.refresh('invoices');
    const view = NS.views[name];
    const out = view && view.onShow ? view.onShow(arg) : undefined;
    // The list beside an open invoice marks that invoice's row: redraw once the invoice has opened.
    if (NS.views.list && !$('view-list').hidden) Promise.resolve(out).then(() => NS.views.list.refresh());
    return out;
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

  /** Redraws the list when it is on screen: the list view, or the workspace list beside an open invoice. */
  function redrawList() {
    clearTimeout(timer);
    timer = setTimeout(() => { if (NS.views.list && !$('view-list').hidden) NS.views.list.refresh(); }, 40);
  }

  /** The top bar's actions: New invoice (list), Save (a draft open) and Print (an invoice open or its print view). */
  function mountTopbar() {
    $('tbNew').addEventListener('click', () => go('new'));
    $('tbSave').addEventListener('click', () => NS.editor.save());
    $('tbPrint').addEventListener('click', () => (NS.state.view === 'edit' ? NS.editor.preview() : window.print()));
  }

  async function boot() {
    const ready = await S.store.ready();
    if (!ready.ok) {
      $('boot').textContent = `Storage is not available here: ${NS.util.refusal(ready)}. Nothing can be saved in this window.`;
      return;
    }
    $('boot').hidden = true;
    // a tab click or the tab keys route through the #hash, which shows the view (route); the print tab stays on its invoice
    tabs = g.SlopTabs.mount(document.querySelector('.tabs'), {
      select: (n) => go(n === 'edit' ? NS.editor.route() : n === 'print' ? location.hash.slice(1) : n) });
    for (const name of VIEWS) if (NS.views[name] && NS.views[name].mount) NS.views[name].mount();
    NS.commands.init();
    mountTopbar();
    if (g.SlopHub) { try { SlopHub.register('invoices'); } catch (e) { /* the hub is optional */ } }
    S.store.subscribe(redrawList);
    addEventListener('hashchange', route);
    await route();
  }

  NS.state = { view: 'list' };
  NS.app = { show, go, route, boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
