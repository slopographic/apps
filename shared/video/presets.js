/* Shared video core (window.SlopVideo.presets): frame size presets for sequences and exports. The chosen
   size is the sequence size used for layout and export. Aspect names ('16:9', '9:16', '1:1', '4:5') map to
   the preset of that shape. Pure data and helpers. */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const SV = (root.SlopVideo = root.SlopVideo || {});
  const P = (SV.presets = {});

  P.LIST = Object.freeze([
    { id: 'phone', name: 'Phone vertical 1080×1920 (9:16)', w: 1080, h: 1920, aspect: '9:16' },
    { id: 'square', name: 'Square 1080×1080', w: 1080, h: 1080, aspect: '1:1' },
    { id: 'landscape', name: 'Landscape 1920×1080 (16:9)', w: 1920, h: 1080, aspect: '16:9' },
    { id: '4k', name: '4K landscape 3840×2160', w: 3840, h: 2160, aspect: '16:9' },
    { id: 'portrait', name: 'Portrait 1080×1350 (4:5)', w: 1080, h: 1350, aspect: '4:5' }
  ]);
  P.CUSTOM = 'custom';
  /** Limits for a custom size. Both sides are even (the encoders need it). */
  P.MIN = 16; P.MAX_W = 7680; P.MAX_H = 4320;

  P.get = (id) => P.LIST.find((x) => x.id === id) || null;
  /** Even, clamped width and height. */
  P.clamp = function (w, h) {
    const even = (v, lo, hi) => Math.min(hi, Math.max(lo, Math.round(+v / 2) * 2 || lo));
    return { w: even(w, P.MIN, P.MAX_W), h: even(h, P.MIN, P.MAX_H) };
  };
  /** The preset of an aspect name ('16:9' → landscape, …), or null. */
  P.byAspect = (name) => P.LIST.find((x) => x.aspect === name) || null;
  /** Size for an aspect name, or null. */
  P.aspectSize = (name) => { const a = P.byAspect(name); return a ? { w: a.w, h: a.h } : null; };
  /** Dropdown choices: [[id, label]] with the custom entry last. */
  P.choices = () => P.LIST.map((x) => [x.id, x.name]).concat([[P.CUSTOM, 'Custom width and height']]);
  /** Size of a preset id, or the custom size (w, h) when id is custom. Null when unknown. */
  P.size = function (id, w, h) {
    if (id === P.CUSTOM) return P.clamp(w, h);
    const x = P.get(id);
    return x ? { w: x.w, h: x.h } : null;
  };
  /** The preset id that matches a size, or 'custom'. */
  P.idFor = (w, h) => { const x = P.LIST.find((q) => q.w === w && q.h === h); return x ? x.id : P.CUSTOM; };
  /** Legacy aspect list [name, w, h] (kept for the older dialogs). */
  P.ASPECTS = Object.freeze(['16:9', '9:16', '1:1'].map((a) => { const s = P.aspectSize(a); return [a, s.w, s.h]; }));
})();
