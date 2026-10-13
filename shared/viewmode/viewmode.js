/* SlopViewMode — shared/viewmode: one set of view modes for every app. Classic script, no dependencies.
 * Sets window.SlopViewMode. See HANDOFF.md for each app's regions and shortcuts.
 *
 *   Modes: full (everything), focus (toolbars and sidebars hidden), content (only the content: every region hidden).
 *   Shortcuts: Ctrl+Shift+F cycles the mode. Ctrl+Shift+L shows every hidden region until pressed again.
 *   Focus and content: move the pointer to the edge of the window (the region's edge, 6 px) and the region comes
 *   back; it hides again when the pointer has been away for 0.7 s.
 *
 *   const V = SlopViewMode.register('hex', {
 *     regions: { toolbar: '.hx-top', sidebar: '#side', panels: '#panels' },  // selector or element; a missing one is skipped
 *     edges:   { toolbar: 'top', sidebar: 'left', panels: 'right' },         // which window edge reveals it (defaults shown)
 *     hides:   { focus: ['toolbar', 'sidebar'], content: ['toolbar', 'sidebar', 'panels'] },  // the defaults
 *     mount:   '.hx-top',                                                    // where the mode button goes (optional)
 *     layout:  { get: () => ({ panel: 'history' }), set: (o) => {...} },     // which panels are open, per app (optional)
 *   });
 *   V.mode()             'full' | 'focus' | 'content'        V.set('focus')   V.cycle()
 *   V.saveLayout()       call when a panel opens or closes; it is restored on the next load
 *
 * Saved in localStorage through try/catch: 'slop.viewmode' (the mode, shared by all apps) and
 * 'slop.viewmode.layout.<app>' (that app's layout). A blocked or full store just means nothing is remembered. */
