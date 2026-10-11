// Slop Admin boot: opens the shared store, mounts each tab, switches tabs (and #hash), and redraws the open tab when
// the store reports a change. Restores and resets redraw through the same path.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopAdmin = g.SlopAdmin || {});
  const $ = (id) => document.getElementById(id);
  const VIEWS = ['company', 'numbering', 'taxes', 'data', 'storage'];
  let timer = 0;
  NS.state = { view: 'company' };

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

  /** Draws the open tab. */
  async function render() {
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
    try { if (g.SlopHub) g.SlopHub.register('admin'); } catch (e) { /* no hub: the app still works */ }
    await show(VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'company');
    $('boot').hidden = true;
  }

  NS.app = { show, render, refreshSoon, boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
