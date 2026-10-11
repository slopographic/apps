// The small HUD: level, XP bar, hat switcher, Unleash and Restore page.
import { M, listeners } from './state.js';
import { xpFor, hatLabel } from './store.js';
import { count } from './journal.js';
import { cycleHat } from './levels.js';

export function mountHud({ onUnleash, onRestore }) {
  const hud = document.createElement('div');
  hud.className = 'sloppo-hud';
  hud.setAttribute('role', 'group');
  hud.setAttribute('aria-label', 'Sloppo the mascot');
  hud.title = 'Pet Sloppo to level him up. Drag him to throw.';
  hud.innerHTML =
    '<span class="sh-lv">Lv <b>1</b></span>' +
    '<span class="sh-bar" role="progressbar" aria-label="XP to the next level" aria-valuemin="0" aria-valuemax="100"><i></i></span>' +
    '<button type="button" class="sh-btn sh-hat" hidden><span class="sh-hat-n"></span><span class="sh-hat-s">Hat</span></button>' +
    '<button type="button" class="sh-btn sh-unleash" aria-pressed="false">Unleash</button>' +
    '<button type="button" class="sh-btn sh-restore" hidden>Restore page</button>';
  const $ = (s) => hud.querySelector(s);
  const lv = $('.sh-lv b'), bar = $('.sh-bar'), fill = $('.sh-bar i'), hat = $('.sh-hat'), unleash = $('.sh-unleash'), restore = $('.sh-restore');
  hat.addEventListener('click', cycleHat);
  unleash.addEventListener('click', onUnleash);
  restore.addEventListener('click', onRestore);

  function render() {
    const lo = xpFor(M.level), hi = xpFor(M.level + 1);
    const pct = Math.round(((M.xp - lo) / (hi - lo)) * 100);
    lv.textContent = M.level;
    fill.style.width = pct + '%';
    bar.setAttribute('aria-valuenow', pct);
    bar.title = `${M.xp - lo} / ${hi - lo} XP to level ${M.level + 1}`;
    hat.hidden = M.level < 2;
    $('.sh-hat-n').textContent = hatLabel(M.hat);
    hat.setAttribute('aria-label', `Change hat (wearing: ${hatLabel(M.hat)})`);
    unleash.textContent = M.chaos ? 'Calm down' : 'Unleash';
    unleash.setAttribute('aria-pressed', String(M.chaos));
    const n = count();
    restore.hidden = n === 0;
    restore.setAttribute('aria-label', `Restore page (undo ${n} change${n === 1 ? '' : 's'})`);
  }
  listeners.add(render);
  render();
  document.body.append(hud);
  return hud;
}
