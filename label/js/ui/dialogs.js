/* SlopLabel — ui/dialogs: label setup (stock picker, size, printer), variable editor, template gallery, about. */
'use strict';

function dRow(label, ...c) { return mk('label', { class: 'row' }, mk('span', null, label), c.length > 1 ? mk('div', { class: 'pair' }, c) : c[0]); }
function dInp(value, type = 'text', attrs = {}) { const i = mk('input', Object.assign({ class: 'inp', type, spellcheck: 'false' }, attrs)); i.value = value == null ? '' : String(value); return i; }
function dSel(options, value) { const s = mk('select', { class: 'inp' }, options.map(([v, l]) => mk('option', { value: v }, l))); s.value = String(value); return s; }
function dChk(label, checked) { const c = mk('input', { type: 'checkbox', checked: !!checked }); return { el: mk('label', { class: 'chk' }, c, label), input: c }; }

/* ---------------- label setup ---------------- */
function labelSetupDialog(target) {
  const d = target || App.doc, P = d.printer;
  let stock = d.stock && stockById(d.stock.id) ? stockById(d.stock.id) : null;
  const u = d.unit, cv = (mm) => num(fromMM(mm, u, d.dpi), unitDigits(u) + 1), back = (v) => toMM(+v, u, d.dpi);
  const name = dInp(d.name), W = dInp(cv(d.label.w), 'number', { step: 'any', min: 1 }), H = dInp(cv(d.label.h), 'number', { step: 'any', min: 1 });
  const gap = dInp(num(d.label.gap, 2), 'number', { step: 'any', min: 0 }), rad = dInp(num(d.label.radius || 0, 2), 'number', { step: 'any', min: 0 });
  const unit = dSel([['mm', 'Millimetres'], ['in', 'Inches'], ['dots', 'Printer dots']], u), dpi = dSel([[152, '152 dpi'], [203, '203 dpi'], [300, '300 dpi'], [600, '600 dpi']], d.dpi);
  const dark = dInp(P.darkness, 'number', { min: 0, max: 30, step: 1 }), speed = dInp(P.speed, 'number', { min: 1, max: 14, step: 1 });
  const media = dSel([['gap', 'Gap / notch'], ['mark', 'Black mark'], ['continuous', 'Continuous']], P.media), method = dSel([['direct', 'Direct thermal'], ['transfer', 'Thermal transfer (ribbon)']], P.method);
  const rot = dChk('Print upside down (rotate 180°)', P.rotate180);
  const info = mk('p', { class: 'hint' });
  const list = mk('div', { class: 'stock-list', role: 'listbox', 'aria-label': 'Label stock' });
  const showInfo = () => { info.textContent = stock ? (stock.kind === 'sheet' ? `${stock.cols} × ${stock.rows} labels on a ${num(stock.pageW, 1)} × ${num(stock.pageH, 1)} mm sheet. Size is fixed by the sheet.` : 'Thermal roll: one label per page.') : 'Custom size on a roll.'; W.disabled = H.disabled = !!(stock && stock.kind === 'sheet'); };
  const pick = (s, btn) => {
    stock = s; list.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === btn));
    if (s) { const uu = unit.value; W.value = num(fromMM(s.w, uu, +dpi.value), 4); H.value = num(fromMM(s.h, uu, +dpi.value), 4); rad.value = num(s.radius || 0, 2); if (s.gap != null) gap.value = s.gap; }
    showInfo();
  };
  const custom = mk('button', { type: 'button', class: stock ? '' : 'on' }, 'Custom size (roll)');
  custom.addEventListener('click', () => pick(null, custom));
  list.append(custom);
  let grp = '';
  for (const s of STOCKS) {
    if (s.group !== grp) { grp = s.group; list.append(mk('div', { class: 'grp' }, grp)); }
    const b = mk('button', { type: 'button', class: stock && stock.id === s.id ? 'on' : '' }, s.name);
    b.addEventListener('click', () => pick(s, b));
    list.append(b);
  }
  unit.addEventListener('change', () => { const mmW = toMM(+W.value, unitPrev, +dpi.value), mmH = toMM(+H.value, unitPrev, +dpi.value); unitPrev = unit.value; W.value = num(fromMM(mmW, unitPrev, +dpi.value), 4); H.value = num(fromMM(mmH, unitPrev, +dpi.value), 4); });
  let unitPrev = u;
  showInfo();
  requestAnimationFrame(() => { const on = list.querySelector('button.on'); if (on) on.scrollIntoView({ block: 'center' }); });
  const body = mk('div', { class: 'dlg-cols' },
    mk('div', null, mk('div', { class: 'sec-h' }, 'Stock'), list, info),
    mk('div', { class: 'dlg-form' }, mk('div', { class: 'sec-h' }, 'Label'), dRow('Name', name), dRow('Units', unit), dRow('Width', W), dRow('Height', H), dRow('Gap (mm)', gap), dRow('Corners (mm)', rad),
      mk('div', { class: 'sec-h' }, 'Printer'), dRow('Resolution', dpi), dRow('Darkness 0–30', dark), dRow('Speed (ips)', speed), dRow('Media', media), dRow('Method', method), rot.el));
  SlopFormReset.snapshot(body);
  return new Promise((res) => SlopUI.dialog({ title: 'Label setup', cls: 'sl-wide', body, onClose: (ok) => res(ok),
    buttons: [{ label: 'Cancel' }, SlopFormReset.dialogButton(body), { label: 'Apply', primary: true, act: () => {
      const w = toMM(+W.value, unit.value, +dpi.value), h = toMM(+H.value, unit.value, +dpi.value);
      if (!(w >= 1 && h >= 1 && w <= 2000 && h <= 2000)) { SlopUI.toast('Enter a label size between 1 and 2000 mm'); return false; }
      const apply = (x) => {
        if (stock) applyStock(x, stock); else { x.stock = { kind: 'roll', id: 'custom', name: 'Custom roll', cols: 1 }; x.label.w = round(w, 4); x.label.h = round(h, 4); x.label.orientation = h >= w ? 'portrait' : 'landscape'; }
        x.name = name.value.trim() || x.name; x.unit = unit.value; x.dpi = +dpi.value;
        x.label.gap = Math.max(0, +gap.value || 0); x.label.radius = Math.max(0, +rad.value || 0);
        Object.assign(x.printer, { darkness: clamp(+dark.value | 0, 0, 30), speed: clamp(+speed.value | 0, 1, 14), media: media.value, method: method.value, rotate180: rot.input.checked });
      };
      if (target) apply(target); else { editDoc(apply, 'Label setup'); document.title = App.doc.name + ' — SlopLabel'; fitView(); }
    } }] }));
}

