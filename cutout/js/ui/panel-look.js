/* Slop Cutout — the look sections of the settings panel: Background, Shadow and Crop. panel.js appends
 * them. Each control is a kit control bound to one field of the active image's look (undo per drag). */
(function () {
  'use strict';
  const CO = window.CO, S = CO.state, K = CO.kit;
  const PL = CO.panelLook = {};
  const src = (it) => it || S.defaults;
  const pct = (v) => Math.round(v * 100) + '%';
  const px = (v) => v + ' px';
  const show = (el, on) => { el.hidden = !on; };

  /** Slider bound to one look field. */
  function slider(bind, label, min, max, step, fmt, get, look) {
    const c = K.slider({ label, min, max, step, value: get(S.defaults), fmt, onInput: look.input, onCommit: look.commit });
    bind((it) => c.sync(get(src(it))));
    return c;
  }
  /** Colour row bound to one look field. */
  function colour(bind, label, get, look) {
    const c = K.color({ label, value: get(S.defaults), onInput: look.input, onCommit: look.commit });
    bind((it) => c.sync(get(src(it))));
    return c;
  }

  function background(bind) {
    const mode = K.look('Background', (it, v) => { it.bg.mode = v; });
    const col = K.look('Background colour', (it, v) => { it.bg.color = v; });
    const blur = K.look('Blur', (it, v) => { it.bg.blur = v; });
    const gA = K.look('Gradient start', (it, v) => { it.bg.gradA = v; });
    const gB = K.look('Gradient end', (it, v) => { it.bg.gradB = v; });
    const ang = K.look('Gradient angle', (it, v) => { it.bg.angle = v; });

    const seg = K.seg({
      options: [['transparent', 'Transparent'], ['color', 'Colour'], ['gradient', 'Gradient'], ['blur', 'Blur']],
      value: S.defaults.bg.mode, onChange: (v) => mode.once(v),
    });
    const colRow = colour(bind, 'Colour', (o) => o.bg.color, col);
    const blurRow = slider(bind, 'Blur', 0, 80, 1, px, (o) => o.bg.blur, blur);
    const aRow = colour(bind, 'Start', (o) => o.bg.gradA, gA);
    const bRow = colour(bind, 'End', (o) => o.bg.gradB, gB);
    const angRow = slider(bind, 'Angle', 0, 360, 1, (v) => v + '°', (o) => o.bg.angle, ang);
    bind((it) => {
      const b = src(it).bg;
      seg.sync(b.mode);
      show(colRow, b.mode === 'color');
      show(blurRow, b.mode === 'blur');
      show(aRow, b.mode === 'gradient');
      show(bRow, b.mode === 'gradient');
      show(angRow, b.mode === 'gradient');
    });
    return K.section('Background', seg, colRow, blurRow, aRow, bRow, angRow);
  }

  function shadow(bind) {
    const on = K.look('Shadow', (it, v) => { it.shadow.on = v; });
    const op = K.look('Shadow opacity', (it, v) => { it.shadow.opacity = v; });
    const bl = K.look('Shadow blur', (it, v) => { it.shadow.blur = v; });
    const sx = K.look('Shadow x', (it, v) => { it.shadow.x = v; });
    const sy = K.look('Shadow y', (it, v) => { it.shadow.y = v; });
    const sc = K.look('Shadow colour', (it, v) => { it.shadow.color = v; });

    const chk = K.check({ label: 'Drop shadow', checked: S.defaults.shadow.on, onChange: (v) => on.once(v) });
    const rows = [
      slider(bind, 'Opacity', 0, 1, 0.01, pct, (o) => o.shadow.opacity, op),
      slider(bind, 'Blur', 0, 30, 0.5, px, (o) => o.shadow.blur, bl),
      slider(bind, 'Offset X', -100, 100, 1, px, (o) => o.shadow.x, sx),
      slider(bind, 'Offset Y', -100, 100, 1, px, (o) => o.shadow.y, sy),
      colour(bind, 'Colour', (o) => o.shadow.color, sc),
    ];
    bind((it) => {
      const sh = src(it).shadow;
      chk.sync(sh.on);
      for (const r of rows) r.input.disabled = !sh.on;
    });
    return K.section('Shadow', chk, ...rows);
  }

  function crop(bind) {
    const mode = K.look('Crop', (it, v) => { it.crop.mode = v; });
    const pad = K.look('Crop padding', (it, v) => { it.crop.pad = v; });
    const seg = K.seg({
      options: [['original', 'Original'], ['subject', 'Subject']],
      value: S.defaults.crop.mode, onChange: (v) => mode.once(v),
    });
    const padRow = slider(bind, 'Padding', 0, 64, 1, px, (o) => o.crop.pad, pad);
    bind((it) => {
      const c = src(it).crop;
      seg.sync(c.mode);
      padRow.input.disabled = c.mode !== 'subject';
    });
    return K.section('Crop', seg, padRow);
  }

  /** The three look sections. bind(fn) registers fn(it) to run on every panel refresh (it = active image or null). */
  PL.build = function (bind = () => {}) {
    return [background(bind), shadow(bind), crop(bind)];
  };
})();
