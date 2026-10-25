/* The app globe in the homepage hero: every app's own icon (SlopHomeCards.icon, the badge the cards use) placed evenly on a
 * sphere (Fibonacci), drawn with true perspective: the far side smaller, fainter and blurred, the near side crisp with a
 * soft accent glow, over a turning wireframe and a faint halo (home/globe/paint.js). Maths: home/globe/sphere.js.
 * Styles: home/hero.css. Classic script, after shared/apps.js, shared/app-icons.js, home/catalog.js, sphere.js, paint.js.
 *  - It draws into .gx-layer over the hero, sized from the reserved .gx-box, 0.7 s after load when the page is idle: the
 *    headline (the largest paint) never waits for it and nothing moves when it comes.
 *  - It turns slowly on a tilted axis; a drag (mouse, pen or finger) spins it, and a fling slows back to the idle turn.
 *    Vertical swipes still scroll the page (touch-action: pan-y). Pointing at an icon (or focusing it in the list) eases
 *    the globe round until that icon faces you and shows its name; a click or tap opens the app; the turn resumes after.
 *  - It runs only while the hero is on screen and the tab is visible. Reduced motion: a still globe. Phones, touch
 *    screens, Save-Data and small devices: fewer icons at 30 fps (SlopGlobeMath.tier).
 *  - Icons over the copy fade almost out (keepOut), so the text always reads.
 *  - The keyboard and screen-reader way in is .gx-nav: every app, one tab stop, the arrow keys move along it.
 *  window.SlopGlobe: { state(), frames(), startedAt(), tier(), view(), icons(), reduce(on), pause(on) } for the tests. */
