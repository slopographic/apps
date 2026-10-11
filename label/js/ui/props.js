/* SlopLabel — ui/props: the Properties panel. Form helpers, label properties (nothing selected),
 * multi-selection tools and the common geometry block. Type-specific fields are in props-types.js. */
'use strict';

/* ---------------- form helpers ---------------- */
function fRow(label, ...controls) { return mk('label', { class: 'row' }, mk('span', { title: label }, label), controls.length > 1 ? mk('div', { class: 'pair' }, controls) : controls[0]); }
function fNum(value, onSet, { step = 'any', min, max, id, geom, title } = {}) {
  const i = mk('input', { class: 'inp', type: 'number', step, min, max, id, title, inputmode: 'decimal', 'data-geom': geom });
  i.value = value == null || value === '' ? '' : String(value);
  const apply = () => { const v = parseFloat(i.value); const ok = isFinite(v) && (min == null || v >= min) && (max == null || v <= max); i.classList.toggle('bad', !ok && i.value !== ''); if (ok) onSet(v); };
  i.addEventListener('input', apply);
  i.addEventListener('keydown', (e) => { if (e.key === 'Enter') { apply(); i.blur(); } });
  return i;
}
function fBox(letter, input) { return mk('span', { class: 'num' }, mk('b', null, letter), input); }
function fText(value, onSet, { multi = false, id, placeholder = '', rows = 3 } = {}) {
  const i = multi ? mk('textarea', { class: 'inp', id, placeholder, rows, spellcheck: 'false' }) : mk('input', { class: 'inp', type: 'text', id, placeholder, spellcheck: 'false' });
  i.value = value == null ? '' : String(value);
  i.addEventListener('input', () => onSet(i.value));
  return i;
}
function fSel(options, value, onSet, { id } = {}) {
  const s = mk('select', { class: 'inp', id });
  for (const o of options) {
    if (o.group) { const g = mk('optgroup', { label: o.group }); for (const [v, l] of o.items) g.append(mk('option', { value: v }, l)); s.append(g); }
    else s.append(mk('option', { value: o[0] }, o[1]));
  }
  s.value = String(value);
  s.addEventListener('change', () => onSet(s.value));
  return s;
}
function fChk(label, checked, onSet, title) { const c = mk('input', { type: 'checkbox', checked: !!checked }); c.addEventListener('change', () => onSet(c.checked)); return mk('label', { class: 'chk', title }, c, label); }
function fSeg(options, value, onSet, { title } = {}) {
  const w = mk('span', { class: 'seg', title, role: 'group' });
  for (const [v, l, t] of options) {
    const b = mk('button', { type: 'button', class: String(v) === String(value) ? 'on' : '', title: t || null, 'aria-pressed': String(String(v) === String(value)) }, l);
    b.addEventListener('click', () => { w.querySelectorAll('button').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); }); onSet(v); });
    w.append(b);
  }
  return w;
}
function fSec(title, ...kids) { return mk('div', { class: 'sec' }, mk('div', { class: 'sec-h' }, mk('span', null, title), mk('span', { class: 'grow' })), kids); }
function fBtn(label, act, { title, cls = '' } = {}) { const b = mk('button', { type: 'button', class: 'btn ' + cls, title }, label); b.addEventListener('click', act); return b; }
/** Set one property on every selected object (coalesced so typing makes one undo step). */
function setProp(key, v, label, rebuild = false) { editSel((o) => { o[key] = v; }, label || 'Change ' + key, 'prop:' + key + ':' + App.sel.join(), { keepProps: !rebuild }); }

