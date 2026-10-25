// Sample mascot overlay for the made-up "Acme Tools" profile (brand/profiles/sample.json): a flat robot head that plays
// the slot's moments with the Web Animations API, so the slot can be tested without WebGL. Sample art for tests, MIT like
// the rest of this repository. The overlay contract: shared/mascot/slot.js. Tests: tests/node/mascot-slot.test.mjs,
// tests/buddy/slot.test.html.
import { svg, name } from './icon.js';

export { name };
/** Each animation: keyframes on the head (or a function of the side, -1 left or 1 right), its length (ms), its face. */
const ANIMS = {
  hello: { frames: [{ transform: 'scale(0)' }, { transform: 'scale(1.1)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(8deg)' }, { transform: 'none' }], ms: 1600 },
  working: { frames: [{ transform: 'translateX(-2px)' }, { transform: 'translateX(2px)' }], ms: 240 },
  celebrate: { frames: [{ transform: 'none' }, { transform: 'translateY(-24px) rotate(180deg)' }, { transform: 'rotate(360deg)' }], ms: 1200 },
  oops: { frames: [{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], ms: 600 },
  sleep: { frames: [{ transform: 'translateY(4px) rotate(6deg)' }, { transform: 'translateY(6px) rotate(6deg)' }], ms: 2400, face: 'asleep' },
  wake: { frames: [{ transform: 'translateY(6px)' }, { transform: 'translateY(-14px)' }, { transform: 'none' }], ms: 900 },
  point: { frames: (s) => [{ transform: 'none' }, { transform: `translateX(${s * 10}px) rotate(${s * -12}deg)` }, { transform: 'none' }], ms: 1800 },
};
export const animations = Object.keys(ANIMS);

export function create(el, { reduce } = {}) {
  const head = document.createElement('div');
  head.innerHTML = svg(80, false);
  Object.assign(head.style, { display: 'grid', placeItems: 'end center', height: '100%', paddingBottom: '8px', boxSizing: 'border-box' });
  el.append(head);
  let run = null;
  return {
    play(anim, { loop = false, side = 0 } = {}) {
      const a = ANIMS[anim];
      if (!a) return Promise.resolve();
      if (run) run.cancel();
      head.dataset.anim = anim;
      head.style.opacity = a.face === 'asleep' ? '.7' : '1';
      if (reduce || typeof head.animate !== 'function') return Promise.resolve();
      run = head.animate(typeof a.frames === 'function' ? a.frames(side || 1) : a.frames, { duration: a.ms, iterations: loop ? Infinity : 1, direction: loop ? 'alternate' : 'normal', easing: 'ease-in-out' });
      return run.finished.then(() => {}, () => {});
    },
    dispose() { if (run) run.cancel(); head.remove(); },
  };
}
