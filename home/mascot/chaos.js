// "Unleash": chaos mode. A small brain picks actions while it lasts; Restore page undoes everything.
import { M, sleep, rand, reduced, changed } from './state.js';
import { ACTS } from './acts.js';
import { restoreAll } from './journal.js';
import { say } from './fx.js';

const WEIGHTS = { bite: 3, eat: 3, knock: 1.4, goo: 2 };

function order() {
  const left = { ...WEIGHTS }, out = [];
  while (Object.keys(left).length) {
    let k = Math.random() * Object.values(left).reduce((a, b) => a + b, 0);
    for (const name in left) if ((k -= left[name]) <= 0) { out.push(name); delete left[name]; break; }
  }
  return out;
}

async function brain(tok) {
  await sleep(reduced() ? 400 : 650);
  while (M.chaos && tok === M.token) {
    if (M.mode === 'perched' && !document.hidden) {
      for (const name of order()) {
        if (await ACTS[name](tok)) break;
        if (tok !== M.token) return;
      }
    }
    await sleep(reduced() ? 1400 : rand(450, 1000));
  }
}

export function setChaos(on) {
  on = !!on;
  if (on === M.chaos) return;
  M.chaos = on;
  M.token++;
  M.el.classList.toggle('is-chaos', on);
  M.squash = 0.6;
  say(on ? 'RAAAH!' : '…fine.', 1100);
  changed();
  if (on) brain(M.token);
}

/** Stop chaos and undo every change it made. */
export function restore() {
  if (M.chaos) setChaos(false);
  M.token++;
  restoreAll();
  for (const n of M.layer.querySelectorAll('.sloppo-letter, .sloppo-goo')) n.remove();
  say('All better.', 1200);
}

/** Run one action now (used by tests and the debug hook). */
export const act = (name) => ACTS[name](M.token);
