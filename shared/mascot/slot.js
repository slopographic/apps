// The mascot slot: a profile's own mascot in place of the built-in buddy. A white-label build whose profile sets
// "mascot": { "overlay": "<folder>" } copies that folder to brand/mascot/ and turns the buddy loader (shared/buddy/boot.js)
// to this module, which has the engine's interface (start, show, toggleHud). The overlay is two ES modules:
//   brand/mascot/mascot.js   export const name ('Acme Bot'), animations (['hello', ...]), moments? ({ done: 'bounce' })
//                            export function create(el, { reduce }) -> { play(name, { loop, side }) -> Promise, dispose() }
//                            play() stops what runs and starts name; its promise settles when name ends or is cut off.
//                            loop: hold the animation (idle, a long task) until the next play. create may throw (no
//                            WebGL): the slot then shows the icon, still.
//   brand/mascot/icon.js     export const name; export function svg(size, small) -> SVG markup with width and height
//                            size (no DOM: the build also renders the favicon
//                            and the app icons from it). small: the 16 and 24 px drawing.
// The slot plays an animation for each moment (moments.js): greeting when shown, working / done / error from the page's
// busy regions (SlopFlow tiles, aria-busy), idle -> sleep after a minute without input and wake on the next one, point
// when a page asks (document event 'mascot-moment', detail { moment: 'point', target }) or at [data-mascot-point] after
// the greeting. Pages and apps may send any moment the same way. Pointer events pass through the mascot.
// Tests: tests/node/mascot-moments.test.mjs (the moment logic), tests/buddy/slot.test.html (the slot on a page).
import { animationFor, stateOf, workTracker, idleTracker, sideOf, MOMENTS } from './moments.js';

export const OVERLAY = new URL('../../brand/mascot/', import.meta.url).href;
const W = 112, H = 136;
const CSS = `.mascot-slot{position:fixed;width:${W}px;height:${H}px;pointer-events:none;transition:opacity .3s}
.mascot-slot[hidden]{display:none}.mascot-slot>*{width:100%;height:100%;display:block}
.mascot-slot .ms-icon{display:grid;place-items:end center}.mascot-slot .ms-icon svg{width:64px;height:64px}
@media print{.mascot-slot{display:none}}`;

let mod = null, inst = null, dock = null, cfg = null, visible = false, holding = null, base = OVERLAY;
const reduce = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Loads the overlay's icon module (the toggle button shows it before the mascot itself loads). */
export const loadIcon = () => import(base + 'icon.js');

/** Plays the animation for a moment, in place of the one running. Returns false when the overlay has none for it. A
 * looping animation (idle, a task still running) holds until the next moment. */
export function moment(name, detail = {}) {
  const anim = mod && inst && animationFor(name, mod);
  if (!anim || !visible) return false;
  const loop = name === 'idle' || (name === 'working' && work && work.busy > 0);
  const opts = { loop, side: detail.side || 0 };
  holding = loop ? name : null;
  try { Promise.resolve(inst.play(anim, opts)).catch(() => {}); } catch (e) { /* an overlay error never reaches the page */ }
  document.dispatchEvent(new CustomEvent('mascot-played', { detail: { moment: name, animation: anim } }));
  return true;
}

/** Points at a page element: the overlay turns towards it (side -1 left, 1 right of the mascot). */
export function point(target) {
  if (!target || !dock || !target.getBoundingClientRect) return false;
  return moment('point', { side: sideOf(dock.getBoundingClientRect(), target.getBoundingClientRect()) });
}

let work = null, idle = null, observer = null, timer = 0;
function watch() {
  work = workTracker((m) => moment(m));
  idle = idleTracker((m) => moment(m));
  const seen = (el) => { const s = stateOf(el); if (s) work.update(el, s); };
  observer = new MutationObserver((list) => { for (const r of list) if (r.type === 'attributes') seen(r.target); });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-state', 'aria-busy'] });
  const poke = () => idle.activity(Date.now());
  for (const t of ['pointerdown', 'keydown', 'wheel', 'touchstart']) addEventListener(t, poke, { passive: true, capture: true });
  timer = setInterval(() => idle.tick(Date.now()), 5000);
  document.addEventListener('mascot-moment', (e) => {
    const d = e.detail || {};
    if (d.moment === 'point') point(d.target); else if (d.moment && MOMENTS[d.moment]) moment(d.moment, d);
  });
}

/** The engine interface (shared/buddy/boot.js calls these). cfg.overlay: another overlay folder URL (tests). */
export async function start(c) {
  cfg = c || {};
  if (cfg.overlay) base = new URL(cfg.overlay, location.href).href;
  if (dock) return;
  if (!document.getElementById('mascot-slot-css')) {
    const st = document.createElement('style'); st.id = 'mascot-slot-css'; st.textContent = CSS; document.head.append(st);
  }
  dock = document.createElement('div');
  dock.className = 'mascot-slot';
  dock.setAttribute('aria-hidden', 'true');
  Object.assign(dock.style, { right: '6px', bottom: '62px', zIndex: String((cfg.z || 900) + 1) });
  dock.hidden = true;
  document.body.append(dock);
  mod = await import(base + 'mascot.js');
  try { inst = mod.create(dock, { reduce: reduce() }); } catch (e) { inst = null; }
  if (!inst) {                                    // no 3D here: the flat icon stands in
    const icon = await loadIcon().catch(() => null);
    if (icon) { const s = document.createElement('div'); s.className = 'ms-icon'; s.innerHTML = icon.svg(64, false); dock.append(s); }
  }
  dock.dataset.mascot = mod.name || '';
  watch();
}

export function show(v) {
  visible = !!v;
  if (!dock) return;
  dock.hidden = !visible;
  if (!visible) return;
  moment('greeting');
  const target = document.querySelector('[data-mascot-point]');
  if (target) setTimeout(() => point(target), 2600);
}

export function toggleHud() { /* the slot has no HUD */ }

/** For tests: the state of the slot. */
export const state = () => ({ visible, name: mod && mod.name, live: !!inst, holding, busy: work ? work.busy : 0, asleep: idle ? idle.asleep : false });
export function stop() { clearInterval(timer); if (observer) observer.disconnect(); if (inst && inst.dispose) inst.dispose(); }
