// Sloppo, the homepage mascot. He perches on headings and cards, hops around, can be petted,
// dragged and thrown, levels up (with hats), and has an "Unleash" chaos mode with a full undo.
// Loaded from index.html as <script type="module" src="home/mascot/index.js">.
import { M, reduced, rand, listeners, navH, changed } from './state.js';
import { load, levelFor } from './store.js';
import { setup, draw, size, face, CW, CH, BASE } from './look.js';
import { step, place, hopTo, leapIn } from './motion.js';
import * as P from './perches.js';
import { bindInput, pet } from './input.js';
import { mountHud } from './hud.js';
import { setChaos, restore, act } from './chaos.js';
import { gain } from './levels.js';
import { say, placeBubble } from './fx.js';
import { count } from './journal.js';
import { count as bodyCount } from './bodies.js';
import { impact } from './blast.js';
import { line } from './lines.js';
import { tickRage, hardLanding, enrage, calmRage } from './rage.js';

function el(tag, cls, attrs = {}) {
  const n = document.createElement(tag);
  n.className = cls;
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

function build() {
  document.body.classList.add('has-sloppo');
  const layer = el('div', 'sloppo-layer');
  const m = el('div', 'sloppo', { hidden: '' });
  m.style.width = CW + 'px';
  m.style.height = CH + 'px';
  const stars = el('div', 'sloppo-stars', { 'aria-hidden': 'true' });
  stars.innerHTML = '<i>✦</i><i>✦</i><i>✦</i>';
  const bubble = el('div', 'sloppo-say', { role: 'status', 'aria-live': 'polite' });
  const hit = el('div', 'sloppo-hit', { role: 'button', tabindex: '0', 'aria-label': 'Sloppo the mascot. Press to pet him, or drag to throw him.' });
  const svg = setup(m);
  m.append(stars, bubble, hit);
  layer.append(m);
  document.body.append(layer);
  Object.assign(M, { layer, el: m, svg, hit, bubble, stars });
}

/** Size the hit box and dizzy stars to his body (he grows with each level). */
function fit() {
  const s = size();
  Object.assign(M.hit.style, { left: CW / 2 - s * 0.62 + 'px', top: BASE - s * 1.16 + 'px', width: s * 1.24 + 'px', height: s * 1.18 + 'px' });
  Object.assign(M.stars.style, { top: BASE - s * 1.2 + 'px', width: s * 1.1 + 'px', marginLeft: -s * 0.55 + 'px' });
}

/* ---------- idle chatter ---------- */
let nextChat = performance.now() + 25000;
function chatter(t) {
  if (t < nextChat) return;
  nextChat = t + 25000 + Math.random() * 25000;
  const vis = M.y > scrollY && M.y < scrollY + innerHeight;
  if (vis && M.mode === 'perched' && !M.chaos && !M.raging) say(line('idle'), 1600);
}

/* ---------- optional 3D Sloppo (three.js is only loaded when switched on) ---------- */
let r3d = null, loading = false;
async function set3d(on) {
  if (loading) return false;
  if (!on) {
    if (r3d) { r3d.dispose(); r3d = null; }
    M.is3d = false;
    M.el.classList.remove('is-3d');
    changed();
    return true;
  }
  loading = true;
  try {
    const mod = await import('./three3d.js');
    r3d = mod.create(M.el, CW, CH, BASE);
    M.is3d = true;
    M.el.classList.add('is-3d');
    M.el.insertBefore(r3d.canvas, M.stars);
  } catch (e) {
    r3d = null;                       // no WebGL: stay 2D, quietly
    M.is3d = false;
    say('2D is my best side.', 1500);
  }
  loading = false;
  changed();
  return M.is3d;
}

let last = 0;
function frame(t) {
  const dt = Math.min(0.05, Math.max(0, (t - last) / 1000));
  last = t;
  if (M.mode !== 'hidden') {
    step(dt, t);
    tickRage(dt, t);
    chatter(t);
    M.el.style.transform = `translate3d(${(M.x - CW / 2).toFixed(1)}px, ${(M.y - BASE).toFixed(1)}px, 0)`;
    if (M.y + 40 > scrollY && M.y - CH < scrollY + innerHeight) {
      if (r3d) r3d.render(M, size(), face(t), t, reduced());
      else draw(t);
    }
    M.el.classList.toggle('is-dizzy', M.mood === 'dizzy' && t < M.moodUntil);
    M.el.classList.toggle('is-held', M.mode === 'drag');
    placeBubble();
  }
  requestAnimationFrame(frame);
}

/** First appearance: onto the intro ledge (or the title), dropping in from the top. */
function spawn() {
  const first = ['.stage-ledge', '#intro-title', '.page-title']
    .map((s) => document.querySelector(s))
    .find((n) => { const r = n && P.rectOf(n); return r && P.inView(r); });
  const p = first ? { el: first, frac: 0.35 + Math.random() * 0.3 } : P.pick({ near: false });
  if (!p) { setTimeout(spawn, 800); return; }
  M.el.hidden = false;
  const pt = P.point(p);
  if (reduced()) place(p);
  else {
    M.x = pt.x;
    M.y = scrollY + navH() - 10;
    hopTo(p, { from: { x: pt.x + rand(-60, 60), y: scrollY + navH() - 10 }, high: 20 });
  }
  setTimeout(() => say(M.xp ? line('hello') : 'Hi! Pet me.', 2200), 900);
}

function boot() {
  if (window.SlopMascot) return;
  Object.assign(M, load());
  M.level = levelFor(M.xp);
  build();
  fit();
  bindInput(M.hit);
  listeners.add(fit);
  mountHud({ onUnleash: () => setChaos(!M.chaos), onRestore: restore, on3d: () => set3d(!M.is3d) });
  requestAnimationFrame((t) => { last = t; frame(t); });
  setTimeout(spawn, reduced() ? 0 : 500);
  // Debug and test hook.
  window.SlopMascot = {
    M, pet, gain, act, restore, leapIn, hopTo, face, impact, perches: P, bodies: () => bodyCount(),
    unleash: () => setChaos(true), calm: () => setChaos(false), bonk: hardLanding, enrage, calmRage, set3d,
    get level() { return M.level; }, get xp() { return M.xp; }, get hat() { return M.hat; }, get journal() { return count(); },
  };
  document.dispatchEvent(new Event('sloppo:ready'));
}

boot();
