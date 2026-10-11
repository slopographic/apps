// Shared state for the homepage mascot. Every mascot module imports M and these helpers.
export const M = {
  x: 0, y: 0, vx: 0, vy: 0,   // feet position in page coordinates, and velocity (px/s)
  rot: 0, vr: 0,               // spin while thrown (rad, rad/s)
  squash: 0, sqv: 0,           // jelly squash-and-stretch spring (>0 wide, <0 tall)
  mode: 'hidden',              // hidden | perched | hop | air | drag
  perch: null,                 // { el, frac } or null (the page floor)
  hop: null, samples: [],
  mood: '', moodUntil: 0,      // love | dizzy | chomp | land
  offSince: 0, nextIdle: 0, hard: false, hover: false, pets: 0,
  chaos: false, token: 0,      // token changes when chaos stops, so running actions bail out
  xp: 0, level: 1, hat: null,
  layer: null, el: null, canvas: null, hit: null, bubble: null,
};

const mq = matchMedia('(prefers-reduced-motion: reduce)');
export const reduced = () => mq.matches;
export const now = () => performance.now();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const navH = () => { const n = document.querySelector('.nav'); return n ? n.getBoundingClientRect().bottom : 0; };
export const pageW = () => document.body.clientWidth;
export const pageH = () => document.body.scrollHeight;

export function setMood(mood, ms) { M.mood = mood; M.moodUntil = now() + ms; }
export const moodIs = (mood) => M.mood === mood && now() < M.moodUntil;

/** HUD and hit-box listeners: called whenever level, hat, chaos or the journal change. */
export const listeners = new Set();
export function changed() { for (const f of listeners) f(); }
