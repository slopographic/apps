// Pointer and keyboard: click (or Enter) to pet, drag to carry, release to throw.
import { M, now, setMood, pick } from './state.js';
import { startDrag, dragTo, release } from './motion.js';
import { gain } from './levels.js';
import { hearts, say } from './fx.js';

const PET_LINES = ['hehe', 'more!', 'purr…', 'squish!', 'again!', 'best day', '<3'];
const THROW_LINES = ['Wheee!', 'Yeet!', 'Aaaa!', 'Again!'];

export function pet() {
  setMood('love', 1500);
  M.squash = 0.55;
  M.sqv = 0;
  hearts(3);
  gain(1, { source: 'pet', throttle: 250 });
  if (++M.pets % 5 === 0) say(pick(PET_LINES), 1100);
  M.nextIdle = Math.max(M.nextIdle, now() + 4000);
}

export function bindInput(hit) {
  let P = null;
  hit.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    try { hit.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
    P = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: M.x - e.pageX, oy: M.y - e.pageY, drag: false };
  });
  hit.addEventListener('pointermove', (e) => {
    if (!P || e.pointerId !== P.id) return;
    if (!P.drag && Math.hypot(e.clientX - P.sx, e.clientY - P.sy) > 6) {
      P.drag = true;
      startDrag();
      hit.classList.add('grabbing');
    }
    if (P.drag) dragTo(e.pageX + P.ox, e.pageY + P.oy, e.timeStamp);
  });
  const end = (e, cancel) => {
    if (!P || e.pointerId !== P.id) return;
    const was = P;
    P = null;
    hit.classList.remove('grabbing');
    if (was.drag) {
      const sp = release(e.timeStamp, cancel);
      if (sp > 600) { gain(2, { source: 'throw', throttle: 600 }); say(pick(THROW_LINES), 900); }
    } else if (!cancel) pet();
  };
  hit.addEventListener('pointerup', (e) => end(e, false));
  hit.addEventListener('pointercancel', (e) => end(e, true));
  hit.addEventListener('lostpointercapture', (e) => end(e, true));
  hit.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pet(); }
  });
  hit.addEventListener('contextmenu', (e) => e.preventDefault());
  hit.addEventListener('click', (e) => e.stopPropagation()); // pointer capture sends the click here
  hit.addEventListener('pointerenter', () => { M.hover = true; });
  hit.addEventListener('pointerleave', () => { M.hover = false; });
}
