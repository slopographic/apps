/* SlopCut: the Inspector section for a graphic clip (kind 'graphic'): shape, colour, size, motion and the counter
   target. The shapes and motions come from shared/graphics (SlopGraphics); the renderer is render/graphics.js. */
(function () {
  'use strict';
  const SE = window.SE, M = SE.model, F = SE.fields, I = SE.inspector;
  const body = () => document.querySelector('#insp .insp-body');

  I.graphicSection = function (c) {
    const id = c.id, t = I.track, G = window.SlopGraphics;
    const gg = (k) => () => { const cc = M.clip(SE.doc, id); return cc && cc.gfx ? cc.gfx[k] : 0; };
    const gs = (k, label) => F.setter(label, id + ':gfx.' + k, (p, v) => { const cc = M.clip(p, id); if (cc) cc.gfx = Object.assign({}, cc.gfx, { [k]: v }); });
    const rows = [
      t(F.select('Shape', G.list().map((s) => [s.id, s.name]), gg('id'), gs('id', 'Shape'))),
      t(F.color('Colour', gg('color'), gs('color', 'Graphic colour'))),
      t(F.slider('Size', gg('size'), gs('size', 'Graphic size'), { min: 5, max: 100, step: 1, scale: 100, unit: '%', reset: 0.3, hardMin: 5, hardMax: 100 })),
      t(F.chips('Motion', G.ANIMS, gg('anim'), (v) => { gs('anim', 'Graphic motion')(v); SE.history.breakCoalescing(); }))
    ];
    if (c.gfx.id === 'counter') rows.push(t(F.number('Count to', gg('value'), gs('value', 'Counter target'), { min: 0, max: 1e9, step: 1 })));
    body().append(F.section('Graphic', 'sparkle', ...rows,
      SE.util.h('p', { class: 'ins-note' }, 'Draw on, Bounce and Pop run once per clip; Pulse repeats. Keyframes and Opacity act on top.')));
  };
})();
