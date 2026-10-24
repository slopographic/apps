/* Slop Time page: the tabs, the one-second tick and the start-up. Classic script, loaded after every panel script.
 * Tabs (SlopTabs): World clock, My time, Meetings, Convert, Timers, Sync. The active tab is kept in the URL hash (#my). */
(function () {
  'use strict';
  const ns = window.SlopTime;
  const TABS = [['world', 'World clock'], ['my', 'My time'], ['meet', 'Meetings'], ['conv', 'Convert'], ['timers', 'Timers'], ['sync', 'Sync']];
  const $ = ns.ui.$;
  let active = 'world', tabs = null;

  /** Shows one tab (SlopTabs, shared/ui/tabs.js: the panel, the selected tab, the arrow keys) and keeps it in the #hash. */
  function show(id) {
    if (!tabs.show(id)) return;
    active = id;
    if (location.hash !== '#' + id) { try { history.replaceState(null, '', '#' + id); } catch (e) { /* sandboxed page */ } }
  }

  function tick() {
    if (active === 'world') ns.world.render();
    if (active === 'my') ns.my.render();
    if (active === 'meet') ns.meet.render();
    if (active === 'conv') ns.conv.render();
    if (active === 'sync') ns.syncPanel.render();
    ns.clocks.tick();
  }

  function fillZoneList() {
    $('st-zones').replaceChildren(...ns.zones.list().map((z) => {
      const o = document.createElement('option');
      o.value = z;
      return o;
    }));
  }

  function boot() {
    fillZoneList();
    $('st-device').textContent = `This device: ${ns.state.device()}`;
    tabs = window.SlopTabs.mount(document.querySelector('.st-tabs'), { select: show, panel: (k) => $('p-' + k) });
    ns.world.init();
    ns.my.init();
    ns.meet.init();
    ns.conv.init();
    ns.clocks.init();
    ns.syncPanel.init();
    const h = location.hash.slice(1);
    show(TABS.some(([k]) => k === h) ? h : 'world');
    setInterval(tick, 250);
  }

  window.SlopTimeApp = { show, tick, get active() { return active; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
