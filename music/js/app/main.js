/* Slop Music: the page controller. Views (Library, Playlists, Now playing), the keyboard (Space, arrows, M, N, P),
 * the document title, launch from Slop Drive (?drive=<id>), and refresh when Drive changes in another tab.
 * Scripts it wires: core/* and ui/* (see HANDOFF.md). */
(function () {
  'use strict';
  const M = window.SlopMusic, H = () => window.SlopHub, $ = (id) => document.getElementById(id);
  const VIEWS = ['library', 'playlists', 'now'];
  let view = 'library';
  function setView(v, { focus = false } = {}) {
    view = VIEWS.includes(v) ? v : 'library';
    for (const name of VIEWS) {
      $('v-' + name).hidden = name !== view;
      const tab = document.querySelector(`[data-tab="${name}"]`);
      if (tab) { tab.setAttribute('aria-selected', String(name === view)); tab.tabIndex = name === view ? 0 : -1; }
    }
    if (view === 'now' && !$('queue-sheet').hidden) M.now.openQueue(false);
    M.mini.paint(view);
    if (focus) $('v-' + view).querySelector('h2, input, button, select')?.focus();
    try { history.replaceState(null, '', view === 'library' ? location.pathname + location.search : '#' + view); } catch (e) { /* file: pages */ }
  }
  function titleNow() {
    const s = M.engine.state(), t = s.trackId ? M.lib.track(s.trackId) : null;
    document.title = t && s.playing ? `▶ ${M.lib.display(t)} — Slop Music` : 'Slop Music — Slopographic';
  }
  function isTyping(e) {
    const t = e.target;
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !(t.type === 'range' || t.type === 'checkbox'));
  }
  function keys(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e)) return;
    const eng = M.engine, k = e.key;
    if (k === ' ' || k === 'Spacebar') { e.preventDefault(); eng.toggle(); }
    else if (k === 'ArrowLeft' && !e.target.closest?.('[role=slider]')) { e.preventDefault(); eng.seek(eng.state().time - (e.shiftKey ? 15 : 5)); }
    else if (k === 'ArrowRight' && !e.target.closest?.('[role=slider]')) { e.preventDefault(); eng.seek(eng.state().time + (e.shiftKey ? 15 : 5)); }
    else if (k === 'ArrowUp' && e.target.tagName !== 'SELECT') { e.preventDefault(); eng.setVolume(eng.state().volume + 0.05); }
    else if (k === 'ArrowDown' && e.target.tagName !== 'SELECT') { e.preventDefault(); eng.setVolume(eng.state().volume - 0.05); }
    else if (k === 'm' || k === 'M') eng.toggleMute();
    else if (k === 'n' || k === 'N') eng.next();
    else if (k === 'p' || k === 'P') eng.prev();
  }
  async function launch() {
    const rec = await H().consumeLaunch().catch(() => null);
    if (!rec || !M.lib.track(rec.id)) return;
    const ids = M.lib.list().map((t) => t.id);
    M.engine.setQueue(ids, rec.id);
    setView('now');
  }
  function bindTabs() {
    document.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.tab)));
    document.querySelector('.mu-tabs').addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const i = VIEWS.indexOf(view) + (e.key === 'ArrowRight' ? 1 : -1);
      const next = VIEWS[(i + VIEWS.length) % VIEWS.length];
      setView(next, { focus: true });
      document.querySelector(`[data-tab="${next}"]`).focus();
    });
  }
  async function start() {
    if (H()) H().register('music');
    M.libUI.bind(); M.plUI.bind(); M.now.bind(); M.mini.bind(() => setView('now'));
    M.libUI.render();
    M.engine.subscribe(() => { titleNow(); M.mini.paint(view); });
    bindTabs();
    document.addEventListener('keydown', keys);
    const hash = location.hash.slice(1);
    setView(VIEWS.includes(hash) ? hash : 'library');
    await M.playlists.load();
    await M.lib.load().catch((e) => console.warn(e));
    launch();
    document.addEventListener('visibilitychange', () => { if (!document.hidden) M.lib.load().catch(() => {}); });
    if (H()) H().on('drive:change', () => M.lib.load().catch(() => {}));
    M.libUI.render();
  }
  M.setView = setView;
  M.ready = new Promise((res) => {
    if (document.readyState !== 'loading') res(); else document.addEventListener('DOMContentLoaded', res, { once: true });
  }).then(start);
})();
