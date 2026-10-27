/* The main window's size, position and maximised state, kept between launches in <userData>/window-state.json.
 *   load(file, screens)      → { width, height, x?, y?, maximized } (the default size when nothing usable is saved; x/y
 *                              only when the saved window still overlaps a display, so it never opens off screen)
 *   save(file, win)          writes the window's normal bounds and whether it is maximised
 *   track(win, file)         saves on resize, move (debounced) and close
 * screens: [{ x, y, width, height }] (screen.getAllDisplays().map((d) => d.workArea)). */
'use strict';
const fs = require('node:fs');

const DEFAULT = { width: 1280, height: 820, maximized: false };
const MIN = { width: 480, height: 360 };

const overlaps = (b, s) => b.x < s.x + s.width && b.x + b.width > s.x && b.y < s.y + s.height && b.y + b.height > s.y;

function load(file, screens) {
  let s = null;
  try { s = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { ...DEFAULT }; }
  if (!s || typeof s !== 'object') return { ...DEFAULT };
  const out = {
    width: Math.max(MIN.width, Number(s.width) || DEFAULT.width),
    height: Math.max(MIN.height, Number(s.height) || DEFAULT.height),
    maximized: !!s.maximized,
  };
  if (Number.isFinite(s.x) && Number.isFinite(s.y) && (screens || []).some((sc) => overlaps({ x: s.x, y: s.y, width: out.width, height: out.height }, sc))) {
    out.x = s.x; out.y = s.y;
  }
  return out;
}

function save(file, win) {
  if (!win || win.isDestroyed()) return;
  const b = win.getNormalBounds();
  try { fs.writeFileSync(file, JSON.stringify({ x: b.x, y: b.y, width: b.width, height: b.height, maximized: win.isMaximized() })); } catch (e) { /* read-only profile: forget it */ }
}

function track(win, file) {
  let timer = null;
  const later = () => { clearTimeout(timer); timer = setTimeout(() => save(file, win), 400); };
  win.on('resize', later);
  win.on('move', later);
  win.on('close', () => { clearTimeout(timer); save(file, win); });
}

module.exports = { load, save, track, DEFAULT };