/* ---------------- variable field picker ---------------- */
function fieldNames() {
  const d = App.doc;
  return { vars: d.vars.map((v) => v.name), data: dataFieldNames(d).filter((n) => !d.vars.some((v) => v.name === n)), sys: ['LABEL_NO', 'RECORD_NO', 'TODAY', 'NOW'] };
}
/** Menu of {fields} to insert into a text input at the caret. */
function insertFieldMenu(input, anchor) {
  const ins = (name) => {
    const s = input.selectionStart != null ? input.selectionStart : input.value.length, e2 = input.selectionEnd != null ? input.selectionEnd : s;
    input.value = input.value.slice(0, s) + '{' + name + '}' + input.value.slice(e2);
    input.dispatchEvent(new Event('input')); input.focus();
    const p = s + name.length + 2; try { input.setSelectionRange(p, p); } catch (err) { /* number inputs */ }
  };
  const f = fieldNames(), items = [];
  if (f.vars.length) items.push(...f.vars.map((n) => ({ label: '{' + n + '}', act: () => ins(n) })), '-');
  if (f.data.length) items.push({ label: 'Data fields', sub: f.data.map((n) => ({ label: '{' + n + '}', act: () => ins(n) })) });
  items.push({ label: 'System', sub: f.sys.map((n) => ({ label: '{' + n + '}', act: () => ins(n) })) });
  items.push('-', { label: 'New variable…', sub: Object.entries(VAR_TYPES).map(([t, l]) => ({ label: l, act: async () => { const v = await varDialog(null, t); if (v) ins(v.name); } })) });
  const r = anchor.getBoundingClientRect();
  SlopUI.menu(items, r.left, r.bottom + 2);
}
function contentField(o, { multi = false, placeholder = '' } = {}) {
  const i = fText(o.content, (v) => setProp('content', v, 'Edit content'), { multi, id: 'pContent', placeholder, rows: o.type === 'para' ? 5 : 2 });
  const b = fBtn('{ } Insert field', () => insertFieldMenu(i, b), { cls: 'small', title: 'Insert a variable, data field or system value' });
  return mk('div', { class: 'sec' }, mk('div', { class: 'sec-h' }, mk('span', null, o.type === 'barcode' ? 'Data' : 'Text'), mk('span', { class: 'grow' }), b), i);
}
function focusContent() {
  if (!App.sel.length) return;
  App.tab = 'props';
  showDock('props', true);
  requestAnimationFrame(() => requestAnimationFrame(() => { const c = $('pContent'); if (c) { c.focus(); if (c.select) c.select(); } }));
}

