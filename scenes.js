/* Slopographic home film: seven scroll-driven scenes.
 * Each scene is a tall section with a sticky stage; its progress p (0..1)
 * is how far you've scrolled through it, and a handler draws that moment.
 */
(() => {
  'use strict';

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const bounce = (t) => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  };

  const home = $('#view-home');
  if (!home) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.documentElement.classList.add('reduce');
  const fine = matchMedia('(pointer: fine)').matches;

  let vw = innerWidth, vh = innerHeight;
  let scrollVel = 0, lastScroll = scrollY;

  // ------------------------------------------------------- 1 · SLOOOOOP

  const N_O = 22;
  const word = $('.slooop', home);
  const obox = $('.obox', word);
  const oCopies = [];
  for (let k = 0; k < N_O; k++) {
    const o = document.createElement('span');
    o.className = 'oc';
    o.textContent = 'O';
    obox.append(o);
    oCopies.push(o);
  }
  const subWords = $$('.s1-sub span', home);
  const hint = $('.scroll-hint', home);
  const m1 = { fs: 0, oW: 0, rest: 0 };

  function measureStretch() {
    word.style.fontSize = '100px';
    obox.style.width = '';
    const lts = $$('.lt', word);
    const rest = lts.reduce((a, l) => a + l.getBoundingClientRect().width, 0);
    const oW = oCopies[0].getBoundingClientRect().width;
    // "SLOP" fills ~88% of the width at rest, without getting taller than the screen allows.
    const fs = Math.min((0.88 * vw * 100) / (rest + oW), 0.62 * vh / 0.8 * 1.0, 0.75 * vh);
    word.style.fontSize = fs + 'px';
    m1.fs = fs;
    m1.oW = (oW * fs) / 100;
    m1.rest = (rest * fs) / 100;
  }

  function stretch(p) {
    const margin = vw * 0.06;
    const sp = smooth(clamp(p / 0.66));
    const boxW = m1.oW * (1 + (N_O - 1) * sp);
    obox.style.width = boxW + 'px';
    const gap = N_O > 1 ? (boxW - m1.oW) / (N_O - 1) : 0;
    for (let k = 1; k < N_O; k++) oCopies[k].style.transform = `translateX(${k * gap}px)`;

    // Camera: pan along the word as it grows, then pull back to show all of it.
    const total = m1.rest + boxW;
    const avail = vw - margin * 2;
    const panX = margin - Math.max(0, total - avail) * smooth(clamp(p / 0.66));
    const z = smooth(clamp((p - 0.66) / 0.18));
    const fit = Math.min(1, avail / total);
    const s = lerp(1, fit, z);
    const x = lerp(panX, (vw - total * fit) / 2, z);
    const wob = Math.sin(p * 40) * (1 - z) * Math.min(1, sp * 4) * 0.012;
    word.style.transform = `translate(${x}px, -50%) scale(${s}, ${s * (1 + wob)})`;

    subWords.forEach((w, i) => {
      const t = easeOut(clamp((p - 0.8 - i * 0.018) / 0.1));
      w.style.opacity = t;
      w.style.transform = `translateY(${(1 - t) * 70}px) rotate(${(1 - t) * (i % 2 ? 8 : -8)}deg)`;
    });
    hint.style.opacity = clamp(1 - p * 10);
  }

  // ------------------------------------------------------- 2 · The pour

  const pour = {
    stage: $('.s-pour .stage', home),
    cv: $('.pour-canvas', home),
    over: $('.pour-over', home),
    under: $('.pour-under', home),
    off: document.createElement('canvas'),
    balls: [],
    mouse: { x: -999, y: -999, on: false },
    t: 0,
    fill: 0,
  };
  pour.ctx = pour.cv.getContext('2d');
  pour.octx = pour.off.getContext('2d');

  function sizePour() {
    const r = pour.stage.getBoundingClientRect();
    pour.W = r.width;
    pour.H = r.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    pour.cv.width = Math.round(pour.W * dpr);
    pour.cv.height = Math.round(pour.H * dpr);
    pour.cell = pour.W * pour.H > 1.4e6 ? 6 : 5;
    pour.cols = Math.ceil(pour.W / pour.cell) + 1;
    pour.rows = Math.ceil(pour.H / pour.cell) + 1;
    pour.off.width = pour.cols;
    pour.off.height = pour.rows;
    pour.img = pour.octx.createImageData(pour.cols, pour.rows);
    pour.field = new Float32Array(pour.cols * pour.rows);
    if (!pour.balls.length) for (let i = 0; i < 26; i++) pour.balls.push(newBall(true));
  }

  function newBall(anywhere) {
    const r = 12 + Math.random() * 30;
    return {
      x: Math.random() * (pour.W || vw),
      y: anywhere ? -Math.random() * (pour.H || vh) : -r * 2 - Math.random() * 200,
      r,
      vy: 0,
      ph: Math.random() * 6.28,
    };
  }

  pour.stage.addEventListener('pointermove', (e) => {
    const r = pour.stage.getBoundingClientRect();
    pour.mouse.x = e.clientX - r.left;
    pour.mouse.y = e.clientY - r.top;
    pour.mouse.on = true;
  });
  pour.stage.addEventListener('pointerleave', () => (pour.mouse.on = false));

  function pourFrame(p, dt) {
    const P = pour;
    P.t += dt;
    const target = 0.06 + 0.92 * smooth(clamp((p - 0.05) / 0.75));
    P.fill += (target - P.fill) * Math.min(1, dt * 4);
    const level = P.H * (1 - P.fill);
    const pouring = p > 0.02 && p < 0.92;
    const streamW = pouring ? 22 + 16 * Math.sin(P.t * 2.3) * 0.3 : 0;
    const sx = P.W * 0.5 + Math.sin(P.t * 0.9) * P.W * 0.08;

    for (const b of P.balls) {
      b.vy = Math.min(b.vy + 1100 * dt, 900);
      b.y += b.vy * dt;
      b.x += Math.sin(P.t * 2 + b.ph) * 0.4;
      if (b.y - b.r > level + 10) Object.assign(b, newBall(false), pouring ? {} : { y: -9999 });
    }

    const { cols, rows, cell, field } = P;
    const surf = new Float32Array(cols);
    for (let i = 0; i < cols; i++) {
      const x = i * cell;
      surf[i] = level + Math.sin(x * 0.011 + P.t * 1.4) * 9 + Math.sin(x * 0.027 - P.t * 2.1) * 5;
    }
    const balls = P.balls.filter((b) => b.y > -b.r * 3);
    const m = P.mouse.on ? P.mouse : null;
    for (let j = 0; j < rows; j++) {
      const y = j * cell;
      for (let i = 0; i < cols; i++) {
        const x = i * cell;
        let f = Math.exp((y - surf[i]) / 20);
        if (streamW && y < surf[i] + 40) {
          const dx = x - (sx + Math.sin(y * 0.02 + P.t * 3) * 6);
          f += (streamW * streamW) / (dx * dx + 1);
        }
        for (let k = 0; k < balls.length; k++) {
          const b = balls[k];
          const dx = x - b.x, dy = y - b.y;
          f += (b.r * b.r) / (dx * dx + dy * dy + 1);
        }
        if (m) {
          const dx = x - m.x, dy = y - m.y;
          f += 2600 / (dx * dx + dy * dy + 1);
        }
        field[j * cols + i] = f;
      }
    }

    // Shade it like glossy slime: lit from the top-left, with a hot specular.
    const d = P.img.data;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const idx = j * cols + i;
        const f = field[idx];
        const o = idx * 4;
        if (f < 0.9) { d[o + 3] = 0; continue; }
        const gx = field[idx + (i < cols - 1 ? 1 : 0)] - field[idx - (i > 0 ? 1 : 0)];
        const gy = field[idx + (j < rows - 1 ? cols : 0)] - field[idx - (j > 0 ? cols : 0)];
        let nx = -gx, ny = -gy, nz = 0.9;
        const len = Math.hypot(nx, ny, nz);
        nx /= len; ny /= len; nz /= len;
        const lambert = clamp(nx * -0.5 + ny * -0.6 + nz * 0.62, 0, 1);
        const spec = Math.pow(clamp(nx * -0.35 + ny * -0.45 + nz * 0.82, 0, 1), 28);
        const rim = 1 - clamp((f - 1) / 1.6);
        const k = 0.62 + 0.5 * lambert - 0.18 * rim;
        d[o] = Math.min(255, 212 * k + spec * 255);
        d[o + 1] = Math.min(255, 255 * k + spec * 255);
        d[o + 2] = Math.min(255, 58 * k + spec * 255);
        d[o + 3] = 255 * clamp((f - 0.9) / 0.2);
      }
    }
    P.octx.putImageData(P.img, 0, 0);
    const c = P.ctx;
    c.setTransform(P.cv.width / P.W, 0, 0, P.cv.height / P.H, 0, 0);
    c.clearRect(0, 0, P.W, P.H);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = 'high';
    c.drawImage(P.off, 0, 0, cols * cell, rows * cell);

    P.over.style.opacity = clamp((P.fill - 0.55) / 0.2);
    P.over.style.transform = `scale(${lerp(1.15, 1, clamp((P.fill - 0.55) / 0.3))})`;
    P.under.style.transform = `translateY(${-p * 8}vh)`;
  }

  // ---------------------------------------------------- 3 · Kinetic type

  const rows = $$('.s-kinetic .row', home).map((el) => ({ el, dir: +el.dataset.dir, speed: +el.dataset.speed }));
  const badge = $('.badge-spin svg', home);
  let skew = 0;

  function kinetic(p, t) {
    skew += (clamp(scrollVel * 0.25, -14, 14) - skew) * 0.12;
    for (const r of rows) {
      const w = r.el.scrollWidth;
      const travel = Math.max(0, w - vw * 1.2);
      const x = r.dir < 0 ? -p * travel * r.speed * 0.7 : -travel * 0.7 + p * travel * r.speed * 0.6;
      r.el.style.transform = `translateX(${x}px) skewX(${r.dir * skew}deg)`;
    }
    badge.style.transform = `rotate(${p * 540 + t * 25}deg)`;
  }

  // -------------------------------------------------------- 4 · Gallery

  const gallery = {
    scene: $('.s-gallery', home),
    track: $('.g-track', home),
    bar: $('.g-progress i', home),
    pieces: [],
    built: false,
  };
  const SPECS = [
    { genre: 'facebook', seed: 200, title: 'Untitled (Amen?)', medium: 'Emoji on canvas' },
    { genre: 'youtube', title: 'Day 365 (Shocking)', medium: 'Clickbait, mixed' },
    { genre: 'quote', title: 'Vibe & Tribe', medium: 'Sunset on algorithm' },
    { genre: 'amazon', title: 'Unisex Object, Upgraded', medium: 'Listing on white' },
    { genre: 'facebook', title: 'Made of Bread (Nobody Liked It)', medium: 'Emoji on canvas' },
    { genre: 'youtube', title: 'Gone Wrong', medium: 'Thumbnail, mixed' },
    { genre: 'quote', title: 'Normalize Normalizing', medium: 'Sunset on algorithm' },
    { genre: 'amazon', title: 'Gift for Enemies', medium: 'Listing on white' },
  ];

  function buildGallery() {
    const UI = window.SlopUI, S = window.Slop;
    if (!UI || gallery.built) return;
    gallery.built = true;
    gallery.track.textContent = '';
    for (const spec of SPECS) {
      const post = S.generate(spec.genre, spec.seed || UI.randSeed(), 1);
      const fig = document.createElement('figure');
      fig.className = 'g-piece';
      const img = document.createElement('img');
      img.src = UI.imageURL(post);
      img.alt = `${spec.title}: a generated ${spec.medium.toLowerCase()} piece`;
      img.decoding = 'async';
      const cap = document.createElement('figcaption');
      const a = document.createElement('span');
      const b = document.createElement('b');
      b.textContent = spec.title;
      a.append(b, document.createTextNode(', 2026'));
      const n = document.createElement('span');
      n.textContent = UI.pieceNo(post);
      cap.append(a, n);
      fig.append(img, cap);
      gallery.track.append(fig);
    }
    const end = document.createElement('a');
    end.className = 'g-end';
    end.href = '#feed';
    end.innerHTML = 'Enter ze collection →<small>Infinite pieces. One of none.</small>';
    gallery.track.append(end);
    gallery.pieces = [...gallery.track.children];
    sizeGallery();
  }

  function sizeGallery() {
    if (!gallery.built || reduce) return;
    gallery.travel = Math.max(0, gallery.track.scrollWidth - vw);
    gallery.scene.style.height = vh + gallery.travel * 1.1 + 'px';
  }

  function galleryFrame(p) {
    if (!gallery.built) return;
    const x = -p * gallery.travel;
    gallery.track.style.transform = `translate3d(${x}px, -50%, 0)`;
    for (const el of gallery.pieces) {
      const r = el.getBoundingClientRect();
      const off = (r.left + r.width / 2 - vw / 2) / vw;
      el.style.transform = `rotateY(${clamp(off * -38, -40, 40)}deg) translateZ(${-Math.abs(off) * 120}px) rotate(${off * 4}deg)`;
    }
    gallery.bar.style.width = p * 100 + '%';
  }

  // ------------------------------------------------------ 5 · Manifesto

  const manifesto = $('.manifesto', home);
  const KEY = new Set(['slop', 'slop,', 'slop.', 'ze', 'happy.', 'infinitely.']);
  const mWords = [];
  {
    const text = manifesto.textContent.trim();
    manifesto.textContent = '';
    text.split(/\s+/).forEach((w, i, all) => {
      const s = document.createElement('span');
      s.className = 'w' + (KEY.has(w.toLowerCase()) ? ' key' : '');
      s.textContent = w;
      manifesto.append(s);
      if (i < all.length - 1) manifesto.append(' ');
      mWords.push(s);
    });
  }
  let litCount = -1;
  function manifestoFrame(p) {
    const lit = Math.floor(clamp((p - 0.05) / 0.8) * mWords.length + 0.0001);
    if (lit === litCount) return;
    litCount = lit;
    mWords.forEach((w, i) => w.classList.toggle('on', i < lit));
  }

  // -------------------------------------------------------- 6 · Counter

  const odo = $('#odometer');
  let odoStr = '';
  let odoLive = false;
  function setOdometer(value) {
    const str = value.toLocaleString('en-US');
    if (str.length !== odoStr.length) {
      odo.textContent = '';
      for (const ch of str) {
        if (/\d/.test(ch)) {
          const dg = document.createElement('span');
          dg.className = 'dg';
          const strip = document.createElement('span');
          for (let d = 0; d <= 9; d++) {
            const b = document.createElement('b');
            b.textContent = d;
            strip.append(b);
          }
          dg.append(strip);
          odo.append(dg);
        } else {
          const sep = document.createElement('span');
          sep.className = 'sep';
          sep.textContent = ch;
          odo.append(sep);
        }
      }
    }
    odoStr = str;
    const strips = $$('.dg > span', odo);
    let k = 0;
    for (const ch of str) {
      if (!/\d/.test(ch)) continue;
      strips[k++].style.transform = `translateY(${-+ch}em)`;
    }
    odo.setAttribute('aria-label', `${str} slops served`);
  }
  setOdometer(0);
  new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting) && !odoLive) {
      odoLive = true;
      const tick = () => window.SlopUI && setOdometer(window.SlopUI.served());
      tick();
      setInterval(tick, 900);
    }
  }).observe(odo);

  // --------------------------------------------------------- 7 · Finale

  const finale = $('.finale-word', home);
  const fLetters = [];
  for (const ch of 'Luv ze slop') {
    const s = document.createElement('span');
    if (ch === ' ') {
      s.className = 'gap';
    } else {
      s.className = 'fl';
      s.textContent = ch;
      fLetters.push(s);
    }
    finale.append(s);
  }
  const fCta = $('.finale-cta', home);
  function finaleFrame(p, t) {
    fLetters.forEach((l, i) => {
      const local = clamp((p * 1.5 - i * 0.07) / 0.45);
      const y = (1 - bounce(local)) * -110;
      const idle = local >= 1 ? Math.sin(t * 3 + i * 0.7) * 0.04 : 0;
      l.style.transform = `translateY(${y}vh) rotate(${(1 - local) * (i % 2 ? 25 : -25)}deg) scale(${1 + idle}, ${1 - idle})`;
    });
    fCta.style.opacity = clamp((p - 0.62) / 0.15);
  }

  // ------------------------------------------------------------- engine

  const handlers = { stretch, pour: pourFrame, kinetic, gallery: galleryFrame, manifesto: manifestoFrame, finale: finaleFrame };
  const scenes = $$('.scene', home).map((el) => ({ el, fn: handlers[el.dataset.scene] }));

  function progress(el) {
    const r = el.getBoundingClientRect();
    const span = r.height - vh;
    return { p: span > 0 ? clamp(-r.top / span) : r.top <= 0 ? 1 : 0, on: r.bottom > 0 && r.top < vh };
  }

  function layout() {
    vw = innerWidth;
    vh = innerHeight;
    measureStretch();
    sizePour();
    sizeGallery();
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    scrollVel = scrollVel * 0.85 + (scrollY - lastScroll) * 0.15;
    lastScroll = scrollY;
    if (home.hidden) return;
    const t = now / 1000;
    for (const s of scenes) {
      const { p, on } = progress(s.el);
      if (on) s.fn(p, s.fn === pourFrame ? dt : t);
    }
  }

  function renderStatic() {
    // Reduced motion: draw each scene once at a calm, fully-revealed moment.
    stretch(1);
    pour.fill = 0.55;
    pourFrame(0.5, 0);
    kinetic(0.3, 0);
    manifestoFrame(1);
    finaleFrame(1, 0);
  }

  let started = false;
  function start() {
    if (started || home.hidden) return;
    started = true;
    layout();
    buildGallery();
    if (reduce) {
      renderStatic();
      return;
    }
    requestAnimationFrame(frame);
  }

  let resizeT = 0;
  addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      if (!started) return;
      layout();
      if (reduce) renderStatic();
    }, 120);
  });

  // Wait for the web fonts (measurements depend on them) and for the home view.
  document.addEventListener('slop:ready', () => {
    if (started) layout();
    start();
  });
  document.addEventListener('slop:view', (e) => {
    if (e.detail === 'home') requestAnimationFrame(() => (started ? layout() : start()));
  });
  setTimeout(start, 1800);
})();
