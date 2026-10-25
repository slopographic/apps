/* Slop Font: the right panel (shared/frame/panel.js, the suite's rule): the settings of the glyph being drawn (width and
 * side bearings, the stroke tool's pen, what to draw it from), the font's names and licence, and its metrics. The
 * characters, the handwriting sheet, the export and the footer (Download font, the main action) are js/panel-more.js.
 * Fields show the state and change it through FC.state.edit (undoable). Classic script. FC.panel: mount(el), paint(). */
(function (g) {
  'use strict';
  const S = () => g.FC.state, F = () => g.SlopFont;
  const el = (tag, attrs = {}, ...kids) => { const n = document.createElement(tag); for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]); n.append(...kids); return n; };
  let side = null;
  const parts = {};
  const OFL = 'This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: https://openfontlicense.org';

  function field(label, control, note) {
    const l = el('label', { class: 'sf-field' }, el('span', { class: 'sf-lab' }, label), control);
    if (note) l.append(el('span', { class: 'sf-note' }, note));
    return l;
  }
  const num = (id, min, max) => el('input', { type: 'number', id, min, max, step: '1', inputmode: 'numeric' });
  const text = (id, max) => el('input', { type: 'text', id, maxlength: String(max || 200), autocomplete: 'off', spellcheck: 'false' });
  const button = (id, label, run) => { const b = el('button', { type: 'button', class: 'sui-btn', id }, label); b.addEventListener('click', () => { try { const r = run(); if (r && r.catch) r.catch((e) => g.SlopUI.toast(e.message)); } catch (e) { g.SlopUI.toast(e.message); } }); return b; };
  function onNum(input, fn) {
    input.addEventListener('change', () => { const v = Number(input.value); if (input.value === '' || !Number.isFinite(v)) { paint(); return; } try { fn(Math.round(v)); } catch (e) { g.SlopUI.toast(e.message); paint(); } });
  }

  function glyphSection() {
    const adv = num('fc-advance', 0, 20000), lsb = num('fc-lsb', -5000, 5000), rsb = num('fc-rsb', -5000, 5000);
    onNum(adv, (v) => S().edit('Change the width', 'glyph', (p, gl) => { F().model.setSides(gl, { advance: v }); }));
    onNum(lsb, (v) => S().edit('Change the left side', 'glyph', (p, gl) => { F().model.setSides(gl, { lsb: v }); }));
    onNum(rsb, (v) => S().edit('Change the right side', 'glyph', (p, gl) => { F().model.setSides(gl, { rsb: v }); }));
    const sw = num('fc-stroke-width', 1, 1000), cap = el('select', { id: 'fc-stroke-cap' });
    for (const [v, t] of [['round', 'Round ends'], ['square', 'Square ends'], ['butt', 'Flat ends']]) cap.append(el('option', { value: v }, t));
    onNum(sw, (v) => S().set({ strokeWidth: Math.max(1, Math.min(1000, v)) }));
    cap.addEventListener('change', () => S().set({ cap: cap.value }));
    const grid = num('fc-grid', 1, 500);
    onNum(grid, (v) => S().set({ grid: Math.max(1, Math.min(500, v)) }));
    Object.assign(parts, { adv, lsb, rsb, sw, cap, grid });
    const from = el('div', { class: 'fc-btns' },
      button('fc-from-svg', 'Draw from SVG…', () => g.FC.svgUi.open()),
      button('fc-from-picture', 'Trace a picture…', () => g.FC.traceUi.pick()),
      button('fc-copy-from', 'Copy from a glyph…', async () => {
        const k = await g.SlopUI.prompt('Copy from a glyph', 'The character or glyph name to copy (its outline and width)', '');
        if (k) g.SlopUI.toast(`Copied ${g.FC.ops.copyFrom(k.trim())}`);
      }),
      button('fc-add-from', 'Add an accent from…', async () => {
        const k = await g.SlopUI.prompt('Add another glyph on top', 'The character or glyph name to add (for example ¨ or ˚ over a vowel)', '');
        if (k) g.SlopUI.toast(`Added ${g.FC.ops.copyFrom(k.trim(), { add: true })}`);
      }),
      button('fc-merge', 'Remove overlap', () => g.FC.ops.merge()),
      button('fc-delete-glyph', 'Delete this glyph', async () => {
        const v = S().view();
        if (v.virtual) throw new Error('This glyph is not in the font');
        if (!(await g.SlopUI.confirm('Delete this glyph?', `Delete ${v.name} from the font? Undo brings it back.`, 'Delete', { danger: true }))) return;
        S().edit(`Delete ${v.name}`, 'project', (p) => F().model.remove(p, v.id));
      }));
    return { title: 'Glyph', key: 'glyph', settings: [
      el('div', { class: 'fc-trio' }, field('Width', adv), field('Left side', lsb), field('Right side', rsb)),
      from, el('div', { class: 'fc-duo' }, field('Stroke width', sw), field('Stroke ends', cap)),
      field('Snap grid (units)', grid, 'Points snap to this grid and to the metric lines; Alt while dragging places them freely.')] };
  }
  const INFO = [['family', 'Family name', 120], ['style', 'Style', 60], ['version', 'Version', 20], ['designer', 'Designer', 120], ['designerURL', 'Designer web address', 200],
    ['manufacturer', 'Foundry or maker', 120], ['copyright', 'Copyright', 300], ['licenseURL', 'Licence web address', 200]];
  function fontSection() {
    const list = [];
    for (const [k, label, max] of INFO) {
      const i = text('fc-info-' + k, max);
      i.addEventListener('change', () => { try { S().edit(`Change the ${label.toLowerCase()}`, 'meta', (p) => { p.info = F().model.cleanInfo(Object.assign({}, p.info, { [k]: i.value })); }); } catch (e) { g.SlopUI.toast(e.message); } });
      parts['info_' + k] = i;
      list.push(field(label, i));
    }
    const weight = el('select', { id: 'fc-info-weight' });
    for (const [v, t] of [[100, 'Thin'], [200, 'Extra light'], [300, 'Light'], [400, 'Regular'], [500, 'Medium'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold'], [900, 'Black']]) weight.append(el('option', { value: String(v) }, `${v} ${t}`));
    weight.addEventListener('change', () => S().edit('Change the weight', 'meta', (p) => { p.info.weight = Number(weight.value); }));
    const lic = el('textarea', { id: 'fc-info-license', rows: '3', maxlength: '4000' }), desc = el('textarea', { id: 'fc-info-description', rows: '2', maxlength: '4000' });
    lic.addEventListener('change', () => S().edit('Change the licence', 'meta', (p) => { p.info.license = lic.value.slice(0, 4000); }));
    desc.addEventListener('change', () => S().edit('Change the description', 'meta', (p) => { p.info.description = desc.value.slice(0, 4000); }));
    Object.assign(parts, { weight, lic, desc });
    list.splice(2, 0, field('Weight', weight));
    list.push(field('Licence', lic), button('fc-ofl', 'Use the SIL Open Font License 1.1', () => S().edit('Use the OFL', 'meta', (p) => {
      p.info.license = OFL; p.info.licenseURL = 'https://openfontlicense.org';
    })), field('Description', desc));
    return { title: 'Font', key: 'font', settings: list };
  }
  const METRICS = [['ascender', 'Ascender'], ['capHeight', 'Cap height'], ['xHeight', 'x-height'], ['descender', 'Descender'], ['lineGap', 'Line gap']];
  function metricsSection() {
    const list = [];
    for (const [k, label] of METRICS) {
      const i = num('fc-m-' + k, -20000, 20000);
      onNum(i, (v) => S().edit(`Change the ${label.toLowerCase()}`, 'meta', (p) => { p.metrics = F().model.cleanMetrics(Object.assign({}, p.metrics, { [k]: v })); }));
      parts['m_' + k] = i;
      list.push(field(label, i));
    }
    parts.upm = el('output', { id: 'fc-upm' });
    return { title: 'Metrics', key: 'metrics', settings: [el('div', { class: 'fc-duo' }, ...list), field('Units per em', parts.upm, 'All sizes are in these units: the height of the em square.')] };
  }
  function setVal(i, v) { if (i && document.activeElement !== i) i.value = v == null ? '' : String(v); }
  function paint() {
    if (!side) return;
    const p = S().project(), v = S().view(), sd = F().model.sides(v), st = S().settings();
    setVal(parts.adv, v.advance); setVal(parts.lsb, sd.box ? sd.lsb : ''); setVal(parts.rsb, sd.box ? sd.rsb : '');
    parts.lsb.disabled = parts.rsb.disabled = !sd.box;
    setVal(parts.sw, st.strokeWidth); parts.cap.value = st.cap; setVal(parts.grid, st.grid);
    for (const [k] of INFO) setVal(parts['info_' + k], p.info[k]);
    parts.weight.value = String(p.info.weight); setVal(parts.lic, p.info.license); setVal(parts.desc, p.info.description);
    for (const [k] of METRICS) setVal(parts['m_' + k], p.metrics[k]);
    parts.upm.textContent = String(p.metrics.upm);
    g.FC.panelMore.paint();
  }
  function mount(panelEl) {
    side = g.SlopFrame.panel(panelEl, { title: 'Font' });
    side.render([glyphSection(), ...g.FC.panelMore.sections(), fontSection(), metricsSection()]);
    S().on(paint);
    paint();
    return side;
  }
  g.FC.panel = { mount, paint, side: () => side, parts: () => parts, OFL };
})(window);