/* ---------------- variable editor ---------------- */
function varDialog(v, type) {
  const isNew = !v;
  const draft = isNew ? makeVar(type, uniqueVarName(type === 'counter' ? 'Serial' : type === 'date' ? 'Date' : type === 'prompt' ? 'Input' : 'Field')) : deepClone(v);
  const name = dInp(draft.name), prev = mk('div', { class: 'msg warn', style: 'color:var(--text)' });
  const F = {}, rows = [];
  const inp = (k, label, t = 'text', attrs) => { F[k] = dInp(draft[k], t, attrs); rows.push(dRow(label, F[k])); };
  const chk = (k, label) => { const c = dChk(label, draft[k]); F[k] = c.input; rows.push(c.el); };
  switch (draft.type) {
    case 'prompt': inp('prompt', 'Question'); inp('def', 'Default'); chk('required', 'Required'); inp('pattern', 'Pattern (regex)', 'text', { placeholder: 'e.g. \\d{5}' }); inp('maxLen', 'Max length', 'number', { min: 0 }); break;
    case 'counter': inp('start', 'Start', 'number'); inp('step', 'Step', 'number'); inp('pad', 'Digits (zero pad)', 'number', { min: 0, max: 30 }); inp('prefix', 'Prefix'); inp('suffix', 'Suffix'); inp('every', 'Change every N labels', 'number', { min: 1 }); chk('remember', 'Continue from the last printed value'); break;
    case 'date': inp('format', 'Format'); rows.push(mk('p', { class: 'hint' }, 'YYYY YY MMMM MMM MM DD D dddd ddd HH hh mm ss A WW (ISO week) DDD (day of year), [literal text]')); inp('days', 'Offset days', 'number'); inp('months', 'Offset months', 'number'); inp('years', 'Offset years', 'number'); inp('hours', 'Offset hours', 'number'); inp('fixed', 'Fixed date', 'text', { placeholder: 'YYYY-MM-DD (empty = today)' }); break;
    case 'formula': inp('expr', 'Expression'); rows.push(mk('p', { class: 'hint' }, 'Combine fields: {SKU}-{Batch}, {Name|upper}, {Price|mul:1.2|fixed:2}, {Body|gs1check}, {Code|left:4}.')); break;
    default: inp('value', 'Value');
  }
  const read = () => { const x = deepClone(draft); x.name = name.value.trim(); for (const k in F) x[k] = F[k].type === 'checkbox' ? F[k].checked : F[k].type === 'number' ? +F[k].value || 0 : F[k].value; return x; };
  const upd = () => {
    const x = read(), doc = Object.assign({}, App.doc, { vars: App.doc.vars.filter((y) => y.id !== x.id).concat(x) });
    let val; try { val = makeResolver(doc, { record: recordAt(doc, App.rec), prompts: App.prompts })(x.name); } catch (e) { val = '#ERROR'; }
    prev.textContent = 'Preview: ' + (val === undefined ? '' : val);
  };
  const body = mk('div', { class: 'dlg-form' }, dRow('Name', name), mk('p', { class: 'hint' }, VAR_TYPES[draft.type] + ' · use it as {' + draft.name + '} in text and barcodes.'), ...rows, prev);
  body.addEventListener('input', upd); body.addEventListener('change', upd); upd();
  SlopFormReset.snapshot(body);
  return new Promise((res) => SlopUI.dialog({ title: (isNew ? 'New ' : 'Edit ') + VAR_TYPES[draft.type].toLowerCase(), body, onClose: (ok) => { if (!ok) res(null); },
    buttons: [{ label: 'Cancel' }, SlopFormReset.dialogButton(body), { label: isNew ? 'Add' : 'Save', primary: true, act: () => {
      const x = read();
      if (!VAR_NAME_RE.test(x.name)) { SlopUI.toast('Names start with a letter and use letters, digits, spaces, _ . -'); return false; }
      if (App.doc.vars.some((y) => y.name === x.name && y.id !== x.id) || ['LABEL_NO', 'RECORD_NO', 'TODAY', 'NOW'].includes(x.name)) { SlopUI.toast('That name is already used'); return false; }
      editDoc((d) => {
        if (isNew) d.vars.push(x);
        else {
          d.vars = d.vars.map((y) => (y.id === x.id ? x : y));
          if (v.name !== x.name) renameRefs(d, v.name, x.name);
        }
      }, isNew ? 'Add variable' : 'Edit variable');
      if (App.tab !== 'props') App.tab = 'vars';
      res(x);
    } }] }));
}
function uniqueVarName(base) { let n = base, i = 2; while (App.doc.vars.some((v) => v.name === n)) n = base + i++; return n; }
/** Rename {Old…} references in object contents and formulas. */
function renameRefs(d, from, to) {
  const re = new RegExp('\\{(\\s*)' + from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s*)([|}])', 'g');
  const fix = (s) => String(s).replace(re, (m, a, b, c) => '{' + a + to + b + c);
  for (const o of d.objects) if (o.content != null) o.content = fix(o.content);
  for (const v of d.vars) if (v.type === 'formula') v.expr = fix(v.expr);
}

