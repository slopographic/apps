/* Slopographic homepage: renders Apps and the Status board from
 * shared/apps.js (the single source of truth), and smooth-scrolls the section links. */
(() => {
  'use strict';
  const APPS = window.SLOP_APPS || [];
  const STATUS = { live: 'Live', beta: 'Beta', building: 'In development' };
  const ICONS = {
    page: '<path d="M12 6h17l9 9v27H12z"/><path d="M29 6v9h9M17 22h14M17 27h14M17 32h10"/>',
    grid: '<rect x="6" y="8" width="36" height="32" rx="2"/><path d="M6 17h36M6 26h36M6 33h36M17 8v32M29 8v32"/>',
    slides: '<rect x="6" y="8" width="36" height="24" rx="2"/><path d="M24 32v8M16 42h16M13 16h14M13 22h20"/>',
    folder: '<path d="M6 12h13l4 5h19v21H6z"/><path d="M6 20h36"/>',
    spark: '<path d="M24 6l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"/><path d="M38 6v6M35 9h6"/>',
    film: '<rect x="6" y="10" width="36" height="28" rx="3"/><path d="M6 17h36M6 31h36M13 10v7M21 10v7M29 10v7M37 10v7M13 31v7M21 31v7M29 31v7M37 31v7"/><path d="m21 21 7 3-7 3z"/>',
    layout: '<rect x="8" y="6" width="32" height="36" rx="2"/><path d="M13 12h22M13 18h10v12H13zM27 18h8M27 23h8M27 28h8M13 35h22"/>',
    brush: '<path d="M14 34c4 0 7-3 7-7l-4-4c-4 0-7 3-7 7 0 2-1 3-3 4 2 0 5 0 7 0z"/><path d="M19 25 36 8l4 4-17 17"/>',
    pen: '<path d="M24 6 10 20l4 18 10 4 10-4 4-18z"/><circle cx="24" cy="24" r="3"/><path d="M24 6v15"/>',
    doc: '<path d="M12 6h17l9 9v27H12z"/><path d="M29 6v9h9M17 24h14M17 30h14M17 36h9"/>',
    tag: '<path d="M6 8h18l18 18-16 16L8 24z"/><circle cx="15" cy="16" r="3"/><path d="M20 32l10-10"/>',
  };
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs || {}) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    for (const c of kids) if (c != null) n.append(c);
    return n;
  };
  /** An SVG-namespace <svg> holding the badge. Created with createElementNS so the markup parses as SVG (not HTML). */
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const svgEl = (inner, cls, attrs) => {
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 48 48');
    s.setAttribute('class', cls);
    s.setAttribute('aria-hidden', 'true');
    for (const k in attrs || {}) s.setAttribute(k, attrs[k]);
    s.innerHTML = inner; // innerHTML on an SVG element parses in SVG context
    return s;
  };
  /** The status badge. Live tiles stay unbadged; app cards always show their status. */
  const badge = (a, always) => (a.status === 'live' && !always ? null : el('span', { class: 'badge ' + a.status }, STATUS[a.status]));

  /** A screenshot, or (until one exists) a generated tile in the app's colours. */
  function shot(a) {
    const box = el('div', { class: 'shot', 'data-id': a.id, 'aria-hidden': 'true' });
    const ph = el('div', { class: 'shot-ph' }, el('b', null, a.name));
    const glyph = (window.SLOP_ICONS && window.SLOP_ICONS[a.id]) || ICONS[a.icon];
    if (glyph) ph.prepend(svgEl(window.SLOP_ICON_BADGE ? window.SLOP_ICON_BADGE(glyph) : glyph, 'shot-icon', { 'data-icon': a.id }));
    box.append(ph);
    if (a.shot) {
      const img = el('img', { alt: '', loading: 'lazy', decoding: 'async', src: a.shot });
      img.addEventListener('load', () => { box.classList.add('has-img'); if (!stillOnly()) { box.dataset.clip = a.shot.replace('/shots/', '/clips/').replace(/\.jpe?g$/, ''); pickCentre(); } });
      img.addEventListener('error', () => img.remove());
      box.append(img);
    }
    return box;
  }

  /* ---------- clips: a muted loop on hover/focus (desktop) or for the one card in view (touch) ---------- */
  const mq = (q) => window.matchMedia && matchMedia(q).matches;
  function stillOnly() {
    const c = navigator.connection;
    return mq('(prefers-reduced-motion: reduce)') || !!(c && c.saveData);
  }
  /** The card's <video>, made on first use (preload none, poster = the shot). Null if the clip is missing. */
  function clipOf(box) {
    if (!box || !box.dataset.clip || box.dataset.noclip) return null;
    let v = box.querySelector('video');
    if (v) return v;
    const src = box.dataset.clip;
    v = el('video', { muted: '', loop: '', playsinline: '', preload: 'none', poster: src.replace('/clips/', '/shots/') + '.jpg', 'aria-hidden': 'true', tabindex: '-1' },
      el('source', { src: src + '.webm', type: 'video/webm' }), el('source', { src: src + '.mp4', type: 'video/mp4' }));
    v.muted = true;
    v.addEventListener('playing', () => box.classList.add('playing'));
    v.lastElementChild.addEventListener('error', () => { box.dataset.noclip = '1'; box.classList.remove('playing'); v.remove(); });
    box.append(v);
    return v;
  }
  function play(box) {
    if (stillOnly()) return;
    const v = clipOf(box);
    if (v) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
  }
  function stop(box) {
    const v = box && box.querySelector('video');
    box && box.classList.remove('playing');
    if (v) v.pause();
  }
  const cardShot = (t) => { const c = t && t.closest && t.closest('.app-card, .tile'); return c && c.querySelector('.shot[data-clip]'); };
  const hoverable = () => mq('(hover: hover) and (pointer: fine)');
  document.addEventListener('pointerover', (e) => { if (hoverable() && e.pointerType !== 'touch') { const s = cardShot(e.target); if (s) play(s); } });
  document.addEventListener('pointerout', (e) => { const s = cardShot(e.target); if (s && !s.closest('.app-card, .tile').contains(e.relatedTarget)) stop(s); });
  document.addEventListener('focusin', (e) => { const s = cardShot(e.target); if (s) play(s); });
  document.addEventListener('focusout', (e) => { const s = cardShot(e.target); if (s) stop(s); });
  /* Touch screens: play the single card nearest the middle of the viewport. */
  let current = null;
  const seen = new Set();
  function pickCentre() {
    if (hoverable()) return;
    let best = null, bd = Infinity;
    const mid = innerHeight / 2;
    for (const s of seen) {
      if (!s.isConnected) { seen.delete(s); continue; }
      if (!s.dataset.clip) continue;
      const r = s.getBoundingClientRect(), d = Math.abs(r.top + r.height / 2 - mid);
      if (r.top >= -r.height * 0.2 && r.bottom <= innerHeight + r.height * 0.2 && d < bd) { bd = d; best = s; }
    }
    if (best === current) return;
    if (current) stop(current);
    current = best;
    if (best) play(best);
  }
  let io = null;
  const watchShots = () => { if (io) document.querySelectorAll('.shot').forEach((s) => io.observe(s)); };
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver((entries) => {
      for (const en of entries) { if (en.intersectionRatio >= 0.6) seen.add(en.target); else { seen.delete(en.target); if (en.target === current) { stop(current); current = null; } } }
      pickCentre();
    }, { threshold: [0, 0.6, 1] });
    queueMicrotask(watchShots);
    let raf = 0;
    addEventListener('scroll', () => { if (!raf && seen.size) raf = requestAnimationFrame(() => { raf = 0; pickCentre(); }); }, { passive: true });
  }
  window.SlopHomeCards = { appCard, tile, watch: watchShots };
  /* A compact card: thumbnail, name, status badge, one line of what it does, and the link. */
  function appCard(a, line) {
    return el('a', { class: 'app-card', href: a.path, 'data-perch': 'card', 'data-id': a.id },
      shot(a),
      el('div', { class: 'app-body' },
        el('div', { class: 'app-name' }, el('h3', null, a.name), badge(a, true)),
        el('p', { class: 'app-tag' }, line || a.tagline),
        el('span', { class: 'go' }, a.status === 'building' ? 'Preview →' : 'Open →')));
  }
  function tile(a) {
    return el('a', { class: 'tile', href: a.path, 'data-perch': 'card', 'data-id': a.id, ...(a.path.startsWith('#') ? { 'data-view': a.path.slice(1) } : {}) },
      shot(a),
      el('div', { class: 'tile-body' }, el('div', { class: 'app-name' }, el('h3', null, a.name), badge(a)), el('p', null, a.tagline)));
  }
  /* ---------- app carousel: the top of the homepage, one slide per app ---------- */
  // Names the carousel leads with, in this order; every other registry entry follows in registry order.
  const CAROUSEL_TOP = ['PhotoSlop', 'SlopCut', 'SlopIsolate', 'SlopVector', 'Reel Remix', 'Slop Image to 3D', 'Slop Upscale', 'Slop Resize', 'Slop Docs', 'Slop Orders', 'Slop Invoices', 'Slop CRM', 'Slop Calendar', 'Slop Drive'];
  // Folders that have a guided tour. Keep in step with TOURS in shared/tour/mount.js.
  const TOUR_DIRS = window.SlopHomeSections.TOUR_DIRS;
  const CAROUSEL_MS = 7000;
  const carouselApps = () => {
    const byName = new Map(APPS.map((a) => [a.name, a]));
    const top = CAROUSEL_TOP.map((n) => byName.get(n)).filter(Boolean);
    const placed = new Set(top.map((a) => a.id));
    return top.concat(APPS.filter((a) => !placed.has(a.id)));
  };
  function slide(a, i, n) {
    const glyph = (window.SLOP_ICONS && window.SLOP_ICONS[a.id]) || ICONS[a.icon];
    const hash = a.path.startsWith('#');
    const feats = (a.features || []).slice(0, 3);
    const tour = TOUR_DIRS.has(a.path.replace(/\/$/, ''));
    // 50/50 on wide screens (text left, badge right); on phones the badge sits above the text (CSS order).
    const visual = glyph ? el('div', { class: 'car-visual' }, svgEl(window.SLOP_ICON_BADGE ? window.SLOP_ICON_BADGE(glyph) : glyph, 'car-icon')) : null;
    return el('div', { class: 'car-slide', role: 'group', 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${n}: ${a.name}`, 'data-id': a.id },
      el('div', { class: 'car-text' },
        el('div', { class: 'car-head' }, el('h3', null, a.name), badge(a, true)),
        el('p', { class: 'car-tag' }, a.tagline),
        feats.length ? el('ul', { class: 'car-feats' }, ...feats.map((f) => el('li', null, f))) : null,
        el('div', { class: 'car-actions' },
          el('a', { class: 'btn primary', href: a.path, ...(hash ? { 'data-view': a.path.slice(1) } : {}) }, 'Open', el('span', { class: 'sr' }, ' ' + a.name)),
          tour ? el('a', { class: 'btn', href: a.path + '?tour=1' }, 'Tour', el('span', { class: 'sr' }, ' ' + a.name + ' tour')) : null)),
      visual);
  }
  /** The carousel: slides, previous and next, dots, a pause control, a live region, swipe and arrow keys. */
  function carousel(list) {
    const n = list.length;
    const reduced = () => mq('(prefers-reduced-motion: reduce)');
    const region = el('section', { class: 'carousel', role: 'region', 'aria-roledescription': 'carousel', 'aria-label': 'Featured apps' });
    const track = el('div', { class: 'car-track', id: 'car-track' }, ...list.map((a, i) => slide(a, i, n)));
    const slides = [...track.children];
    const live = el('p', { class: 'sr', 'aria-live': 'off' });
    const count = el('span', { class: 'car-count', 'aria-hidden': 'true' });
    const button = (cls, label, text, fn) => { const b = el('button', { type: 'button', class: cls, 'aria-label': label, 'aria-controls': 'car-track' }, text); b.addEventListener('click', fn); return b; };
    // One dot per slide, built once (so a focused dot is never replaced); paintDots() shows only the nearby ones.
    const dots = list.map((a, i) => { const d = button('car-dot', `Show ${a.name}`, '', () => user(() => show(i))); d.dataset.slide = i; return d; });
    const strip = el('div', { class: 'car-dots', role: 'group', 'aria-label': 'Choose a slide' }, ...dots);
    const prev = button('btn car-btn car-prev', 'Previous app', '‹', () => user(() => show(cur - 1)));
    const next = button('btn car-btn car-next', 'Next app', '›', () => user(() => show(cur + 1)));
    const pause = button('btn ghost car-pause', 'Pause the slides', 'Pause', () => { stopped = true; schedule(); });
    const viewport = el('div', { class: 'car-viewport' }, track);
    region.append(viewport,
      el('div', { class: 'car-bar' }, prev, count, next, strip, pause), live);
    let cur = 0, timer = 0, stopped = false, hover = false, focus = false;
    const playing = () => !stopped && !hover && !focus && !reduced();
    /** The slides the strip shows: five around the current one, plus the first and last (at most seven). */
    function nearby() {
      if (n <= 7) return new Set(list.map((_, k) => k));
      const start = Math.min(Math.max(cur - 2, 0), n - 5);
      const s = new Set([0, n - 1]);
      for (let k = start; k < start + 5; k++) s.add(k);
      return s;
    }
    function paintDots() {
      const shown = nearby();
      dots.forEach((d, k) => {
        const on = shown.has(k);
        d.hidden = !on;
        d.classList.toggle('gap-after', on && k + 1 < n && !shown.has(k + 1)); // a wider gap where slides are skipped
        d.classList.toggle('is-current', k === cur);
        if (k === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    }
    function show(i) {
      cur = (i + n) % n;
      slides.forEach((s, k) => { s.classList.toggle('is-current', k === cur); s.toggleAttribute('inert', k !== cur); });
      paintDots();
      track.style.transform = `translateX(${-cur * 100}%)`;
      count.textContent = `${cur + 1} / ${n}`;
      live.textContent = `Slide ${cur + 1} of ${n}: ${list[cur].name}`;
      schedule();
    }
    /** Auto-advance runs only while the person is not on the carousel, has not used a control, and motion is allowed. */
    function schedule() {
      clearTimeout(timer);
      const run = playing();
      live.setAttribute('aria-live', run ? 'off' : 'polite');
      pause.hidden = stopped || reduced();
      if (run) timer = setTimeout(() => show(cur + 1), CAROUSEL_MS);
    }
    /** A control, dot, arrow key or swipe: the person is in charge now, so auto-advance stops for good. */
    function user(fn) { stopped = true; fn(); }
    region.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); user(() => show(cur + (e.key === 'ArrowRight' ? 1 : -1))); }
    });
    region.addEventListener('pointerenter', () => { hover = true; schedule(); });
    region.addEventListener('pointerleave', () => { hover = false; schedule(); });
    region.addEventListener('focusin', () => { focus = true; schedule(); });
    region.addEventListener('focusout', (e) => { focus = region.contains(e.relatedTarget); schedule(); });
    let sx = null, sy = 0;
    viewport.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { sx = e.clientX; sy = e.clientY; } });
    viewport.addEventListener('pointerup', (e) => {
      if (sx == null) return;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) user(() => show(cur + (dx < 0 ? 1 : -1)));
    });
    viewport.addEventListener('pointercancel', () => { sx = null; });
    const rm = matchMedia('(prefers-reduced-motion: reduce)');
    if (rm.addEventListener) rm.addEventListener('change', schedule);
    show(0);
    return region;
  }
  const carouselMount = document.getElementById('app-carousel');
  if (carouselMount && APPS.length) carouselMount.append(carousel(carouselApps()));

  /* ---------- status board ---------- */
  const board = document.getElementById('status-board');
  if (board) {
    const counts = { live: 0, beta: 0, building: 0 };
    APPS.forEach((a) => counts[a.status]++);
    document.getElementById('status-sum').textContent = `${APPS.length} projects: ${counts.live} live, ${counts.beta} in beta, ${counts.building} in development. Statuses come straight from the app registry, so this board is always current.`;
    const kinds = { app: 'App', game: 'Game', experiment: 'Experiment' };
    const order = { building: 0, beta: 1, live: 2 };
    [...APPS].sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name)).forEach((a) => {
      board.append(el('a', { class: 'status-row', href: a.path, role: 'row', ...(a.path.startsWith('#') ? { 'data-view': a.path.slice(1) } : {}) },
        el('span', { class: 'dot ' + a.status, role: 'cell', 'aria-label': STATUS[a.status] }),
        el('b', { role: 'cell' }, a.name),
        el('span', { class: 'kind', role: 'cell' }, kinds[a.kind]),
        el('span', { class: 'state', role: 'cell' }, STATUS[a.status]),
        el('span', { class: 'tagline', role: 'cell' }, a.tagline)));
    });
  }

  /* ---------- section links: work from either view, and scroll smoothly ---------- */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-jump]');
    if (!a) return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (window.slopShowView) window.slopShowView('home');
    history.replaceState(null, '', location.pathname + location.search);
    requestAnimationFrame(() => target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
  });
  if (window.SlopHub) window.SlopHub.register('home');
})();
