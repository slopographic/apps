// Paints Sloppo onto the mascot canvas with the shared painter, picking a face for his mood.
import { drawSloppo } from '../../shared/sloppo/index.js';
import { M, now, reduced, moodIs } from './state.js';
import { scaleFor } from './store.js';

/** The canvas box (CSS px) and the y of his feet inside it. */
export const CW = 176, CH = 204, BASE = 168;
const VH = 248;                                // virtual painter height: makes s about 72 px at level 1
const S0 = Math.min(CW * 0.48, VH * 0.29);
let g = null, dpr = 1, blinkAt = 0, blinkUntil = 0, lastKey = '';

export function setup(canvas) {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(CW * dpr);
  canvas.height = Math.round(CH * dpr);
  canvas.style.width = CW + 'px';
  canvas.style.height = CH + 'px';
  g = canvas.getContext('2d');
  lastKey = '';
}

/** Body size in CSS px for the current level. */
export const size = () => S0 * scaleFor(M.level);

/** [eyes, mouth] for the current state. */
export function face(t = now()) {
  if (moodIs('dizzy')) return ['spiral', 'wavy'];
  if (M.mode === 'drag' || M.mode === 'air') return ['normal', 'o'];
  if (moodIs('love')) return ['heart', 'open'];
  if (moodIs('chomp')) return [M.chaos ? 'angry' : 'happy', 'open'];
  if (M.chaos) return ['angry', 'fangs'];
  if (moodIs('land')) return ['happy', 'smile'];
  if (M.mode === 'hop') return ['normal', 'open'];
  if (t > blinkAt) { blinkUntil = t + 140; blinkAt = t + 2200 + Math.random() * 3800; }
  return [t < blinkUntil ? 'sleepy' : 'normal', 'smile'];
}

export function draw(t) {
  if (!g) return;
  const [eyes, mouth] = face(t);
  const sc = scaleFor(M.level), s = S0 * sc, still = reduced();
  const k = still ? 0 : M.squash;
  const key = [eyes, mouth, M.hat, sc, k.toFixed(3), M.rot.toFixed(3)].join();
  if (still && key === lastKey) return;    // nothing moves: skip the repaint
  lastKey = key;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, CW, CH);
  const cy = BASE - s * 0.42;
  g.translate(CW / 2, cy); g.rotate(M.rot); g.translate(-CW / 2, -cy);
  g.translate(CW / 2, BASE); g.scale(1 + k * 0.32, 1 - k * 0.28); g.translate(-CW / 2, -BASE);
  drawSloppo(g, CW, VH, { body: 'lime', eyes, mouth, hat: M.hat || undefined, noGlow: true, seed: 7, scale: sc, baseY: BASE / VH }, still ? 0 : t / 1000);
}
