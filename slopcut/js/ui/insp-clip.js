/* SlopCut: inspector sections for clips: transform, crop, colour, fades, transition (visual),
   text (titles) and audio (volume, fades, keyframes). */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, M = SE.model, F = SE.fields, I = SE.inspector;
  const h = U.h;
  const body = () => document.querySelector('#insp .insp-body');

  I.visualSections = function (c) {
    const id = c.id, get = (k, d) => I.clipGet(id, k, d), set = (k, l) => I.clipSet(id, k, l), t = I.track;
    body().append(F.section('Transform', 'select',
      t(F.pair('Position', { label: 'X offset (px)', get: get('x'), set: (v) => set('x', 'Position')(Math.round(v)) }, { label: 'Y offset (px)', get: get('y'), set: (v) => set('y', 'Position')(Math.round(v)) })),
      t(F.slider('Scale', get('scale', 1), set('scale', 'Scale'), { step: 1, scale: 100, unit: '%', reset: 1, hardMin: SE.fit.SCALE.min * 100, hardMax: SE.fit.SCALE.max * 100,
        curve: { steps: SE.fit.SCALE.steps, to: SE.fit.toSlider, from: SE.fit.fromSlider } })),
      h('div', { class: 'ins-actions' },
        h('button', { type: 'button', class: 'btn sm', title: 'Scale the picture to cover the whole frame (aspect kept, centred)', onclick: () => fill(id, 'fill') }, 'Fill frame'),
        h('button', { type: 'button', class: 'btn sm', title: 'Scale the whole picture to fit inside the frame (centred)', onclick: () => fill(id, 'fit') }, 'Fit frame')),
      t(F.slider('Rotation', get('rot'), set('rot', 'Rotation'), { min: -180, max: 180, step: 1, unit: '°', reset: 0 })),
      t(F.slider('Opacity', get('opacity', 1), set('opacity', 'Opacity'), { min: 0, max: 100, step: 1, scale: 100, unit: '%', reset: 1, hardMin: 0, hardMax: 100 })),
      c.kind !== 'title' ? h('div', null,
        t(F.slider('Crop left', get('cropL'), set('cropL', 'Crop'), { min: 0, max: 50, scale: 100, reset: 0, hardMin: 0, hardMax: 100 })).el,
        t(F.slider('Crop right', get('cropR'), set('cropR', 'Crop'), { min: 0, max: 50, scale: 100, reset: 0, hardMin: 0, hardMax: 100 })).el,
        t(F.slider('Crop top', get('cropT'), set('cropT', 'Crop'), { min: 0, max: 50, scale: 100, reset: 0, hardMin: 0, hardMax: 100 })).el,
        t(F.slider('Crop bottom', get('cropB'), set('cropB', 'Crop'), { min: 0, max: 50, scale: 100, reset: 0, hardMin: 0, hardMax: 100 })).el) : null,
      h('div', { class: 'ins-actions' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => SE.change('Centre', (p) => { const cc = M.clip(p, id); cc.x = 0; cc.y = 0; }) }, 'Centre'),
        h('button', { type: 'button', class: 'btn sm', disabled: !SE.aspect.targetOf(SE.doc, c), title: 'Set the visible box back to the source ratio', onclick: () => SE.aspect.restore(id) }, 'Restore aspect ratio'))));
    if (c.kind !== 'color') body().append(F.section('Colour', 'color',
      t(F.slider('Brightness', get('bright'), set('bright', 'Brightness'), { min: -100, max: 100, reset: 0 })),
      t(F.slider('Contrast', get('contrast'), set('contrast', 'Contrast'), { min: -100, max: 100, reset: 0 })),
      t(F.slider('Saturation', get('sat'), set('sat', 'Saturation'), { min: -100, max: 100, reset: 0 })),
      t(F.slider('Temperature', get('temp'), set('temp', 'Temperature'), { min: -100, max: 100, reset: 0 })),
      h('div', { class: 'ins-actions' }, ...[['Warm', { temp: 35, sat: 10 }], ['Cool', { temp: -35 }], ['Punchy', { contrast: 25, sat: 30 }], ['B&W', { sat: -100, contrast: 15 }], ['Faded', { contrast: -25, bright: 8, sat: -20 }]].map(([l, v]) =>
        h('button', { type: 'button', class: 'btn sm', onclick: () => SE.change('Colour look', (p) => Object.assign(M.clip(p, id), { bright: 0, contrast: 0, sat: 0, temp: 0 }, v)) }, l)))));
    body().append(F.section('Fades & transition', 'transition',
      t(F.slider('Fade in', get('fadeIn'), set('fadeIn', 'Fade in'), { min: 0, max: Math.min(10, c.dur), step: 0.05, unit: 's', reset: 0, hardMin: 0 })),
      t(F.slider('Fade out', get('fadeOut'), set('fadeOut', 'Fade out'), { min: 0, max: Math.min(10, c.dur), step: 0.05, unit: 's', reset: 0, hardMin: 0 })),
      t(F.select('Transition in', [['', 'None']].concat(M.TRANSITIONS), () => (M.clip(SE.doc, id) && M.clip(SE.doc, id).trIn ? M.clip(SE.doc, id).trIn.type : ''), (v) => SE.change(v ? 'Transition' : 'Remove transition', (p) => SE.edit.setTransition(p, id, v || null, (M.clip(p, id).trIn && M.clip(p, id).trIn.dur) || 1)))),
      c.trIn ? t(F.slider('Duration', () => { const cc = M.clip(SE.doc, id); return cc && cc.trIn ? cc.trIn.dur : 1; }, (v) => SE.change('Transition length', (p) => { const cc = M.clip(p, id); SE.edit.setTransition(p, id, cc.trIn.type, v); }, { key: 'insp:trdur' + id }), { min: 0.1, max: Math.min(5, c.dur), step: 0.05, unit: 's' })) : null,
      !M.prevAdjacent(SE.doc, c) && c.trIn ? h('p', { class: 'ins-note' }, 'No clip right before this one, so it transitions from the tracks below.') : null));
  };
  function fill(id, mode) {
    SE.change(mode === 'fill' ? 'Fill frame' : 'Fit frame', (p) => { const c = M.clip(p, id); SE.fit.clip(p, c, c.media && M.media(p, c.media), mode); });
  }
  /** Font choices: the standard list, then the bundled and downloaded families of shared/fonts (when the picker loaded). */
  function fontOptions() {
    const names = [...M.FONTS];
    if (window.SlopFonts) for (const n of SlopFonts.names()) if (!names.includes(n)) names.push(n);
    return names.map((f) => [f, f]);
  }
  I.textSection = function (c) {
    const id = c.id, t = I.track;
    const tg = (k) => () => { const cc = M.clip(SE.doc, id); return cc ? cc.text[k] : ''; };
    const ts = (k, l) => F.setter(l || 'Text', id + ':text.' + k, (p, v) => { const cc = M.clip(p, id); if (cc) cc.text = Object.assign({}, cc.text, { [k]: v }); });
    const tb = t(F.text('Text', tg('str'), ts('str'), { multiline: true }));
    const fontF = t(F.select('Font', fontOptions(), tg('font'), ts('font', 'Font')));
    body().append(F.section('Text', 'text', tb,
      fontF,
      t(F.slider('Size', tg('size'), ts('size', 'Text size'), { min: 8, max: 400, step: 1, unit: 'px', hardMin: 4 })),
      t(F.chips('Style', [['b', 'Bold'], ['i', 'Italic'], ['s', 'Shadow']], () => { const x = M.clip(SE.doc, id); return x ? [x.text.bold && 'b', x.text.italic && 'i', x.text.shadow && 's'].filter(Boolean) : []; },
        (v) => { const k = { b: 'bold', i: 'italic', s: 'shadow' }[v]; ts(k, 'Text style')(!M.clip(SE.doc, id).text[k]); SE.history.breakCoalescing(); })),
      t(F.chips('Align', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], tg('align'), (v) => { ts('align', 'Align')(v); SE.history.breakCoalescing(); })),
      t(F.color('Colour', tg('color'), ts('color', 'Text colour'))),
      t(F.color('Outline', tg('stroke'), ts('stroke', 'Outline colour'))),
      t(F.slider('Outline width', tg('strokeW'), ts('strokeW', 'Outline width'), { min: 0, max: 20, step: 0.5, unit: 'px', hardMin: 0 })),
      t(F.chips('Box', [['', 'None'], ['#000000b0', 'Dark'], ['#ffffffd0', 'Light'], ['#d4ff3a', 'Lime']], tg('bg'), (v) => { ts('bg', 'Text box')(v); SE.history.breakCoalescing(); })),
      t(F.chips('Animation in', SE.text.ANIMS, tg('anim'), (v) => { ts('anim', 'Text animation')(v); SE.history.breakCoalescing(); })),
      t(F.chips('Animation out', SE.text.OUTS, () => { const x = M.clip(SE.doc, id); return x && x.text.out ? x.text.out : 'same'; }, (v) => { ts('out', 'Text exit')(v); SE.history.breakCoalescing(); }))));
    I.textInput = tb.input;
    // The font list is the shared picker (shared/fonts/picker.js): bundled and downloaded families, and Get more.
    if (window.SlopFonts) SlopFonts.attach(fontF.el.querySelector('select'), { value: c.text.font, legacy: M.FONTS, onPick: () => SE.emit('frame', {}) });
  };
  I.audioSection = function (c) {
    const id = c.id, t = I.track, get = (k) => I.clipGet(id, k);
    const db = () => { const v = M.clip(SE.doc, id); return v ? 20 * Math.log10(Math.max(1e-4, v.vol)) : 0; };
    body().append(F.section('Audio', 'speaker',
      t(F.slider('Volume', db, (v) => SE.change('Volume', (p) => { M.clip(p, id).vol = U.round(v <= -59.5 ? 0 : Math.pow(10, v / 20), 4); }, { key: 'insp:vol' + id }), { min: -60, max: 12, step: 0.5, unit: 'dB', reset: 0, dec: 1 })),
      t(F.slider('Fade in', get('afIn'), I.clipSet(id, 'afIn', 'Audio fade in'), { min: 0, max: Math.min(10, c.dur), step: 0.05, unit: 's', reset: 0, hardMin: 0 })),
      t(F.slider('Fade out', get('afOut'), I.clipSet(id, 'afOut', 'Audio fade out'), { min: 0, max: Math.min(10, c.dur), step: 0.05, unit: 's', reset: 0, hardMin: 0 })),
      h('p', { class: 'ins-note' }, (c.keys ? c.keys.length : 0) + ' volume keyframes. Ctrl/⌥-click the yellow line on the clip to add one, drag to move, or use Shift+K at the playhead.'),
      h('div', { class: 'ins-actions' },
        h('button', { type: 'button', class: 'btn sm', onclick: () => SE.cmd.run('clip.volKey') }, 'Keyframe at playhead'),
        c.keys ? h('button', { type: 'button', class: 'btn sm', onclick: () => SE.change('Clear keyframes', (p) => { M.clip(p, id).keys = null; }) }, 'Clear keyframes') : null)));
  };
})();
