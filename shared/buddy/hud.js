// The Sloppo HUD. Collapsed, it is one small round toggle beside him showing his level. Opened
// (click, or the H key), it is a compact card beside him (a bottom sheet on phones) with the XP and
// rage bars, the everyday actions, the hat and RAGE buttons, and a "Give…" section that opens only
// when pressed. Escape, a click outside or the grip closes it. Idle for a while, the toggle fades.
import { M, listeners, clamp } from './state.js';
import { xpFor, hatLabel } from './store.js';
import { count } from './journal.js';
import { cycleHat } from './levels.js';
import { rageLevel } from './rage.js';
import { size } from './look.js';

const IDLE_MS = 6000, TOG = 40, GAP = 8;
const PHONE = matchMedia('(max-width: 600px)');
let hud = null, tog = null, panel = null, lv = null;
let idleT = 0, hovered = false, focused = false, wasOpen = false, lastX = NaN, lastY = NaN;

export function mountHud({ onUnleash, onRestore, on3d, onAsk }) {
  hud = document.createElement('div');
  hud.className = 'sloppo-hud';
  hud.style.zIndex = M.z || '';
  hud.hidden = true;
  hud.setAttribute('role', 'group');
  hud.setAttribute('aria-label', 'Sloppo the mascot');
  hud.title = 'Pet Sloppo to level him up. Drag him to throw.';
  hud.innerHTML =
    '<button type="button" class="sh-toggle" aria-expanded="false" aria-controls="sloppo-hud-panel"><span class="sh-lv">Lv <b>1</b></span></button>' +
    '<div class="sh-panel" id="sloppo-hud-panel" hidden>' +
    '<button type="button" class="sh-grip" aria-label="Close Sloppo panel" title="Close"></button>' +
    '<div class="sh-meters">' +
    '<span class="sh-bar" role="progressbar" aria-label="XP to the next level" aria-valuemin="0" aria-valuemax="100"><i></i></span>' +
    '<span class="sh-rage" hidden title="Rage"><i></i></span></div>' +
    '<div class="sh-row">' +
    '<button type="button" class="sh-btn sh-ask" title="Ask Sloppo">Ask</button>' +
    '<button type="button" class="sh-btn sh-3d" aria-pressed="false" aria-label="3D Sloppo">3D</button>' +
    '<button type="button" class="sh-btn sh-restore" hidden>Restore page</button></div>' +
    '<div class="sh-row">' +
    '<button type="button" class="sh-btn sh-hat" hidden><span class="sh-hat-n"></span><span class="sh-hat-s">Hat</span></button>' +
    '<button type="button" class="sh-btn sh-unleash" aria-pressed="false">Unleash</button></div>' +
    '</div>';
  tog = hud.querySelector('.sh-toggle');
  panel = hud.querySelector('.sh-panel');
  lv = hud.querySelector('.sh-lv b');
  const $ = (s) => hud.querySelector(s);
  const bar = $('.sh-bar'), fill = $('.sh-bar i'), hat = $('.sh-hat'), unleash = $('.sh-unleash'), restore = $('.sh-restore');
  const rage = $('.sh-rage'), three = $('.sh-3d');
  tog.addEventListener('click', () => setOpen(!M.hudOpen));
  $('.sh-grip').addEventListener('click', () => setOpen(false));
  hat.addEventListener('click', cycleHat);
  unleash.addEventListener('click', onUnleash);
  restore.addEventListener('click', onRestore);
  three.addEventListener('click', on3d);
  $('.sh-ask').addEventListener('click', onAsk);

  // Idle fade: the collapsed toggle dims after a few quiet seconds; hover, focus or touch bring it back.
  hud.addEventListener('pointerenter', () => { hovered = true; wake(); });
  hud.addEventListener('pointerleave', () => { hovered = false; restartIdle(); });
  hud.addEventListener('pointerdown', wake);
  hud.addEventListener('focusin', () => { focused = true; wake(); });
  hud.addEventListener('focusout', (e) => { if (!hud.contains(e.relatedTarget)) { focused = false; restartIdle(); } });
  document.addEventListener('pointermove', activity, { passive: true });
  document.addEventListener('pointerdown', (e) => {
    activity();
    if (M.hudOpen && !hud.contains(e.target)) setOpen(false);
  }, true);
  document.addEventListener('keydown', (e) => {
    activity();
    if (e.key === 'Escape' && M.hudOpen) {
      const inside = panel.contains(document.activeElement);
      setOpen(false);
      if (inside) tog.focus();
    } else if ((e.key === 'h' || e.key === 'H') && !e.altKey && !e.ctrlKey && !e.metaKey && !typing(e.target) && M.visible) {
      setOpen(true);
    }
  });

  function render() {
    const angry = M.rage >= 1 || !!M.raging;
    hud.hidden = !M.visible;
    hud.classList.toggle('is-angry', angry);
    hud.classList.toggle('is-open', !!M.hudOpen);
    panel.hidden = !M.hudOpen;
    tog.setAttribute('aria-expanded', String(!!M.hudOpen));
    tog.title = `Sloppo's level ${M.level}. ${M.hudOpen ? 'Press to close' : 'Press to open (H)'}`;
    const lo = xpFor(M.level), hi = xpFor(M.level + 1);
    const pct = Math.round(((M.xp - lo) / (hi - lo)) * 100);
    lv.textContent = M.level;
    fill.style.width = pct + '%';
    bar.setAttribute('aria-valuenow', pct);
    bar.title = `${M.xp - lo} / ${hi - lo} XP to level ${M.level + 1}`;
    hat.hidden = M.level < 2;
    $('.sh-hat-n').textContent = hatLabel(M.hat);
    hat.setAttribute('aria-label', `Change hat (wearing: ${hatLabel(M.hat)})`);
    const rl = rageLevel();
    rage.hidden = rl <= 0.01;
    rage.firstChild.style.width = Math.round(rl * 100) + '%';
    rage.classList.toggle('full', !!M.raging);
    rage.setAttribute('aria-label', M.raging ? 'RAGE' : `Rage ${Math.round(rl * 100)}%`);
    three.setAttribute('aria-pressed', String(M.is3d));
    unleash.textContent = M.raging ? 'RAGE' : M.chaos ? 'Calm down' : 'Unleash';
    unleash.setAttribute('aria-pressed', String(M.chaos));
    const n = count();
    restore.hidden = n === 0;
    restore.setAttribute('aria-label', `Restore page (undo ${n} change${n === 1 ? '' : 's'})`);
    if (M.hudOpen) { clearTimeout(idleT); hud.classList.remove('is-faded'); }
    else if (wasOpen) restartIdle();
    wasOpen = !!M.hudOpen;
  }
  listeners.add(render);
  render();
  document.body.append(hud);
  restartIdle();
  return hud;
}

