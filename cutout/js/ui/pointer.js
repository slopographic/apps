/* Slop Cutout — pointer input on #stage: pan (pan tool, middle button, or Space), refine brush strokes
 * (keep / remove, in image px), before/after knob drag, wheel zoom, and the brush cursor. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, P = CO.process;
  const PT = CO.pointer = {};
  let stage = null, cur = null, drag = null, space = false;

  const isBrush = () => S.tool === 'keep' || S.tool === 'remove';
  const typing = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const local = (e) => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  /** Brush radius in image px and hardness for the current settings. */
  const brushArgs = () => ({ r: S.brush.size / 2 / CO.view.geom().scale, h: S.brush.hardness });

  /** Move and size the brush cursor (screen px: the diameter is the brush size). */
  function hover(sx, sy) {
    if (!cur) return;
    const act = P.active, show = isBrush() && !!act && !(drag && drag.kind !== 'brush');
    cur.hidden = !show;
    if (!show) return;
    const d = S.brush.size;
    cur.className = 'brush-cursor ' + S.tool;
    cur.style.width = cur.style.height = d + 'px';
    cur.style.transform = `translate(${sx - d / 2}px, ${sy - d / 2}px)`;
  }

  function onDown(e) {
    const act = P.active, [sx, sy] = local(e);
    if (S.view === 'split' && act && e.target.closest && e.target.closest('#split')) drag = { kind: 'split' };
    else if (e.button === 1 || (e.button === 0 && (S.tool === 'pan' || space))) drag = { kind: 'pan', x: sx, y: sy };
    else if (e.button === 0 && act && isBrush()) {
      const it = act.item, p = CO.view.toImage(sx, sy), { r, h } = brushArgs();
      const st = CO.brush.begin(it, S.tool);
      CO.brush.line(st, p.x, p.y, p.x, p.y, r, h);
      drag = { kind: 'brush', it, st, x: p.x, y: p.y };
    } else return;
    e.preventDefault();
    stage.setPointerCapture(e.pointerId);
    stage.classList.toggle('grabbing', drag.kind === 'pan');
    hover(sx, sy);
  }

  function onMove(e) {
    const [sx, sy] = local(e);
    if (!drag) { hover(sx, sy); return; }
    if (drag.kind === 'pan') {
      CO.view.panBy(sx - drag.x, sy - drag.y);
      drag.x = sx; drag.y = sy;
    } else if (drag.kind === 'split') {
      S.split = U.clamp(sx / Math.max(1, stage.clientWidth), 0, 1);
      CO.view.draw();
    } else {
      const p = CO.view.toImage(sx, sy), { r, h } = brushArgs();
      CO.brush.line(drag.st, drag.x, drag.y, p.x, p.y, r, h);
      drag.x = p.x; drag.y = p.y;
      CO.process.refreshSoon(drag.it);
      hover(sx, sy);
    }
  }

  function onUp() {
    if (!drag) return;
    if (drag.kind === 'brush') {
      const en = CO.brush.end(drag.st);
      if (en) CO.history.push(drag.it, en);
      CO.process.refresh(drag.it);
    }
    drag = null;
    stage.classList.remove('grabbing');
    if (cur) cur.hidden = true;
  }

  /** Pinch-free wheel zoom around the pointer. */
  function onWheel(e) {
    if (!P.active) return;
    e.preventDefault();
    const [sx, sy] = local(e), dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    CO.view.zoomAt(Math.exp(-dy * 0.0015), sx, sy);
  }

  /** Space held = pan, unless the user is typing. */
  function onKey(down) {
    return (e) => {
      if (e.code !== 'Space' || typing(e.target)) return;
      space = down;
      if (down) e.preventDefault();
    };
  }

  PT.init = function () {
    stage = U.$('#stage');
    cur = U.$('#brushCursor');
    if (!stage) return;
    stage.dataset.tool = S.tool;
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onUp);
    stage.addEventListener('pointercancel', onUp);
    stage.addEventListener('pointerleave', () => { if (!drag && cur) cur.hidden = true; });
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', onKey(true));
    window.addEventListener('keyup', onKey(false));
    window.addEventListener('blur', () => { space = false; });
    CO.on('tool', () => {
      stage.dataset.tool = S.tool;
      if (!isBrush() && cur) cur.hidden = true;
    });
  };
  PT.isBrush = isBrush;
})();
