// Chaos actions: bite cards, eat letters, knock cards off the page, splat goo.
// Each one records how to undo itself in the journal. Each takes the chaos token and
// returns true if it did something.
import { M, reduced, sleep, rand, clamp, pick, setMood, navH } from './state.js';
import * as P from './perches.js';
import { hopTo } from './motion.js';
import { size } from './look.js';
import { record, keepStyle } from './journal.js';
import { crumbs, say, gooSVG } from './fx.js';
import { gain } from './levels.js';

const ok = (tok) => tok === M.token && M.mode === 'perched';
const wait = (ms) => sleep(reduced() ? 0 : ms);
const isCard = (el) => el.dataset.perch === 'card';
const bites = new WeakMap();   // card -> mask layers
const wrapped = new WeakMap(); // heading -> letter spans
const eaten = new WeakSet();

/** Hop onto a perch chosen by filter. */
async function goTo(filter, tok) {
  const p = P.pick({ filter });
  if (!p) return null;
  if (M.perch && M.perch.el === p.el) return p;
  return (await hopTo(p)) && ok(tok) ? p : null;
}

/* ---------- bite a card ---------- */
export async function bite(tok) {
  const p = await goTo((el) => isCard(el) && (bites.get(el) || []).length < 18, tok);
  if (!p) return false;
  for (let i = 0; i < 2; i++) {
    setMood('chomp', 300);
    M.squash = -0.35;
    await wait(170);
    if (!ok(tok)) return false;
    M.squash = 0.6;
    biteAt(p.el, M.x - scrollX + (i ? rand(-22, 22) : 0));
    await wait(260);
  }
  gain(1, { source: 'chaos' });
  return true;
}
function biteAt(card, clientX) {
  const r = card.getBoundingClientRect(), R = size() * 0.27;
  const x = clamp(clientX - r.left, R, r.width - R);
  const list = bites.get(card) || [];
  const hole = (cx, cy, rr) => `radial-gradient(circle at ${cx.toFixed(1)}px ${cy.toFixed(1)}px, transparent ${rr.toFixed(1)}px, #000 ${(rr + 0.8).toFixed(1)}px)`;
  const layers = [hole(x, R * 0.2, R), hole(x - R * 0.85, R * 0.45, R * 0.5), hole(x + R * 0.85, R * 0.45, R * 0.5)];
  keepStyle(card);
  list.push(...layers);
  bites.set(card, list);
  record(() => { list.length -= layers.length; });
  card.style.setProperty('mask-image', list.join(', '));
  card.style.setProperty('mask-composite', list.map(() => 'intersect').join(', '));
  card.style.setProperty('-webkit-mask-image', list.join(', '));
  crumbs(r.left + scrollX + x, r.top + scrollY + R * 0.4, '#1d1d1d');
}