/* ---------------- templates / new ---------------- */
function templateThumb(doc) {
  try { const sc = buildScene(doc, previewResolver(doc)); return renderLabelCanvas(doc, sc, (240 * 25.4) / Math.max(doc.label.w, doc.label.h)); } catch (e) { return mk('span', null, '…'); }
}
function templatesDialog() {
  const grid = mk('div', { class: 'tpl-grid' });
  let dlg;
  const tile = (title, desc, thumb, act) => { const b = mk('button', { type: 'button', class: 'tpl' }, mk('span', { class: 'tp' }, thumb), mk('b', null, title), mk('small', null, desc)); b.addEventListener('click', async () => { if (!(await confirmDiscard())) return; dlg.close(true); act(); }); return b; };
  grid.append(tile('Blank label', 'Choose a roll or sheet size, then design from scratch', mk('span', { class: 'mono', style: 'font-size:28px;color:#999' }, '+'), async () => {
    const d = newDoc({ stock: stockById('roll-4x2') }); d.unit = 'mm';
    if (await labelSetupDialog(d)) setDoc(d, 'New label');
  }));
  for (const t of TEMPLATES) { const d = t.build(); grid.append(tile(t.name, t.desc, templateThumb(d), () => { setDoc(t.build(), 'New from template'); status('Started from “' + t.name + '”', '', 3000); })); }
  dlg = SlopUI.dialog({ title: 'New label', cls: 'sl-wide', body: mk('div', null, mk('p', { class: 'sui-p' }, 'Start blank or from a ready-made label. Your current label stays in the browser until you start a new one.'), grid), buttons: [{ label: 'Cancel' }] });
  return dlg;
}
function aboutDialog() {
  SlopUI.dialog({ title: 'About SlopLabel', body: mk('div', null,
    mk('p', { class: 'sui-p' }, 'SlopLabel designs and prints barcode labels entirely in your browser. Nothing is uploaded.'),
    mk('p', { class: 'sui-p' }, 'Barcodes: Code 128, GS1-128, EAN-13/8, UPC-A/E, Code 39/93, ITF-14, Interleaved 2 of 5, Codabar, QR, GS1 QR, Data Matrix, GS1 DataMatrix, PDF417 and Aztec (2D codes by bwip-js, MIT).'),
    mk('p', { class: 'sui-p' }, 'Output: browser printing at exact page size, PDF, PNG, SVG, Zebra ZPL II, EPL2 and TSPL. Import ZPL to migrate old formats.'),
    mk('p', { class: 'sui-p' }, 'Shortcuts: V select, T text, P paragraph, B barcode, Q QR, I image, R box, L line, E ellipse, N inverse, H or Space pan, Ctrl+P print, Ctrl+D duplicate, Ctrl+G group, arrows nudge (Shift ×10), PageUp/PageDown records.')),
    buttons: [{ label: 'OK', primary: true }] });
}
