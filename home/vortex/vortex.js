/* The tool vortex behind the homepage wordmark: the apps' own icons (SLOP_ICONS through SlopHomeCards.icon, the same badge
 * as the cards) swirl on elliptical spirals into the centre, smaller and fainter the deeper they go, with faint flow lines
 * and trails on a canvas. The maths is home/vortex/orbit.js (SlopVortexMath); the styles are in home/hero.css.
 * Classic script, after shared/apps.js, shared/app-icons.js, home/catalog.js and orbit.js.
 *  - It starts after the page has loaded and gone idle, so the wordmark (the largest paint) is never waited on, and it only
 *    adds absolutely placed layers, so nothing moves.
 *  - Runs while the hero is on screen and the tab is visible; stops otherwise. Reduced motion: a still ring of icons.
 *    Phones, touch screens, Save-Data and small devices: fewer icons at 30 fps (SlopVortexMath.tier).
 *  - Icons are links (tabindex -1, hidden from screen readers); hovering one shows its name and slows the swirl. The
 *    keyboard and screen-reader way in is the list in .vx-nav: one tab stop, the arrow keys move along it, and the
 *    focused app shows as a chip under the wordmark with its icon lit.
 *  - Icons near the text fade almost out (SlopVortexMath.keepOut), so the wordmark and the copy always read.
 *  window.SlopVortex: { state(), frames(), icons(), reduce(on), pause(on) } for the tests. */
