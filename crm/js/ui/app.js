// Slop CRM boot: opens the shared store, mounts every view, switches views (tabs and #hash, plus the customer
// detail panel), and redraws the open view whenever the store reports a change (this tab or another one).
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopCrm = g.SlopCrm || {});
  const $ = (id) => document.getElementById(id);
  const TABS = ['pipeline', 'customers', 'followups'];
  const VIEWS = [...TABS, 'customer'];
  let timer = 0, lastTab = 'pipeline';
  NS.state = { view: 'pipeline', current: null, settings: { defaultCurrency: 'USD', locale: 'en-US' } };

  /** Shows one view. `customer` opens the detail panel for the id in arg. Tabs keep their place while it is open. */
  function show(name, arg) {
    if (!VIEWS.includes(name)) return;
    NS.state.view = name;
    if (name === 'customer') NS.state.current = arg || null;
    else { lastTab = name; if (location.hash !== `#${name}`) history.replaceState(null, '', `#${name}`); }
    for (const v of VIEWS) $(`view-${v}`).hidden = v !== name;
    for (const t of TABS) {
      const b = $(`tab-${t}`);
      const on = t === (name === 'customer' ? lastTab : name);
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    }
    return render();
  }

  /** Redraws the open view (and reloads the settings it formats money and dates with). */
  async function render() {
    NS.state.settings = await NS.util.settings();
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
    $('dBack').addEventListener('click', () => show(lastTab));
    S.store.subscribe(() => refreshSoon());
    addEventListener('hashchange', () => { const h = location.hash.slice(1); if (TABS.includes(h)) show(h); });
    try { if (g.SlopHub) g.SlopHub.register('crm'); } catch (e) { /* no hub: the app still works */ }
    const start = TABS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'pipeline';
    await show(start);
    $('boot').hidden = true;
  }

  NS.app = { show, render, refreshSoon, boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
