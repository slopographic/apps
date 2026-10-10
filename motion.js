/* Slopographic motion layer: intro, SLOOOOP stretch, drips, slime cursor,
 * scroll-reactive ticker, reveals and the Authenticator's stamp slam.
 * Everything here is decoration: the site works without it, and it all
 * switches off for people who prefer reduced motion.
 */
(() => {
  'use strict';

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const finePointer = matchMedia('(pointer: fine)').matches;
  const store = (() => {
    try { return window.sessionStorage; } catch { return null; }
  })();

  // --------------------------------------------------------------- wordmark

  const mark = $('.wordmark');
  const wrap = $('.wordmark-wrap');

  function splitWordmark() {
    const text = mark.textContent;
    mark.textContent = '';
    [...text].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.style.setProperty('--i', i);
      s.textContent = c;
      mark.append(s);
    });
    mark.classList.add('split');
    mark.setAttribute('aria-label', text);
  }
  splitWordmark();

  // Letters squish when you touch them.
  mark.addEventListener('pointerover', (e) => {
    const ch = e.target.closest('.ch');
    if (!ch || ch.classList.contains('wobble')) return;
    ch.classList.add('wobble');
    ch.addEventListener('animationend', function done(ev) {
      if (ev.animationName !== 'jelly') return;
      ch.classList.remove('wobble');
      ch.removeEventListener('animationend', done);
    });
  });

  // SLOPO… → SLOOOOOOOPO… with an elastic snap back.
  let stretching = false;
  function sloooop() {
    if (stretching) return;
    const o = mark.querySelectorAll('.ch')[2];
    if (!o) return;
    stretching = true;
    const oW = o.getBoundingClientRect().width;
    const full = mark.getBoundingClientRect().width;
    const extra = 6;
    // Extra O's sit on top of each other and fan out as the slot widens.
    o.classList.add('o-stretch');
    o.style.setProperty('--ow', oW + 'px');
    o.style.setProperty('--n', extra);
    o.textContent = '';
    for (let k = 0; k <= extra; k++) {
      const c = document.createElement('span');
      c.className = 'oc';
      c.style.setProperty('--k', k);
      c.textContent = 'O';
      o.append(c);
    }
    o.style.width = oW + 'px';
    // Springy stretch out, a beat of hold, then a clean snap back (no undershoot,
    // which would squeeze the O thinner than normal).
    const timing = { duration: 1500, easing: 'linear' };
    const offsets = [0, 0.38, 0.58, 1];
    const eases = ['cubic-bezier(0.25, 1.35, 0.35, 1)', 'linear', 'cubic-bezier(0.65, 0, 0.25, 1)', 'linear'];
    const s = full / (full + oW * extra);
    const keyW = [oW, oW * (extra + 1), oW * (extra + 1), oW].map((w, i) => ({ width: w + 'px', offset: offsets[i], easing: eases[i] }));
    const keyS = [1, s, s, 1].map((v, i) => ({ transform: `scaleX(${v})`, offset: offsets[i], easing: eases[i] }));
    o.animate(keyW, timing);
    mark.animate(keyS, timing).finished.then(() => {
      o.classList.remove('o-stretch');
      o.style.width = '';
      o.textContent = 'O';
      stretching = false;
    });
    for (let k = 0; k < 4; k++) setTimeout(spawnDrop, 300 + k * 120);
  }
  mark.addEventListener('click', sloooop);
  mark.addEventListener('mouseenter', () => finePointer && sloooop());

  // Every so often a drop of slime falls off one of the drips.
  function spawnDrop() {
    if (document.hidden) return;
    const drips = $$('.drip', wrap);
    const d = drips[Math.floor(Math.random() * drips.length)];
    if (!d) return;
    const drop = document.createElement('i');
    drop.className = 'drop';
    const r = d.getBoundingClientRect();
    const g = wrap.getBoundingClientRect();
    drop.style.left = r.left - g.left + r.width / 2 + 'px';
    drop.style.top = r.bottom - g.top - 6 + 'px';
    drop.style.setProperty('--t', 1.3 + Math.random() * 0.9 + 's');
    drop.style.setProperty('--dist', 40 + Math.random() * 40 + 'vh');
    wrap.append(drop);
    drop.addEventListener('animationend', () => drop.remove());
  }
  setInterval(spawnDrop, 1100);

  // ------------------------------------------------------------- tagline

  const ze = $('.tagline em');
  if (ze) {
    const t = ze.textContent;
    ze.textContent = '';
    [...t].forEach((c, i) => {
      const s = document.createElement('span');
      s.className = 'wl';
      s.style.setProperty('--i', i);
      s.textContent = c === ' ' ? ' ' : c;
      ze.append(s);
    });
  }

  // ---------------------------------------------------------------- intro

  function playIntro() {
    const seen = store && store.getItem('slop-intro');
    if (seen) {
      mark.classList.add('enter');
      return;
    }
    if (store) store.setItem('slop-intro', '1');
    document.documentElement.classList.add('intro-open');
    const intro = document.createElement('div');
    intro.className = 'intro';
    intro.innerHTML = `
      <div class="intro-word">SL<span class="oo">O</span>P</div>
      <div class="intro-sub">Maison de Slop · You will like ze slop · Tap to skip</div>
      <svg class="intro-goo" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 0H1200V18C1160 18 1150 70 1120 70S1090 20 1040 20 980 104 940 104 900 24 840 24 790 56 760 56 720 14 650 14 600 90 560 90 520 22 460 22 410 64 380 64 340 16 280 16 230 110 190 110 150 26 100 26 60 50 40 50 20 18 0 18Z"/>
      </svg>`;
    document.body.append(intro);
    const word = $('.intro-word', intro);
    const oo = $('.oo', intro);
    let n = 1;
    let done = false;
    const grow = setInterval(() => {
      if (n >= 11) return clearInterval(grow);
      oo.textContent = 'O'.repeat(++n);
      const over = word.scrollWidth / (window.innerWidth * 0.92);
      word.style.transform = `translate(-50%, -50%) scale(${over > 1 ? 1 / over : 1})`;
    }, 85);
    const finish = () => {
      if (done) return;
      done = true;
      clearInterval(grow);
      intro.classList.add('out');
      document.documentElement.classList.remove('intro-open');
      mark.classList.add('enter');
      setTimeout(() => intro.remove(), 900);
    };
    intro.addEventListener('click', finish);
    setTimeout(finish, 1700);
  }
  if ($('#view-feed').hidden) mark.classList.add('enter');
  else playIntro();

  // --------------------------------------------------------- slime cursor

  if (finePointer) {
    // A tapered slug of slime drawn on one canvas: cheap, no filters.
    const cv = document.createElement('canvas');
    cv.className = 'slime';
    document.body.append(cv);
    const cx = cv.getContext('2d');
    const size = () => {
      const d = Math.min(devicePixelRatio || 1, 2);
      cv.width = innerWidth * d;
      cv.height = innerHeight * d;
      cx.setTransform(d, 0, 0, d, 0, 0);
    };
    size();
    addEventListener('resize', size);
    const N = 10;
    const pts = Array.from({ length: N }, () => ({ x: -100, y: -100 }));
    let mx = -100, my = -100, idle = 0;
    addEventListener('pointermove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      idle = 0;
    }, { passive: true });
    (function tick() {
      requestAnimationFrame(tick);
      if (idle > 90) return;
      idle++;
      pts[0].x += (mx - pts[0].x) * 0.55;
      pts[0].y += (my - pts[0].y) * 0.55;
      for (let k = 1; k < N; k++) {
        pts[k].x += (pts[k - 1].x - pts[k].x) * 0.42;
        pts[k].y += (pts[k - 1].y - pts[k].y) * 0.42;
      }
      cx.clearRect(0, 0, innerWidth, innerHeight);
      cx.lineCap = 'round';
      cx.strokeStyle = cx.fillStyle = '#d4ff3a';
      for (let k = N - 1; k > 0; k--) {
        cx.lineWidth = 18 * (1 - k / N) + 3;
        cx.beginPath();
        cx.moveTo(pts[k].x, pts[k].y);
        cx.lineTo(pts[k - 1].x, pts[k - 1].y);
        cx.stroke();
      }
      cx.beginPath();
      cx.arc(pts[0].x, pts[0].y, 10, 0, Math.PI * 2);
      cx.fill();
      cx.fillStyle = 'rgba(255,255,255,0.75)';
      cx.beginPath();
      cx.arc(pts[0].x - 3, pts[0].y - 3, 2.6, 0, Math.PI * 2);
      cx.fill();
    })();
    addEventListener('pointerdown', (e) => {
      for (let k = 0; k < 7; k++) {
        const s = document.createElement('i');
        s.className = 'splat';
        const a = (k / 7) * Math.PI * 2 + Math.random() * 0.5;
        const d = 18 + Math.random() * 26;
        s.style.left = e.clientX + 'px';
        s.style.top = e.clientY + 'px';
        s.style.setProperty('--dx', Math.cos(a) * d + 'px');
        s.style.setProperty('--dy', Math.sin(a) * d + 'px');
        document.body.append(s);
        s.addEventListener('animationend', () => s.remove());
      }
    });
  }

  // ------------------------------------------------- scroll-driven ticker

  const tickerAnim = $('.ticker-track') && $('.ticker-track').getAnimations()[0];
  if (tickerAnim) {
    let lastY = scrollY, vel = 0;
    addEventListener('scroll', () => {
      vel += (scrollY - lastY) * 0.06;
      lastY = scrollY;
    }, { passive: true });
    (function loop() {
      vel *= 0.9;
      const v = Math.max(-8, Math.min(8, vel));
      tickerAnim.playbackRate = 1 + Math.abs(v) * (v < 0 ? -1.4 : 1);
      requestAnimationFrame(loop);
    })();
  }

  // ------------------------------------------------- gallery parallax

  const art = $('#hero-art');
  if (art && finePointer) {
    addEventListener('pointermove', (e) => {
      const nx = e.clientX / innerWidth - 0.5;
      const ny = e.clientY / innerHeight - 0.5;
      art.style.setProperty('--px', nx * -22 + 'px');
      art.style.setProperty('--py', ny * -16 + 'px');
    }, { passive: true });
  }

  // ------------------------------------------------------- card reveals

  const revealer = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      revealer.unobserve(el);
      el.classList.add('reveal');
      requestAnimationFrame(() => el.classList.remove('pre'));
      el.addEventListener('transitionend', () => el.classList.remove('reveal'), { once: true });
    }
  }, { rootMargin: '0px 0px -8% 0px' });

  const watch = (node) => {
    if (!(node instanceof HTMLElement) || !node.classList.contains('post') || node.classList.contains('pinned')) return;
    if (node.classList.contains('jelly')) {
      node.addEventListener('animationend', () => node.classList.remove('jelly'), { once: true });
      return;
    }
    // Cards already on screen just rise in; the rest wait for the scroll.
    node.classList.add('pre');
    revealer.observe(node);
  };
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach(watch))).observe($('#feed'), { childList: true });
  new MutationObserver((muts) => muts.forEach((m) => m.addedNodes.forEach((n) => {
    if (n instanceof HTMLElement && n.classList.contains('jelly')) n.addEventListener('animationend', () => n.classList.remove('jelly'), { once: true });
  }))).observe($('#pinned'), { childList: true });
  $$('#feed .post').forEach(watch);

  // -------------------------------------------------- authenticator

  let shown = 0;
  let lastStamp = '';
  let countRaf = 0;
  document.addEventListener('slop:verdict', (e) => {
    const { score, stamp } = e.detail;
    const el = $('#score');
    const from = shown;
    const t0 = performance.now();
    cancelAnimationFrame(countRaf);
    (function step(now) {
      const p = Math.min(1, (now - t0) / 900);
      const eased = 1 - Math.pow(1 - p, 3);
      shown = Math.round(from + (score - from) * eased);
      el.textContent = shown;
      if (p < 1) countRaf = requestAnimationFrame(step);
    })(t0);

    if (stamp !== lastStamp) {
      lastStamp = stamp;
      const st = $('#stamp');
      const cert = $('#result');
      st.classList.remove('slam');
      cert.classList.remove('thud');
      void st.offsetWidth;
      st.classList.add('slam');
      cert.classList.add('thud');
    }
  });

  // ------------------------------------------------------ footer fill

  const fm = $('.footer-mark');
  if (fm) {
    new IntersectionObserver((entries) => {
      entries.forEach((e) => fm.classList.toggle('filled', e.isIntersecting));
    }, { threshold: 0.6 }).observe(fm);
  }
})();
