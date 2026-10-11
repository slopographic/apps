// Slop Effects panels for the Effects tab (the ordered stack of each layer: add, enable, reorder, remove, and the numeric
// parameters with their stopwatches; the order is the order they are applied) and the Motion tab (animate in and out
// presets, and seeded Random motion with its bounds). Classic script: window.SlopEffects.propsFx.
(function (g) {
  'use strict';
  const ns = (g.SlopEffects = g.SlopEffects || {});
  const { h, numberOf } = ns.dom;
  const D = () => ns.defs;
  const PRESET_LIST = [['fade-in', 'Fade in'], ['slide-up', 'Slide up'], ['pop', 'Pop'], ['spin-in', 'Spin in']];
  const MOTION_PROPS = [['position', 'Position'], ['scale', 'Scale'], ['rotation', 'Rotation'], ['opacity', 'Opacity']];
  const fmt = (v) => (Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : '');

  /** A labelled row. */
  const row = (label, control, extra) => h('div', { class: 'fx-row' }, h('label', null, label), control, extra || h('span'));

  /** The Effects tab. Returns { render, update }. */
  function mountFx(host, S, act) {
    let bindings = [];

    /** One numeric parameter: its value at the playhead, and a stopwatch. */
    function param(layer, fx, name, def) {
      const prop = `fx.${fx.id}.${name}`;
      const keyed = act.isKeyed(S.doc, layer.id, prop);
      const input = h('input', { class: 'sui-input', type: 'number', step: 'any', min: def.min, max: def.max, value: fmt(ns.values.valuesAt(S.doc, layer, S.playhead).fx[fx.id][name]), 'aria-label': def.label });
      input.addEventListener('change', () => { const v = numberOf(input); if (v !== null) act.setValue(prop, v, layer.id); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      bindings.push({ input, get: () => ns.values.valuesAt(S.doc, act.sel(), S.playhead).fx[fx.id][name] });
      const sw = h('button', { type: 'button', class: 'fx-key', 'aria-pressed': String(keyed), 'aria-label': `${keyed ? 'Remove keyframes' : 'Add keyframe'} for ${def.label}`, title: 'Animate this parameter', onclick: () => act.toggleKeyed(prop, layer.id) }, '◆');
      return row(def.label, input, sw);
    }

    /** One effect in the stack, expanded when it is selected. */
    function card(layer, fx) {
      const def = D().EFFECTS[fx.kind];
      const idx = layer.effects.findIndex((f) => f.id === fx.id);
      const on = h('input', { type: 'checkbox', checked: fx.on ? true : null, 'aria-label': `${def.label} on`, onchange: (e) => act.setEffectOn(fx.id, e.target.checked) });
      const head = h('header', null, on,
        h('b', { title: def.label }, def.label),
        h('button', { type: 'button', class: 'sui-btn', 'aria-label': 'Move up', disabled: idx <= 0 ? true : null, onclick: () => act.moveEffect(fx.id, -1) }, '↑'),
        h('button', { type: 'button', class: 'sui-btn', 'aria-label': 'Move down', disabled: idx >= layer.effects.length - 1 ? true : null, onclick: () => act.moveEffect(fx.id, 1) }, '↓'),
        h('button', { type: 'button', class: 'sui-btn sui-danger', 'aria-label': `Remove ${def.label}`, onclick: () => act.removeEffect(fx.id) }, '×'));
      const open = S.sel.fx === fx.id;
      const rows = [];
      if (open) {
        for (const [name, p] of Object.entries(def.params)) {
          if (p.type === 'colour') {
            rows.push(row(p.label, h('input', { class: 'sui-input', type: 'color', value: fx.params[name], 'aria-label': p.label, style: 'height:30px;padding:2px', onchange: (e) => act.setValue(`fx.${fx.id}.${name}`, e.target.value, layer.id) })));
          } else rows.push(param(layer, fx, name, p));
        }
      }
      return h('div', {
        class: 'fx-card' + (open ? ' is-sel' : ''), 'data-fx': fx.id,
        onclick: (e) => { if (e.target.closest && e.target.closest('button, input, select')) return; S.select({ fx: open ? null : fx.id }); },
      }, head, rows.length ? rows : (fx.on ? null : h('p', { class: 'fx-empty', style: 'padding:0;text-align:left' }, 'Off: not drawn')));
    }

    function render() {
      bindings = [];
      host.replaceChildren();
      const layer = act.sel();
      if (!layer) { host.append(h('div', { class: 'fx-empty' }, 'Select a layer to add effects.')); return; }
      const kind = h('select', { class: 'sui-input', 'aria-label': 'Effect to add' }, D().EFFECT_KINDS.map((k) => h('option', { value: k }, D().EFFECTS[k].label)));
      host.append(h('section', { class: 'fx-group', 'aria-label': 'Add effect' }, h('h3', null, 'Stack'),
        row('Effect', kind, h('button', { type: 'button', class: 'sui-btn sui-primary', onclick: () => act.addEffect(kind.value) }, 'Add')),
        h('p', { class: 'fx-empty', style: 'padding:0;text-align:left' }, 'Applied top to bottom. Blur and colour use the browser canvas filter; a browser without it skips them.')));
      if (!layer.effects.length) host.append(h('div', { class: 'fx-empty' }, 'No effects on this layer yet.'));
      for (const fx of layer.effects) host.append(card(layer, fx));
    }

    function update() {
      for (const b of bindings) {
        if (document.activeElement === b.input) continue;
        const layer = act.sel();
        if (layer) b.input.value = fmt(b.get());
      }
    }

    S.on((what) => { if (what === 'time') update(); else if (what === 'doc' || what === 'sel') { if (!S.isDragging()) render(); } });
    render();
    return { render, update };
  }

  /** The Motion tab: animate in and out, and Random motion. Returns { render }. */
  function mountMotion(host, S, act, ka) {
    let seedText = '', seedHex = g.SlopVideo.seed.hex(g.SlopVideo.seed.make());

    /** A preset picker and its button. */
    function presetRow(label, dir) {
      const sel = h('select', { class: 'sui-input', 'aria-label': `${label} preset` }, PRESET_LIST.map(([v, l]) => h('option', { value: v }, l)));
      return row(label, sel, h('button', { type: 'button', class: 'sui-btn', onclick: () => ka.animate(dir, sel.value) }, dir === 'in' ? 'In' : 'Out'));
    }

    function render() {
      host.replaceChildren();
      const layer = act.sel();
      if (!layer) { host.append(h('div', { class: 'fx-empty' }, 'Select a layer to animate it.')); return; }
      const comp = S.doc.comp;
      const b = ns.motion.defaultBounds(comp);
      const bx0 = h('input', { class: 'sui-input', type: 'number', value: b.x[0], 'aria-label': 'X from' }), bx1 = h('input', { class: 'sui-input', type: 'number', value: b.x[1], 'aria-label': 'X to' });
      const by0 = h('input', { class: 'sui-input', type: 'number', value: b.y[0], 'aria-label': 'Y from' }), by1 = h('input', { class: 'sui-input', type: 'number', value: b.y[1], 'aria-label': 'Y to' });
      const s0 = h('input', { class: 'sui-input', type: 'number', value: b.scale[0], 'aria-label': 'Scale from' }), s1 = h('input', { class: 'sui-input', type: 'number', value: b.scale[1], 'aria-label': 'Scale to' });
      const r0 = h('input', { class: 'sui-input', type: 'number', value: b.rotation[0], 'aria-label': 'Rotation from' }), r1 = h('input', { class: 'sui-input', type: 'number', value: b.rotation[1], 'aria-label': 'Rotation to' });
      const o0 = h('input', { class: 'sui-input', type: 'number', value: b.opacity[0], 'aria-label': 'Opacity from' }), o1 = h('input', { class: 'sui-input', type: 'number', value: b.opacity[1], 'aria-label': 'Opacity to' });
      const every = h('input', { class: 'sui-input', type: 'number', step: '0.05', min: 0.04, value: 0.5, 'aria-label': 'Seconds between keys' });
      const seed = h('input', { class: 'sui-input', type: 'text', value: seedText, placeholder: seedHex, 'aria-label': 'Seed', oninput: (e) => { seedText = e.target.value; } });
      const newSeed = h('button', { type: 'button', class: 'sui-btn', onclick: () => { seedHex = g.SlopVideo.seed.hex(g.SlopVideo.seed.make()); seedText = ''; seed.value = ''; seed.placeholder = seedHex; } }, 'New seed');
      const props = MOTION_PROPS.map(([v, l]) => h('label', { class: 'sui-check' }, h('input', { type: 'checkbox', value: v, checked: true }), h('span', null, l)));
      const pair = (a, b2) => h('div', { class: 'fx-pair' }, a, b2);
      const go = () => {
        const chosen = [...host.querySelectorAll('input[type=checkbox][value]')].filter((c) => c.checked).map((c) => c.value);
        const n = (x) => Number(x.value);
        ka.randomMotion({
          seed: g.SlopVideo.seed.parse(seedText || seedHex), props: chosen, every: n(every),
          bounds: { x: [n(bx0), n(bx1)], y: [n(by0), n(by1)], scale: [n(s0), n(s1)], rotation: [n(r0), n(r1)], opacity: [n(o0), n(o1)] },
        });
      };
      host.append(
        h('section', { class: 'fx-group', 'aria-label': 'Animate in and out' }, h('h3', null, 'Animate in and out'),
          presetRow('Animate in', 'in'), presetRow('Animate out', 'out'),
          h('p', { class: 'fx-empty', style: 'padding:0;text-align:left' }, 'In starts from the preset and ends at rest. Out starts at rest and ends at the preset, at the end of the composition.')),
        h('section', { class: 'fx-group', 'aria-label': 'Random motion' }, h('h3', null, 'Random motion'),
          row('Seed', seed, newSeed),
          row('Properties', h('div', { class: 'fx-chips' }, props)),
          row('Every (s)', every),
          row('X', pair(bx0, bx1)), row('Y', pair(by0, by1)),
          row('Scale %', pair(s0, s1)), row('Rotation °', pair(r0, r1)), row('Opacity %', pair(o0, o1)),
          h('div', { class: 'fx-chips' }, h('button', { type: 'button', class: 'sui-btn sui-primary', onclick: go }, 'Add random motion')),
          h('p', { class: 'fx-empty', style: 'padding:0;text-align:left' }, 'The same seed and bounds give the same keys. Replaces the chosen properties of this layer. Expressions are not in version one.')));
    }

    S.on((what) => { if (what === 'doc' || what === 'sel') { if (!S.isDragging()) render(); } });
    render();
    return { render };
  }

  ns.propsFx = { mountFx, mountMotion, PRESET_LIST };
})(typeof window !== 'undefined' ? window : globalThis);
