// Drag to move or resize a timed event in the time grid. Moves snap to 15 minutes and may cross days. The move is
// worked out on the viewer's wall clock (so a move across a daylight saving change keeps the reading) and saved as an
// instant in the event's own zone. A repeating event moves or resizes as a whole series. A press without movement
// counts as a click. Exposes window.SlopCal.drag.
(function (g) {
  'use strict';
  const T = g.SlopTime;
  const NS = (g.SlopCal = g.SlopCal || {});
  const SNAP = 15, MIN = 60000, THRESH = 4;

  /**
   * Starts a drag from a pointer press on a block. mode 'move' or 'resize'. opts: { pxPerHour, zone, onCommit({ start, end }),
   * onClick() }. The block moves with the pointer; nothing is saved until the pointer is released.
   */
  function begin(e, node, it, mode, opts) {
    if (e.button !== undefined && e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY, pxMin = opts.pxPerHour / 60;
    const colWidth = node.parentElement ? node.parentElement.getBoundingClientRect().width : 0;
    const baseH = node.offsetHeight;
    let moved = false, dOff = 0, dMin = 0;
    try { node.setPointerCapture(e.pointerId); } catch (err) { /* not supported: the drag still works while over the block */ }

    const onMove = (ev) => {
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.hypot(dx, dy) < THRESH) return;
      moved = true;
      node.classList.add('dragging');
      dMin = Math.round(dy / pxMin / SNAP) * SNAP;
      if (mode === 'move') {
        dOff = colWidth ? Math.round(dx / colWidth) : 0;
        node.style.transform = `translate(${dOff * colWidth}px, ${dMin * pxMin}px)`;
      } else {
        node.style.height = `${Math.max(SNAP * pxMin, baseH + dMin * pxMin)}px`;
      }
    };

    const finish = (ev) => {
      node.removeEventListener('pointermove', onMove);
      node.removeEventListener('pointerup', finish);
      node.removeEventListener('pointercancel', cancel);
      try { node.releasePointerCapture(ev.pointerId); } catch (err) { /* already released */ }
      node.classList.remove('dragging');
      node.style.transform = '';
      node.style.height = '';
      if (!moved) { if (opts.onClick) opts.onClick(); return; }
      const change = compute(it, mode, dOff, dMin, opts.zone);
      if (change && opts.onCommit) opts.onCommit(change);
    };
    const cancel = () => { node.style.transform = ''; node.style.height = ''; node.classList.remove('dragging'); moved = false; };
    node.addEventListener('pointermove', onMove);
    node.addEventListener('pointerup', finish);
    node.addEventListener('pointercancel', cancel);
  }

  /** The new { start, end } for a move or resize, or null when nothing changed. */
  function compute(it, mode, dOff, dMin, zone) {
    if (mode === 'resize') {
      const end = it.end + dMin * MIN;
      const min = it.start + SNAP * MIN;
      const next = Math.max(min, end);
      return next === it.end ? null : { start: it.start, end: next };
    }
    if (!dOff && !dMin) return null;
    const p = T.parts(it.start, zone);
    const wall = new Date(Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) + (dOff * 1440 + dMin) * MIN);
    const start = T.wallToUtc(wall.getUTCFullYear(), wall.getUTCMonth() + 1, wall.getUTCDate(), wall.getUTCHours(), wall.getUTCMinutes(), zone);
    return { start, end: start + (it.end - it.start) };
  }

  NS.drag = { begin, compute, SNAP };
})(typeof window !== 'undefined' ? window : globalThis);
