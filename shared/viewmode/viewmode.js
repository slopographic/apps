/* SlopViewMode — shared/viewmode: one set of view modes for every app. Classic script, no dependencies.
 * Sets window.SlopViewMode. See HANDOFF.md for each app's regions and shortcuts.
 *
 *   Modes: full (everything), focus (toolbars and sidebars hidden), content (only the content: every region hidden).
 *   The controls live in the app's own toolbar (the mount element), never over the page: the mode button, and in
 *   focus and content a "Show panels" button. A toolbar that is hidden stays as a strip that holds those controls.
 *   Ctrl+Shift+F cycles the mode. Ctrl+Shift+L shows every hidden region until pressed again. Escape returns to Full.
 *   Hidden regions give their grid tracks back: the workspace grows into the freed space (see paint()).
 *
 *   const V = SlopViewMode.register('hex', {
 *     regions: { toolbar: ['.hx-top', '.hx-bar'], sidebar: '#side', panels: '#panels' },  // selector, element or a list
 *     edges:   { toolbar: 'top', sidebar: 'left', panels: 'right' },         // which window edge reveals it (defaults)
 *     hides:   { focus: ['toolbar', 'sidebar'], content: ['toolbar', 'sidebar', 'panels'] },  // the defaults
 *     mount:   '.hx-top',                                                    // the app's toolbar that holds the controls
 *     layout:  { get: () => ({ panel: 'history' }), set: (o) => {...} },     // which panels are open, per app (optional)
 *   });
 *   V.mode()   V.set('focus')   V.cycle()   V.saveLayout()
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
  const SELF = doc.currentScript && doc.currentScript.src;
  const safe = (fn, fallback) => { try { return fn(); } catch (e) { return fallback; } };
  const store = {
    get(k) { return safe(() => win.localStorage.getItem(k), null); },
    set(k, v) { safe(() => win.localStorage.setItem(k, v)); },
  };

  let mode = MODES.includes(store.get(KEY)) ? store.get(KEY) : 'full';
  let peekAll = false, sweep = null, painting = false, wired = false;
  const apps = new Map();   // app -> { app, spec, regions: [], hides, buttons: [] }
  const shells = new Set(); // grid containers whose template paint() changed
  const regions = () => [...apps.values()].flatMap((e) => e.regions);
  const el = (sel) => (typeof sel === 'string' ? safe(() => doc.querySelector(sel), null) : sel || null);
  const wantHidden = (r) => (apps.get(r.app).hides[mode] || []).includes(r.name);
  /** A toolbar that holds the mode controls stays on screen as a strip (only the controls show in it). */
  const isStrip = (r) => { const m = el(apps.get(r.app).spec.mount); return !!m && r.el.contains(m); };
  const shown = (n) => { const cs = win.getComputedStyle(n); return cs.display !== 'none' && cs.position !== 'fixed' && cs.position !== 'absolute'; };
  const isGrid = (n) => /grid$/.test(win.getComputedStyle(n).display);

  /** The tracks of a grid container, as [start, end] in window pixels, measured in the current layout. */
  function tracks(P, axis) {
    const cs = win.getComputedStyle(P), x = axis === 'col';
    const sizes = (x ? cs.gridTemplateColumns : cs.gridTemplateRows).split(/\s+/).filter((t) => /px$/.test(t)).map(parseFloat);
    const gap = parseFloat(x ? cs.columnGap : cs.rowGap) || 0;
    const box = P.getBoundingClientRect();
    let pos = x ? box.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft)
      : box.top + parseFloat(cs.borderTopWidth) + parseFloat(cs.paddingTop);
    return sizes.map((s) => { const t = { a: pos, b: pos + s }; pos += s + gap; return t; });
  }
  const overlap = (a1, b1, a2, b2) => Math.min(b1, b2) - Math.max(a1, a2);

  /** Which tracks a hidden region gives back: the ones it alone covers on that axis. An item that spans the whole axis
   *  (a full-width toolbar) is not in the way: it simply gets narrower with the track. */
  function giveBack(list, a, b, others, axis) {
    const lo = axis === 'x' ? 'left' : 'top', hi = axis === 'x' ? 'right' : 'bottom';
    const out = new Set();
    if (!list.length) return out;
    const first = list[0].a, last = list[list.length - 1].b;
    const covered = list.map((t) => overlap(t.a, t.b, a, b) > 1);
    if (covered.every(Boolean)) return out;   // the hidden region spans the whole axis: nothing to give back
    const blockers = others.filter((o) => !(o[lo] <= first + 1 && o[hi] >= last - 1));
    list.forEach((t, i) => {
      if (covered[i] && !blockers.some((o) => overlap(t.a, t.b, o[lo], o[hi]) > 1)) out.add(i);
    });
    return out;
  }
  /** The track the freed space goes to: the one under the largest shown item that is not given back. */
  function fillTrack(list, kids, axis, zero) {
    let best = null, bestArea = 0;
    for (const k of kids) {
      const area = k.width * k.height;
      if (area > bestArea) { bestArea = area; best = k; }
    }
    if (!best) return -1;
    const mid = axis === 'x' ? best.left + best.width / 2 : best.top + best.height / 2;
    const i = list.findIndex((t) => mid >= t.a && mid <= t.b);
    return i >= 0 && !zero.has(i) ? i : -1;
  }

  /** Put the classes on every region for the current mode, give hidden tracks back to the grid, and label the buttons.
   *  Measure first, on the page as it is with nothing hidden; then apply. notify: a mode change tells the app to re-measure. */
  function paint(notify) {
    painting = true;
    for (const s of shells) { s.style.gridTemplateColumns = ''; s.style.gridTemplateRows = ''; }
    shells.clear();
    const all = regions();
    for (const r of all) { r.el.classList.remove('slopvm-off', 'slopvm-strip', 'slopvm-peek'); }
    for (const r of all) { r.off = wantHidden(r) && !(r.peek || peekAll); r.strip = r.off && isStrip(r); }
    const hiddenEls = all.filter((r) => r.off && !r.strip).map((r) => r.el);
    const gone = (n) => hiddenEls.some((h) => h === n || h.contains(n));
    const plan = new Map();   // grid -> { cols, rows, colSizes, rowSizes }
    for (const r of all) {
      const P = r.el.parentElement;
      if (!r.off || r.strip || !P || !isGrid(P)) continue;
      const rr = r.el.getBoundingClientRect();
      const others = [...P.children].filter((c) => c !== r.el && !gone(c) && shown(c)).map((c) => c.getBoundingClientRect());
      const cols = tracks(P, 'col'), rows = tracks(P, 'row');
      const p = plan.get(P) || { cols: new Set(), rows: new Set(), colSizes: cols, rowSizes: rows, kids: [] };
      giveBack(cols, rr.left, rr.right, others, 'x').forEach((i) => p.cols.add(i));
      giveBack(rows, rr.top, rr.bottom, others, 'y').forEach((i) => p.rows.add(i));
      p.kids = [...P.children].filter((c) => !gone(c) && shown(c)).map((c) => c.getBoundingClientRect());
      plan.set(P, p);
    }
    for (const r of all) {
      r.el.classList.toggle('slopvm-off', r.off && !r.strip);
      r.el.classList.toggle('slopvm-strip', !!r.strip);
      r.el.classList.toggle('slopvm-peek', wantHidden(r) && r.peek && !peekAll);
    }
    for (const [P, p] of plan) {
      if (!p.cols.size && !p.rows.size) continue;
      const fmt = (list, zero, fill) => list.map((t, i) => (zero.has(i) ? '0px' : i === fill ? 'minmax(0, 1fr)' : (t.b - t.a) + 'px')).join(' ');
      if (p.colSizes.length) P.style.gridTemplateColumns = fmt(p.colSizes, p.cols, fillTrack(p.colSizes, p.kids, 'x', p.cols));
      if (p.rowSizes.length) P.style.gridTemplateRows = fmt(p.rowSizes, p.rows, fillTrack(p.rowSizes, p.kids, 'y', p.rows));
      shells.add(P);
      watch(P);
    }
    for (const e of apps.values()) for (const b of e.buttons) b.querySelector('.slopvm-txt').textContent = 'View: ' + LABEL[mode];
    for (const e of apps.values()) for (const b of e.reveal) b.textContent = peekAll ? 'Hide panels' : 'Show panels';
    if (doc.documentElement) doc.documentElement.dataset.slopvm = mode;
    if (watcher) watcher.takeRecords();   // our own class changes are not an app change
    painting = false;
    // A changed layout needs a re-measure: apps listen for resize (canvases, editors, grids).
    if (notify && win.requestAnimationFrame) win.requestAnimationFrame(() => fire());
  }
  /** Dispatch a resize for the app to re-measure; paint() ignores the resize this sends. */
  let firing = false;
  function fire() { firing = true; try { win.dispatchEvent(new Event('resize')); } finally { firing = false; } }

  /** An app that changes its own shell's classes (a panel toggled inside the app) gets the layout re-measured. */
  let watcher = null;
  function watch(P) {
    if (!win.MutationObserver) return;
    if (!watcher) watcher = new win.MutationObserver(() => { if (!painting && !firing) paint(false); });
    watcher.observe(P, { attributes: true, attributeFilter: ['class'] });
  }

  function setMode(next) {
    if (!MODES.includes(next) || next === mode) return mode;
    mode = next; peekAll = false;
    for (const r of regions()) r.peek = false;
    store.set(KEY, mode);
    paint(true);
    return mode;
  }
  const cycle = () => setMode(MODES[(MODES.indexOf(mode) + 1) % MODES.length]);
  function revealAll() { if (mode === 'full') return; peekAll = !peekAll; paint(true); }

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
    if (changed) paint(true);
    if (regions().some((r) => r.peek)) startSweep();
  }
  /** Hide a peeked region again once the pointer has been away from it for LEAVE_MS. */
  function startSweep() {
    if (sweep) return;
    sweep = win.setInterval(() => {
      const now = Date.now(); let changed = false;
      for (const r of regions()) if (r.peek && now - r.lastIn > LEAVE_MS) { r.peek = false; changed = true; }
      if (changed) paint(true);
      if (!regions().some((r) => r.peek)) { win.clearInterval(sweep); sweep = null; }
    }, 200);
  }
  function onKey(e) {
    if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return;
    const k = String(e.key || '').toLowerCase();
    if (k === 'f') { e.preventDefault(); e.stopImmediatePropagation(); cycle(); }
    else if (k === 'l') { e.preventDefault(); e.stopImmediatePropagation(); revealAll(); }
  }
  /** Escape returns to Full, unless an app is using Escape (a dialog, a text field, or a key the app already handled). */
  function onEscape(e) {
    if (e.key !== 'Escape' || mode === 'full') return;
    const t = e.target, tag = t && t.tagName;
    if (t && (t.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')) return;
    if (doc.querySelector('dialog[open], [aria-modal="true"]')) return;
    setMode('full');
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
  function span(cls, text) { const n = doc.createElement('span'); n.className = cls; n.setAttribute('aria-hidden', 'true'); n.textContent = text; return n; }
  /** The mode button and the "Show panels" button, in the app's toolbar (never over the page). */
  function mountControls(e) {
    const host = el(e.spec.mount);
    if (!host) return;
    const bar = doc.createElement('span');
    bar.className = 'slopvm-bar';
    const b = doc.createElement('button');
    b.type = 'button';
    b.className = 'slopvm-btn';
    b.title = 'Change the view (Ctrl+Shift+F). Ctrl+Shift+L shows hidden parts. Escape returns to Full.';
    b.setAttribute('aria-label', 'View mode. Press to change.');
    b.append(span('slopvm-txt', ''));
    b.addEventListener('click', cycle);
    const reveal = doc.createElement('button');
    reveal.type = 'button';
    reveal.className = 'slopvm-reveal';
    reveal.title = 'Show every hidden panel and toolbar (Ctrl+Shift+L)';
    reveal.addEventListener('click', revealAll);
    bar.append(b, reveal);
    host.appendChild(bar);
    e.buttons.push(b); e.reveal.push(reveal); e.bar = bar;
  }

  /** Register an app. Returns its handle. Regions the page does not have are skipped. */
  function register(app, spec) {
    spec = spec || {};
    const old = apps.get(app);
    if (old) { for (const r of old.regions) r.el.classList.remove('slopvm-off', 'slopvm-strip', 'slopvm-peek'); if (old.bar) old.bar.remove(); }
    const edges = Object.assign({}, DEFAULT_EDGE, spec.edges || {});
    const e = { app, spec, buttons: [], reveal: [], bar: null, hides: Object.assign({}, DEFAULT_HIDES, spec.hides || {}), regions: [] };
    for (const name of Object.keys(spec.regions || {})) {
      for (const sel of [].concat(spec.regions[name])) {   // a region may be several elements (a menu bar and a control bar)
        const node = el(sel);
        if (node) e.regions.push({ app, name, el: node, edge: edges[name] || 'top', peek: false, off: false, strip: false, lastIn: 0 });
      }
    }
    apps.set(app, e);
    mountControls(e);
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
  // The key and pointer listeners are set up when this script loads, before the app's own scripts, so the shortcuts
  // come first. Escape is checked before the app too: it returns to Full unless a dialog is open or a field has focus.
  win.addEventListener('keydown', onKey, true);
  win.addEventListener('keydown', onEscape, true);
  doc.addEventListener('pointermove', onPointer, { passive: true });
  function wire() {
    wired = true;
    // A window resize re-measures a locked layout (its tracks are fixed to the sizes measured in paint()).
    win.addEventListener('resize', () => { if (!firing && shells.size) paint(false); });
    win.addEventListener('pagehide', () => { for (const a of apps.keys()) saveLayout(a); });
    safe(() => {
      if (!SELF) return;
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = SELF.replace(/[^/]*$/, 'viewmode.css');
      doc.head.appendChild(link);
    });
    safe(() => { const s = doc.createElement('style'); s.id = 'slopvm-style'; s.textContent = CRITICAL; doc.head.appendChild(s); });
  }
  // The rules a hidden region or strip needs before viewmode.css has loaded. The rest of the look is in viewmode.css.
  const CRITICAL = '.slopvm-off{display:none!important}' +
    '.slopvm-strip>:not(.slopvm-bar){display:none!important}';

  win.SlopViewMode = {
    register, mode: () => mode, set: setMode, cycle, saveLayout,
    modes: MODES.slice(),
    shortcuts: { cycle: 'Ctrl+Shift+F', reveal: 'Ctrl+Shift+L' },
  };
})(window);
