/* SlopEdit: layout templates as data. Each template has slot regions as fractions of the frame
   (x, y, w, h with 0..1 origin top-left), a default cut length (s) and an optional frame aspect.
   Tiling templates (layered: false) cover the frame without overlap; layered ones (picture-in-
   picture) put later slots on top of earlier ones. Used by layout.js, random-edit.js and the panel. */
(function () {
  'use strict';
  const SE = window.SE;
  const T = SE.templates = {};
  const cells = (cols, rows) => {
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ x: c / cols, y: r / rows, w: 1 / cols, h: 1 / rows });
    return out;
  };
  const FULL = { x: 0, y: 0, w: 1, h: 1 };

  T.ASPECTS = [['16:9', 1920, 1080], ['9:16', 1080, 1920], ['1:1', 1080, 1080]];
  T.aspectSize = (name) => { const a = T.ASPECTS.find((x) => x[0] === name); return a ? { w: a[1], h: a[2] } : null; };

  T.list = [
    { id: 'single', name: 'Single', desc: 'One full frame', slots: [FULL], dur: 4, layered: false },
    { id: 'split-h', name: 'Split horizontal', desc: 'Two side by side', slots: [{ x: 0, y: 0, w: 0.5, h: 1 }, { x: 0.5, y: 0, w: 0.5, h: 1 }], dur: 4, layered: false },
    { id: 'split-v', name: 'Split vertical', desc: 'Two stacked', slots: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }], dur: 4, layered: false },
    { id: 'pip', name: 'Picture-in-picture', desc: 'Main frame with a small corner', slots: [FULL, { x: 0.6, y: 0.6, w: 0.36, h: 0.36 }], dur: 6, layered: true },
    { id: 'grid2', name: 'Grid 2×2', desc: 'Four cells', slots: cells(2, 2), dur: 3, layered: false },
    { id: 'grid3', name: 'Grid 3×3', desc: 'Nine cells', slots: cells(3, 3), dur: 2, layered: false },
    { id: 'three-up', name: 'Three-up', desc: 'Three columns', slots: cells(3, 1), dur: 3, layered: false },
    { id: 'reel', name: 'Vertical 9:16 reel', desc: 'Portrait frame, two stacked', slots: [{ x: 0, y: 0, w: 1, h: 0.5 }, { x: 0, y: 0.5, w: 1, h: 0.5 }], dur: 2, layered: false, aspect: '9:16' }
  ];
  T.get = (id) => T.list.find((t) => t.id === id) || null;
  /** Region of slot i of a template (or null). */
  T.region = (tpl, i) => (tpl && tpl.slots[i]) || null;
  /** True when a tiling template covers the frame exactly once: areas sum to 1, no pair overlaps, all inside. */
  T.tiles = function (tpl) {
    const eps = 1e-9;
    const inside = tpl.slots.every((r) => r.x >= -eps && r.y >= -eps && r.x + r.w <= 1 + eps && r.y + r.h <= 1 + eps && r.w > 0 && r.h > 0);
    const area = tpl.slots.reduce((s, r) => s + r.w * r.h, 0);
    let overlap = false;
    for (let i = 0; i < tpl.slots.length; i++) for (let j = i + 1; j < tpl.slots.length; j++) {
      const a = tpl.slots[i], b = tpl.slots[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > eps && oy > eps) overlap = true;
    }
    return inside && !overlap && Math.abs(area - 1) < eps;
  };
})();