/** Open or close the card (M.hudOpen; every listener follows). */
export function setOpen(v) { M.hudOpen = !!v; listeners.forEach((f) => f()); }

function typing(t) { return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
function restartIdle() { clearTimeout(idleT); idleT = setTimeout(fade, IDLE_MS); }
function fade() { if (!hovered && !focused && !M.hudOpen) hud.classList.add('is-faded'); }
function wake() { hud.classList.remove('is-faded'); restartIdle(); }
function activity() { if (hud && !hud.classList.contains('is-faded')) restartIdle(); }

/** Each frame: keep the toggle beside Sloppo's head, and the card beside the toggle (or a sheet on phones). */
export function placeHud() {
  if (!hud || hud.hidden) return;
  const s = size();
  const away = M.y < scrollY || M.y - s * 1.2 > scrollY + innerHeight;
  const cx = clamp(M.x - scrollX + s * 0.62 + 6, 4, innerWidth - TOG - 4);
  const cy = clamp(M.y - scrollY - s * 0.9, 4, innerHeight - TOG - 4);
  if (cx !== lastX || cy !== lastY) {
    lastX = cx; lastY = cy;
    hud.style.left = cx + 'px';
    hud.style.top = cy + 'px';
  }
  hud.classList.toggle('is-away', away);
  if (M.hudOpen && !PHONE.matches) {
    const flip = cx + TOG + GAP + panel.offsetWidth > innerWidth - 8;
    panel.classList.toggle('flip', flip);
    const top = clamp(cy - 6, 8, innerHeight - panel.offsetHeight - 8);
    panel.style.top = top - cy + 'px';
  }
}
