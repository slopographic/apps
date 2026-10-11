// Slop Ledger boot: opens the shared store, mounts every tab, switches tabs (and #hash), and redraws the open tab
// whenever the store reports a change (from this tab or another one). The base currency comes from settings.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopLedger = g.SlopLedger || {});
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['journal', 'gl', 'trial', 'accounts', 'rates'];
  let timer = 0;
  NS.state = { view: 'journal' };

  /** Shows one tab and draws it. */
  function show(name) {
    if (!VIEWS.includes(name)) return undefined;
    NS.state.view = name;
    for (const v of VIEWS) {
      $(`view-${v}`).hidden = v !== name;
      const t = $(`tab-${v}`);
      t.setAttribute('aria-selected', String(v === name));
      t.tabIndex = v === name ? 0 : -1;
    }
    if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`);
    return render();
  }

  /** Draws the open tab and shows the base currency in the header. */
  async function render() {
    const s = await NS.util.settings();
    $('baseLabel').textContent = `Base currency ${s.base}`;
    const v = NS.views[NS.state.view];
    if (v && v.render) await v.render();
  }

  const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(render, 40); };

  async function boot() {
    const ready = await S.store.ready();
    if (!ready.ok) {
      $('boot').textContent = `Storage is not available here: ${ready.message}. Nothing can be saved in this window.`;
      return;
    }
    for (const v of Object.values(NS.views)) if (v.mount) v.mount();
    NS.commands.init();
    for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => show(t.dataset.view));
    S.store.subscribe(() => refreshSoon());
    addEventListener('hashchange', () => show(location.hash.slice(1)));
    try { if (g.SlopHub) g.SlopHub.register('ledger'); } catch (e) { /* no hub: the app still works */ }
    await show(VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'journal');
    $('boot').hidden = true;
  }

  NS.app = { show, render, refreshSoon, boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
