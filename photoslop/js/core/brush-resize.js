/* PhotoSlop: right-button drag on the canvas resizes the brush live. Across = size, down = hardness
 * (the same as Shift-drag, minus Alt for opacity). No history step: the value goes straight into the
 * brush settings (BRUSH_OPTS) and is stored with the other tool options. A right-click without a drag
 * still opens the canvas menu (ui/context.js). Windows and Linux send the menu event after the release,
 * macOS sends it on the press; both are handled here. */
'use strict';

function brushRightDown(e) {
  const t = currentTool(), bo = typeof BRUSH_OPTS === 'function' && BRUSH_OPTS()[t.id];
  if (!bo || TRANSFORM.active || V.space) return false;
  V.rightDragged = false;
  V.resize = { id: e.pointerId, sx: e.clientX, sy: e.clientY, p: snapP(toDoc(e), t), e, o: bo, size: bo.size, hard: bo.hardness, op: bo.opacity, moved: false, alt: false, right: true, menu: false };
  try { V.el.setPointerCapture(e.pointerId); } catch (err) { /* synthetic events */ }
  dirty();
  return true;
}
/** The menu event for a right button. Returns true when it was taken care of (menu suppressed or deferred). */
function brushRightContext() {
  if (V.resize && V.resize.right) { V.resize.menu = true; return true; } // macOS: the menu comes on the press
  if (V.rightDragged) { V.rightDragged = false; return true; }          // Windows/Linux: the drag was not a click
  return false;
}
function brushRightEnd(R) {
  if (R.moved) { V.rightDragged = !R.menu; saveToolOptions(); buildOptions(); } // a drag: no menu after it
  else if (R.menu) openContextMenu(V.el, R.e.clientX, R.e.clientY);             // macOS click: the menu was held back
}
