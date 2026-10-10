/* Slopographic home film: scroll-driven scenes that also play themselves.
 * Each scene is a tall section with a sticky stage; its progress p (0..1) is
 * how far you've scrolled through it, and a handler draws that moment. On top:
 * a goo engine (metaball slime with a springy surface you can massage),
 * velocity jelly, chromatic aberration and slime curtains between scenes.
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

  let vw = innerWidth, vh = innerHeight;
  let scrollVel = 0, lastScroll = scrollY;

  // ============================================================ goo engine
  //
  // A metaball field on a coarse grid, shaded like glossy slime and upscaled.
  // The pool surface is a row of springs, so pokes and splashes make waves.

  function makeGoo(stage, canvas, cfg) {
    const g = {
      ctx: canvas.getContext('2d'),
      off: document.createElement('canvas'),
      balls: [],
      t: 0,
      level: 0,
      m: { x: -999, y: -999, vx: 0, vy: 0, on: false, inside: false, lastT: 0 },
    };
    g.octx = g.off.getContext('2d');

    g.resize = () => {
      const r = stage.getBoundingClientRect();
      g.W = r.width;
      g.H = r.height;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(g.W * dpr);
      canvas.height = Math.round(g.H * dpr);
      g.cell = g.W * g.H > 1.6e6 ? 5 : 4;
      g.cols = Math.ceil(g.W / g.cell) + 1;
      g.rows = Math.ceil(g.H / g.cell) + 1;
      g.off.width = g.cols;
      g.off.height = g.rows;
      g.img = g.octx.createImageData(g.cols, g.rows);
      g.field = new Float32Array(g.cols * g.rows);
      g.h = new Float32Array(g.cols);
      g.v = new Float32Array(g.cols);
      g.surf = new Float32Array(g.cols);
      if (cfg.blob && !g.blob) initBlob();
    };

    // ------------------------------------------------ ze Slop Blob (optional)
    const SAYINGS = ['SLURRRP', 'SLOOOOP', 'luv ze slop', 'massage me', 'drooop', 'zlop?', 'blorp', 'U WILL LIKE ZE SLOP', 'nom'];
    let sayT = 0;
    function say(text) {
      const el = cfg.say;
      if (!el) return;
      el.textContent = text;
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
      sayT = 1.6;
    }
    function initBlob() {
      const r = clamp(Math.min(g.W, g.H) * 0.11, 46, 96);
      const b = (g.blob = { x: g.W * 0.72, y: g.H * 0.4, vx: 0, vy: 0, r, hopT: 1.4, squash: 0, sv: 0, grow: 0, grounded: false, parts: [], eatT: 0 });
      const n = 7;
      for (let k = 0; k < n; k++) {
        const a = (k / (n - 1)) * Math.PI * 2;
        const ox = k === 0 ? 0 : Math.cos(a) * r * 0.48;
        const oy = k === 0 ? 0 : Math.sin(a) * r * 0.42;
        b.parts.push({ ox, oy, x: b.x + ox, y: b.y + oy, vx: 0, vy: 0, r: k === 0 ? r * 0.78 : r * 0.42 });
      }
    }
    function updateBlob(dt) {
      const b = g.blob;
      const m = g.m;
      b.hopT -= dt;
      b.eatT -= dt;
      if (sayT > 0 && (sayT -= dt) <= 0 && cfg.say) cfg.say.classList.remove('show');
      b.vy += 1700 * dt;
      b.vx *= 1 - 1.6 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      const R = b.r * (1 + b.grow);
      if (b.x < R) { b.x = R; b.vx = Math.abs(b.vx); }
      if (b.x > g.W - R) { b.x = g.W - R; b.vx = -Math.abs(b.vx); }
      const ground = g.surf[col(b.x)] - R * 0.32;
      b.grounded = false;
      if (b.y > ground) {
        if (b.vy > 320) {
          // Landing: squash, make waves, fling a little goo.
          kick(b.x, b.vy * 0.4, R * 2.2);
          b.squash = Math.min(0.5, b.vy / 1800);
          for (let k = 0; k < 4; k++) g.drop(b.x + (Math.random() - 0.5) * R * 1.6, ground, (Math.random() - 0.5) * 420, -250 - Math.random() * 380, 6 + Math.random() * 9);
        }
        b.y = ground;
        b.vy = 0;
        b.grounded = true;
      }
      // Hop: toward food, toward you, or anywhere.
      if (b.grounded && b.hopT <= 0) {
        let tx = Math.random() * g.W;
        const food = g.balls.find((d) => d.vy > 0 && Math.abs(d.x - b.x) < 420);
        if (food) tx = food.x;
        else if (m.on && Math.random() < 0.6) tx = m.x;
        b.vx = clamp((tx - b.x) * 1.4, -460, 460);
        b.vy = -(480 + Math.random() * 520);
        b.squash = -0.35;
        b.hopT = 1.1 + Math.random() * 2.4;
      }
      // Squash and stretch on a spring.
      b.sv += (-b.squash * 150 - b.sv * 8) * dt;
      b.squash += b.sv * dt;
      b.grow *= 1 - 0.12 * dt;
      const stretchY = clamp(-b.vy / 2600, -0.25, 0.3);
      const sx = (1 + b.squash - stretchY * 0.6) * (1 + b.grow);
      const sy = (1 - b.squash + stretchY) * (1 + b.grow);
      for (const p of b.parts) {
        const tx = b.x + p.ox * sx, ty = b.y + p.oy * sy;
        p.vx += ((tx - p.x) * 240 - p.vx * 13) * dt;
        p.vy += ((ty - p.y) * 240 - p.vy * 13) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      // Slurp drops that fall into it.
      for (let k = g.balls.length - 1; k >= 0; k--) {
        const d = g.balls[k];
        if (d.vy > 0 && Math.hypot(d.x - b.x, d.y - b.y) < R * 0.95) {
          g.balls.splice(k, 1);
          b.grow = Math.min(0.4, b.grow + 0.025);
          b.squash += 0.08;
          if (b.eatT <= 0) {
            say(Math.random() < 0.7 ? 'SLURRRP' : 'nom');
            b.eatT = 2.2;
          }
        }
      }
      // Face: eyes follow you.
      if (cfg.face) {
        const lx = m.on ? clamp((m.x - b.x) / 200, -1, 1) : Math.sin(g.t * 0.7) * 0.6;
        const ly = m.on ? clamp((m.y - b.y) / 200, -1, 1) : 0.2;
        cfg.face.style.transform = `translate(${b.x}px, ${b.y - R * 0.12}px) translate(-50%, -50%) scale(${(R / 70) * sx / (1 + b.grow)}, ${(R / 70) * sy / (1 + b.grow)})`;
        cfg.face.style.setProperty('--lx', lx * 5 + 'px');
        cfg.face.style.setProperty('--ly', ly * 5 + 'px');
        cfg.face.classList.toggle('wow', !!(m.on && Math.hypot(m.x - b.x, m.y - b.y) < R * 2.4));
      }
      if (cfg.say) cfg.say.style.transform = `translate(${b.x}px, ${b.y - R * 1.5}px) translate(-50%, -100%)`;
    }
    g.poke = (x, y) => {
      const b = g.blob;
      if (!b) return false;
      const R = b.r * (1 + b.grow);
      if (Math.hypot(x - b.x, y - b.y) > R * 1.15) return false;
      b.squash = 0.55;
      b.vy = -720 - Math.random() * 300;
      b.vx = (Math.random() - 0.5) * 500;
      for (const p of b.parts) {
        p.vx += (Math.random() - 0.5) * 900;
        p.vy += (Math.random() - 0.5) * 900;
      }
      for (let k = 0; k < 10; k++) {
        const a = Math.random() * Math.PI * 2;
        g.drop(b.x + Math.cos(a) * R * 0.6, b.y + Math.sin(a) * R * 0.4, Math.cos(a) * 520, -300 - Math.random() * 600, 6 + Math.random() * 12);
      }
      say(SAYINGS[Math.floor(Math.random() * SAYINGS.length)]);
      return true;
    };

    g.drop = (x, y, vx = 0, vy = 0, r = 10 + Math.random() * 16) => {
      if (g.balls.length < 70) g.balls.push({ x, y, vx, vy, r });
    };

    const col = (x) => clamp(Math.round(x / g.cell), 0, g.cols - 1);
    const kick = (x, amount, radius = 60) => {
      const c0 = col(x - radius), c1 = col(x + radius);
      for (let i = c0; i <= c1; i++) {
        const f = 1 - Math.abs(i * g.cell - x) / radius;
        if (f > 0) g.v[i] += amount * f;
      }
    };

    // Pointer: massage the surface, poke holes, pull strands.
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const m = g.m;
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const now = performance.now();
      const dt = Math.max(8, now - m.lastT) / 1000;
      m.vx = m.on ? (x - m.x) / dt : 0;
      m.vy = m.on ? (y - m.y) / dt : 0;
      m.x = x;
      m.y = y;
      m.on = true;
      m.lastT = now;
      if (!g.cols) return;
      const s = g.surf[col(x)] || g.H;
      const near = Math.abs(y - s) < 140;
      if (near) kick(x, clamp(m.vy, -1600, 1600) * 0.35 + Math.abs(m.vx) * 0.04, 80);
      const inside = y > s;
      // Pulling up out of the goo stretches a strand of slime after you.
      if (m.inside && !inside && m.vy < -250) {
        for (let k = 0; k < 5; k++) g.drop(x - m.vx * 0.01 * k, s - k * 14, m.vx * 0.15, m.vy * (0.35 - k * 0.05), 22 - k * 3);
      }
      m.inside = inside;
    });
    stage.addEventListener('pointerleave', () => (g.m.on = false));
    stage.addEventListener('pointerdown', (e) => {
      const r = stage.getBoundingClientRect();
      const x = e.clientX - r.left;
      if (g.poke(x, e.clientY - r.top)) return;
      kick(x, 900, 110);
      for (let k = 0; k < 6; k++) g.drop(x + (Math.random() - 0.5) * 60, (g.surf[col(x)] || g.H) - 10, (Math.random() - 0.5) * 300, -500 - Math.random() * 500, 8 + Math.random() * 12);
    });

    g.frame = (dt, p) => {
      if (!g.cols) return;
      g.t += dt;
      const target = cfg.level(p);
      g.level += (target - g.level) * Math.min(1, dt * 3.5);
      const base = g.H * (1 - g.level);
      const { cols, rows, cell, field, h, v, surf } = g;

      // Springy surface: two substeps of a damped wave equation.
      for (let step = 0; step < 2; step++) {
        const sdt = dt / 2;
        for (let i = 0; i < cols; i++) {
          const lap = (i > 0 ? h[i - 1] : h[i]) + (i < cols - 1 ? h[i + 1] : h[i]) - 2 * h[i];
          v[i] += (lap * 1400 - h[i] * 9 - v[i] * 2.6) * sdt;
        }
        for (let i = 0; i < cols; i++) h[i] = clamp(h[i] + v[i] * sdt, -base + 20, g.H * 0.5);
      }
      const amb = cfg.ambient || 0;
      for (let i = 0; i < cols; i++) {
        const x = i * cell;
        surf[i] = base + h[i] + (Math.sin(x * 0.011 + g.t * 1.4) * 7 + Math.sin(x * 0.027 - g.t * 2.1) * 4) * amb;
      }

      // Rain / stream from the config.
      const rain = cfg.rain ? cfg.rain(p) : 0;
      if (rain && Math.random() < rain * dt) g.drop(Math.random() * g.W, -40, 0, 100);
      const stream = cfg.stream ? cfg.stream(p, g.t) : null;

      // Balls fall, and splash when they land.
      for (let k = g.balls.length - 1; k >= 0; k--) {
        const b = g.balls[k];
        b.vy += 1500 * dt;
        b.vx *= 0.99;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        const s = surf[col(b.x)];
        if (b.y > s + b.r * 0.4 && b.vy > 0) {
          kick(b.x, b.vy * 0.18 * (b.r / 20), 40 + b.r * 2);
          if (b.r > 13 && b.vy > 500 && Math.random() < 0.6) {
            g.drop(b.x - 6, s - 6, -120 - Math.random() * 120, -b.vy * 0.28, b.r * 0.4);
            g.drop(b.x + 6, s - 6, 120 + Math.random() * 120, -b.vy * 0.25, b.r * 0.35);
          }
          g.balls.splice(k, 1);
        } else if (b.x < -100 || b.x > g.W + 100) g.balls.splice(k, 1);
      }

      if (g.blob) updateBlob(dt);
      const parts = g.blob ? g.blob.parts : [];

      // Field: pool term everywhere, then each blob only adds to its own
      // neighbourhood (beyond ~6 radii its contribution is negligible).
      const m = g.m.on ? g.m : null;
      const ms = m ? surf[col(m.x)] : 0;
      for (let j = 0; j < rows; j++) {
        const y = j * cell;
        const row = j * cols;
        for (let i = 0; i < cols; i++) {
          const d = y - surf[i];
          field[row + i] = d < -140 ? 0 : d < 0 ? Math.exp(d / 18) : Math.min(4, 1 + d / 26);
        }
      }
      const splat = (bx, by, r, reach) => {
        const i0 = Math.max(0, Math.floor((bx - reach) / cell)), i1 = Math.min(cols - 1, Math.ceil((bx + reach) / cell));
        const j0 = Math.max(0, Math.floor((by - reach) / cell)), j1 = Math.min(rows - 1, Math.ceil((by + reach) / cell));
        const r2 = r * r;
        for (let j = j0; j <= j1; j++) {
          const dy = j * cell - by;
          const row = j * cols;
          for (let i = i0; i <= i1; i++) {
            const dx = i * cell - bx;
            field[row + i] += r2 / (dx * dx + dy * dy + 1);
          }
        }
      };
      const balls = g.balls;
      for (let k = 0; k < balls.length; k++) {
        const b = balls[k];
        if (b.y > -b.r * 6) splat(b.x, b.y, b.r, Math.min(320, b.r * 6));
      }
      for (let k = 0; k < parts.length; k++) splat(parts[k].x, parts[k].y, parts[k].r, Math.min(360, parts[k].r * 6));
      if (stream) {
        const reach = stream.w * 7;
        for (let j = 0; j < rows; j++) {
          const y = j * cell;
          const sx = stream.x + Math.sin(y * 0.02 + g.t * 3) * 6;
          const i0 = Math.max(0, Math.floor((sx - reach) / cell)), i1 = Math.min(cols - 1, Math.ceil((sx + reach) / cell));
          const w2 = stream.w * stream.w;
          for (let i = i0; i <= i1; i++) {
            if (y > surf[i] + 30) continue;
            const dx = i * cell - sx;
            field[j * cols + i] += w2 / (dx * dx + 1);
          }
        }
      }
      if (m) {
        if (m.y < ms) {
          // Hovering just above: the slime reaches up for you.
          const pull = clamp(1 - (ms - m.y) / 170);
          if (pull > 0) splat(m.x, m.y, Math.sqrt(1400 * pull), 260);
        } else {
          // Poking in: a dimple follows your finger.
          const reach = 150;
          const i0 = Math.max(0, Math.floor((m.x - reach) / cell)), i1 = Math.min(cols - 1, Math.ceil((m.x + reach) / cell));
          const j0 = Math.max(0, Math.floor((m.y - reach) / cell)), j1 = Math.min(rows - 1, Math.ceil((m.y + reach) / cell));
          for (let j = j0; j <= j1; j++) {
            const dy = j * cell - m.y;
            for (let i = i0; i <= i1; i++) {
              const dx = i * cell - m.x;
              field[j * cols + i] -= 2.4 * Math.exp(-(dx * dx + dy * dy) / 3200);
            }
          }
        }
      }
      // Clamp so deep insides shade flat instead of blotchy.
      for (let q = 0; q < field.length; q++) if (field[q] > 2.6) field[q] = 2.6;

      // Shade like glossy slime: lit from the top-left, with a hot specular.
      const dd = g.img.data;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const idx = j * cols + i;
          const f = field[idx];
          const o = idx * 4;
          if (f < 0.9) { dd[o + 3] = 0; continue; }
          const gx = field[idx + (i < cols - 1 ? 1 : 0)] - field[idx - (i > 0 ? 1 : 0)];
          const gy = field[idx + (j < rows - 1 ? cols : 0)] - field[idx - (j > 0 ? cols : 0)];
          let nx = -gx, ny = -gy, nz = 0.9;
          const len = Math.hypot(nx, ny, nz);
          nx /= len; ny /= len; nz /= len;
          const lambert = clamp(nx * -0.5 + ny * -0.6 + nz * 0.62);
          const spec = Math.pow(clamp(nx * -0.35 + ny * -0.45 + nz * 0.82), 28);
          const rim = 1 - clamp((f - 1) / 1.6);
          const k = 0.62 + 0.5 * lambert - 0.18 * rim;
          dd[o] = Math.min(255, 212 * k + spec * 255);
          dd[o + 1] = Math.min(255, 255 * k + spec * 255);
          dd[o + 2] = Math.min(255, 58 * k + spec * 255);
          dd[o + 3] = 255 * clamp((f - 0.9) / 0.2);
        }
      }
      g.octx.putImageData(g.img, 0, 0);
      const c = g.ctx;
      c.setTransform(canvas.width / g.W, 0, 0, canvas.height / g.H, 0, 0);
      c.clearRect(0, 0, g.W, g.H);
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'medium';
      c.drawImage(g.off, 0, 0, cols * cell, rows * cell);
    };
    return g;
  }

  // ======================================================== 1 · SLOOOOOP

  const N_O = 22;
  const s1 = $('.s-stretch', home);
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
  const massage = $('.massage', home);
  const m1 = { fs: 0, oW: 0, rest: 0 };
  const face = document.createElement('div');
  face.className = 'blob-face';
  face.setAttribute('aria-hidden', 'true');
  face.innerHTML = '<i class="eye"><b></b></i><i class="eye"><b></b></i><i class="mouth"></i>';
  const bubble = document.createElement('div');
  bubble.className = 'blob-say';
  bubble.setAttribute('aria-live', 'polite');
  $('.stage', s1).append(face, bubble);
  const pool = makeGoo($('.stage', s1), $('.hero-goo', home), {
    level: (p) => 0.3 + 0.08 * p,
    ambient: 1,
    blob: true,
    face,
    say: bubble,
  });
  let dripT = 0;

  function measureStretch() {
    word.style.fontSize = '100px';
    obox.style.width = '';
    const lts = $$('.lt', word);
    const rest = lts.reduce((a, l) => a + l.getBoundingClientRect().width, 0);
    const oW = oCopies[0].getBoundingClientRect().width;
    // "SLOP" fills ~88% of the width at rest, without getting taller than the screen allows.
    const fs = Math.min((0.88 * vw * 100) / (rest + oW), 0.7 * vh);
    word.style.fontSize = fs + 'px';
    m1.fs = fs;
    m1.oW = (oW * fs) / 100;
    m1.rest = (rest * fs) / 100;
  }

  function stretch(p, dt) {
    const margin = vw * 0.06;
    const sp = smooth(clamp(p / 0.66));
    const boxW = m1.oW * (1 + (N_O - 1) * sp);
    obox.style.width = boxW + 'px';
    const gap = (boxW - m1.oW) / (N_O - 1);
    for (let k = 1; k < N_O; k++) oCopies[k].style.transform = `translateX(${k * gap}px)`;

    // Camera: pan along the word as it grows, then pull back to show all of it.
    const total = m1.rest + boxW;
    const avail = vw - margin * 2;
    const panX = margin - Math.max(0, total - avail) * sp;
    const z = smooth(clamp((p - 0.66) / 0.18));
    const fit = Math.min(1, avail / total);
    const s = lerp(1, fit, z);
    const x = lerp(panX, (vw - total * fit) / 2, z);
    const lift = lerp(0, -12, z);
    const breathe = Math.sin(pool.t * 2.2) * 0.012;
    word.style.transform = `translate(${x}px, calc(-50% + ${lift}vh)) scale(${s * (1 - breathe)}, ${s * (1 + breathe)})`;

    subWords.forEach((w, i) => {
      const t = easeOut(clamp((p - 0.8 - i * 0.018) / 0.1));
      w.style.opacity = t;
      w.style.transform = `translateY(${(1 - t) * 70}px) rotate(${(1 - t) * (i % 2 ? 8 : -8)}deg)`;
    });
    massage.style.opacity = clamp(1 - (p - 0.6) * 5);

    // SLOOOOP DROOOOPP: slime drips off the letters into the pool.
    dripT -= dt;
    if (dripT <= 0) {
      dripT = 0.35 + Math.random() * 0.5;
      const r = word.getBoundingClientRect();
      const sr = s1.querySelector('.stage').getBoundingClientRect();
      const left = Math.max(0, r.left - sr.left), right = Math.min(vw, r.right - sr.left);
      if (right > left) pool.drop(lerp(left, right, Math.random()), r.bottom - sr.top - r.height * 0.06, 0, 40, 9 + Math.random() * 14);
    }
    pool.frame(dt, p);
  }

  // ======================================================== 2 · The pour

  const s2 = $('.s-pour', home);
  const pourOver = $('.pour-over', home);
  const pourUnder = $('.pour-under', home);
  const pour = makeGoo($('.stage', s2), $('.pour-canvas', home), {
    level: (p) => 0.06 + 0.92 * smooth(clamp((p - 0.05) / 0.75)),
    rain: (p) => (p > 0.02 && p < 0.9 ? 9 : 0),
    stream: (p, t) => (p > 0.02 && p < 0.92 ? { x: pour.W * 0.5 + Math.sin(t * 0.9) * pour.W * 0.08, w: 24 + Math.sin(t * 2.3) * 5 } : null),
    ambient: 1,
  });

  function pourFrame(p, dt) {
    pour.frame(dt, p);
    pourOver.style.opacity = clamp((pour.level - 0.55) / 0.2);
    pourOver.style.transform = `scale(${lerp(1.15, 1, clamp((pour.level - 0.55) / 0.3))})`;
    pourUnder.style.transform = `translateY(${-p * 8}vh)`;
  }

  // ===================================================== 3 · Kinetic type

  const rows = $$('.s-kinetic .row', home).map((el) => ({ el, dir: +el.dataset.dir, speed: +el.dataset.speed }));
  const badge = $('.badge-spin', home);
  const badgeSvg = $('svg', badge);
  let skew = 0;

  function kinetic(p, dt, t) {
    skew += (clamp(scrollVel * 0.3, -16, 16) - skew) * 0.12;
    rows.forEach((r, i) => {
      const w = r.el.scrollWidth;
      const travel = Math.max(0, w - vw * 1.2);
      const x = r.dir < 0 ? -p * travel * r.speed * 0.7 : -travel * 0.7 + p * travel * r.speed * 0.6;
      const wave = Math.sin(t * 2.4 + i * 1.3) * 10;
      r.el.style.transform = `translate(${x}px, ${wave}px) skewX(${r.dir * skew}deg)`;
    });
    badgeSvg.style.transform = `rotate(${p * 540 + t * 30}deg)`;
    const pulse = 1 + Math.sin(t * 5) * 0.04 + Math.abs(skew) * 0.01;
    badge.style.transform = `scale(${pulse})`;
  }

  // =========================================================== 4 · Rooms

  const gallery = {
    scene: $('.s-gallery', home),
    track: $('.g-track', home),
    bar: $('.g-progress i', home),
    pieces: [],
  };
  const ROOMS = [
    { href: 'paint/', no: '01', title: 'Slop Paint', desc: 'MS Paint, but sexy. Draw ze slop, save ze slop.', art: 'paint' },
    { href: 'fluid/', no: '02', title: 'Ze Slop Tank', desc: 'Ten litres of virtual goo. Stir it with your hands.', art: 'tank' },
    { href: 'cards/', no: '03', title: 'Slop Shots', desc: 'Holographic fractal slop cards. You own nothing. It’s beautiful.', art: 'cards' },
    { href: 'annoying/', no: '04', title: 'Unsubscribe', desc: 'Try to leave ze Maison. We dare you.', art: 'unsub' },
    { href: '#detector', no: '05', title: 'Ze Authenticator', desc: 'Is your text secretly slop? Get it certified.', art: 'auth' },
  ];
  const ART = {
    paint: `<div class="ra-win"><div class="ra-title"><span>untitled - Slop Paint</span><i></i></div>
      <svg viewBox="0 0 200 130" class="ra-draw"><path d="M18 96 C 40 20, 70 20, 82 70 S 130 120, 150 50 S 185 30, 188 90" /><circle cx="60" cy="98" r="14"/><rect x="120" y="82" width="40" height="28"/></svg></div>`,
    tank: `<div class="ra-tank"><i></i><i></i><i></i><i></i></div>`,
    cards: `<div class="ra-card"><div class="ra-holo"></div><span>MYTHIC</span><b>Shrimp Christ, Ascended</b><em>#0042 / 1,000,000,000</em></div>`,
    unsub: `<div class="ra-unsub"><p>Are you sure you want to leave ze slop?</p><button tabindex="-1">Unsubscribe</button><button tabindex="-1" class="keep">Keep my slop</button></div>`,
    auth: `<div class="ra-auth"><span>Genuine<br>Slop</span></div>`,
  };

  function buildRooms() {
    gallery.track.textContent = '';
    for (const r of ROOMS) {
      const a = document.createElement('a');
      a.className = 'room';
      a.href = r.href;
      a.innerHTML = `<div class="room-art art-${r.art}" aria-hidden="true">${ART[r.art]}</div>
        <div class="room-cap"><span class="room-no">Room ${r.no}</span><b>${r.title}</b><span class="room-desc">${r.desc}</span><span class="room-go">Enter →</span></div>`;
      gallery.track.append(a);
    }
    gallery.pieces = [...gallery.track.children];
  }
  buildRooms();

  function sizeGallery() {
    if (reduce) return;
    gallery.travel = Math.max(0, gallery.track.scrollWidth - vw);
    gallery.scene.style.height = vh + gallery.travel * 1.1 + 'px';
  }

  function galleryFrame(p, dt, t) {
    gallery.track.style.transform = `translate3d(${-p * gallery.travel}px, -50%, 0)`;
    gallery.pieces.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const off = (r.left + r.width / 2 - vw / 2) / vw;
      const float = Math.sin(t * 1.6 + i) * 8;
      el.style.transform = `translateY(${float}px) rotateY(${clamp(off * -38, -40, 40)}deg) translateZ(${-Math.abs(off) * 140}px) rotate(${off * 5}deg)`;
    });
    gallery.bar.style.width = p * 100 + '%';
  }

  // ======================================================= 5 · Manifesto

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

  // Floating chrome goo blobs in the darker scenes.
  const blobs = [];
  for (const st of [$('.s-manifesto .stage', home), $('.s-gallery .stage', home)]) {
    for (let k = 0; k < 3; k++) {
      const b = document.createElement('i');
      b.className = 'chrome-blob';
      b.style.setProperty('--s', 80 + Math.random() * 160 + 'px');
      st.prepend(b);
      blobs.push({ el: b, x: Math.random(), y: Math.random(), ph: Math.random() * 6.28, sp: 0.2 + Math.random() * 0.3 });
    }
  }
  function blobFrame(t) {
    for (const b of blobs) {
      const x = (b.x + Math.sin(t * b.sp + b.ph) * 0.12) * vw;
      const y = (b.y + Math.cos(t * b.sp * 0.8 + b.ph) * 0.1) * vh - scrollVel * 4;
      const sq = 1 + Math.sin(t * 2 + b.ph) * 0.08;
      b.el.style.transform = `translate(${x}px, ${y}px) scale(${sq}, ${2 - sq})`;
    }
  }

  // ========================================================= 6 · Counter

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

  // ========================================================== 7 · Finale

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
  function finaleFrame(p, dt, t) {
    fLetters.forEach((l, i) => {
      const local = clamp((p * 1.5 - i * 0.07) / 0.45);
      const y = (1 - bounce(local)) * -110;
      const idle = local >= 1 ? Math.sin(t * 3 + i * 0.7) * 0.06 : 0;
      l.style.transform = `translateY(${y}vh) rotate(${(1 - local) * (i % 2 ? 25 : -25)}deg) scale(${1 + idle}, ${1 - idle})`;
    });
    fCta.style.opacity = clamp((p - 0.62) / 0.15);
  }

  // ===================================================== global sloppiness

  // Jelly: every stage wobbles with scroll speed and keeps wobbling after.
  const jel = { x: 0, v: 0 };
  let lastCa = '';
  const curtain = document.createElement('div');
  curtain.className = 'curtain';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.innerHTML = `<svg viewBox="0 0 1200 140" preserveAspectRatio="none" class="c-top"><path d="M0 140V60C40 60 50 0 90 0S140 70 200 70 260 10 330 10 400 90 450 90 520 30 600 30 660 110 720 110 790 20 860 20 930 80 990 80 1050 5 1110 5 1170 60 1200 60V140Z"/></svg><div class="c-body"></div><svg viewBox="0 0 1200 160" preserveAspectRatio="none" class="c-bot"><path d="M0 0H1200V30C1160 30 1150 90 1120 90S1090 30 1040 30 980 140 940 140 900 34 840 34 790 76 760 76 720 24 650 24 600 120 560 120 520 32 460 32 410 84 380 84 340 26 280 26 230 150 190 150 150 36 100 36 60 70 40 70 20 30 0 30Z"/></svg>`;
  home.append(curtain);

  function globalFx(dt, visibleStages) {
    const target = clamp(scrollVel * 0.14, -8, 8);
    jel.v += ((target - jel.x) * 190 - jel.v * 11) * dt;
    jel.x += jel.v * dt;
    const j = jel.x;
    const jt = Math.abs(j) < 0.02 && Math.abs(jel.v) < 0.05 ? '' : `skewY(${(j * 0.35).toFixed(3)}deg) scaleY(${(1 + Math.abs(j) * 0.01).toFixed(4)})`;
    for (const st of visibleStages) if (st.style.transform !== jt) st.style.transform = jt;
    const ca = clamp(Math.abs(j) * 1.1, 0, 7);
    const caStr = ca < 0.15 ? '0' : ca.toFixed(1);
    if (caStr !== lastCa) {
      lastCa = caStr;
      document.documentElement.style.setProperty('--ca', caStr);
    }

    // Slime curtain sweeps down while the next scene comes up.
    let q = -1;
    for (let k = 1; k < scenes.length; k++) {
      const top = scenes[k].el.getBoundingClientRect().top;
      if (top > 0 && top < vh) q = 1 - top / vh;
    }
    if (q < 0) {
      curtain.style.visibility = 'hidden';
    } else {
      curtain.style.visibility = 'visible';
      curtain.style.transform = `translateY(${lerp(-125, 105, q)}vh)`;
    }
  }

  // ========================================================= autoplay

  // The film plays itself: each scene gets a director's pace (seconds to
  // scroll through it). Any wheel, touch or key hands control to the viewer.
  const PACE = { stretch: 8, pour: 7, kinetic: 5.5, gallery: 10, manifesto: 7, finale: 4.5 };
  const chip = $('.autoplay', home);
  const auto = { on: false, pos: 0, hold: 0 };

  function setAuto(on) {
    auto.on = on;
    auto.pos = scrollY;
    auto.hold = on ? 1.6 : 0;
    chip.hidden = false;
    chip.setAttribute('aria-pressed', String(on));
    chip.querySelector('.ap-label').textContent = on ? 'Playing ze film' : 'Play ze film';
  }

  function autoSpeed() {
    for (const s of scenes) {
      const top = s.el.offsetTop, len = s.el.offsetHeight - vh;
      if (auto.pos < top + len - 1) {
        if (auto.pos < top) return Math.max(vh * 1.2, (top - auto.pos) * 2.5);
        return Math.max(60, len / (PACE[s.el.dataset.scene] || 6));
      }
    }
    return vh * 0.6;
  }

  function autoStep(dt) {
    if (!auto.on) return;
    if (auto.hold > 0) {
      auto.hold -= dt;
      return;
    }
    const end = document.documentElement.scrollHeight - vh;
    auto.pos = Math.min(end, auto.pos + autoSpeed() * dt);
    window.scrollTo({ top: auto.pos, behavior: 'instant' });
    if (auto.pos >= end - 1) setAuto(false);
  }

  const takeOver = () => auto.on && setAuto(false);
  addEventListener('wheel', takeOver, { passive: true });
  addEventListener('touchstart', (e) => {
    if (!e.target.closest('.autoplay, .hero-goo, .s-stretch .stage, .s-pour .stage')) takeOver();
  }, { passive: true });
  addEventListener('touchmove', takeOver, { passive: true });
  addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key) && !e.target.closest('.autoplay')) takeOver();
  });
  chip.addEventListener('click', () => {
    if (auto.on) return setAuto(false);
    if (scrollY >= document.documentElement.scrollHeight - vh - 2) window.scrollTo({ top: 0, behavior: 'instant' });
    setAuto(true);
  });
  document.addEventListener('slop:view', (e) => {
    if (e.detail !== 'home') {
      auto.on = false;
      chip.hidden = true;
    }
  });

  // =========================================================== engine

  const handlers = { stretch, pour: pourFrame, kinetic, gallery: galleryFrame, manifesto: manifestoFrame, finale: finaleFrame };
  const scenes = $$('.scene', home).map((el) => ({ el, stage: $('.stage', el), fn: handlers[el.dataset.scene] }));

  function progress(el) {
    const r = el.getBoundingClientRect();
    const span = r.height - vh;
    return { p: span > 0 ? clamp(-r.top / span) : r.top <= 0 ? 1 : 0, on: r.bottom > 0 && r.top < vh };
  }

  function layout() {
    vw = innerWidth;
    vh = innerHeight;
    measureStretch();
    pool.resize();
    pour.resize();
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
    autoStep(dt);
    const t = now / 1000;
    const visible = [];
    for (const s of scenes) {
      const { p, on } = progress(s.el);
      if (!on) continue;
      visible.push(s.stage);
      s.fn(p, dt, t);
    }
    blobFrame(t);
    globalFx(dt, visible);
  }

  function renderStatic() {
    // Reduced motion: draw each scene once at a calm, fully revealed moment.
    stretch(1, 0);
    pool.level = 0.38;
    pool.frame(0, 1);
    pour.level = 0.55;
    pourFrame(0.5, 0);
    kinetic(0.3, 0, 0);
    manifestoFrame(1);
    finaleFrame(1, 0, 0);
    curtain.style.visibility = 'hidden';
  }

  let started = false;
  function start() {
    if (started || home.hidden) return;
    started = true;
    layout();
    if (reduce) {
      renderStatic();
      return;
    }
    requestAnimationFrame(frame);
    // Play from the top as soon as you land (not if you arrived mid-page).
    setAuto(scrollY < 10);
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

  document.addEventListener('slop:ready', () => {
    if (started) layout();
    start();
  });
  document.addEventListener('slop:view', (e) => {
    if (e.detail === 'home') requestAnimationFrame(() => {
      if (!started) return start();
      layout();
      if (!reduce) setAuto(scrollY < 10);
    });
  });
  setTimeout(start, 1800);
})();
