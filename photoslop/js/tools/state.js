/* PhotoSLOP: tools. Each tool: { id, name, key, icon, down, move, up, hover, overlay, cancel, activate, deactivate, brushCursor }. */
'use strict';

const C = { fg: store.get('fg', '#000000'), bg: store.get('bg', '#ffffff') };
const T = Object.assign({
  brush: { size: 30, hardness: 0.7, opacity: 1, flow: 1, spacing: 0.12, pressure: true, blend: 'normal', tip: 'round' },
  pencil: { size: 2, opacity: 1 },
  eraser: { size: 40, hardness: 0.6, opacity: 1, flow: 1, spacing: 0.12, pressure: true, tip: 'round' },
  blur: { size: 50, hardness: 0.3, strength: 0.5 },
  sharpen: { size: 50, hardness: 0.3, strength: 0.4 },
  sponge: { size: 60, hardness: 0.3, flow: 0.4, mode: 'saturate' },
  clone: { size: 60, hardness: 0.5, opacity: 1, flow: 1, aligned: true, sampleAll: false },
  heal: { size: 60, hardness: 0.5, opacity: 1, aligned: true, sampleAll: false },
  spot: { size: 30, hardness: 0.5, opacity: 1 },
  redeye: { size: 40, tol: 50, dark: 60 },
  smudge: { size: 40, hardness: 0.4, strength: 0.6 },
  dodge: { size: 70, hardness: 0.3, exposure: 0.35, mode: 'dodge' },
  select: { mode: 'replace', feather: 0 },
  wand: { tol: 32, contiguous: true, sampleAll: false },
  bucket: { tol: 32, contiguous: true, sampleAll: false, opacity: 1 },
  gradient: { type: 'linear', mode: 'fgbg', reverse: false, opacity: 1 },
  shape: { kind: 'rect', fill: true, stroke: false, strokeW: 6, radius: 32, sides: 5, strokeColor: '#000000' },
  type: { font: 'Archivo', size: 96, bold: true, italic: false, align: 'left', tracking: 0, leading: 120, aa: 'smooth' },
  move: { auto: false },
  crop: { del: true },
  eyedrop: { size: 1, all: true },
}, {});
(function loadToolOptions() { const saved = store.get('tools', null); if (saved) for (const k in saved) if (T[k]) Object.assign(T[k], saved[k]); })();
let saveOptsTimer = 0;
function saveToolOptions() { clearTimeout(saveOptsTimer); saveOptsTimer = setTimeout(() => store.set('tools', T), 300); }
const UI = { tool: 'brush', prevTool: null, editMask: false };

function setColor(which, hex) { C[which] = hex; store.set(which, hex); emit('color'); }

/* ---------- helpers ---------- */
function editableLayer(forPixels = true) {
  let L = activeLayer();
  if (!L) return null;
  if (!L.visible) { toast('The target layer is hidden. Show it first.'); return null; }
  if (L.locked) { toast('That layer is locked'); return null; }
  if (forPixels && L.text && !UI.editMask) { L = rasterizeText(L, true); toast('Type layer rasterized'); }
  return L;
}
function maskTarget(L) { return UI.editMask && L.mask; }
function docCanvasOf(L) { const c = mkCanvas(D.w, D.h); cx(c).drawImage(L.canvas, L.x, L.y); return c; }
function sampleSource(all) { return all ? flattenCanvas() : docCanvasOf(activeLayer()); }
function pickColor(p, all, size = 1) {
  const src = sampleSource(all), x = Math.floor(p.x), y = Math.floor(p.y);
  if (x < 0 || y < 0 || x >= D.w || y >= D.h) return null;
  const r = Math.floor(size / 2), x0 = clamp(x - r, 0, D.w - 1), y0 = clamp(y - r, 0, D.h - 1), w = Math.min(size, D.w - x0), hh = Math.min(size, D.h - y0);
  const d = cxr(src).getImageData(x0, y0, w, hh).data;
  let R0 = 0, G = 0, B = 0, A = 0;
  for (let i = 0; i < d.length; i += 4) { R0 += d[i] * d[i + 3]; G += d[i + 1] * d[i + 3]; B += d[i + 2] * d[i + 3]; A += d[i + 3]; }
  if (!A) return null;
  return rgbToHex(R0 / A, G / A, B / A);
}
