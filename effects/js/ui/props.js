// Slop Effects property panel, Layer tab: the selected layer's name, visibility, parent, stacking, transform (position,
// anchor, scale, rotation, opacity, each with a stopwatch that keys it at the playhead) and its source (colour, shape, text,
// media). Editing a keyed property keys it at the playhead; an unkeyed one changes the base value. Inputs commit on change
// (Enter or blur). Values at the playhead refresh as the playhead moves. Classic script: window.SlopEffects.props.
(function (g) {
  'use strict';
  const ns = (g.SlopEffects = g.SlopEffects || {});
  const { h, numberOf } = ns.dom;
  const D = () => ns.defs;
  const TEXT_WEIGHTS = [[400, 'Regular'], [700, 'Bold'], [900, 'Black']];
  const SHAPE_LIST = D().SHAPES;

  /** Mounts the panel into host (the Layer tab). Returns { render, update }. */
  function mount(host, S, act, io) {
    let bindings = []; // { input, get } refreshed on playhead moves

    /** A labelled row: label, control and an optional trailing element. */
    const row = (label, control, extra) => h('div', { class: 'fx-row' }, h('label', null, label), control, extra || h('span'));

    /** A number input that commits on change. */
    function num(value, onset, opts = {}) {
      const input = h('input', { class: 'sui-input', type: 'number', step: opts.step || 'any', value: fmt(value), 'aria-label': opts.label || '', min: opts.min, max: opts.max });
      input.addEventListener('change', () => { const v = numberOf(input); if (v !== null) onset(v); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      return input;
    }
    const fmt = (v) => (Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : '');

    /** The stopwatch button for a property: keyed or not, and whether a key sits exactly at the playhead. */
    function stopwatch(layer, prop) {
      const keyed = act.isKeyed(S.doc, layer.id, prop);
      const here = keyed && (S.doc.tl.tracks[layer.id][prop] || []).some((k) => Math.abs(k.t - S.playhead) < 1e-4);
      return h('button', {
        type: 'button', class: 'fx-key', 'aria-pressed': String(keyed), 'data-keyed-now': String(here), 'aria-label': `${keyed ? 'Remove keyframes' : 'Add keyframe'} for ${prop}`,
        title: keyed ? 'Animated: click to remove all keyframes' : 'Click to animate: adds a keyframe at the playhead',
        onclick: () => act.toggleKeyed(prop, layer.id),
      }, '◆');
    }

    /** Transform rows: position, anchor, scale (x, y), rotation and opacity. */
    function transform(layer) {
      const vals = ns.values.valuesAt(S.doc, layer, S.playhead);
      const rows = [];
      const pair = (prop, label, unit) => {
        const v = vals[prop];
        /** Changes one component, keeping the other at its current value at the playhead. */
        const commit = (i, x) => { const cur = act.valueNow(layer.id, prop).slice(); cur[i] = x; act.setValue(prop, cur, layer.id); };
        const xi = num(v[0], (x) => commit(0, x), { label: `${label} x` });
        const yi = num(v[1], (y) => commit(1, y), { label: `${label} y` });
        bindings.push({ input: xi, get: () => act.valueNow(layer.id, prop)[0] }, { input: yi, get: () => act.valueNow(layer.id, prop)[1] });
        rows.push(h('div', { class: 'fx-row' }, h('label', null, label + (unit ? ` (${unit})` : '')), h('div', { class: 'fx-pair' }, xi, yi), stopwatch(layer, prop)));
      };
      const single = (prop, label, unit, opts) => {
        const input = num(vals[prop], (x) => act.setValue(prop, Math.min(opts.max, Math.max(opts.min, x))), { label, min: opts.min, max: opts.max, step: opts.step });
        bindings.push({ input, get: () => act.valueNow(layer.id, prop) });
        rows.push(h('div', { class: 'fx-row' }, h('label', null, label + (unit ? ` (${unit})` : '')), input, stopwatch(layer, prop)));
      };
      pair('position', 'Position', 'px');
      pair('anchor', 'Anchor', 'px');
      pair('scale', 'Scale', '%');
      single('rotation', 'Rotation', '°', { min: -100000, max: 100000, step: 'any' });
      single('opacity', 'Opacity', '%', { min: 0, max: 100, step: 'any' });
      return h('section', { class: 'fx-group', 'aria-label': 'Transform' }, h('h3', null, 'Transform at playhead'), rows);
    }

    /** Source fields by layer type. */
    function source(layer) {
      const s = layer.source;
      const set = (patch) => { if (Object.keys(patch).length) S.edit('Edit layer', (d) => ns.layers.setSource(d, layer.id, patch)); };
      const colour = (val, key, label) => h('input', { class: 'sui-input', type: 'color', value: val, 'aria-label': label, style: 'height:30px;padding:2px', onchange: (e) => set({ [key]: e.target.value }) });
      if (layer.type === 'solid') {
        return h('section', { class: 'fx-group', 'aria-label': 'Source' }, h('h3', null, 'Solid'),
          row('Colour', colour(s.color, 'color', 'Solid colour')),
          row('Width', num(s.w, (v) => set({ w: Math.max(1, v) }), { label: 'Width' }), h('span', null, 'px')),
          row('Height', num(s.h, (v) => set({ h: Math.max(1, v) }), { label: 'Height' }), h('span', null, 'px')));
      }
      if (layer.type === 'shape') {
        const shape = h('select', { class: 'sui-input', 'aria-label': 'Shape', onchange: (e) => set({ shape: e.target.value }) }, SHAPE_LIST.map(([v, l]) => h('option', { value: v, selected: s.shape === v ? true : null }, l)));
        return h('section', { class: 'fx-group', 'aria-label': 'Source' }, h('h3', null, 'Shape'),
          row('Shape', shape),
          row('Width', num(s.w, (v) => set({ w: Math.max(1, v) }), { label: 'Width' }), h('span', null, 'px')),
          row('Height', num(s.h, (v) => set({ h: Math.max(1, v) }), { label: 'Height' }), h('span', null, 'px')),
          s.shape === 'rrect' ? row('Corner', num(s.radius, (v) => set({ radius: Math.max(0, v) }), { label: 'Corner radius' }), h('span', null, 'px')) : null,
          s.shape === 'line' ? null : row('Fill', colour(s.fill, 'fill', 'Fill colour')),
          row('Stroke', colour(s.stroke, 'stroke', 'Stroke colour')),
          row('Stroke width', num(s.strokeWidth, (v) => set({ strokeWidth: Math.max(0, v) }), { label: 'Stroke width' }), h('span', null, 'px')));
      }
      if (layer.type === 'text') {
        const text = h('textarea', { class: 'sui-input', rows: 2, 'aria-label': 'Text', onchange: (e) => set({ text: e.target.value }) }, s.text);
        const fontSel = h('select', { class: 'sui-input', 'aria-label': 'Font' }, h('option', { value: s.font }, s.font));
        const weight = h('select', { class: 'sui-input', 'aria-label': 'Weight', onchange: (e) => set({ weight: Number(e.target.value) }) }, TEXT_WEIGHTS.map(([v, l]) => h('option', { value: v, selected: s.weight === v ? true : null }, l)));
        const align = h('select', { class: 'sui-input', 'aria-label': 'Align', onchange: (e) => set({ align: e.target.value }) }, D().ALIGN.map((a) => h('option', { value: a, selected: s.align === a ? true : null }, a)));
        const fit = h('button', { type: 'button', class: 'sui-btn', onclick: () => fitText(layer) }, 'Fit box to text');
        const node = h('section', { class: 'fx-group', 'aria-label': 'Source' }, h('h3', null, 'Text'),
          row('Text', text), row('Font', fontSel), row('Weight', weight), row('Size', num(s.size, (v) => set({ size: Math.max(1, v) }), { label: 'Size' }), h('span', null, 'px')),
          row('Align', align), row('Colour', colour(s.color, 'color', 'Text colour')), h('div', { class: 'fx-chips' }, fit));
        queueMicrotask(() => { if (g.SlopFonts && g.SlopFonts.attach) { const api = g.SlopFonts.attach(fontSel, { value: s.font, getMore: true, onPick: (f) => set({ font: f }) }); void api; } });
        return node;
      }
      if (layer.type === 'image' || layer.type === 'video') {
        const bin = ns.media.get(s.mediaId);
        const name = bin ? bin.name : (S.doc.media.find((m) => m.id === s.mediaId) || {}).name || 'Missing media';
        const relink = !bin ? h('button', { type: 'button', class: 'sui-btn fx-warn', onclick: () => io.relink(s.mediaId) }, 'Relink media…') : null;
        return h('section', { class: 'fx-group', 'aria-label': 'Source' }, h('h3', null, D().label(D().LAYER_TYPES, layer.type)),
          h('p', { class: bin ? '' : 'fx-warn', style: 'margin:0' }, name, bin ? ` · ${s.w}×${s.h}${layer.type === 'video' ? ` · ${(bin.dur || 0).toFixed(2)} s` : ''}` : ' · not loaded in this session'),
          relink);
      }
      return h('section', { class: 'fx-group', 'aria-label': 'Source' }, h('h3', null, 'Null'), h('p', { class: 'fx-empty', style: 'padding:0;text-align:left' }, 'A null has no picture. Use it as a parent to move, rotate or scale several layers together.'));
    }

    /** Sets a text layer's box to the measured width and height of its text. */
    function fitText(layer) {
      const s = layer.source;
      const c = document.createElement('canvas').getContext('2d');
      c.font = `${s.weight} ${s.size}px ${ns.draw.fontStack(s.font)}`;
      const lines = String(s.text || '').split('\n');
      const w = Math.ceil(Math.max(1, ...lines.map((l) => c.measureText(l).width)));
      const hh = Math.ceil(lines.length * s.size * 1.2);
      S.edit('Fit text box', (d) => ns.layers.setSource(d, layer.id, { w, h: hh }));
    }

    /** Parent choices: none, and every layer that would not make a loop. */
    function parentRow(layer) {
      const options = [h('option', { value: '' }, 'None')];
      for (const l of S.doc.layers) if (l.id !== layer.id && !ns.values.wouldLoop(S.doc, layer.id, l.id)) options.push(h('option', { value: l.id, selected: layer.parent === l.id ? true : null }, l.name));
      return row('Parent', h('select', { class: 'sui-input', 'aria-label': 'Parent layer', onchange: (e) => act.setParent(e.target.value || null, layer.id) }, options));
    }

    /** The header: name, visibility and the stack buttons. */
    function header(layer) {
      const idx = S.doc.layers.findIndex((l) => l.id === layer.id);
      const name = h('input', { class: 'sui-input', type: 'text', value: layer.name, maxlength: 80, 'aria-label': 'Layer name', onchange: (e) => S.edit('Rename layer', (d) => ns.layers.rename(d, layer.id, e.target.value)) });
      const hid = h('input', { type: 'checkbox', checked: layer.hidden ? null : true, 'aria-label': 'Visible', onchange: (e) => S.edit('Visibility', (d) => ns.layers.setHidden(d, layer.id, !e.target.checked)) });
      return h('section', { class: 'fx-group', 'aria-label': 'Layer' },
        h('h3', null, D().label(D().LAYER_TYPES, layer.type)),
        row('Name', name),
        row('Visible', h('label', { class: 'sui-check' }, hid, h('span', null, 'Show in preview and render'))),
        parentRow(layer),
        h('div', { class: 'fx-chips' },
          h('button', { type: 'button', class: 'sui-btn', disabled: idx <= 0 ? true : null, title: 'Bring forward ( ] )', onclick: () => act.moveLayer(-1) }, 'Up'),
          h('button', { type: 'button', class: 'sui-btn', disabled: idx >= S.doc.layers.length - 1 ? true : null, title: 'Send back ( [ )', onclick: () => act.moveLayer(1) }, 'Down'),
          h('button', { type: 'button', class: 'sui-btn', title: 'Duplicate (Ctrl+D)', onclick: () => act.duplicateLayer() }, 'Duplicate'),
          h('button', { type: 'button', class: 'sui-btn sui-danger', title: 'Delete (Delete)', onclick: () => act.removeLayer() }, 'Delete')));
    }

    /** Re-renders for the selected layer, or the empty state with the add buttons. */
    function render() {
      bindings = [];
      host.replaceChildren();
      const layer = act.sel();
      if (!layer) {
        host.append(h('div', { class: 'fx-empty' }, 'Select a layer in the timeline, or add one.'),
          h('div', { class: 'fx-chips', style: 'justify-content:center' },
            ...[['solid', 'Solid'], ['shape', 'Shape'], ['text', 'Text'], ['null', 'Null']].map(([t, l]) => h('button', { type: 'button', class: 'sui-btn', onclick: () => act.addLayer(t, t === 'text' ? { size: 120 } : {}) }, l)),
            h('button', { type: 'button', class: 'sui-btn', onclick: () => io.importFromComputer() }, 'Image or video…')));
        return;
      }
      host.append(header(layer), transform(layer), source(layer));
      if (layer.type !== 'null' && layer.type !== 'solid' && layer.type !== 'shape' && layer.type !== 'text') {
        host.append(h('p', { class: 'fx-empty' }, 'Image and video layers take their size from the file.'));
      }
    }

    /** Updates the values at the playhead without rebuilding the panel (keeps focus). */
    function update() {
      for (const b of bindings) {
        if (document.activeElement === b.input) continue;
        const v = b.get();
        b.input.value = fmt(v);
      }
    }

    S.on((what) => {
      if (what === 'time') update();
      else if (what === 'doc' || what === 'sel') { if (!S.isDragging()) render(); else update(); }
    });
    render();
    return { render, update };
  }

  ns.props = { mount, SHAPE_LIST };
})(typeof window !== 'undefined' ? window : globalThis);