(function (win) {
  'use strict';
  if (win.SlopViewMode) return;
  const doc = win.document;
  const MODES = ['full', 'focus', 'content'];
  const LABEL = { full: 'Full', focus: 'Focus', content: 'Content only' };
  const KEY = 'slop.viewmode', LAYOUT = 'slop.viewmode.layout.';
  const EDGE_PX = 6, LEAVE_MS = 700;
  const DEFAULT_EDGE = { toolbar: 'top', sidebar: 'left', panels: 'right' };
  const DEFAULT_HIDES = { focus: ['toolbar', 'sidebar'], content: ['toolbar', 'sidebar', 'panels'] };
  const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };
  const store = {
    get(k) { return safe(() => win.localStorage.getItem(k), null); },
    set(k, v) { safe(() => win.localStorage.setItem(k, v)); },
  };

  let mode = MODES.includes(store.get(KEY)) ? store.get(KEY) : 'full';
  let peekAll = false, sweep = null;
  const apps = new Map();   // app -> { app, spec, regions: [], hides, buttons: [] }
  const regions = () => [...apps.values()].flatMap((e) => e.regions);

  const el = (sel) => (typeof sel === 'string' ? safe(() => doc.querySelector(sel), null) : sel || null);

  /** Put the classes on every region for the current mode, and label every mode button. */
  function paint() {
    for (const r of regions()) {
      const wanted = (apps.get(r.app).hides[mode] || []).includes(r.name);
      r.off = wanted && !(r.peek || peekAll);
      r.el.classList.toggle('slopvm-off', r.off);
      r.el.classList.toggle('slopvm-peek', wanted && r.peek && !peekAll);
    }
    for (const e of apps.values()) for (const b of e.buttons) b.textContent = 'View: ' + LABEL[mode];
    if (doc.documentElement) doc.documentElement.dataset.slopvm = mode;
    // A changed layout needs a re-measure: apps listen for resize (canvases, editors, grids).
    if (win.requestAnimationFrame) win.requestAnimationFrame(() => win.dispatchEvent(new Event('resize')));
  }
  function setMode(next) {
    if (!MODES.includes(next) || next === mode) return mode;
    mode = next; peekAll = false;
    for (const r of regions()) r.peek = false;
    store.set(KEY, mode);
    paint();
    return mode;
  }
  const cycle = () => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);

  /** Is the point inside the edge zone of a region? */
  function inZone(r, x, y) {
    const w = win.innerWidth, h = win.innerHeight;
    switch (r.edge) {
      case 'left': return x <= EDGE_PX;
      case 'right': return x >= w - EDGE_PX;
      case 'bottom': return y >= h - EDGE_PX;
      default: return y <= EDGE_PX;   // top
    }
  }
  function onPointer(e) {
    if (mode === 'full') return;
    const now = Date.now(); let changed = false;
    for (const r of regions()) {
      if (r.off && inZone(r, e.clientX, e.clientY)) { r.peek = true; r.lastIn = now; changed = true; }
      else if (r.peek && (r.el.contains(e.target) || inZone(r, e.clientX, e.clientY))) r.lastIn = now;
    }
    if (changed) paint();
    if (regions().some((r) => r.peek)) startSweep();
  }
  /** Hide a peeked region again once the pointer has been away from it for LEAVE_MS. */
  function startSweep() {
    if (sweep) return;
    sweep = win.setInterval(() => {
      const now = Date.now(); let changed = false;
      for (const r of regions()) if (r.peek && now - r.lastIn > LEAVE_MS) { r.peek = false; changed = true; }
      if (changed) paint();
      if (!regions().some((r) => r.peek)) { win.clearInterval(sweep); sweep = null; }
    }, 200);
  }
  function onKey(e) {
    if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return;
    const k = String(e.key || '').toLowerCase();
    if (k === 'f') { e.preventDefault(); e.stopImmediatePropagation(); cycle(); }
    else if (k === 'l') { e.preventDefault(); e.stopImmediatePropagation(); peekAll = !peekAll; paint(); }
  }

  /** Put the saved layout back into the app. A bad saved value is ignored. */
  function restoreLayout(spec, app) {
    if (!spec.layout || typeof spec.layout.set !== 'function') return;
    const raw = store.get(LAYOUT + app);
    const saved = raw ? safe(() => JSON.parse(raw), null) : null;
    if (saved && typeof saved === 'object') safe(() => spec.layout.set(saved));
  }
  function saveLayout(app) {
    const e = apps.get(app);
    if (!e || !e.spec.layout || typeof e.spec.layout.get !== 'function') return false;
    const obj = safe(() => e.spec.layout.get(), null);
    if (!obj || typeof obj !== 'object') return false;
    store.set(LAYOUT + app, safe(() => JSON.stringify(obj), '{}'));
    return true;
  }
  function mountButton(e) {
    const host = el(e.spec.mount);
    if (!host) return;
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'slopvm-btn';
    b.title = 'Change the view (Ctrl+Shift+F). Ctrl+Shift+L shows hidden parts.';
    b.setAttribute('aria-label', 'View mode. Press to change.');
    b.addEventListener('click', cycle);
    host.appendChild(b);
    e.buttons.push(b);
  }

  /** Register an app. Returns its handle. Regions the page does not have are skipped. */
  function register(app, spec) {
    spec = spec || {};
    const old = apps.get(app);
    if (old) { for (const r of old.regions) r.el.classList.remove('slopvm-off', 'slopvm-peek'); for (const b of old.buttons) b.remove(); }
    const edges = Object.assign({}, DEFAULT_EDGE, spec.edges || {});
    const e = { app, spec, buttons: [], hides: Object.assign({}, DEFAULT_HIDES, spec.hides || {}), regions: [] };
    for (const name of Object.keys(spec.regions || {})) {
      const node = el(spec.regions[name]);
      if (node) e.regions.push({ app, name, el: node, edge: edges[name] || 'top', peek: false, off: false, lastIn: 0 });
    }
    apps.set(app, e);
    mountButton(e);
    restoreLayout(spec, app);
    if (!wired) wire();
    paint();
    return {
      mode: () => mode,
      set: (m) => setMode(m),
      cycle,
      saveLayout: () => saveLayout(app),
    };
  }
  let wired = false;
  function wire() {
    wired = true;
    doc.addEventListener('keydown', onKey, true);
    doc.addEventListener('pointermove', onPointer, { passive: true });
    win.addEventListener('pagehide', () => { for (const a of apps.keys()) saveLayout(a); });
    safe(() => { const s = doc.createElement('style'); s.id = 'slopvm-style'; s.textContent = CSS; doc.head.appendChild(s); });
  }
  const CSS = '.slopvm-off{display:none!important}' +
    '.slopvm-peek{outline:1px dashed var(--sl-accent,#888);outline-offset:-1px}' +
    '.slopvm-btn{font:inherit;font-size:12px;line-height:1.2;padding:2px 8px;margin-left:6px;border:1px solid var(--sl-border,#8886);' +
    'border-radius:4px;background:transparent;color:var(--sl-text,inherit);cursor:pointer;white-space:nowrap}' +
    '.slopvm-btn:focus-visible{outline:2px solid var(--sl-accent,#06c);outline-offset:2px}';

  win.SlopViewMode = {
    register, mode: () => mode, set: setMode, cycle, saveLayout,
    modes: MODES.slice(),
    shortcuts: { cycle: 'Ctrl+Shift+F', reveal: 'Ctrl+Shift+L' },
  };
})(window);
