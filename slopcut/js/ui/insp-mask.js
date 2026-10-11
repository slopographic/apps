/* SlopCut: the Mask section of the Inspector (shape, position, size, corner radius, feather, expansion, area) and
   the mask items shared by the Clip menu and the clip context menu. Every field change is one undo step (coalesced
   while a slider is dragged). Drawing and handles: render/mask-input.js. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, M = SE.model, MK = SE.mask, F = SE.fields, I = SE.inspector, C = SE.cmd;
  const h = U.h;
  const body = () => document.querySelector('#insp .insp-body');
  const maskOf = (id) => { const c = M.clip(SE.doc, id); return c ? c.mask : null; };
  /** Getter for one mask field of a clip (d when the clip has no mask). */
  const mg = (id, fn, d = 0) => () => { const m = maskOf(id); return m ? fn(m) : d; };
  /** Setter for one mask field, one undo step per field (key 'mask.<name>' coalesces a slider drag). */
  const ms = (id, name, label, fn) => I.clipSet(id, 'mask.' + name, label, (c, v) => { if (c.mask) fn(c.mask, v); });

  I.maskSection = function (c) {
    const id = c.id, m = c.mask, t = I.track;
    if (!m) {
      body().append(F.section('Mask', 'mask',
        h('p', { class: 'ins-note' }, 'A mask keeps only the part of this clip inside its shape. Pick a shape, or draw one in the monitor.'),
        h('div', { class: 'ins-actions' },
          ...MK.SHAPES.filter(([s]) => s !== 'path').map(([s, l]) => h('button', { type: 'button', class: 'btn sm', onclick: () => SE.act.maskAdd(s) }, l)),
          h('button', { type: 'button', class: 'btn sm', onclick: () => SE.act.maskTool('free') }, 'Freehand'),
          h('button', { type: 'button', class: 'btn sm', onclick: () => SE.act.maskTool('pen') }, 'Pen path'))));
      return;
    }
    const isPath = m.shape === 'path';
    const shapeRows = isPath ? [h('p', { class: 'ins-note' }, 'Path mask (' + m.pts.length + ' points). Drag its points in the monitor while Edit shape is on.')]
      : [t(F.chips('Shape', [['rect', 'Rect'], ['ellipse', 'Ellipse'], ['rrect', 'Rounded']], () => { const x = maskOf(id); return x ? x.shape : 'rect'; }, (v) => {
        SE.change('Mask shape', (p) => { const x = M.clip(p, id).mask; x.shape = v; if (v === 'rrect' && !x.r) x.r = Math.min(x.w, x.h) * 0.2; });
      }))];
    body().append(F.section('Mask', 'mask',
      ...shapeRows,
      t(F.pair('Centre', { label: 'Centre X (px)', get: mg(id, (x) => x.x), set: ms(id, 'x', 'Mask position', (x, n) => { x.x = Math.round(n); }) },
        { label: 'Centre Y (px)', get: mg(id, (x) => x.y), set: ms(id, 'y', 'Mask position', (x, n) => { x.y = Math.round(n); }) })),
      isPath ? null : t(F.pair('Size', { label: 'Width (px)', get: mg(id, (x) => x.w), set: ms(id, 'w', 'Mask size', (x, n) => { x.w = Math.max(0, Math.round(n)); }) },
        { label: 'Height (px)', get: mg(id, (x) => x.h), set: ms(id, 'h', 'Mask size', (x, n) => { x.h = Math.max(0, Math.round(n)); }) })),
      !isPath && m.shape === 'rrect' ? t(F.slider('Corner radius', mg(id, (x) => x.r), ms(id, 'r', 'Mask radius', (x, v) => { x.r = v; }), { min: 0, max: 400, step: 1, unit: 'px', reset: 0, hardMin: 0 })) : null,
      t(F.slider('Feather', mg(id, (x) => x.feather), ms(id, 'feather', 'Mask feather', (x, v) => { x.feather = v; }), { min: 0, max: 200, step: 1, unit: 'px', reset: 0, hardMin: 0 })),
      t(F.slider('Expansion', mg(id, (x) => x.expand), ms(id, 'expand', 'Mask expansion', (x, v) => { x.expand = v; }), { min: -200, max: 200, step: 1, unit: 'px', reset: 0 })),
      t(F.chips('Area', [['keep', 'Keep inside'], ['invert', 'Keep outside']], () => { const x = maskOf(id); return x && x.invert ? 'invert' : 'keep'; }, (v) => {
        SE.change('Invert mask', (p) => { M.clip(p, id).mask.invert = v === 'invert'; });
      })),
      h('div', { class: 'ins-actions' },
        h('button', { type: 'button', class: 'btn sm' + (SE.maskInput && SE.maskInput.edit === id ? ' on' : ''), onclick: () => SE.act.maskEdit() }, 'Edit shape'),
        h('button', { type: 'button', class: 'btn sm', onclick: () => SE.act.maskRemove() }, 'Remove mask'))));
  };

  /** Mask items for a menu: add (sub-menu), remove, invert and edit. Disabled items follow the selection. */
  SE.maskMenu = function () {
    return [
      { label: 'Add mask', sub: MK.SHAPES.filter(([s]) => s !== 'path').map(([s, l]) => ({ label: l, act: () => SE.act.maskAdd(s) }))
        .concat(['-', { label: 'Freehand path', act: () => SE.act.maskTool('free') }, { label: 'Bezier path (pen)', act: () => SE.act.maskTool('pen') }]) },
      C.item('mask.remove'), C.item('mask.invert'), C.item('mask.edit')
    ];
  };
})();