/* ---------- eat letters from a heading ---------- */
// Headings keep at least one letter, so there is always something to stand on.
const edible = (el) => /^H[12]$/.test(el.tagName) && (!wrapped.has(el) || wrapped.get(el).filter((s) => !eaten.has(s)).length > 1);
export async function eat(tok) {
  const p = await goTo(edible, tok);
  if (!p) return false;
  const left = wrap(p.el).filter((s) => !eaten.has(s));
  const near = left.map((s) => { const r = s.getBoundingClientRect(); return [Math.abs(r.left + r.width / 2 + scrollX - M.x), s]; })
    .sort((a, b) => a[0] - b[0]).slice(0, 6).map((a) => a[1]);
  const n = Math.min(near.length, left.length - 1, 2 + Math.floor(Math.random() * 3));
  for (let i = 0; i < n; i++) {
    if (!ok(tok)) return false;
    const s = near.splice(Math.floor(Math.random() * near.length), 1)[0];
    await gulp(s);
  }
  gain(1, { source: 'chaos' });
  return true;
}
/** Wrap each letter of a heading in a span (once), recording how to unwrap it. */
function wrap(el) {
  if (wrapped.has(el)) return wrapped.get(el);
  const texts = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walk.nextNode()) texts.push(walk.currentNode);
  const spans = [], swaps = [];
  for (const tn of texts) {
    const nodes = [];
    for (const part of tn.data.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) { nodes.push(document.createTextNode(part)); continue; }
      for (const c of Array.from(part)) {
        const s = document.createElement('span');
        s.className = 'sloppo-ch';
        s.textContent = c;
        nodes.push(s);
        spans.push(s);
      }
    }
    if (!nodes.length) continue;
    tn.replaceWith(...nodes);
    swaps.push([tn, nodes]);
  }
  wrapped.set(el, spans);
  record(() => {
    for (const [tn, nodes] of swaps.reverse()) { nodes[0].before(tn); nodes.forEach((n) => n.remove()); }
    wrapped.delete(el);
  });
  return spans;
}
/** Fly one letter into his mouth. */
async function gulp(span) {
  const r = span.getBoundingClientRect(), cs = getComputedStyle(span);
  const fl = document.createElement('span');
  fl.className = 'sloppo-letter';
  fl.setAttribute('aria-hidden', 'true');
  fl.textContent = span.textContent;
  for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontStretch', 'letterSpacing', 'color']) fl.style[k] = cs[k];
  Object.assign(fl.style, { left: r.left + scrollX + 'px', top: r.top + scrollY + 'px', lineHeight: r.height + 'px' });
  span.style.visibility = 'hidden';
  eaten.add(span);
  M.layer.append(fl);
  setMood('chomp', 700);
  if (!reduced()) {
    const mx = M.x - (r.left + scrollX + r.width / 2), my = M.y - size() * 0.32 - (r.top + scrollY + r.height / 2);
    const a = fl.animate([
      { transform: 'none' },
      { transform: `translate(${mx * 0.45}px, ${my * 0.45 - 50}px) rotate(160deg) scale(.75)`, offset: 0.55 },
      { transform: `translate(${mx}px, ${my}px) rotate(320deg) scale(.08)`, opacity: 0.5 },
    ], { duration: 480, easing: 'ease-in' });
    await a.finished.catch(() => {});
  }
  fl.remove();
  M.squash = 0.5;
  await wait(110);
}

/* ---------- knock a card off the page ---------- */
export async function knock(tok) {
  const p = await goTo(isCard, tok);
  if (!p) return false;
  say(pick(['Oops.', 'Mine.', 'Bye!', 'Down you go.']), 1200);
  for (let i = 0; i < 2; i++) { M.squash = 0.65; await wait(240); if (!ok(tok)) return false; }
  topple(p.el);
  gain(1, { source: 'chaos' });
  return true;
}
function topple(card) {
  keepStyle(card);
  P.gone.add(card);
  record(() => P.gone.delete(card));
  Object.assign(card.style, { pointerEvents: 'none', transition: 'none', position: 'relative', zIndex: '14' });
  if (reduced()) { card.style.visibility = 'hidden'; return; }
  const r = card.getBoundingClientRect(), top0 = r.top + scrollY;
  let x = 0, y = 0, rot = 0, last = performance.now();
  const vx = rand(60, 220) * (M.x < r.left + scrollX + r.width / 2 ? 1 : -1), vr = vx * rand(0.15, 0.35);
  let vy = -rand(280, 420);
  const tick = (t) => {
    if (!P.gone.has(card)) return;                     // restored mid-fall
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    vy += 2200 * dt; x += vx * dt; y += vy * dt; rot += vr * dt;
    if (top0 + y > scrollY + innerHeight + 60) { card.style.transform = ''; card.style.visibility = 'hidden'; return; }
    card.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- spit goo ---------- */
export async function goo(tok) {
  if (tok !== M.token) return false;
  const top = navH() + 30, s = size();
  const x = scrollX + rand(40, innerWidth - 40), y = scrollY + rand(top, Math.max(top + 10, innerHeight - 90));
  setMood('chomp', 400);
  M.squash = -0.45;
  await wait(180);
  if (tok !== M.token) return false;
  const blob = document.createElement('div');
  blob.className = 'sloppo-goo';
  blob.setAttribute('aria-hidden', 'true');
  const w = rand(70, 120);
  Object.assign(blob.style, { left: x - w / 2 + 'px', top: y - w * 0.5 + 'px', width: w + 'px' });
  blob.innerHTML = gooSVG(rand(26, 36));
  M.layer.append(blob);
  record(() => blob.remove());
  if (!reduced()) {
    const dx = M.x - x, dy = M.y - s * 0.3 - y;
    blob.animate([{ transform: `translate(${dx}px, ${dy}px) scale(.12)` }, { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 90}px) scale(.3)`, offset: 0.5 }, { transform: 'scale(1.15, .8)', offset: 0.88 }, { transform: 'none' }], { duration: 560, easing: 'ease-out' });
  }
  gain(1, { source: 'chaos' });
  return true;
}

export const ACTS = { bite, eat, knock, goo };
