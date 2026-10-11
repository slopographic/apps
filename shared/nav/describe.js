/* SlopNav descriptions: what each binding does, in plain words, and the choices the modal offers.
 * Classic script; sets window.SlopNav.describe. Option values are strings (a select's value) and
 * parseOption turns them back into the binding's type. */
(function () {
  'use strict';
  const N = (window.SlopNav = window.SlopNav || {});
  const { label } = N.logic;

  const WHEEL_OPTS = [['plain', 'Plain wheel'], ['ctrl', 'Ctrl/⌘ + wheel'], ['alt', 'Alt + wheel'], ['shift', 'Shift + wheel'], ['off', 'Off']];
  const COMBO_OPTS = {
    fitKey: ['', 'Mod+0', 'Mod+Shift+0', 'Shift+1', 'Alt+0'],
    actualKey: ['', 'Mod+1', 'Shift+0', 'Alt+1'],
    zoomInKeys: ['', 'Mod+=', 'Alt+=', 'Shift+='],
    zoomOutKeys: ['', 'Mod+-', 'Alt+-', 'Shift+-'],
    handKey: ['', 'H', 'Alt+H'],
    clickZoomKey: ['', 'Mod+Space', 'Alt+Space'],
  };
  const BOOL_OPTS = [['true', 'On'], ['false', 'Off']];
  const OPTIONS = {
    zoomWheel: WHEEL_OPTS, panWheel: WHEEL_OPTS,
    spacePan: BOOL_OPTS, middlePan: BOOL_OPTS, touchPan: BOOL_OPTS,
    pinch: [['zoom', 'Zooms'], ['off', 'Off']],
  };
  const TITLES = {
    zoomWheel: 'Wheel zoom', panWheel: 'Wheel pan', spacePan: 'Space drag pans', middlePan: 'Middle drag pans',
    pinch: 'Pinch zoom', touchPan: 'Two-finger pan', fitKey: 'Fit on screen key', actualKey: '100% key',
    zoomInKeys: 'Zoom in key', zoomOutKeys: 'Zoom out key', handKey: 'Hold to pan key', clickZoomKey: 'Click to zoom in key',
  };
  const WORDS = {
    zoomWheel: { plain: 'Wheel zooms around the pointer', ctrl: 'Ctrl/⌘ + wheel zooms around the pointer', alt: 'Alt + wheel zooms around the pointer', shift: 'Shift + wheel zooms around the pointer', off: 'Wheel does not zoom' },
    panWheel: { plain: 'Wheel scrolls (pans) the canvas', ctrl: 'Ctrl/⌘ + wheel pans', alt: 'Alt + wheel pans', shift: 'Shift + wheel pans sideways', off: 'Wheel does not pan' },
    spacePan: { true: 'Hold Space and drag to pan', false: 'Space does not pan' },
    middlePan: { true: 'Middle-drag pans', false: 'Middle-drag does nothing' },
    pinch: { zoom: 'Pinch zooms (trackpad and touch)', off: 'Pinch does nothing' },
    touchPan: { true: 'Two-finger drag pans on touch', false: 'Two-finger drag does not pan' },
  };
  const COMBO_WORDS = {
    fitKey: (c) => `${label(c)} fits the page to the window`,
    actualKey: (c) => `${label(c)} shows 100%`,
    zoomInKeys: (c) => `${label(c)} zooms in`,
    zoomOutKeys: (c) => `${label(c)} zooms out`,
    handKey: (c) => `Hold ${label(c)} and drag to pan`,
    clickZoomKey: (c) => `${label(c)} + click zooms in`,
  };

  /** One line per binding: [{ name, title, text }]. Unset combos say so. */
  function describe(b) {
    return N.validate.KEYS.map((name) => {
      const v = b[name];
      let text;
      if (WORDS[name]) text = WORDS[name][String(v)] || String(v);
      else {
        const combos = (Array.isArray(v) ? v : [v]).filter(Boolean);
        text = combos.length ? combos.map((c) => COMBO_WORDS[name](c)).join('; ') : 'Not bound';
      }
      return { name, title: TITLES[name], text };
    });
  }

  /** The choices for one binding as [value, label] string pairs. `current` is kept even when it is not listed. */
  function optionsFor(name, current) {
    const cur = Array.isArray(current) ? current[0] || '' : current;
    if (OPTIONS[name]) return OPTIONS[name].map(([v, l]) => [v, l]);
    const list = COMBO_OPTS[name] || [];
    const out = list.map((c) => [c, c ? label(c) : 'Not bound']);
    if (cur && !list.includes(cur)) out.push([cur, label(cur)]);
    return out;
  }
  /** Turns a select's string value back into the binding's type: bools, a one-item list for combos, or a choice. */
  function parseOption(name, str) {
    const s = N.validate.SPEC[name];
    if (!s) return undefined;
    if (s.kind === 'bool') return str === 'true';
    if (s.kind === 'combos') return str ? [str] : [];
    return str;
  }
  /** The select's current string value for a binding. */
  function valueOf(name, v) {
    if (Array.isArray(v)) return v[0] || '';
    return String(v);
  }

  N.describe = { describe, optionsFor, parseOption, valueOf, TITLES, WORDS };
})();
