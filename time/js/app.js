/* Slop Time page: the tabs, the one-second tick and the start-up. Classic script, loaded after every panel script.
 * Tabs: World clock, My time, Meetings, Convert, Timers, Sync. The active tab is kept in the URL hash (#my). */
(function () {
  'use strict';
  const ns = window.SlopTime;
  const TABS = [['world', 'World clock'], ['my', 'My time'], ['meet', 'Meetings'], ['conv', 'Convert'], ['timers', 'Timers'], ['sync', 'Sync']];
  const $ = ns.ui.$;
  let active = 'world';

  function show(id) {
    active = id;
    for (const [key] of TABS) {
      const on = key === id;
      const tab = $('tab-' + key);
      tab.setAttribute('aria-selected', String(on));
      tab.tabIndex = on ? 0 : -1;
      $('p-' + key).hidden = !on;
    }
    if (location.hash !== '#' + id) { try { history.replaceState(null, '', '#' + id); } catch (e) { /* sandboxed page */ } }
  }

  function onTabKey(e) {
    const keys = TABS.map(([k]) => k);
    const i = keys.indexOf(active);
    let j = null;
    if (e.key === 'ArrowRight') j = (i + 1) % keys.length;
    else if (e.key === 'ArrowLeft') j = (i - 1 + keys.length) % keys.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = keys.length - 1;
    if (j === null) return;
    e.preventDefault();
    show(keys[j]);
    $('tab-' + keys[j]).focus();
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
    for (const [key] of TABS) {
      $('tab-' + key).addEventListener('click', () => show(key));
      $('tab-' + key).addEventListener('keydown', onTabKey);
    }
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
