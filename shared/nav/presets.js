/* SlopNav presets: the built-in navigation presets, as plain data. Classic script, no dependencies.
 * Sets window.SlopNav.presets. A preset is { id, name, blurb, custom?, bindings } and bindings has
 * every key listed in SlopNav.validate.KEYS (see validate.js for the allowed values). */
(function () {
  'use strict';
  const N = (window.SlopNav = window.SlopNav || {});

  // Slop: the default. Plain wheel zooms around the pointer; Shift+wheel pans sideways.
  const SLOP = {
    zoomWheel: 'plain', panWheel: 'shift', spacePan: true, middlePan: true, pinch: 'zoom', touchPan: true,
    fitKey: '', actualKey: '', zoomInKeys: [], zoomOutKeys: [], handKey: '', clickZoomKey: '',
  };
  const over = (o) => Object.assign({}, SLOP, o, { zoomInKeys: (o.zoomInKeys || SLOP.zoomInKeys).slice(), zoomOutKeys: (o.zoomOutKeys || SLOP.zoomOutKeys).slice() });

  const LIST = [
    { id: 'slop', name: 'Slop', blurb: 'The default. Wheel zooms around the pointer, Space or middle drag pans, pinch zooms on touch.', bindings: over({}) },
    {
      id: 'photoshop', name: 'Photoshop-style',
      blurb: 'Alt + wheel zooms, the wheel scrolls, Space drag pans, Ctrl/⌘ +/- zooms, Ctrl/⌘ 0 fits, Ctrl/⌘ 1 is 100%.',
      bindings: over({ zoomWheel: 'alt', panWheel: 'plain', fitKey: 'Mod+0', actualKey: 'Mod+1', zoomInKeys: ['Mod+='], zoomOutKeys: ['Mod+-'], clickZoomKey: 'Mod+Space' }),
    },
    {
      id: 'illustrator', name: 'Illustrator-style',
      blurb: 'Ctrl/⌘ + wheel zooms, the wheel scrolls, Space drag pans, H holds the hand tool, Ctrl/⌘ +/- zooms, Ctrl/⌘ 0 fits.',
      bindings: over({ zoomWheel: 'ctrl', panWheel: 'plain', handKey: 'H', fitKey: 'Mod+0', actualKey: 'Mod+1', zoomInKeys: ['Mod+='], zoomOutKeys: ['Mod+-'] }),
    },
    {
      id: 'figma', name: 'Figma-style',
      blurb: 'Trackpad pinch zooms, two-finger drag pans, the wheel pans, Ctrl/⌘ + wheel zooms, Shift+1 fits, Shift+0 is 100%.',
      bindings: over({ zoomWheel: 'ctrl', panWheel: 'plain', fitKey: 'Shift+1', actualKey: 'Shift+0', zoomInKeys: ['Mod+='], zoomOutKeys: ['Mod+-'] }),
    },
    { id: 'custom', name: 'Custom', custom: true, blurb: 'Set each binding yourself. Starts from Slop and is saved for this app.', bindings: over({}) },
  ];

  const byId = {};
  for (const p of LIST) byId[p.id] = p;
  /** A fresh deep copy of a built-in preset's bindings (callers may mutate it). */
  const clone = (b) => JSON.parse(JSON.stringify(b));
  N.presets = {
    list: () => LIST.map((p) => ({ id: p.id, name: p.name, blurb: p.blurb, custom: !!p.custom, bindings: clone(p.bindings) })),
    get: (id) => (byId[id] ? { id, name: byId[id].name, blurb: byId[id].blurb, custom: !!byId[id].custom, bindings: clone(byId[id].bindings) } : null),
    has: (id) => Object.prototype.hasOwnProperty.call(byId, id),
    DEFAULT: 'slop',
    clone,
  };
})();