/* ---------------- panel ---------------- */
function renderProps(body) {
  markPropsOpen();
  body.append(mk('div', { class: 'btnrow', style: 'margin-bottom:6px' }, fBtn('Reset', resetProps, { cls: 'small', title: 'Put back the values from when this was selected' })));
  const objs = selObjs();
  if (!objs.length) return renderLabelProps(body);
  if (objs.length > 1) return renderMultiProps(body, objs);
  const o = objs[0], it = itemOf(o.id);
  body.append(mk('div', { class: 'sec' }, mk('div', { class: 'row' }, mk('span', null, TYPE_NAMES[o.type] || o.type), fText(o.name, (v) => setProp('name', v, 'Rename')))));
  if (it && it.error) body.append(mk('div', { class: 'msg err', role: 'alert' }, it.error));
  else if (it && it.warn) body.append(mk('div', { class: 'msg warn' }, it.warn));
  const typed = typeSections(o, it);
  body.append(...typed, geometrySection(o), arrangeSection(true));
}
function geometrySection(o) {
  const b = boxOf(o), auto = o.type === 'barcode' || ((o.type === 'text' || o.type === 'para') && o.fit === 'grow');
  const setG = (k) => (v) => {
    const mm = fromU(v);
    editSel((x) => { if (k === 'x') x.x = round(x.x + mm - boxOf(x).x, 3); else if (k === 'y') x.y = round(x.y + mm - boxOf(x).y, 3); else x[k] = Math.max(0.1, mm); }, 'Change ' + k, 'geom:' + k, { keepProps: true });
  };
  const W = fNum(toU(b.w), setG('w'), { min: 0, geom: 'w', title: auto ? 'Set by the content (resize with the handles)' : '' }), H = fNum(toU(b.h), setG('h'), { min: 0, geom: 'h' });
  if (auto) { W.disabled = true; H.disabled = true; }
  return fSec('Position & size (' + unitLabel() + ')',
    mk('div', { class: 'pair', style: 'margin-bottom:6px' }, fBox('X', fNum(toU(b.x), setG('x'), { geom: 'x' })), fBox('Y', fNum(toU(b.y), setG('y'), { geom: 'y' }))),
    mk('div', { class: 'pair', style: 'margin-bottom:6px' }, fBox('W', W), fBox('H', H)),
    fRow('Rotation', fSeg([[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], o.rot || 0, (v) => setRotation(o, +v))),
    mk('div', { class: 'btnrow' }, fChk('Locked', o.locked, (v) => setProp('locked', v, v ? 'Lock' : 'Unlock', true)), fChk('Hidden', o.hidden, (v) => setProp('hidden', v, v ? 'Hide' : 'Show', true)), fChk('Printable', o.printable !== false, (v) => setProp('printable', v, 'Printable'), 'Untick for guides that show in the designer only')));
}
function arrangeSection(single) {
  const ib = (t, l, f) => fBtn(l, f, { title: t });
  return fSec('Arrange',
    mk('div', { class: 'iconrow', style: 'margin-bottom:6px' },
      ib('Align left', '⇤', () => alignSel('left')), ib('Centre horizontally', '↔', () => alignSel('hcenter')), ib('Align right', '⇥', () => alignSel('right')),
      ib('Align top', '⤒', () => alignSel('top')), ib('Centre vertically', '↕', () => alignSel('vcenter')), ib('Align bottom', '⤓', () => alignSel('bottom')),
      single ? null : ib('Distribute horizontally', '⋯', () => distributeSel('h')), single ? null : ib('Distribute vertically', '⋮', () => distributeSel('v'))),
    mk('div', { class: 'btnrow' }, fBtn('Front', () => orderSel('front')), fBtn('Forward', () => orderSel('forward')), fBtn('Backward', () => orderSel('backward')), fBtn('Back', () => orderSel('back'))),
    mk('div', { class: 'btnrow' }, fBtn('Duplicate', () => duplicateSel()), fBtn('Delete', deleteSel, { cls: 'danger' })),
    single ? mk('p', { class: 'hint' }, 'One object aligns to the label; several align to each other.') : null);
}
function renderMultiProps(body, objs) {
  const grouped = objs.some((o) => o.group);
  body.append(fSec(objs.length + ' objects selected',
    mk('div', { class: 'btnrow' }, fBtn('Group', groupSel), grouped ? fBtn('Ungroup', ungroupSel) : null, fBtn(objs.every((o) => o.locked) ? 'Unlock' : 'Lock', toggleLock), fBtn(objs.every((o) => o.hidden) ? 'Show' : 'Hide', toggleHide)),
    mk('div', { class: 'btnrow' }, fBtn('Rotate 90°', () => rotateSel(90)))), arrangeSection(false));
}
function renderLabelProps(body) {
  const d = App.doc, L = d.label, st = stockOf(d);
  const setL = (k, label) => (v) => editDoc((x) => { x.label[k] = Math.max(0, fromU(v)); }, label, 'label:' + k, { keepProps: true });
  body.append(
    fSec('Label', fRow('Name', fText(d.name, (v) => editDoc((x) => { x.name = v; document.title = v + ' — SlopLabel'; }, 'Rename label', 'name', { keepProps: true }))),
      mk('div', { class: 'pair', style: 'margin-bottom:6px' }, fBox('W', fNum(toU(L.w), setL('w', 'Label width'), { min: 1 })), fBox('H', fNum(toU(L.h), setL('h', 'Label height'), { min: 1 }))),
      fRow('Orientation', fSeg([['portrait', 'Portrait'], ['landscape', 'Landscape']], L.w > L.h ? 'landscape' : 'portrait', (v) => editDoc((x) => setOrientation(x, v), 'Orientation'))),
      fRow('Corners', fNum(toU(L.radius || 0), setL('radius', 'Corner radius'), { min: 0 })),
      fRow('Units', fSel([['mm', 'Millimetres'], ['in', 'Inches'], ['dots', 'Printer dots']], d.unit, (v) => editDoc((x) => { x.unit = v; }, 'Units'))),
      fRow('Resolution', fSel([[152, '152 dpi (6 dots/mm)'], [203, '203 dpi (8 dots/mm)'], [300, '300 dpi (12 dots/mm)'], [600, '600 dpi (24 dots/mm)']], d.dpi, (v) => editDoc((x) => { x.dpi = +v; }, 'Resolution'))),
      fRow('Stock', fBtn(st.kind === 'sheet' ? `${d.stock.name || 'Sheet'}` : `${d.stock.name || 'Roll'}`, () => labelSetupDialog(), { title: 'Choose an Avery/Herma sheet or a thermal roll' }))),
    fSec('Safe margin (' + unitLabel() + ')', mk('div', { class: 'quad' }, ['Top', 'Right', 'Bottom', 'Left'].map((n, i) => fBox(n[0], fNum(toU(L.margin[i] || 0), (v) => editDoc((x) => { x.label.margin[i] = Math.max(0, fromU(v)); }, 'Margin', 'margin' + i, { keepProps: true }), { min: 0, title: n }))))),
    fSec('Grid', mk('div', { class: 'row' }, mk('span', null, 'Size (' + unitLabel() + ')'), fNum(toU(d.grid.size), (v) => editDoc((x) => { x.grid.size = Math.max(0, fromU(v)); }, 'Grid', 'grid', { keepProps: true }), { min: 0 })),
      mk('div', { class: 'btnrow' }, fChk('Show grid', d.grid.show, (v) => editDoc((x) => { x.grid.show = v; }, 'Grid')), fChk('Snap', d.grid.snap, (v) => editDoc((x) => { x.grid.snap = v; }, 'Snap')))),
    mk('p', { class: 'hint' }, 'Pick a tool on the left and click the label to add text, barcodes, QR codes, images and shapes. Drag to move, Alt-drag to ignore snapping.'));
}
/** Update geometry inputs in place (after a drag) without rebuilding the panel. */
function syncGeomFields() {
  const o = selOne(); if (!o) return;
  const b = boxOf(o);
  for (const i of document.querySelectorAll('[data-geom]')) if (document.activeElement !== i) i.value = String(toU(b[i.dataset.geom]));
}
