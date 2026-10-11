/* Slop 3D inspector: the properties of the primary selection. Sections: object (name, visible), transform
 * (position, rotation in degrees, scale; local to the parent), shape (the primitive's parameters), material (colour,
 * roughness, metallic, opacity, texture) and light (colour, intensity). Edits commit on change or Enter, and
 * consecutive edits to one field merge into one undo step. Sets window.Slop3D.inspector. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const M = S.model, A = S.actions, st = S.state, s = st.s;
  const fmt = (v) => (typeof v === 'number' ? String(+v.toFixed(4)) : String(v ?? ''));

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const k in attrs) {
      if (attrs[k] === false || attrs[k] == null) continue;
      if (k === 'class') n.className = attrs[k];
      else if (k === 'text') n.textContent = attrs[k];
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    for (const c of kids) if (c) n.append(c);
    return n;
  }

  function create(root) {
    let fields = [], shown = null, shownType = null;
    const body = el('div', { class: 'insp-body' });
    root.append(body);

    /** A labelled input bound to a dotted path of the node. kind: 'number' | 'text' | 'check' | 'color' | 'range'. */
    function field(id, label, path, kind, opts = {}) {
      const TYPE = { number: 'number', text: 'text', check: 'checkbox', color: 'color', range: 'range' };
      const input = el('input', Object.assign({ class: kind === 'check' ? '' : 'insp-in', type: TYPE[kind], 'aria-label': label }, opts.attrs || {}));
      const get = () => { const n = s.doc.nodes[id]; return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), n); };
      const wrap = el('label', { class: 'insp-f' + (kind === 'check' ? ' insp-check' : '') }, el('span', { class: 'insp-l', text: label }), input);
      const ev = kind === 'check' ? 'change' : kind === 'color' ? 'input' : 'change';
      input.addEventListener(ev, () => {
        let v;
        if (kind === 'check') v = input.checked;
        else if (kind === 'number' || kind === 'range') { v = parseFloat(input.value); if (!Number.isFinite(v)) return; if (opts.min != null) v = Math.max(opts.min, v); if (opts.max != null) v = Math.min(opts.max, v); if (opts.round) v = opts.round(v); }
        else v = input.value;
        A.setField(id, path, v, `field:${id}:${path}`);
      });
      if (kind === 'number') input.addEventListener('keydown', (e) => { if (e.key === 'Enter') input.blur(); });
      fields.push({ input, get, kind });
      return wrap;
    }
    const section = (title, ...kids) => el('section', { class: 'insp-sec' }, el('h3', { text: title }), ...kids);
    const row3 = (id, title, key, step, extra = {}) => el('div', { class: 'insp-row3' }, el('span', { class: 'insp-l', text: title }),
      el('div', { class: 'insp-trio' }, ...['X', 'Y', 'Z'].map((ax, i) => field(id, `${title} ${ax}`, `${key}.${i}`, 'number', Object.assign({ attrs: { step } }, extra)))));

    function build() {
      body.replaceChildren();
      fields = [];
      const id = st.primary();
      const n = id && s.doc.nodes[id];
      shown = n ? n.id : null; shownType = n ? n.type + (n.geom ? ':' + n.geom.kind : '') : null;
      if (!n) { body.append(el('p', { class: 'insp-empty', text: 'Select an object to see its properties. Right-click the viewport to add one.' })); return; }
      if (s.sel.length > 1) body.append(el('p', { class: 'insp-note', text: `${s.sel.length} selected. Editing the last one.` }));
      body.append(section('Object',
        field(n.id, 'Name', 'name', 'text'),
        field(n.id, 'Visible', 'visible', 'check'),
        el('p', { class: 'insp-kind', text: M.typeLabel(n) + (n.type === 'group' ? ` · ${n.children.length} inside` : '') })));
      body.append(section('Transform',
        row3(n.id, 'Position', 'transform.p', 0.05),
        row3(n.id, 'Rotation°', 'transform.r', 1),
        row3(n.id, 'Scale', 'transform.s', 0.05)));
      if (n.type === 'mesh') body.append(shapeSection(n), materialSection(n));
      if (n.type === 'light') body.append(lightSection(n));
      root.dataset.kind = n.type;
      refresh();
    }
    function shapeSection(n) {
      const g = n.geom;
      if (g.kind === 'mesh') return section('Shape', el('p', { class: 'insp-kind', text: `Imported mesh · ${g.indices.length / 3} triangles` }));
      const spec = S.geometry.SPEC[g.kind] || {};
      return section('Shape', ...Object.keys(spec).map((k) => {
        const [lo, hi, int] = spec[k];
        return field(n.id, k, `geom.${k}`, 'number', { attrs: { min: lo, max: hi, step: int ? 1 : 0.05 }, min: lo, max: hi, round: int ? Math.round : null });
      }));
    }
    function materialSection(n) {
      const m = n.material;
      const kids = [
        field(n.id, 'Colour', 'material.color', 'color', { attrs: { value: m.color } }),
        field(n.id, 'Roughness', 'material.roughness', 'number', { attrs: { min: 0, max: 1, step: 0.05 }, min: 0, max: 1 }),
        field(n.id, 'Metallic', 'material.metallic', 'number', { attrs: { min: 0, max: 1, step: 0.05 }, min: 0, max: 1 }),
        field(n.id, 'Opacity', 'material.opacity', 'range', { attrs: { min: 0, max: 1, step: 0.01 }, min: 0, max: 1 }),
      ];
      if (m.map) kids.push(el('button', { type: 'button', class: 'insp-btn', text: 'Remove image texture', onclick: () => A.setField(n.id, 'material.map', undefined) }));
      return section('Material', ...kids);
    }
    function lightSection(n) {
      return section('Light',
        field(n.id, 'Colour', 'light.color', 'color', { attrs: { value: n.light.color } }),
        field(n.id, 'Intensity', 'light.intensity', 'number', { attrs: { min: 0, max: 100, step: 0.1 }, min: 0, max: 100 }),
        el('p', { class: 'insp-kind', text: n.light.kind === 'ambient' ? 'Ambient light: lights everything evenly.' : 'Directional light: a sun. Its position sets the direction.' }));
    }
    /** Writes the current values into the fields (skips the one being typed in). */
    function refresh() {
      const id = st.primary();
      const n = id && s.doc.nodes[id];
      if (!n) return;
      for (const f of fields) {
        if (document.activeElement === f.input) continue;
        const v = f.get();
        if (f.kind === 'check') f.input.checked = !!v;
        else f.input.value = f.kind === 'color' ? v : fmt(v);
      }
    }
    function sync() {
      const id = st.primary();
      const n = id && s.doc.nodes[id];
      const type = n ? n.type + (n.geom ? ':' + n.geom.kind : '') : null;
      if ((n ? n.id : null) !== shown || type !== shownType) build(); else refresh();
    }
    st.on('doc', sync);
    st.on('sel', sync);
    build();
    return { sync };
  }

  S.inspector = { create };
})();