(function () {
  'use strict';
  const G = window.SlopGlobeMath, P = window.SlopGlobePaint, C = window.SlopHomeCards;
  const hero = document.getElementById('hero');
  if (!G || !P || !C || !hero) return;
  const box = hero.querySelector('.gx-box'), nav = hero.querySelector('.gx-nav');
  const ICONS = window.SLOP_ICONS || {};
  const APPS = (window.SLOP_APPS || []).filter((a) => a.path && !a.path.startsWith('#') && ICONS[a.id]);
  if (!box || !APPS.length) return;
  const mq = (q) => !!(window.matchMedia && matchMedia(q).matches);
  const name = (a) => (window.slopAppLabel ? window.slopAppLabel(a, !!(window.slopBrandNamesOn && window.slopBrandNamesOn())) : a.name);
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    n.append(...kids.filter(Boolean));
    return n;
  };
  const TILT = 0.3, IDLE = G.TAU / 75000, RESUME_MS = 1400;   // tipped towards you; one turn in 75 s; idle pause after a hover
  const LINES = { full: G.grid(30, 30, 6), lite: G.grid(30, 30, 12) };   // the lite globe draws coarser lines

  const layer = el('div', { class: 'gx-layer', 'aria-hidden': 'true' });
  const canvas = el('canvas', { class: 'gx-lines' });
  const hit = el('div', { class: 'gx-hit' });
  const ctx = canvas.getContext && canvas.getContext('2d');
  layer.append(canvas, hit);
  hero.prepend(layer);

  let tierName = 'full', T = G.TIERS.full, icons = [], s = { yaw: 0.7, pitch: TILT, vel: IDLE };
  let focus = null, target = null, resumeAt = 0;
  function pickTier() {
    const nv = navigator, c = nv.connection;
    tierName = G.tier({ reduced: mq('(prefers-reduced-motion: reduce)'), cores: nv.hardwareConcurrency, memory: nv.deviceMemory,
      saveData: !!(c && c.saveData), coarse: mq('(pointer: coarse)'), width: hero.clientWidth });
  }
  function setApp(ic, a) {
    ic.app = a;
    const n = ic.el;
    n.href = a.path; n.dataset.id = a.id;
    n.setAttribute('aria-label', name(a));
    n.replaceChildren(C.icon(a, 'gx-svg') || '', el('span', { class: 'gx-name' }, name(a)));
  }
  function build() {
    T = G.TIERS[tierName];
    layer.querySelectorAll('.gx-i').forEach((n) => n.remove());
    focus = null; target = null;
    const pts = G.fibonacci(Math.min(T.icons, APPS.length));
    icons = pts.map((p, i) => {
      const ic = { p, el: el('a', { class: 'gx-i', tabindex: '-1', 'aria-hidden': 'true', 'data-gx-icon': '' }), x: 0, y: 0, z: 0, op: 0, blur: -1 };
      setApp(ic, APPS[i]);
      layer.append(ic.el);
      return ic;
    });
    measure();
    draw();
  }

  /* ---------- geometry: the globe fills the reserved box; the copy's boxes are kept clear ---------- */
  let W = 0, H = 0, geom = { cx: 0, cy: 0, r: 1, d: 3.4 }, rects = [], size = 56, ink = '#888', accent = '#d4ff3a';
  function rel(n, base) {
    const r = n && n.getBoundingClientRect();
    return r && r.width ? { l: r.left - base.left, t: r.top - base.top, r: r.right - base.left, b: r.bottom - base.top } : null;
  }
  function measure() {
    const base = hero.getBoundingClientRect(), b = rel(box, base);
    if (!b || !hero.clientWidth) return false;   // the home view is hidden (the Authenticator): keep the last geometry
    W = hero.clientWidth; H = hero.clientHeight;
    const r = (Math.min(b.r - b.l, b.b - b.t) / 2) * 0.8;
    geom = { cx: (b.l + b.r) / 2, cy: (b.t + b.b) / 2, r, d: 3.4 };
    rects = ['.hx-title', '.hx-sub', '.hx-cta', '.hx-meta'].map((q) => rel(hero.querySelector(q), base)).filter(Boolean);
    size = Math.round(G.clamp(r * 0.2, 30, 54));
    layer.style.setProperty('--gx-size', size + 'px');
    Object.assign(hit.style, { left: geom.cx - r * 1.05 + 'px', top: geom.cy - r * 1.05 + 'px', width: r * 2.1 + 'px', height: r * 2.1 + 'px' });
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cs = getComputedStyle(hero);
    ink = cs.getPropertyValue('--bone').trim() || ink;
    accent = cs.getPropertyValue('--slop').trim() || accent;
    return true;
  }

  /* ---------- one frame ---------- */
  let frames = 0;
  const frontScale = () => geom.d / (geom.d - 1);
  function draw() {
    for (const ic of icons) {
      const q = G.rotate(ic.p, s.yaw, s.pitch), pr = G.project(q, geom), lk = G.look(q.z);
      let op = lk.alpha * G.keepOut(pr.x, pr.y, rects, size * 0.6);
      if (ic === focus) op = 1;
      ic.x = pr.x; ic.y = pr.y; ic.z = q.z; ic.op = op;
      const st = ic.el.style, sc = pr.scale / frontScale();
      st.transform = `translate3d(${(pr.x - size / 2).toFixed(1)}px,${(pr.y - size / 2).toFixed(1)}px,0) scale(${sc.toFixed(3)})`;
      st.opacity = op.toFixed(3);
      st.zIndex = String(Math.round(50 + q.z * 40));
      if (lk.blur !== ic.blur) { ic.blur = lk.blur; ic.el.dataset.depth = lk.blur ? 'far' + lk.blur : lk.front ? 'near' : 'mid'; }
      ic.el.classList.toggle('is-live', op > 0.35 && q.z > -0.1);
    }
    P.paint(ctx, { W, H, geom, yaw: s.yaw, pitch: s.pitch, ink, accent, lines: tierName === 'full' ? LINES.full : LINES.lite });
    frames++;
  }

  /* ---------- running: on screen, tab visible, motion allowed, not held ---------- */
  let raf = 0, last = 0, inView = true, held = false, drag = null;
  const running = () => tierName !== 'static' && inView && !document.hidden && !held;
  function tick(now) {
    raf = 0;
    if (!running()) return paint();
    raf = requestAnimationFrame(tick);
    if (last && !G.due(now, last, T.fps)) return;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    if (drag) { /* the pointer turns it */ }
    else if (target) s = G.seek(s, target, dt, 420);
    else {
      s = G.spin(s, dt, { idle: now < resumeAt ? 0 : IDLE, tau: 900 });
      s.pitch += (TILT - s.pitch) * (1 - Math.exp(-dt / 1200));   // back to the resting tilt
    }
    draw();
  }
  function paint() {
    hero.dataset.globe = tierName === 'static' ? 'static' : running() ? 'running' : 'paused';
    if (running() && !raf) { last = 0; raf = requestAnimationFrame(tick); }
  }

  /* ---------- focus: point at an icon (or focus it in the list) and it comes round to the front ---------- */
  function focusOn(ic) {
    if (focus === ic) return;
    if (focus) focus.el.classList.remove('is-hot');
    focus = ic || null;
    if (!focus) { target = null; resumeAt = performance.now() + RESUME_MS; return draw(); }
    focus.el.classList.add('is-hot');
    if (tierName !== 'static') { const f = G.frontOf(focus.p, TILT); target = { yaw: G.nearAngle(s.yaw, f.yaw), pitch: f.pitch }; }
    draw();
  }
  const iconOf = (n) => { const a = n && n.closest && n.closest('.gx-i'); return a ? icons.find((i) => i.el === a) : null; };
  // While the pointed icon turns away from under the pointer, other icons pass beneath it: they take over only once the
  // pointer itself has moved on (no chase).
  let at = null;
  layer.addEventListener('pointerover', (e) => {
    const ic = iconOf(e.target);
    if (!ic || drag || ic === focus) return;
    if (focus && at && Math.hypot(e.clientX - at.x, e.clientY - at.y) < 24) return;
    at = { x: e.clientX, y: e.clientY };
    focusOn(ic);
  });
  layer.addEventListener('pointerout', (e) => { if (!drag && !layer.contains(e.relatedTarget)) focusOn(null); });

  /* ---------- drag to spin, with inertia; a drag is never a click ---------- */
  let moved = 0;
  layer.addEventListener('pointerdown', (e) => {
    if (tierName === 'static' || e.button > 0) return;
    drag = { x: e.clientX, y: e.clientY, t: performance.now(), vel: 0, id: e.pointerId };
    moved = 0;
    if (e.pointerType !== 'mouse') focusOn(iconOf(e.target));   // a finger shows the name it presses
  });
  addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const now = performance.now(), dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(1, now - drag.t);
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved < 6) return;
    if (focus) focusOn(null);
    s.yaw += dx / geom.r; s.pitch = G.clamp(s.pitch + dy / geom.r / 2, -0.6, 0.6);
    drag.vel = drag.vel * 0.6 + (dx / geom.r / dt) * 0.4;
    Object.assign(drag, { x: e.clientX, y: e.clientY, t: now });
    if (!running()) draw();
  }, { passive: true });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (moved >= 6) { s.vel = G.clamp(drag.vel, -0.006, 0.006); resumeAt = 0; }
    drag = null;
  };
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);
  layer.addEventListener('click', (e) => { if (moved >= 6) { e.preventDefault(); moved = 0; } }, true);

  /* ---------- the keyboard list: every app, one tab stop, arrow keys move; the focused app comes to the front ---------- */
  const list = el('ul', { class: 'gx-list' });
  const fillList = () => { if (nav) nav.append(list); APPS.forEach((a, i) => list.append(el('li', null, el('a', { href: a.path, tabindex: i ? '-1' : '0', 'data-id': a.id }, C.icon(a, 'gx-svg') || '', el('span', null, name(a)))))); };
  list.addEventListener('keydown', (e) => {
    const all = [...list.querySelectorAll('a')], i = all.indexOf(document.activeElement);
    if (i < 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    const j = step ? (i + step + all.length) % all.length : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    all[i].tabIndex = -1; all[j].tabIndex = 0; all[j].focus();
  });
  list.addEventListener('focusin', (e) => {
    const id = e.target.closest('a').dataset.id;
    let ic = icons.find((x) => x.app.id === id);
    if (!ic && icons.length) {   // fewer icons than apps (lite): the farthest one takes this app
      ic = icons.reduce((m, x) => (x.z < m.z ? x : m));
      setApp(ic, APPS.find((a) => a.id === id));
    }
    focusOn(ic);
  });
  list.addEventListener('focusout', (e) => { if (!list.contains(e.relatedTarget)) focusOn(null); });

  /* ---------- start, and what stops it ---------- */
  let startedAt = 0;
  function start() {
    startedAt = performance.now();
    fillList();
    pickTier();
    build();
    hero.classList.add('gx-on');
    paint();
    if ('IntersectionObserver' in window) new IntersectionObserver((en) => { inView = en[en.length - 1].isIntersecting; paint(); }).observe(hero);
    document.addEventListener('visibilitychange', paint);
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (measure()) draw(); }).observe(hero);
    const rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    if (rm && rm.addEventListener) rm.addEventListener('change', () => { pickTier(); build(); paint(); });
    new MutationObserver(() => { if (measure()) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-slop-theme'] });
  }
  window.SlopGlobe = {
    state: () => hero.dataset.globe || 'idle',
    frames: () => frames,
    startedAt: () => startedAt,
    tier: () => tierName,
    view: () => ({ ...s, geom: { ...geom }, focus: focus ? focus.app.id : null }),
    icons: () => icons.map((i) => ({ id: i.app.id, x: i.x, y: i.y, z: i.z, opacity: i.op, el: i.el })),
    /** Reduced motion on or off (what the media query's change does), for the tests. */
    reduce(on) { tierName = on ? 'static' : 'full'; build(); paint(); },
    /** Holds the globe still (the layout tests measure a still page). */
    pause(on) { held = !!on; paint(); },
  };
  // well after the first paints: a moment past load, then the next idle time
  const later = () => setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(start, { timeout: 1500 }) : start()), 700);
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
})();