(function () {
  'use strict';
  const V = window.SlopVortexMath, C = window.SlopHomeCards;
  const hero = document.getElementById('hero');
  if (!V || !C || !hero) return;
  const stage = hero.querySelector('.hx-stage'), mark = hero.querySelector('.hx-mark');
  const nav = hero.querySelector('.vx-nav');
  const ICONS = window.SLOP_ICONS || {};
  const APPS = (window.SLOP_APPS || []).filter((a) => a.path && !a.path.startsWith('#') && ICONS[a.id]);
  if (!stage || !mark || !APPS.length) return;
  const mq = (q) => !!(window.matchMedia && matchMedia(q).matches);
  const name = (a) => (window.slopAppLabel ? window.slopAppLabel(a, !!(window.slopBrandNamesOn && window.slopBrandNamesOn())) : a.name);
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs || {}) n.setAttribute(k, attrs[k]);
    n.append(...kids.filter(Boolean));
    return n;
  };
  const LIFE = 34000;         // ms for an icon to sink from the rim into the centre, at full speed

  /* ---------- layers: the canvas (flow lines, trails) and the icons, under the copy ---------- */
  const layer = el('div', { class: 'vx-layer', 'aria-hidden': 'true' });
  const canvas = el('canvas', { class: 'vx-lines' });
  const ctx = canvas.getContext && canvas.getContext('2d');
  layer.append(canvas);
  hero.prepend(layer);

  let tierName = 'full', T = V.TIERS.full, slots = [], queue = 0;
  function pickTier() {
    const nv = navigator, c = nv.connection;
    tierName = V.tier({ reduced: mq('(prefers-reduced-motion: reduce)'), cores: nv.hardwareConcurrency, memory: nv.deviceMemory,
      saveData: !!(c && c.saveData), coarse: mq('(pointer: coarse)'), width: hero.clientWidth });
  }
  /** An icon link for a slot; its app changes each time it reaches the centre. */
  function iconFor(slot, a) {
    slot.app = a;
    const n = slot.el;
    n.href = a.path;
    n.dataset.id = a.id;
    n.setAttribute('aria-label', name(a));
    n.replaceChildren(C.icon(a, 'vx-svg') || '', el('span', { class: 'vx-name' }, name(a)));
  }
  const nextApp = () => APPS[queue++ % APPS.length];
  function build() {
    T = V.TIERS[tierName];
    layer.querySelectorAll('.vx-i').forEach((n) => n.remove());
    queue = 0; hot = null; lit = null; target = 1;
    const ringAt = V.ring(T.icons);
    slots = [];
    for (let i = 0; i < Math.min(T.icons, APPS.length * 2); i++) {
      const slot = { el: el('a', { class: 'vx-i', tabindex: '-1', 'aria-hidden': 'true', 'data-vx-icon': '' }), i,
        p0: i / T.icons, a0: i * 2.39996, turns: 1.15 + (i % 3) * 0.14, speed: 0.92 + ((i * 37) % 10) / 60, lap: 0, ring: ringAt[i], x: 0, y: 0, op: 0 };
      iconFor(slot, nextApp());
      layer.append(slot.el);
      slots.push(slot);
    }
    measure();
    draw();
  }

  /* ---------- geometry: the vortex is centred on the wordmark; the text boxes are kept clear ---------- */
  let W = 0, H = 0, geom = { cx: 0, cy: 0, rx: 1, ry: 1, tilt: -0.12 }, rects = [], margin = 30, ink = '#888', size = 64;
  function box(n, base) {
    if (!n) return null;
    let r = n.getBoundingClientRect();
    if (n === mark) { const range = document.createRange(); range.selectNodeContents(n); r = range.getBoundingClientRect(); }
    return r.width ? { l: r.left - base.left, t: r.top - base.top, r: r.right - base.left, b: r.bottom - base.top } : null;
  }
  function measure() {
    const base = hero.getBoundingClientRect(), s = box(stage, base);
    if (!s || !hero.clientWidth) return false;   // the home view is hidden (the Authenticator): keep the last geometry
    W = hero.clientWidth; H = hero.clientHeight;
    const phone = W < 700;
    const m = box(mark, base) || s;
    geom = { cx: (m.l + m.r) / 2, cy: (m.t + m.b) / 2, rx: W * (phone ? 0.62 : 0.5), ry: (s.b - s.t) * (phone ? 0.6 : 0.66), tilt: -0.12 };
    rects = [m, ...['.hx-title', '.hx-sub', '.hx-cta', '.hx-meta'].map((q) => box(hero.querySelector(q), base))].filter(Boolean);
    margin = phone ? 16 : 30;
    size = phone ? 44 : 60;
    layer.style.setProperty('--vx-size', size + 'px');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ink = getComputedStyle(hero).getPropertyValue('--bone').trim() || '#888';
    return true;
  }

  /* ---------- one frame ---------- */
  let t = 0, last = 0, frames = 0, born = 0, speed = 1, target = 1, hot = null, lit = null;
  const ptr = { x: 0, y: 0 }, par = { x: 0, y: 0 };
  const rawPhase = (s) => (s.hold != null ? s.hold : s.p0 + (t / LIFE) * s.speed);
  function phaseOf(s) { const p = rawPhase(s); return { lap: Math.floor(p), p: p - Math.floor(p) }; }
  /** Holds one icon where it is (pointed at or focused) and lets it go on from the same place. */
  function hold(s, on) {
    if (!s || (s.hold != null) === on) return;
    if (on) s.hold = rawPhase(s);
    else { s.p0 = s.hold - (t / LIFE) * s.speed; s.hold = null; }
  }
  function lines() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = ink;
    ctx.lineCap = 'round';
    if (tierName === 'static') {   // the still version: the two rings the icons sit on
      ctx.globalAlpha = 0.1; ctx.lineWidth = 1;
      for (const d of [0.94, 0.7, 0.46]) { ctx.beginPath(); ctx.ellipse(geom.cx, geom.cy, geom.rx * d, geom.ry * d, geom.tilt, 0, V.TAU); ctx.stroke(); }
      return;
    }
    // Flow lines: five arms that trace the icons' own spiral, turning slowly.
    ctx.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      ctx.beginPath();
      for (let p = 0; p <= 0.9; p += 0.025) {
        const s = V.spiral(p, (V.TAU * k) / 5 + t / 52000, 1.25), q = V.place(s.d, s.a, geom, par);
        if (p === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.globalAlpha = 0.09;
      ctx.stroke();
    }
    // Trails: a short tail behind each icon, fading out behind it.
    for (const s of slots) {
      if (s.op < 0.05) continue;
      const ph = phaseOf(s).p, back = 0.045;
      let prev = null;
      for (let j = 0; j <= T.trail; j++) {
        const p = Math.max(0, ph - back + (back * j) / T.trail), o = V.spiral(p, s.a0, s.turns), q = V.place(o.d, o.a, geom, par);
        if (prev) { ctx.globalAlpha = s.op * 0.45 * (j / T.trail); ctx.lineWidth = 2 * q.scale; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        prev = q;
      }
    }
    ctx.globalAlpha = 1;
  }
  function draw() {
    const intro = tierName === 'static' ? 1 : V.smooth(0, 1200, performance.now() - born);
    for (const s of slots) {
      let pos, op;
      if (tierName === 'static') {
        pos = V.place(s.ring.d, s.ring.a, geom, null);
        op = V.alpha(0.3, s.ring.d, pos.z);
      } else {
        const ph = phaseOf(s);
        if (ph.lap !== s.lap) { s.lap = ph.lap; if (s !== hot && s !== lit) iconFor(s, nextApp()); }
        const o = V.spiral(ph.p, s.a0, s.turns);
        pos = V.place(o.d, o.a, geom, par);
        op = V.alpha(ph.p, o.d, pos.z) * intro;
      }
      op *= V.keepOut(pos.x, pos.y, rects, margin);
      if (s === hot || s === lit) op = 1;
      s.x = pos.x; s.y = pos.y; s.op = op;
      const st = s.el.style;
      st.transform = `translate3d(${(pos.x - size / 2).toFixed(1)}px,${(pos.y - size / 2).toFixed(1)}px,0) scale(${pos.scale.toFixed(3)})`;
      st.opacity = op.toFixed(3);
      st.zIndex = String(Math.round(20 + pos.z * 10 + pos.scale * 10));
      s.el.classList.toggle('is-live', op > 0.3);
    }
    lines();
    frames++;
  }

  /* ---------- running: only on screen, in a visible tab, with motion allowed and nothing paused ---------- */
  let raf = 0, inView = true, held = false, focused = false;
  const running = () => tierName !== 'static' && inView && !document.hidden && !held && !focused;
  function tick(now) {
    raf = 0;
    if (!running()) return paint();
    raf = requestAnimationFrame(tick);
    if (last && !V.due(now, last, T.fps)) return;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    speed += (target - speed) * 0.08;
    par.x += (ptr.x - par.x) * 0.05; par.y += (ptr.y - par.y) * 0.05;
    t += dt * speed;
    draw();
  }
  function paint() {
    hero.dataset.vx = tierName === 'static' ? 'static' : running() ? 'running' : 'paused';
    if (running() && !raf) { last = 0; raf = requestAnimationFrame(tick); }
  }

  /* ---------- pointer: parallax, and hover or press shows a name and slows the swirl ---------- */
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const r = hero.getBoundingClientRect();
    ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1; ptr.y = ((e.clientY - r.top) / r.height) * 2 - 1;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { ptr.x = 0; ptr.y = 0; });
  const slotOf = (n) => { const a = n && n.closest && n.closest('.vx-i'); return a ? slots.find((s) => s.el === a) : null; };
  function heat(s) {
    if (hot === (s || null)) return;
    if (hot) { hot.el.classList.remove('is-hot'); if (hot !== lit) hold(hot, false); }
    hot = s || null;
    if (hot) { hot.el.classList.add('is-hot'); hold(hot, true); }
    target = hot ? 0.06 : 1;
    if (tierName === 'static' || !running()) draw();
  }
  layer.addEventListener('pointerover', (e) => heat(slotOf(e.target)));
  layer.addEventListener('pointerout', (e) => { if (!slotOf(e.relatedTarget)) heat(null); });
  layer.addEventListener('pointerdown', (e) => heat(slotOf(e.target)));

  /* ---------- the keyboard list: every app, one tab stop, arrow keys move ---------- */
  const list = el('ul', { class: 'vx-list' });
  if (nav) nav.append(list);
  APPS.forEach((a, i) => list.append(el('li', null, el('a', { href: a.path, tabindex: i ? '-1' : '0', 'data-id': a.id }, C.icon(a, 'vx-svg') || '', el('span', null, name(a))))));
  const links = () => [...list.querySelectorAll('a')];
  list.addEventListener('keydown', (e) => {
    const all = links(), i = all.indexOf(document.activeElement);
    if (i < 0) return;
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let j = step ? (i + step + all.length) % all.length : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    all[i].tabIndex = -1; all[j].tabIndex = 0; all[j].focus();
  });
  list.addEventListener('focusin', (e) => {
    const a = e.target.closest('a');
    focused = true;
    if (lit) { lit.el.classList.remove('is-lit'); if (lit !== hot) hold(lit, false); }
    lit = slots.find((s) => s.app.id === a.dataset.id) || null;
    if (lit) { lit.el.classList.add('is-lit'); hold(lit, true); }
    draw(); paint();
  });
  list.addEventListener('focusout', (e) => {
    if (list.contains(e.relatedTarget)) return;
    focused = false;
    if (lit) { lit.el.classList.remove('is-lit'); if (lit !== hot) hold(lit, false); }
    lit = null;
    paint();
  });

  /* ---------- start, and what stops it ---------- */
  function start() {
    born = performance.now();
    pickTier();
    build();
    hero.classList.add('vx-on');
    paint();
    if ('IntersectionObserver' in window) new IntersectionObserver((en) => { inView = en[en.length - 1].isIntersecting; paint(); }).observe(hero);
    document.addEventListener('visibilitychange', paint);
    if ('ResizeObserver' in window) new ResizeObserver(() => { if (measure()) draw(); }).observe(hero);
    const rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    if (rm && rm.addEventListener) rm.addEventListener('change', () => { pickTier(); build(); paint(); });
    // a theme change repaints the lines in the new ink
    new MutationObserver(() => { if (measure()) draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-slop-theme'] });
  }
  window.SlopVortex = {
    state: () => hero.dataset.vx || 'idle',
    frames: () => frames,
    tier: () => tierName,
    icons: () => slots.map((s) => ({ id: s.app.id, x: s.x, y: s.y, opacity: s.op, el: s.el })),
    /** Reduced motion on or off (what the media query's change does), for the tests. */
    reduce(on) { tierName = on ? 'static' : 'full'; build(); paint(); },
    /** Holds the swirl still (the layout tests measure a still page). */
    pause(on) { held = !!on; paint(); },
  };
  const later = () => (window.requestIdleCallback ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 200));
  if (document.readyState === 'complete') later(); else addEventListener('load', later, { once: true });
})();
