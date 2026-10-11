/* Slop Shop: menus, options bar, toolbox, panels, dialogs, keyboard. */
'use strict';

const MOD = isMac ? '⌘' : 'Ctrl+';
const keyLabel = (k) => (isMac ? k.replace(/Ctrl\+/g, '⌘').replace(/Alt\+/g, '⌥').replace(/Shift\+/g, '⇧') : k);
const MODIFIERS = ['Ctrl', 'Alt', 'Shift'];
function normCombo(s) {
  const parts = s.split('+').map((p) => p.trim()).filter(Boolean);
  const key = parts.pop();
  return MODIFIERS.filter((m) => parts.includes(m)).concat([key.length === 1 ? key.toUpperCase() : key]).join('+');
}
const CODE_KEY = { BracketLeft: '[', BracketRight: ']', Equal: '=', Minus: '-', Quote: "'", Slash: '/', Backslash: '\\', Semicolon: ';', Comma: ',', Period: '.', Backquote: '`', Space: 'Space', NumpadAdd: '=', NumpadSubtract: '-' };
function comboOf(e) {
  let k = e.code.startsWith('Key') ? e.code.slice(3) : e.code.startsWith('Digit') ? e.code.slice(5) : e.code.startsWith('Numpad') && /\d/.test(e.code.slice(6)) ? e.code.slice(6) : CODE_KEY[e.code] || e.key;
  if (k && k.length === 1) k = k.toUpperCase();
  const mods = [];
  if (e.ctrlKey || e.metaKey) mods.push('Ctrl');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  return mods.concat([k]).join('+');
}

/* ---------- dialogs ---------- */
let openDialogs = 0;
function dialog({ title, body, buttons = [], onClose, cls = '' }) {
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'dlg ' + cls, role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const head = h('div', { class: 'dlg-head' }, h('span', null, title), h('button', { class: 'dlg-x', type: 'button', 'aria-label': 'Close', onclick: () => close(false) }, '×'));
  const foot = h('div', { class: 'dlg-foot' });
  box.append(head, h('div', { class: 'dlg-body' }, body), foot);
  back.append(box);
  document.body.append(back);
  openDialogs++;
  let closed = false;
  function close(ok) {
    if (closed) return; closed = true; openDialogs--;
    back.remove();
    if (onClose) onClose(ok);
  }
  for (const b of buttons) {
    const btn = h('button', { type: 'button', class: 'btn' + (b.primary ? ' primary' : '') }, b.label);
    btn.addEventListener('click', async () => { if (b.act) { const r = await b.act(); if (r === false) return; } close(!!b.primary); });
    foot.append(btn);
  }
  back.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); }
    else if (e.key === 'Enter' && !(e.target.tagName === 'TEXTAREA') && !(e.target.tagName === 'BUTTON')) { const p = buttons.find((b) => b.primary); if (p) { e.preventDefault(); e.stopPropagation(); foot.querySelector('.primary').click(); } }
  });
  // drag by header
  head.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const r = box.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    const mv = (ev) => { box.style.position = 'fixed'; box.style.margin = '0'; box.style.left = clamp(ev.clientX - sx, 0, innerWidth - 60) + 'px'; box.style.top = clamp(ev.clientY - sy, 0, innerHeight - 40) + 'px'; };
    head.addEventListener('pointermove', mv);
    head.addEventListener('pointerup', () => head.removeEventListener('pointermove', mv), { once: true });
  });
  setTimeout(() => { const f = box.querySelector('input:not([type=checkbox]):not([type=range]), select, textarea') || foot.querySelector('.primary'); if (f) f.focus(); if (f && f.select) f.select(); }, 0);
  return { box, close };
}
function field(label, input, unit) { return h('label', { class: 'field' }, h('span', { class: 'field-l' }, label), input, unit ? h('span', { class: 'field-u' }, unit) : null); }
function numInput(v, min, max, step = 1) { return h('input', { type: 'number', value: v, min, max, step, inputmode: 'decimal' }); }
function alertDlg(title, msg) { return new Promise((res) => dialog({ title, body: h('p', { class: 'dlg-p' }, msg), buttons: [{ label: 'OK', primary: true }], onClose: () => res() })); }
function confirmDlg(title, msg, ok = 'OK') { return new Promise((res) => dialog({ title, body: h('p', { class: 'dlg-p' }, msg), buttons: [{ label: 'Cancel' }, { label: ok, primary: true }], onClose: (r) => res(r) })); }

/* ---------- colour picker ---------- */
function colorPicker(get, set) {
  const sv = h('canvas', { class: 'cp-sv', width: 200, height: 140 }), hue = h('canvas', { class: 'cp-hue', width: 200, height: 12 });
  const hex = h('input', { class: 'cp-hex', type: 'text', maxlength: 7, spellcheck: 'false', 'aria-label': 'Hex colour' });
  const rgb = ['R', 'G', 'B'].map((c) => h('input', { type: 'number', min: 0, max: 255, 'aria-label': c, class: 'cp-n' }));
  const el = h('div', { class: 'cp' }, sv, hue, h('div', { class: 'cp-row' }, h('span', null, '#'), hex, ...rgb.flatMap((i, k) => [h('span', null, 'RGB'[k]), i])));
  let H = 0, S = 0, Vv = 0;
  function fromHex(hx) { const [r, g, b] = hexToRgb(hx); const [hh, s, v] = rgbToHsv(r, g, b); if (s > 0 && v > 0) H = hh; S = s; Vv = v; }
  function render() {
    const g = sv.getContext('2d'), w = sv.width, hh = sv.height;
    const [r, gg, b] = hsvToRgb(H, 1, 1);
    g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(0, 0, w, hh);
    let gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#fff'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    gr = g.createLinearGradient(0, 0, 0, hh); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
    g.strokeStyle = Vv > 0.5 && S < 0.5 ? '#000' : '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(S * w, (1 - Vv) * hh, 5, 0, Math.PI * 2); g.stroke();
    const hg = hue.getContext('2d'), hgr = hg.createLinearGradient(0, 0, hue.width, 0);
    for (let i = 0; i <= 6; i++) { const [a, bb, c] = hsvToRgb((i * 60) % 360, 1, 1); hgr.addColorStop(i / 6, `rgb(${a},${bb},${c})`); }
    hg.fillStyle = hgr; hg.fillRect(0, 0, hue.width, hue.height);
    const x = (H / 360) * hue.width; hg.fillStyle = '#fff'; hg.fillRect(x - 1.5, 0, 3, hue.height); hg.strokeStyle = '#000'; hg.strokeRect(x - 2, 0, 4, hue.height);
    const cur = get();
    if (document.activeElement !== hex) hex.value = cur.slice(1);
    const c = hexToRgb(cur); rgb.forEach((i, k) => { if (document.activeElement !== i) i.value = c[k]; });
  }
  function push() { const [r, g, b] = hsvToRgb(H, S, Vv); set(rgbToHex(r, g, b)); render(); }
  const drag = (canvas, fn) => canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const go = (ev) => { const r = canvas.getBoundingClientRect(); fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); push(); };
    go(e); canvas.onpointermove = go; canvas.onpointerup = () => { canvas.onpointermove = null; };
  });
  drag(sv, (x, y) => { S = x; Vv = 1 - y; });
  drag(hue, (x) => { H = x * 359.9; });
  hex.addEventListener('input', () => { if (/^[0-9a-f]{6}$/i.test(hex.value) || /^[0-9a-f]{3}$/i.test(hex.value)) { set(rgbToHex(...hexToRgb(hex.value))); fromHex(get()); render(); } });
  rgb.forEach((i) => i.addEventListener('input', () => { set(rgbToHex(...rgb.map((x) => clamp(+x.value || 0, 0, 255)))); fromHex(get()); render(); }));
  fromHex(get()); render();
  return { el, sync() { fromHex(get()); render(); } };
}
function pickColorDialog(title, initial) {
  return new Promise((res) => {
    let cur = initial;
    const cp = colorPicker(() => cur, (v) => { cur = v; sw.style.background = v; });
    const sw = h('div', { class: 'cp-preview' }); sw.style.background = cur;
    const old = h('div', { class: 'cp-preview old', title: 'Original — click to restore', onclick: () => { cur = initial; cp.sync(); sw.style.background = cur; } }); old.style.background = initial;
    dialog({ title, cls: 'dlg-color', body: h('div', { class: 'cp-dlg' }, cp.el, h('div', { class: 'cp-compare' }, h('span', null, 'new'), sw, old, h('span', null, 'current'))), buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true }], onClose: (ok) => res(ok ? cur : null) });
  });
}

/* ---------- menus ---------- */
const filterMenu = (group) => FILTERS.filter((f) => f.menu === group || (f.sep === group)).map((f) => (f.sep ? '-' : { label: f.name, key: f.key, act: () => runFilter(f.id), need: 'layer' }));
function filterSub(name) { return { label: name, sub: filterMenu(name) }; }
const MENUS = [
  ['File', [
    { label: 'New…', key: 'Ctrl+N', act: () => dlgNew() },
    { label: 'Open…', key: 'Ctrl+O', act: () => openFilePicker(false) },
    { label: 'Place Image as Layer…', key: 'Shift+Ctrl+P', act: () => openFilePicker(true) },
    '-',
    { label: 'Save as Photoshop (.psd)', key: 'Ctrl+S', act: () => savePSD() },
    { label: 'Export As…', key: 'Alt+Shift+Ctrl+W', act: () => dlgExport() },
    { label: 'Quick Export as PNG', key: 'Alt+Shift+Ctrl+S', act: () => quickExport() },
    { label: 'Export Layers as PNGs', act: () => exportLayers() },
    '-',
    { label: 'Download Slop Shop for offline use (.html)', act: () => downloadOfflineApp() },
    { label: 'Clear Recovery Data', act: () => clearAutosave() },
  ]],
  ['Edit', [
    { label: 'Undo', key: 'Ctrl+Z', act: () => undo(), en: () => Hist.idx > 0, dyn: () => (Hist.idx > 0 ? 'Undo ' + Hist.states[Hist.idx].label : 'Undo') },
    { label: 'Redo', key: 'Shift+Ctrl+Z', act: () => redo(), en: () => Hist.idx < Hist.states.length - 1, dyn: () => (Hist.idx < Hist.states.length - 1 ? 'Redo ' + Hist.states[Hist.idx + 1].label : 'Redo') },
    '-',
    { label: 'Cut', key: 'Ctrl+X', act: () => cutSel(), need: 'layer' },
    { label: 'Copy', key: 'Ctrl+C', act: () => copySel(false), need: 'layer' },
    { label: 'Copy Merged', key: 'Shift+Ctrl+C', act: () => copySel(true) },
    { label: 'Paste', key: 'Ctrl+V', act: () => pasteInternal(false), en: () => !!CLIP.canvas },
    { label: 'Paste in Place', key: 'Shift+Ctrl+V', act: () => pasteInternal(true), en: () => !!CLIP.canvas },
    { label: 'Clear', key: 'Delete', act: () => clearSelectionPixels(), en: () => !!D.sel },
    '-',
    { label: 'Fill with Foreground', key: 'Alt+Backspace', act: () => fillSelection(C.fg, 'Fill'), need: 'layer' },
    { label: 'Fill with Background', key: 'Ctrl+Backspace', act: () => fillSelection(C.bg, 'Fill'), need: 'layer' },
    { label: 'Stroke Selection…', act: () => dlgStroke(), en: () => !!D.sel },
    '-',
    { label: 'Free Transform', key: 'Ctrl+T', act: () => startTransform(), need: 'layer' },
    { label: 'Transform', sub: [
      { label: 'Rotate 180°', act: () => transformLayerQuick('180') },
      { label: 'Rotate 90° Clockwise', act: () => transformLayerQuick('cw') },
      { label: 'Rotate 90° Counter Clockwise', act: () => transformLayerQuick('ccw') },
      '-',
      { label: 'Flip Horizontal', act: () => transformLayerQuick('flipH') },
      { label: 'Flip Vertical', act: () => transformLayerQuick('flipV') },
    ] },
    '-',
    { label: 'Keyboard Shortcuts…', key: 'Alt+Shift+Ctrl+K', act: () => dlgShortcuts() },
  ]],
  ['Image', [
    { label: 'Adjustments', sub: filterMenu('adjust') },
    '-',
    { label: 'Image Size…', key: 'Alt+Ctrl+I', act: () => dlgImageSize() },
    { label: 'Canvas Size…', key: 'Alt+Ctrl+C', act: () => dlgCanvasSize() },
    { label: 'Image Rotation', sub: [
      { label: '180°', act: () => transformCanvas('180') },
      { label: '90° Clockwise', act: () => transformCanvas('cw') },
      { label: '90° Counter Clockwise', act: () => transformCanvas('ccw') },
      '-',
      { label: 'Flip Canvas Horizontal', act: () => transformCanvas('flipH') },
      { label: 'Flip Canvas Vertical', act: () => transformCanvas('flipV') },
    ] },
    { label: 'Crop to Selection', act: () => { const b = D.sel.bounds; cropTo(b, true); fitView(); }, en: () => !!D.sel },
    { label: 'Trim Transparent Pixels', act: () => { const b = alphaBounds(flattenCanvas()); if (b) { cropTo(b, true); fitView(); } } },
  ]],
  ['Layer', [
    { label: 'New Layer', key: 'Shift+Ctrl+N', act: () => addLayer() },
    { label: 'Duplicate Layer', act: () => duplicateLayer() },
    { label: 'Delete Layer', act: () => deleteLayer() },
    { label: 'Layer Properties…', act: () => dlgLayerProps() },
    '-',
    { label: 'Layer via Copy', key: 'Ctrl+J', act: () => layerViaCopy(false) },
    { label: 'Layer via Cut', key: 'Shift+Ctrl+J', act: () => layerViaCopy(true), need: 'layer' },
    { label: 'New Fill Layer', sub: [
      { label: 'Solid Color (foreground)', act: () => { const c = mkCanvas(D.w, D.h), g = cx(c); g.fillStyle = C.fg; g.fillRect(0, 0, D.w, D.h); addLayer({ name: nextName('Color Fill'), canvas: c }, 'Fill Layer'); } },
      { label: 'Gradient (foreground → background)', act: () => { const keep = T.gradient.type; T.gradient.type = 'linear'; const c = gradientCanvas({ x: 0, y: 0 }, { x: 0, y: D.h }); T.gradient.type = keep; addLayer({ name: nextName('Gradient Fill'), canvas: c }, 'Fill Layer'); } },
    ] },
    { label: 'Layer Style', sub: filterMenu('style') },
    '-',
    { label: 'Layer Mask', sub: [
      { label: 'Reveal All', act: () => addMask('reveal'), en: () => activeLayer() && !activeLayer().mask },
      { label: 'Hide All', act: () => addMask('hide'), en: () => activeLayer() && !activeLayer().mask },
      { label: 'Reveal Selection', act: () => addMask('sel'), en: () => activeLayer() && !activeLayer().mask && !!D.sel },
      '-',
      { label: 'Disable / Enable Mask', act: () => { const L = activeLayer(); setLayerProps(L.id, { mask: Object.assign({}, L.mask, { enabled: L.mask.enabled === false }) }, 'Toggle Mask'); }, en: () => activeLayer() && !!activeLayer().mask },
      { label: 'Apply Mask', act: () => applyMask(), en: () => activeLayer() && !!activeLayer().mask },
      { label: 'Delete Mask', act: () => { const L = activeLayer(); UI.editMask = false; setLayerProps(L.id, { mask: null }, 'Delete Mask'); }, en: () => activeLayer() && !!activeLayer().mask },
    ] },
    { label: 'Rasterize Type', act: () => rasterizeText(activeLayer()), en: () => activeLayer() && !!activeLayer().text },
    '-',
    { label: 'Arrange', sub: [
      { label: 'Bring to Front', key: 'Shift+Ctrl+]', act: () => moveLayer(D.activeId, D.layers.length - 1) },
      { label: 'Bring Forward', key: 'Ctrl+]', act: () => moveLayer(D.activeId, layerIndex(D.activeId) + 1) },
      { label: 'Send Backward', key: 'Ctrl+[', act: () => moveLayer(D.activeId, layerIndex(D.activeId) - 1) },
      { label: 'Send to Back', key: 'Shift+Ctrl+[', act: () => moveLayer(D.activeId, 0) },
    ] },
    { label: 'Lock / Unlock Layer', key: 'Ctrl+/', act: () => { const L = activeLayer(); setLayerProps(L.id, { locked: !L.locked }, L.locked ? 'Unlock Layer' : 'Lock Layer'); } },
    '-',
    { label: 'Merge Down', key: 'Ctrl+E', act: () => mergeDown() },
    { label: 'Merge Visible', key: 'Shift+Ctrl+E', act: () => mergeVisible() },
    { label: 'Flatten Image', act: () => flattenImage() },
  ]],
  ['Select', [
    { label: 'All', key: 'Ctrl+A', act: () => selectAll() },
    { label: 'Deselect', key: 'Ctrl+D', act: () => deselect(), en: () => !!D.sel },
    { label: 'Inverse', key: 'Shift+Ctrl+I', act: () => selectInverse() },
    '-',
    { label: 'Layer Transparency', act: () => { const L = activeLayer(); const c = mkCanvas(D.w, D.h); cx(c).drawImage(bakedLayer(L).canvas, L.x, L.y); D.sel = makeSel(c); commit('Load Selection'); } },
    { label: 'Color Range (foreground)…', act: () => dlgColorRange() },
    '-',
    { label: 'Feather…', key: 'Shift+F6', act: () => dlgNumber('Feather Selection', 'Feather radius', 8, 0.5, 250, 'px', (v) => featherSel(v)), en: () => !!D.sel },
    { label: 'Expand…', act: () => dlgNumber('Expand Selection', 'Expand by', 8, 1, 100, 'px', (v) => growSel(v)), en: () => !!D.sel },
    { label: 'Contract…', act: () => dlgNumber('Contract Selection', 'Contract by', 8, 1, 100, 'px', (v) => growSel(-v)), en: () => !!D.sel },
  ]],
  ['Filter', [
    { label: 'Last Filter', key: 'Alt+Ctrl+F', act: () => LAST_FILTER.id && runFilter(LAST_FILTER.id, LAST_FILTER.params), en: () => !!LAST_FILTER.id, dyn: () => (LAST_FILTER.id ? 'Last Filter: ' + FILTER_BY_ID[LAST_FILTER.id].name.replace('…', '') : 'Last Filter') },
    '-',
    filterSub('Blur'), filterSub('Sharpen'), filterSub('Noise'), filterSub('Pixelate'), filterSub('Stylize'), filterSub('Distort'), filterSub('Render'), filterSub('Other'),
    '-',
    filterSub('Slop'),
  ]],
  ['View', [
    { label: 'Zoom In', key: 'Ctrl+=', act: () => zoomStep(1) },
    { label: 'Zoom Out', key: 'Ctrl+-', act: () => zoomStep(-1) },
    { label: 'Fit on Screen', key: 'Ctrl+0', act: () => fitView() },
    { label: '100%', key: 'Ctrl+1', act: () => actualPixels() },
    '-',
    { label: 'Grid', key: "Ctrl+'", check: () => store.get('grid', false), act: () => { store.set('grid', !store.get('grid', false)); dirty(); } },
    { label: 'Pixel Grid', check: () => store.get('pixelGrid', true), act: () => { store.set('pixelGrid', !store.get('pixelGrid', true)); dirty(); } },
    { label: 'Layer Bounds', check: () => store.get('showBounds', true), act: () => { store.set('showBounds', !store.get('showBounds', true)); dirty(); } },
    '-',
    { label: 'Theme', sub: [
      { label: 'Pro (dark)', check: () => theme() === 'pro', act: () => setTheme('pro') },
      { label: 'Light', check: () => theme() === 'light', act: () => setTheme('light') },
      { label: 'Paint ’98', check: () => theme() === 'paint', act: () => setTheme('paint') },
    ] },
    { label: 'Show / Hide Panels', key: 'Tab', act: () => document.body.classList.toggle('no-panels') },
  ]],
  ['Help', [
    { label: 'Keyboard Shortcuts…', act: () => dlgShortcuts() },
    { label: 'About Slop Shop', act: () => dlgAbout() },
    '-',
    { label: 'Open Slop Paint Classic (MS Paint)', act: () => { location.href = 'classic/'; } },
    { label: 'Back to slopographic.com', act: () => { location.href = '../'; } },
  ]],
];
const SHORTCUTS = new Map();
function collectShortcuts(items) { for (const it of items) { if (it === '-' || !it) continue; if (it.sub) collectShortcuts(it.sub); if (it.key) SHORTCUTS.set(normCombo(it.key), it); } }
MENUS.forEach(([, items]) => collectShortcuts(items));

let openMenu = null;
function buildMenubar() {
  const bar = $('#menubar');
  for (const [name, items] of MENUS) {
    const btn = h('button', { class: 'mb-item', type: 'button', 'aria-haspopup': 'true' }, name);
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (openMenu && openMenu.btn === btn) closeMenus(); else showMenu(btn, items); });
    btn.addEventListener('pointerenter', () => { if (openMenu && openMenu.btn !== btn) showMenu(btn, items); });
    btn.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); showMenu(btn, items, true); } });
    bar.append(btn);
  }
  document.addEventListener('pointerdown', (e) => { if (openMenu && !e.target.closest('.menu, .mb-item')) closeMenus(); });
}
function closeMenus() { $$('.menu').forEach((m) => m.remove()); $$('.mb-item.open').forEach((b) => b.classList.remove('open')); openMenu = null; }
function menuEnabled(it) {
  if (it.en && !it.en()) return false;
  if (it.need === 'layer' && !activeLayer()) return false;
  return true;
}
function renderMenu(items, x, y, level) {
  const m = h('div', { class: 'menu', role: 'menu' });
  for (const it of items) {
    if (it === '-') { m.append(h('div', { class: 'menu-sep', role: 'separator' })); continue; }
    const en = it.sub ? true : menuEnabled(it);
    const row = h('button', { class: 'menu-row' + (it.sub ? ' has-sub' : ''), type: 'button', role: 'menuitem', disabled: !en },
      h('span', { class: 'menu-check' }, it.check ? (it.check() ? '✓' : '') : ''),
      h('span', { class: 'menu-label' }, it.dyn ? it.dyn() : it.label),
      h('span', { class: 'menu-key' }, it.sub ? '▸' : it.key ? keyLabel(it.key) : ''));
    if (it.sub) {
      const openSub = () => {
        $$('.menu').filter((mm) => +mm.dataset.level > level).forEach((mm) => mm.remove());
        $$('.menu-row.sub-open', m).forEach((r) => r.classList.remove('sub-open'));
        row.classList.add('sub-open');
        const r = row.getBoundingClientRect();
        const sm = renderMenu(it.sub, r.right - 2, r.top - 4, level + 1);
        const sr = sm.getBoundingClientRect();
        if (sr.right > innerWidth) sm.style.left = Math.max(0, r.left - sr.width + 2) + 'px';
      };
      row.addEventListener('pointerenter', openSub);
      row.addEventListener('click', openSub);
      row.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') { openSub(); const f = $$('.menu').pop().querySelector('.menu-row:not([disabled])'); if (f) f.focus(); } });
    } else {
      row.addEventListener('pointerenter', () => { $$('.menu').filter((mm) => +mm.dataset.level > level).forEach((mm) => mm.remove()); });
      row.addEventListener('click', () => { closeMenus(); if (en) it.act(); });
    }
    m.append(row);
  }
  m.dataset.level = level;
  m.style.left = x + 'px'; m.style.top = y + 'px';
  m.addEventListener('keydown', (e) => {
    const rows = $$('.menu-row:not([disabled])', m), i = rows.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (rows[i + 1] || rows[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (rows[i - 1] || rows[rows.length - 1]).focus(); }
    else if (e.key === 'Escape' || e.key === 'ArrowLeft') { e.preventDefault(); if (level === 0) { const b = openMenu && openMenu.btn; closeMenus(); if (b) b.focus(); } else { m.remove(); } }
  });
  document.body.append(m);
  const r = m.getBoundingClientRect();
  if (r.bottom > innerHeight) m.style.top = Math.max(0, innerHeight - r.height - 4) + 'px';
  if (r.right > innerWidth) m.style.left = Math.max(0, innerWidth - r.width - 4) + 'px';
  return m;
}
function showMenu(btn, items, focus) {
  closeMenus();
  btn.classList.add('open');
  const r = btn.getBoundingClientRect();
  const m = renderMenu(items, r.left, r.bottom, 0);
  openMenu = { btn, m };
  if (focus) { const f = m.querySelector('.menu-row:not([disabled])'); if (f) f.focus(); }
}

/* ---------- toolbox ---------- */
function buildToolbox() {
  const box = $('#toolbox');
  const order = ['move', 'marquee', 'ellipse', 'lasso', 'polylasso', 'wand', 'crop', 'eyedropper', 'brush', 'pencil', 'clone', 'eraser', 'gradient', 'bucket', 'smudge', 'dodge', 'type', 'shape', 'hand', 'zoom'];
  const grid = h('div', { class: 'tools' });
  for (const id of order) {
    const t = TOOL[id];
    const b = h('button', { class: 'tool', type: 'button', 'data-tool': id, title: `${t.name} (${t.key})`, 'aria-label': t.name, html: t.icon });
    b.addEventListener('click', () => selectTool(id));
    grid.append(b);
  }
  const fg = h('button', { class: 'sw-fg', type: 'button', title: 'Set foreground colour', 'aria-label': 'Foreground colour' });
  const bg = h('button', { class: 'sw-bg', type: 'button', title: 'Set background colour', 'aria-label': 'Background colour' });
  const swap = h('button', { class: 'sw-swap', type: 'button', title: 'Swap colours (X)', 'aria-label': 'Swap colours', html: '<svg viewBox="0 0 12 12"><path d="M2 4h6l-2-2M10 8H4l2 2"/></svg>' });
  const def = h('button', { class: 'sw-def', type: 'button', title: 'Default colours (D)', 'aria-label': 'Default colours' }, h('i'), h('i'));
  fg.addEventListener('click', async () => { const c = await pickColorDialog('Color Picker (Foreground Color)', C.fg); if (c) setColor('fg', c); });
  bg.addEventListener('click', async () => { const c = await pickColorDialog('Color Picker (Background Color)', C.bg); if (c) setColor('bg', c); });
  swap.addEventListener('click', swapColors);
  def.addEventListener('click', defaultColors);
  box.append(grid, h('div', { class: 'swatches-fgbg' }, bg, fg, swap, def));
  const sync = () => {
    $$('.tool', box).forEach((b) => b.classList.toggle('active', b.dataset.tool === UI.tool && !TRANSFORM.active));
    fg.style.background = C.fg; bg.style.background = C.bg;
  };
  listeners.add((w) => { if (w === 'tool' || w === 'color') sync(); });
  sync();
}
function swapColors() { const f = C.fg; setColor('fg', C.bg); setColor('bg', f); }
function defaultColors() { setColor('fg', '#000000'); setColor('bg', '#ffffff'); }

/* ---------- options bar ---------- */
function optRange(label, obj, key, min, max, step = 1, fmt = (v) => v, toVal = (v) => v, fromVal = (v) => v) {
  const range = h('input', { type: 'range', min, max, step, value: fromVal(obj[key]), 'aria-label': label });
  const num = h('input', { type: 'number', min, max, step, value: fmt(fromVal(obj[key])), class: 'opt-num', 'aria-label': label });
  const set = (v) => { v = clamp(+v, min, max); obj[key] = toVal(v); range.value = v; if (document.activeElement !== num) num.value = fmt(v); saveToolOptions(); emit('options'); dirty(); };
  range.addEventListener('input', () => set(range.value));
  num.addEventListener('change', () => set(num.value));
  return h('label', { class: 'opt' }, h('span', null, label), range, num);
}
function optCheck(label, obj, key) {
  const c = h('input', { type: 'checkbox', checked: !!obj[key] });
  c.addEventListener('change', () => { obj[key] = c.checked; saveToolOptions(); emit('options'); });
  return h('label', { class: 'opt opt-check' }, c, h('span', null, label));
}
function optSelect(label, obj, key, options, onChange) {
  const s = h('select', { 'aria-label': label }, options.map(([v, l]) => h('option', { value: v, selected: obj[key] === v }, l)));
  s.addEventListener('change', () => { obj[key] = s.value; saveToolOptions(); emit('options'); if (onChange) onChange(); });
  return h('label', { class: 'opt' }, label ? h('span', null, label) : null, s);
}
function optSelMode() {
  const modes = [['replace', 'New selection', 'M3 3h12v12H3z'], ['add', 'Add to selection (Shift)', 'M3 3h9v9H3zM9 9h9v9H9z'], ['sub', 'Subtract from selection (Alt)', 'M3 3h9v9H3zM9 9h9v9H9z'], ['int', 'Intersect with selection (Shift+Alt)', 'M3 3h9v9H3zM9 9h9v9H9z']];
  const wrap = h('div', { class: 'opt seg', role: 'group', 'aria-label': 'Selection mode' });
  for (const [m, title, d] of modes) {
    const b = h('button', { type: 'button', class: 'seg-b' + (T.select.mode === m ? ' on' : ''), title, 'aria-label': title, html: `<svg viewBox="0 0 21 21" class="selmode-${m}"><path d="${d}"/></svg>` });
    b.addEventListener('click', () => { T.select.mode = m; saveToolOptions(); buildOptions(); });
    wrap.append(b);
  }
  return wrap;
}
const pct = (v) => Math.round(v);
function buildOptions() {
  const bar = $('#options'); bar.textContent = '';
  const t = currentTool();
  const icon = h('span', { class: 'opt-icon', html: t.icon || '' });
  bar.append(icon, h('span', { class: 'opt-name' }, t.name));
  const add = (...els) => bar.append(...els);
  if (TRANSFORM.active) {
    const tf = TRANSFORM;
    const n = (label, get, set, unit) => { const i = h('input', { type: 'number', class: 'opt-num wide', value: get(), step: 0.1 }); i.addEventListener('change', () => { set(+i.value); dirty(true); }); listeners.add((w) => { if (w === 'transform' && document.activeElement !== i) i.value = get(); }); return h('label', { class: 'opt' }, h('span', null, label), i, unit ? h('span', { class: 'opt-u' }, unit) : null); };
    add(n('X', () => Math.round(tf.cx + tf.tx), (v) => { tf.tx = v - tf.cx; }, 'px'), n('Y', () => Math.round(tf.cy + tf.ty), (v) => { tf.ty = v - tf.cy; }, 'px'),
      n('W', () => Math.round(tf.sx * 1000) / 10, (v) => { tf.sx = v / 100; }, '%'), n('H', () => Math.round(tf.sy * 1000) / 10, (v) => { tf.sy = v / 100; }, '%'),
      n('∠', () => Math.round((tf.rot * 180) / Math.PI * 10) / 10, (v) => { tf.rot = (v * Math.PI) / 180; }, '°'),
      h('span', { class: 'opt-spacer' }),
      h('button', { class: 'btn', type: 'button', onclick: cancelTransform, title: 'Cancel (Esc)' }, 'Cancel'),
      h('button', { class: 'btn primary', type: 'button', onclick: commitTransform, title: 'Commit (Enter)' }, 'Commit'));
    return;
  }
  const blendOpts = BLENDS.map((b) => [b[0], b[1]]);
  switch (t.id) {
    case 'brush': add(optRange('Size', T.brush, 'size', 1, 1000, 1, (v) => v + ''), optRange('Hardness', T.brush, 'hardness', 0, 100, 1, pct, (v) => v / 100, (v) => v * 100), optSelect('Mode', T.brush, 'blend', blendOpts), optRange('Opacity', T.brush, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Flow', T.brush, 'flow', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optCheck('Pen pressure', T.brush, 'pressure')); break;
    case 'pencil': add(optRange('Size', T.pencil, 'size', 1, 200), optRange('Opacity', T.pencil, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100)); break;
    case 'eraser': add(optRange('Size', T.eraser, 'size', 1, 1000), optRange('Hardness', T.eraser, 'hardness', 0, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Opacity', T.eraser, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Flow', T.eraser, 'flow', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optCheck('Pen pressure', T.eraser, 'pressure')); break;
    case 'clone': add(optRange('Size', T.clone, 'size', 1, 1000), optRange('Hardness', T.clone, 'hardness', 0, 100, 1, pct, (v) => v / 100, (v) => v * 100), optRange('Opacity', T.clone, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optCheck('Aligned', T.clone, 'aligned'), optCheck('Sample all layers', T.clone, 'sampleAll'), h('span', { class: 'opt-hint' }, isMac ? '⌥-click to set the source' : 'Alt-click to set the source')); break;
    case 'smudge': add(optRange('Size', T.smudge, 'size', 1, 500), optRange('Strength', T.smudge, 'strength', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100)); break;
    case 'dodge': add(optSelect('', T.dodge, 'mode', [['dodge', 'Dodge (lighten)'], ['burn', 'Burn (darken)']]), optRange('Size', T.dodge, 'size', 1, 1000), optRange('Exposure', T.dodge, 'exposure', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100)); break;
    case 'marquee': case 'ellipse': case 'lasso': case 'polylasso': add(optSelMode(), optRange('Feather', T.select, 'feather', 0, 250, 1, (v) => v), h('span', { class: 'opt-hint' }, t.id === 'polylasso' ? 'Click points · double-click or Enter to close' : 'Drag inside a selection to move it')); break;
    case 'wand': add(optSelMode(), optRange('Tolerance', T.wand, 'tol', 0, 255), optCheck('Contiguous', T.wand, 'contiguous'), optCheck('Sample all layers', T.wand, 'sampleAll')); break;
    case 'bucket': add(optRange('Tolerance', T.bucket, 'tol', 0, 255), optRange('Opacity', T.bucket, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100), optCheck('Contiguous', T.bucket, 'contiguous'), optCheck('All layers', T.bucket, 'sampleAll')); break;
    case 'gradient': add(optSelect('', T.gradient, 'type', [['linear', 'Linear'], ['radial', 'Radial'], ['reflected', 'Reflected'], ['angle', 'Angle']]), optSelect('', T.gradient, 'mode', [['fgbg', 'Foreground → Background'], ['fgt', 'Foreground → Transparent'], ['slop', 'Slop Green'], ['spectrum', 'Spectrum']]), optCheck('Reverse', T.gradient, 'reverse'), optRange('Opacity', T.gradient, 'opacity', 1, 100, 1, pct, (v) => v / 100, (v) => v * 100)); break;
    case 'shape': add(optSelect('', T.shape, 'kind', [['rect', 'Rectangle'], ['rounded', 'Rounded Rectangle'], ['ellipse', 'Ellipse'], ['polygon', 'Polygon'], ['star', 'Star'], ['heart', 'Heart'], ['line', 'Line']], buildOptions), optCheck('Fill (fg)', T.shape, 'fill'), optCheck('Stroke', T.shape, 'stroke'), optRange('Stroke', T.shape, 'strokeW', 1, 200)); if (T.shape.kind === 'rounded') add(optRange('Radius', T.shape, 'radius', 0, 500)); if (T.shape.kind === 'polygon' || T.shape.kind === 'star') add(optRange('Sides', T.shape, 'sides', 3, 40)); break;
    case 'type': {
      const fonts = [['Archivo', 'Archivo'], ['Inter Tight', 'Inter Tight'], ['Instrument Serif', 'Instrument Serif'], ['JetBrains Mono', 'JetBrains Mono'], ['Impact', 'Impact'], ['Comic Sans MS', 'Comic Sans MS'], ['Georgia', 'Georgia'], ['Times New Roman', 'Times New Roman'], ['Arial', 'Arial'], ['Courier New', 'Courier New']];
      add(optSelect('', T.type, 'font', fonts, updateEditingType), optRange('Size', T.type, 'size', 4, 600), optCheck('Bold', T.type, 'bold'), optCheck('Italic', T.type, 'italic'), optSelect('', T.type, 'align', [['left', 'Left'], ['center', 'Center'], ['right', 'Right']], updateEditingType),
        h('span', { class: 'opt-hint' }, `Click to type · ${MOD}Enter to commit · Esc to cancel`));
      break;
    }
    case 'move': add(optCheck('Auto-select layer', T.move, 'auto'), h('span', { class: 'opt-hint' }, 'Drag to move · arrow keys nudge · Ctrl+T to transform')); break;
    case 'crop': add(optCheck('Delete cropped pixels', T.crop, 'del'), h('span', { class: 'opt-spacer' }), h('button', { class: 'btn', type: 'button', onclick: () => { TOOL.crop.activate(); dirty(); } }, 'Reset'), h('button', { class: 'btn primary', type: 'button', onclick: () => TOOL.crop.apply() }, 'Crop')); break;
    case 'eyedropper': add(optSelect('Sample size', T.eyedrop, 'size', [[1, 'Point'], [3, '3 × 3 average'], [5, '5 × 5 average'], [11, '11 × 11 average']].map(([v, l]) => [String(v), l])), optCheck('All layers', T.eyedrop, 'all')); break;
    case 'hand': case 'zoom': add(h('button', { class: 'btn', type: 'button', onclick: () => actualPixels() }, '100%'), h('button', { class: 'btn', type: 'button', onclick: () => fitView() }, 'Fit Screen')); break;
  }
  if (t.id === 'eyedropper') { const s = bar.querySelector('select'); s.value = String(T.eyedrop.size); s.onchange = () => { T.eyedrop.size = +s.value; saveToolOptions(); }; }
  if (t.id === 'type') $$('input[type=range], input[type=number], input[type=checkbox]', bar).forEach((i) => i.addEventListener('input', updateEditingType));
}

/* ---------- panels ---------- */
function panel(id, title, body, extra) {
  const collapsed = store.get('collapsed.' + id, false);
  const p = h('section', { class: 'panel' + (collapsed ? ' collapsed' : ''), id: 'panel-' + id },
    h('button', { class: 'panel-head', type: 'button', 'aria-expanded': String(!collapsed) }, h('span', null, title), extra || null), h('div', { class: 'panel-body' }, body));
  p.firstChild.addEventListener('click', (e) => { if (e.target.closest('.panel-extra')) return; p.classList.toggle('collapsed'); p.firstChild.setAttribute('aria-expanded', String(!p.classList.contains('collapsed'))); store.set('collapsed.' + id, p.classList.contains('collapsed')); });
  return p;
}
function buildPanels() {
  const side = $('#panels');
  // Colour
  const cp = colorPicker(() => C.fg, (v) => setColor('fg', v));
  listeners.add((w) => { if (w === 'color') cp.sync(); });
  side.append(panel('color', 'Color', cp.el));
  // Swatches
  const sw = h('div', { class: 'swatch-grid' });
  const renderSw = () => {
    sw.textContent = '';
    const custom = store.get('swatches', []);
    const base = ['#000000', '#ffffff', '#7f7f7f', '#c3c3c3', '#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#7f00ff', '#d4ff3a', '#9fcc00', '#3d5200', '#1f2a00', '#e6ff8c', '#ff6f8e', '#ffb3c7', '#f1ede4', '#0a0a0a', '#1e90ff', '#ffd23f', '#8b4513'];
    for (const c of base.concat(custom)) {
      const b = h('button', { type: 'button', class: 'swatch', title: c + ' — click: foreground, Alt-click: background', 'aria-label': 'Swatch ' + c });
      b.style.background = c;
      b.addEventListener('click', (e) => setColor(e.altKey ? 'bg' : 'fg', c));
      b.addEventListener('contextmenu', (e) => { e.preventDefault(); if (custom.includes(c)) { store.set('swatches', custom.filter((x) => x !== c)); renderSw(); } });
      sw.append(b);
    }
    const addB = h('button', { type: 'button', class: 'swatch add', title: 'Add the foreground colour', 'aria-label': 'Add swatch' }, '+');
    addB.addEventListener('click', () => { const cs = store.get('swatches', []); if (!cs.includes(C.fg)) { cs.push(C.fg); store.set('swatches', cs.slice(-40)); renderSw(); } });
    sw.append(addB);
  };
  renderSw();
  side.append(panel('swatches', 'Swatches', sw));
  // Layers
  side.append(panel('layers', 'Layers', buildLayersPanel()));
  // History
  const hist = h('ol', { class: 'history', 'aria-label': 'History states' });
  const renderHist = () => {
    hist.textContent = '';
    Hist.states.forEach((s, i) => {
      const li = h('li', { class: (i === Hist.idx ? 'cur' : '') + (i > Hist.idx ? ' future' : '') }, h('button', { type: 'button' }, s.label));
      li.firstChild.addEventListener('click', () => jumpHistory(i));
      hist.append(li);
    });
    const cur = hist.querySelector('.cur'); if (cur) cur.scrollIntoView({ block: 'nearest' });
  };
  listeners.add((w) => { if (w === 'history') renderHist(); });
  side.append(panel('history', 'History', hist));
}
function layerThumb(L) {
  const k = Math.min(40 / D.w, 30 / D.h), w = Math.max(1, Math.round(D.w * k)), hh = Math.max(1, Math.round(D.h * k));
  const t = mkCanvas(w, hh), g = cx(t);
  g.imageSmoothingQuality = 'high';
  g.drawImage(L.canvas, L.x * k, L.y * k, L.canvas.width * k, L.canvas.height * k);
  return t;
}
function maskThumb(L) {
  const k = Math.min(40 / D.w, 30 / D.h), w = Math.max(1, Math.round(D.w * k)), hh = Math.max(1, Math.round(D.h * k));
  const t = mkCanvas(w, hh), g = cx(t), m = L.mask;
  g.fillStyle = '#000'; g.fillRect(0, 0, w, hh);
  if (!m.def) { g.fillStyle = '#fff'; g.fillRect(0, 0, w, hh); g.fillStyle = '#000'; g.fillRect(m.x * k, m.y * k, m.canvas.width * k, m.canvas.height * k); }
  const white = mkCanvas(m.canvas.width, m.canvas.height), wg = cx(white); wg.drawImage(m.canvas, 0, 0); wg.globalCompositeOperation = 'source-in'; wg.fillStyle = '#fff'; wg.fillRect(0, 0, white.width, white.height);
  g.drawImage(white, m.x * k, m.y * k, m.canvas.width * k, m.canvas.height * k);
  return t;
}
const thumbs = new WeakMap();
function cachedThumb(L, mask) {
  const src = mask ? L.mask.canvas : L.canvas, key = src;
  const e = thumbs.get(key);
  const sig = `${D.w}x${D.h}|${mask ? L.mask.x + ',' + L.mask.y + ',' + L.mask.def : L.x + ',' + L.y}`;
  if (e && e.sig === sig) return e.c;
  const c = mask ? maskThumb(L) : layerThumb(L);
  thumbs.set(key, { sig, c });
  return c;
}
function buildLayersPanel() {
  const blend = h('select', { class: 'lp-blend', 'aria-label': 'Blend mode' }, BLENDS.map((b) => h('option', { value: b[0] }, b[1])));
  const op = h('input', { type: 'range', min: 0, max: 100, class: 'lp-op', 'aria-label': 'Layer opacity' });
  const opN = h('input', { type: 'number', min: 0, max: 100, class: 'opt-num', 'aria-label': 'Layer opacity percent' });
  const list = h('ul', { class: 'layers', role: 'listbox', 'aria-label': 'Layers' });
  const btn = (title, d, fn) => { const b = h('button', { type: 'button', class: 'lp-btn', title, 'aria-label': title, html: `<svg viewBox="0 0 24 24"><path d="${d}"/></svg>` }); b.addEventListener('click', fn); return b; };
  const fx = btn('Layer style', 'M5 19c3 0 3-14 6-14M4 10h8M14 9l6 8M20 9l-6 8', (e) => { const r = e.currentTarget.getBoundingClientRect(); closeMenus(); const m = renderMenu(filterMenu('style'), r.left, r.top, 0); m.style.top = Math.max(0, r.top - m.getBoundingClientRect().height) + 'px'; openMenu = { btn: e.currentTarget, m }; });
  const foot = h('div', { class: 'lp-foot' },
    btn('Lock / unlock layer', 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z', () => { const L = activeLayer(); setLayerProps(L.id, { locked: !L.locked }, L.locked ? 'Unlock Layer' : 'Lock Layer'); }),
    fx,
    btn('Add layer mask', 'M3 5h18v14H3zM12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z', () => { if (activeLayer().mask) { UI.editMask = !UI.editMask; emit('doc'); } else addMask(D.sel ? 'sel' : 'reveal'); }),
    btn('Merge down', 'M12 4v12M7 11l5 5 5-5M5 20h14', () => mergeDown()),
    btn('Duplicate layer', 'M8 8h12v12H8zM4 16V4h12', () => duplicateLayer()),
    btn('New layer', 'M4 4h16v16H4zM12 8v8M8 12h8', () => addLayer()),
    btn('Delete layer', 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3', () => deleteLayer()));
  blend.addEventListener('change', () => setLayerProps(D.activeId, { blend: blend.value }, 'Blending Change'));
  op.addEventListener('input', () => { patchLayer(D.activeId, { opacity: op.value / 100 }); opN.value = op.value; emit('doc'); });
  op.addEventListener('change', () => commit('Opacity Change'));
  opN.addEventListener('change', () => { setLayerProps(D.activeId, { opacity: clamp(+opN.value, 0, 100) / 100 }, 'Opacity Change'); });
  let dragId = null;
  const render = () => {
    const L0 = activeLayer();
    if (L0) { blend.value = L0.blend; if (document.activeElement !== op) op.value = Math.round(L0.opacity * 100); if (document.activeElement !== opN) opN.value = Math.round(L0.opacity * 100); }
    list.textContent = '';
    for (let i = D.layers.length - 1; i >= 0; i--) {
      const L = D.layers[i];
      const eye = h('button', { type: 'button', class: 'lp-eye' + (L.visible ? ' on' : ''), title: L.visible ? 'Hide layer' : 'Show layer', 'aria-label': (L.visible ? 'Hide ' : 'Show ') + L.name, html: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>' });
      eye.addEventListener('click', (e) => { e.stopPropagation(); if (e.altKey) { const solo = D.layers.every((l) => l === L || !l.visible); D.layers = D.layers.map((l) => Object.assign({}, l, { visible: solo ? true : l.id === L.id })); commit('Show/Hide'); } else setLayerProps(L.id, { visible: !L.visible }, L.visible ? 'Hide Layer' : 'Show Layer'); });
      const th = h('span', { class: 'lp-thumb' + (L.id === D.activeId && !UI.editMask ? ' target' : ''), title: 'Edit layer pixels' }, cachedThumb(L, false));
      th.addEventListener('click', () => { D.activeId = L.id; UI.editMask = false; emit('doc'); emit('tool'); });
      const row = h('li', { class: 'layer' + (L.id === D.activeId ? ' active' : ''), role: 'option', 'aria-selected': String(L.id === D.activeId), draggable: 'true', 'data-id': L.id }, eye, th);
      if (L.mask) {
        const mt = h('span', { class: 'lp-thumb mask' + (L.id === D.activeId && UI.editMask ? ' target' : '') + (L.mask.enabled === false ? ' off' : ''), title: 'Edit layer mask (Shift-click to disable)' }, cachedThumb(L, true));
        mt.addEventListener('click', (e) => { e.stopPropagation(); if (e.shiftKey) { setLayerProps(L.id, { mask: Object.assign({}, L.mask, { enabled: L.mask.enabled === false }) }, 'Toggle Mask'); return; } D.activeId = L.id; UI.editMask = true; emit('doc'); emit('tool'); toast('Painting now edits the mask: black hides, white reveals'); });
        row.append(mt);
      }
      const name = h('span', { class: 'lp-name' }, L.text ? h('b', { class: 'lp-t' }, 'T') : null, L.name);
      name.addEventListener('dblclick', (e) => { e.stopPropagation(); renameInline(name, L); });
      row.append(name);
      if (L.locked) row.append(h('span', { class: 'lp-lock', title: 'Locked', html: '<svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z"/></svg>' }));
      if (L.blend !== 'normal' || L.opacity < 1) row.append(h('span', { class: 'lp-meta' }, (L.blend !== 'normal' ? BLENDS.find((b) => b[0] === L.blend)[1] : '') + (L.opacity < 1 ? ` ${Math.round(L.opacity * 100)}%` : '')));
      row.addEventListener('click', () => { if (D.activeId !== L.id) { D.activeId = L.id; UI.editMask = false; emit('doc'); emit('tool'); } });
      row.addEventListener('dragstart', (e) => { dragId = L.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(L.id)); row.classList.add('dragging'); });
      row.addEventListener('dragend', () => { dragId = null; row.classList.remove('dragging'); $$('.layer', list).forEach((r) => r.classList.remove('drop-above', 'drop-below')); });
      row.addEventListener('dragover', (e) => { if (dragId == null) return; e.preventDefault(); const r = row.getBoundingClientRect(), above = e.clientY < r.top + r.height / 2; row.classList.toggle('drop-above', above); row.classList.toggle('drop-below', !above); });
      row.addEventListener('dragleave', () => row.classList.remove('drop-above', 'drop-below'));
      row.addEventListener('drop', (e) => {
        e.preventDefault(); if (dragId == null) return;
        const r = row.getBoundingClientRect(), above = e.clientY < r.top + r.height / 2;
        const from = layerIndex(dragId); let to = layerIndex(L.id) + (above ? 1 : 0);
        if (from < to) to--;
        moveLayer(dragId, to);
      });
      list.append(row);
    }
  };
  listeners.add((w) => { if (w === 'doc') render(); });
  render();
  return h('div', { class: 'lp' }, h('div', { class: 'lp-top' }, blend, h('label', { class: 'lp-opl' }, h('span', null, 'Opacity'), op, opN)), list, foot);
}
function renameInline(el, L) {
  const inp = h('input', { class: 'lp-rename', value: L.name, 'aria-label': 'Layer name' });
  el.replaceWith(inp); inp.focus(); inp.select();
  let done = false;
  const finish = (ok) => { if (done) return; done = true; if (ok && inp.value.trim() && inp.value !== L.name) setLayerProps(L.id, { name: inp.value.trim() }, 'Rename Layer'); else emit('doc'); };
  inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
  inp.addEventListener('blur', () => finish(true));
}
function addMask(kind) {
  const L = coverDoc(activeLayer());
  const m = mkCanvas(D.w, D.h), g = cx(m);
  if (kind === 'reveal') { g.fillStyle = '#000'; g.fillRect(0, 0, D.w, D.h); }
  else if (kind === 'sel') g.drawImage(D.sel.mask, 0, 0);
  const mask = { canvas: m, x: 0, y: 0, def: kind !== 'reveal', enabled: true };
  setLayerProps(L.id, { mask }, 'Add Layer Mask');
  UI.editMask = true; emit('doc');
  if (kind === 'sel') { D.sel = null; commit('Deselect'); }
}
function applyMask() {
  const L = activeLayer(); const b = bakedLayer(L);
  UI.editMask = false;
  setLayerProps(L.id, { canvas: b.canvas, x: b.x, y: b.y, mask: null }, 'Apply Layer Mask');
}
function layerViaCopy(cut) {
  const L = activeLayer(); if (!L) return;
  const r = D.sel ? copySelectionPixels(false) : null;
  if (!r) { duplicateLayer(); return; }
  if (cut) clearSelectionPixels('Cut');
  const c = mkCanvas(D.w, D.h); cx(c).drawImage(r.canvas, r.x, r.y);
  addLayer({ name: nextName('Layer'), canvas: c }, cut ? 'Layer via Cut' : 'Layer via Copy');
}

/* ---------- filters ---------- */
const LAST_FILTER = { id: null, params: null };
async function runFilter(id, presetParams) {
  const f = FILTER_BY_ID[id];
  let L = activeLayer();
  if (!L) return;
  if (L.locked) { toast('That layer is locked'); return; }
  if (!L.visible) { toast('Show the layer first'); return; }
  if (TE.el) await endTypeEdit();
  if (TRANSFORM.active) commitTransform();
  L = activeLayer();
  const wasText = !!L.text; // rasterized only if the filter is actually applied
  if (f.cover) L = coverDoc(L);
  const env = { fg: C.fg, bg: C.bg };
  const base = L.canvas;
  const finish = async (params) => {
    document.body.classList.add('busy');
    await new Promise((r) => setTimeout(r, 20));
    try {
      const out = await f.fn(base, params, env);
      const LL = D.layers.find((l) => l.id === L.id);
      live = null;
      patchLayer(L.id, { canvas: D.sel ? mixBySel(LL.canvas, out, selInLayer(LL)) : out, text: null });
      commit(f.name.replace('…', ''));
      if (wasText) toast('Type layer rasterized');
      LAST_FILTER.id = id; LAST_FILTER.params = params;
    } catch (e) { console.warn(e); toast('That filter failed: ' + e.message); live = null; dirty(true); }
    document.body.classList.remove('busy');
  };
  if (!f.params || presetParams) { await finish(presetParams || {}); return; }
  const params = {};
  for (const p of f.params) if (p.k) params[p.k] = p.v === '@fg' ? C.fg : p.v === '@bg' ? C.bg : JSON.parse(JSON.stringify(p.v === undefined ? null : p.v));
  if (LAST_FILTER.id === id && LAST_FILTER.params) Object.assign(params, JSON.parse(JSON.stringify(LAST_FILTER.params)));
  let preview = true, token = 0, pending = false, lastOut = null;
  const status = h('span', { class: 'dlg-status' });
  const runPreview = async () => {
    if (pending) return; pending = true;
    await new Promise((r) => requestAnimationFrame(r));
    pending = false;
    const my = ++token;
    if (!preview) { live = null; dirty(true); return; }
    status.textContent = 'Rendering…';
    await new Promise((r) => setTimeout(r, 0));
    let out;
    try { out = await f.fn(base, params, env); } catch (e) { status.textContent = e.message; return; }
    if (my !== token) return;
    lastOut = { out, key: JSON.stringify(params) };
    const mixed = D.sel ? mixBySel(base, out, selInLayer(L)) : out;
    live = { layerId: L.id, surface: (LL) => ({ canvas: mixed, x: L.x, y: L.y }) };
    status.textContent = '';
    dirty(true);
  };
  const body = h('div', { class: 'fparams' });
  for (const p of f.params) body.append(paramControl(p, params, base, runPreview));
  const pv = h('input', { type: 'checkbox', checked: true });
  pv.addEventListener('change', () => { preview = pv.checked; runPreview(); });
  body.append(h('div', { class: 'dlg-row' }, h('label', { class: 'opt-check' }, pv, h('span', null, 'Preview')), status));
  dialog({ title: f.name.replace('…', ''), body, cls: 'dlg-filter' + (f.params.some((p) => p.type === 'curve') ? ' dlg-curve' : ''),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true }],
    onClose: async (ok) => {
      token++;
      if (!ok) { live = null; dirty(true); return; }
      if (lastOut && lastOut.key === JSON.stringify(params) && preview) {
        live = null;
        const LL = D.layers.find((l) => l.id === L.id);
        patchLayer(L.id, { canvas: D.sel ? mixBySel(LL.canvas, lastOut.out, selInLayer(LL)) : lastOut.out, text: null });
        if (wasText) toast('Type layer rasterized');
        commit(f.name.replace('…', '')); LAST_FILTER.id = id; LAST_FILTER.params = JSON.parse(JSON.stringify(params));
      } else { await finish(params); LAST_FILTER.params = JSON.parse(JSON.stringify(params)); }
    } });
  runPreview();
}
function paramControl(p, params, base, changed) {
  if (p.type === 'range') {
    const r = h('input', { type: 'range', min: p.min, max: p.max, step: p.step || 1, value: params[p.k], 'aria-label': p.label });
    const n = h('input', { type: 'number', min: p.min, max: p.max, step: p.step || 1, value: params[p.k], class: 'opt-num', 'aria-label': p.label });
    const set = (v) => { v = clamp(+v, p.min, p.max); params[p.k] = v; r.value = v; if (document.activeElement !== n) n.value = v; changed(); };
    r.addEventListener('input', () => set(r.value)); n.addEventListener('change', () => set(n.value));
    return h('div', { class: 'fp fp-range' }, h('div', { class: 'fp-l' }, h('span', null, p.label), h('span', { class: 'fp-n' }, n, p.unit ? h('span', { class: 'fp-u' }, p.unit) : null)), r);
  }
  if (p.type === 'check') { const c = h('input', { type: 'checkbox', checked: !!params[p.k] }); c.addEventListener('change', () => { params[p.k] = c.checked; changed(); }); return h('label', { class: 'fp opt-check' }, c, h('span', null, p.label)); }
  if (p.type === 'select') { const s = h('select', null, p.options.map(([v, l]) => h('option', { value: v, selected: params[p.k] === v }, l))); s.addEventListener('change', () => { params[p.k] = s.value; changed(); }); return h('label', { class: 'fp fp-sel' }, h('span', null, p.label), s); }
  if (p.type === 'color') {
    const b = h('button', { type: 'button', class: 'fp-color', 'aria-label': p.label }); b.style.background = params[p.k];
    b.addEventListener('click', async () => { const c = await pickColorDialog(p.label, params[p.k]); if (c) { params[p.k] = c; b.style.background = c; changed(); } });
    return h('div', { class: 'fp fp-sel' }, h('span', null, p.label), b);
  }
  if (p.type === 'histogram') {
    const c = h('canvas', { class: 'fp-hist', width: 256, height: 90 }), H = histogram(base), g = c.getContext('2d');
    let mx = 1; for (let i = 0; i < 256; i++) mx = Math.max(mx, H.l[i]);
    g.fillStyle = getComputedStyle(document.body).getPropertyValue('--fg') || '#ddd';
    for (let i = 0; i < 256; i++) { const v = Math.sqrt(H.l[i] / mx) * 88; g.fillRect(i, 90 - v, 1, v); }
    return h('div', { class: 'fp' }, c);
  }
  if (p.type === 'curve') return curveEditor(params[p.k], base, changed);
  return h('div');
}
function curveEditor(curves, base, changed) {
  const S = 256, c = h('canvas', { class: 'fp-curve', width: S, height: S, 'aria-label': 'Curve: click to add points, drag them, drag off the graph to remove' });
  let ch = 'rgb', drag = -1;
  const sel = h('select', { 'aria-label': 'Channel' }, [['rgb', 'RGB'], ['r', 'Red'], ['g', 'Green'], ['b', 'Blue']].map(([v, l]) => h('option', { value: v }, l)));
  sel.addEventListener('change', () => { ch = sel.value; draw(); });
  const H = histogram(base);
  function draw() {
    const g = c.getContext('2d');
    g.fillStyle = '#1b1b1b'; g.fillRect(0, 0, S, S);
    const hist = ch === 'rgb' ? H.l : H[ch]; let mx = 1; for (const v of hist) mx = Math.max(mx, v);
    g.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 256; i++) { const v = Math.sqrt(hist[i] / mx) * S; g.fillRect(i, S - v, 1, v); }
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); for (let i = 1; i < 4; i++) { g.moveTo((i * S) / 4, 0); g.lineTo((i * S) / 4, S); g.moveTo(0, (i * S) / 4); g.lineTo(S, (i * S) / 4); } g.moveTo(0, S); g.lineTo(S, 0); g.stroke();
    const lut = curveLut(curves[ch]);
    g.strokeStyle = { rgb: '#eee', r: '#ff5a5a', g: '#4cff7a', b: '#5aa0ff' }[ch]; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x < 256; x++) { const y = S - lut[x]; x ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    for (const [x, y] of curves[ch]) { g.fillStyle = '#fff'; g.fillRect(x - 3.5, S - y - 3.5, 7, 7); }
  }
  const pt = (e) => { const r = c.getBoundingClientRect(); return [clamp(Math.round(((e.clientX - r.left) / r.width) * 255), 0, 255), clamp(Math.round((1 - (e.clientY - r.top) / r.height) * 255), 0, 255), (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]; };
  c.addEventListener('pointerdown', (e) => {
    const [x, y] = pt(e), pts = curves[ch];
    drag = pts.findIndex(([px, py]) => Math.abs(px - x) < 10 && Math.abs(py - y) < 10);
    if (drag < 0) { pts.push([x, y]); pts.sort((a, b) => a[0] - b[0]); drag = pts.findIndex((p) => p[0] === x && p[1] === y); }
    c.setPointerCapture(e.pointerId); draw(); changed();
  });
  c.addEventListener('pointermove', (e) => {
    if (drag < 0) return;
    const [x, y, fx, fy] = pt(e), pts = curves[ch];
    if ((fx < -0.08 || fx > 1.08 || fy < -0.08 || fy > 1.08) && pts.length > 2) { pts.splice(drag, 1); drag = -1; draw(); changed(); return; }
    const lo = drag > 0 ? pts[drag - 1][0] + 1 : 0, hi = drag < pts.length - 1 ? pts[drag + 1][0] - 1 : 255;
    pts[drag] = [clamp(x, lo, hi), y]; draw(); changed();
  });
  c.addEventListener('pointerup', () => { drag = -1; });
  const reset = h('button', { type: 'button', class: 'btn' }, 'Reset channel');
  reset.addEventListener('click', () => { curves[ch] = [[0, 0], [255, 255]]; draw(); changed(); });
  const presets = h('select', { 'aria-label': 'Preset' }, [['', 'Preset…'], ['contrast', 'Increase Contrast'], ['film', 'Faded Film'], ['negative', 'Negative'], ['lighter', 'Lighter'], ['darker', 'Darker']].map(([v, l]) => h('option', { value: v }, l)));
  presets.addEventListener('change', () => {
    const P = { contrast: [[0, 0], [64, 48], [192, 208], [255, 255]], film: [[0, 38], [128, 130], [255, 232]], negative: [[0, 255], [255, 0]], lighter: [[0, 0], [128, 160], [255, 255]], darker: [[0, 0], [128, 96], [255, 255]] }[presets.value];
    if (P) { curves.rgb = P.map((p) => p.slice()); ch = 'rgb'; sel.value = 'rgb'; draw(); changed(); }
    presets.value = '';
  });
  draw();
  return h('div', { class: 'fp fp-curvebox' }, h('div', { class: 'dlg-row' }, sel, presets, reset), c, h('p', { class: 'fp-help' }, 'Click to add a point · drag to shape · drag a point off the graph to delete it'));
}

/* ---------- misc dialogs ---------- */
function dlgNumber(title, label, v, min, max, unit, fn) {
  const i = numInput(v, min, max, 0.5);
  dialog({ title, body: field(label, i, unit), buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => fn(clamp(+i.value, min, max)) }] });
}
const PRESETS = [['Slop Shop default', 1600, 1000], ['Instagram post', 1080, 1080], ['Instagram story', 1080, 1920], ['HD 1080p', 1920, 1080], ['4K UHD', 3840, 2160], ['Twitter / X header', 1500, 500], ['A4 @150ppi', 1240, 1754], ['Meme (classic)', 800, 800], ['Icon', 512, 512]];
function dlgNew() {
  const w = numInput(1600, 1, 12000), hh = numInput(1000, 1, 12000);
  const preset = h('select', null, PRESETS.map(([n, a, b], i) => h('option', { value: i }, `${n} — ${a} × ${b}`)), h('option', { value: 'clip' }, 'Clipboard size'));
  preset.addEventListener('change', () => { if (preset.value === 'clip') { if (CLIP.canvas) { w.value = CLIP.canvas.width; hh.value = CLIP.canvas.height; } return; } const p = PRESETS[+preset.value]; w.value = p[1]; hh.value = p[2]; });
  const bg = h('select', null, [['#ffffff', 'White'], ['#000000', 'Black'], ['fg', 'Foreground colour'], ['bg', 'Background colour'], ['transparent', 'Transparent']].map(([v, l]) => h('option', { value: v }, l)));
  const name = h('input', { type: 'text', value: 'Untitled' });
  dialog({ title: 'New Document', body: h('div', { class: 'form' }, field('Name', name), field('Preset', preset), field('Width', w, 'px'), field('Height', hh, 'px'), field('Background', bg)),
    buttons: [{ label: 'Cancel' }, { label: 'Create', primary: true, act: async () => {
      if (D.dirty && !(await confirmDlg('Discard changes?', 'Your current document has unsaved changes. Create a new one anyway?', 'Discard'))) return false;
      const b = bg.value === 'fg' ? C.fg : bg.value === 'bg' ? C.bg : bg.value;
      newDocument(clamp(+w.value || 1, 1, 12000), clamp(+hh.value || 1, 1, 12000), b, name.value || 'Untitled');
      fitView(); scheduleAutosave();
    } }] });
}
function anchorGrid(state) {
  const g = h('div', { class: 'anchor', role: 'group', 'aria-label': 'Anchor' });
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const b = h('button', { type: 'button', class: 'anchor-b' + (state.ax === i && state.ay === j ? ' on' : ''), 'aria-label': `Anchor ${['top', 'middle', 'bottom'][j]} ${['left', 'centre', 'right'][i]}` });
    b.addEventListener('click', () => { state.ax = i; state.ay = j; $$('.anchor-b', g).forEach((x) => x.classList.remove('on')); b.classList.add('on'); });
    g.append(b);
  }
  return g;
}
function dlgCanvasSize() {
  const w = numInput(D.w, 1, 12000), hh = numInput(D.h, 1, 12000), st = { ax: 1, ay: 1 };
  dialog({ title: 'Canvas Size', body: h('div', { class: 'form' }, h('p', { class: 'dlg-p' }, `Current size: ${D.w} × ${D.h} px`), field('Width', w, 'px'), field('Height', hh, 'px'), h('div', { class: 'field' }, h('span', { class: 'field-l' }, 'Anchor'), anchorGrid(st))),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => { const nw = clamp(+w.value || 1, 1, 12000), nh = clamp(+hh.value || 1, 1, 12000); resizeCanvas(nw, nh, Math.round(((nw - D.w) * st.ax) / 2), Math.round(((nh - D.h) * st.ay) / 2)); fitView(); } }] });
}
function dlgImageSize() {
  const w = numInput(D.w, 1, 12000), hh = numInput(D.h, 1, 12000), lock = h('input', { type: 'checkbox', checked: true }), smooth = h('select', null, h('option', { value: '1' }, 'Bicubic (smooth)'), h('option', { value: '0' }, 'Nearest Neighbor (hard edges)'));
  const ratio = D.w / D.h;
  w.addEventListener('input', () => { if (lock.checked) hh.value = Math.max(1, Math.round(+w.value / ratio)); });
  hh.addEventListener('input', () => { if (lock.checked) w.value = Math.max(1, Math.round(+hh.value * ratio)); });
  dialog({ title: 'Image Size', body: h('div', { class: 'form' }, field('Width', w, 'px'), field('Height', hh, 'px'), h('label', { class: 'field opt-check' }, lock, h('span', null, 'Constrain proportions')), field('Resample', smooth)),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => { imageSize(clamp(+w.value || 1, 1, 12000), clamp(+hh.value || 1, 1, 12000), smooth.value === '1'); fitView(); } }] });
}
function dlgLayerProps() {
  const L = activeLayer(); if (!L) return;
  const name = h('input', { type: 'text', value: L.name });
  dialog({ title: 'Layer Properties', body: h('div', { class: 'form' }, field('Name', name)), buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => setLayerProps(L.id, { name: name.value || L.name }, 'Layer Properties') }] });
}
function dlgStroke() {
  const w = numInput(4, 1, 250), pos = h('select', null, h('option', { value: 'center' }, 'Center'), h('option', { value: 'inside' }, 'Inside'), h('option', { value: 'outside' }, 'Outside'));
  dialog({ title: 'Stroke', body: h('div', { class: 'form' }, field('Width', w, 'px'), field('Location', pos), h('p', { class: 'dlg-p' }, 'Uses the foreground colour.')),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => {
      const r = clamp(+w.value, 1, 250), path = selectionPath(D.sel), c = mkCanvas(D.w, D.h), g = cx(c);
      g.strokeStyle = C.fg; g.lineWidth = pos.value === 'center' ? r : r * 2; g.lineJoin = 'round'; g.stroke(path);
      if (pos.value !== 'center') { g.globalCompositeOperation = pos.value === 'inside' ? 'destination-in' : 'destination-out'; g.drawImage(D.sel.mask, 0, 0); }
      fillSelection(c, 'Stroke', 1, 'normal', true);
    } }] });
}
function dlgColorRange() {
  const tol = h('input', { type: 'range', min: 0, max: 200, value: 40 });
  dialog({ title: 'Color Range', body: h('div', { class: 'form' }, h('p', { class: 'dlg-p' }, `Selects pixels close to the foreground colour ${C.fg} across the whole image.`), field('Fuzziness', tol)),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => {
      const src = flattenCanvas(), d = cxr(src).getImageData(0, 0, D.w, D.h).data, [r, g, b] = hexToRgb(C.fg), f = +tol.value;
      const m = mkCanvas(D.w, D.h), mg = cxr(m), img = mg.createImageData(D.w, D.h), o = img.data;
      for (let i = 0; i < d.length; i += 4) { const dist = Math.max(Math.abs(d[i] - r), Math.abs(d[i + 1] - g), Math.abs(d[i + 2] - b)); o[i + 3] = d[i + 3] && dist <= f ? clamp((1 - dist / (f + 1)) * 2, 0, 1) * 255 : 0; }
      mg.putImageData(img, 0, 0); D.sel = makeSel(m); commit('Color Range');
      if (!D.sel) toast('No pixels matched');
    } }] });
}
function dlgShortcuts() {
  const rows = [];
  const walk = (items, path) => { for (const it of items) { if (it === '-' || !it) continue; if (it.sub) walk(it.sub, path + ' › ' + it.label); else if (it.key) rows.push([path + ' › ' + it.label, it.key]); } };
  MENUS.forEach(([n, items]) => walk(items, n));
  const toolRows = TOOLS.map((t) => [t.name, t.key + (TOOLS.filter((x) => x.key === t.key).length > 1 ? ' (Shift+' + t.key + ' cycles)' : '')]);
  const extra = [['Pan', 'Space + drag · middle mouse · two fingers'], ['Zoom', 'Ctrl/⌘ + wheel · pinch'], ['Brush size', '[ and ]'], ['Brush hardness', 'Shift+[ and Shift+]'], ['Tool opacity', '1 … 0'], ['Swap colours', 'X'], ['Default colours', 'D'], ['Nudge layer (Move tool)', 'Arrow keys · Shift = 10px'], ['Commit / cancel (Transform, Crop, Type)', 'Enter / Esc']];
  const table = (list) => h('table', { class: 'keys' }, list.map(([a, b]) => h('tr', null, h('td', null, a), h('td', null, h('kbd', null, keyLabel(b))))));
  dialog({ title: 'Keyboard Shortcuts', cls: 'dlg-wide', body: h('div', { class: 'keys-wrap' }, h('div', null, h('h4', null, 'Tools'), table(toolRows), h('h4', null, 'Canvas'), table(extra)), h('div', null, h('h4', null, 'Menus'), table(rows))), buttons: [{ label: 'Close', primary: true }] });
}
function dlgAbout() {
  dialog({ title: 'About Slop Shop', body: h('div', { class: 'about' },
    h('p', { class: 'about-logo' }, 'Slop Shop'),
    h('p', null, 'A layered image editor that runs entirely in your browser. Nothing you open, paint or save ever leaves your device: there is no server, no account and no upload.'),
    h('p', null, 'Opens and saves real Photoshop .psd files (layers, masks, opacity and blend modes), exports PNG, JPEG and WebP, and can be downloaded as a single offline .html file.'),
    h('p', { class: 'dlg-p' }, 'Part of ', h('a', { href: '../' }, 'slopographic.com'), '. Prefer the 1998 experience? ', h('a', { href: 'classic/' }, 'Slop Paint Classic'), '.')),
  buttons: [{ label: 'Close', primary: true }] });
}

/* ---------- themes ---------- */
const theme = () => document.documentElement.dataset.theme || 'pro';
function setTheme(t) { document.documentElement.dataset.theme = t; store.set('theme', t); const m = $('meta[name=theme-color]'); if (m) m.content = t === 'paint' ? '#008080' : t === 'light' ? '#e8e8e8' : '#1d1d1d'; dirty(); emit('theme'); }

/* ---------- keyboard ---------- */
const TOOL_KEYS = {};
for (const t of TOOLS) (TOOL_KEYS[t.key] = TOOL_KEYS[t.key] || []).push(t.id);
function onKeyDown(e) {
  if (openDialogs || isTyping(e.target)) return;
  if (e.code === 'Space' && !e.repeat) { V.space = true; V.el.classList.add('space'); e.preventDefault(); return; }
  const combo = comboOf(e);
  const t = currentTool();
  if (t.onKey && t.onKey(e)) { e.preventDefault(); dirty(); return; }
  if (openMenu && e.key === 'Escape') { closeMenus(); return; }
  if (e.key === 'Escape' && D.sel && !(TE.el)) { /* Photoshop keeps the selection on Esc */ }
  const item = SHORTCUTS.get(combo) || (combo === 'Ctrl+Y' ? SHORTCUTS.get('Shift+Ctrl+Z') : null) || (combo === 'Alt+Ctrl+Z' ? SHORTCUTS.get('Ctrl+Z') : null) || (combo === 'Backspace' ? SHORTCUTS.get('Delete') : null) || (combo === 'Ctrl+Shift+=' || combo === 'Shift+Ctrl+=' ? SHORTCUTS.get('Ctrl+=') : null);
  if (item) {
    if (combo === 'Ctrl+V' || combo === 'Shift+Ctrl+V') return; // handled by the paste event so system images work
    if (combo === 'Ctrl+C' || combo === 'Ctrl+X') { e.preventDefault(); item.act(); return; }
    if (!menuEnabled(item)) { e.preventDefault(); return; }
    e.preventDefault(); closeMenus(); item.act(); return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = combo.replace('Shift+', '');
  if (TOOL_KEYS[k] && !e.repeat) {
    const ids = TOOL_KEYS[k];
    if (e.shiftKey && ids.includes(UI.tool)) selectTool(ids[(ids.indexOf(UI.tool) + 1) % ids.length]);
    else selectTool(ids.includes(store.get('lastOf.' + k)) ? store.get('lastOf.' + k) : ids[0]);
    e.preventDefault(); return;
  }
  const o = { brush: T.brush, pencil: T.pencil, eraser: T.eraser, clone: T.clone, smudge: T.smudge, dodge: T.dodge }[UI.tool];
  if (o && (e.code === 'BracketLeft' || e.code === 'BracketRight')) {
    const up = e.code === 'BracketRight';
    if (e.shiftKey && o.hardness != null) o.hardness = clamp(Math.round((o.hardness + (up ? 0.25 : -0.25)) * 4) / 4, 0, 1);
    else { const s = o.size, step = s < 10 ? 1 : s < 50 ? 5 : s < 100 ? 10 : s < 300 ? 25 : 50; o.size = clamp(s + (up ? step : -step), 1, 1000); }
    saveToolOptions(); buildOptions(); dirty(); e.preventDefault(); return;
  }
  if (/^Digit\d$/.test(e.code) && o && o.opacity != null) { const n = +e.code.slice(5); o.opacity = n === 0 ? 1 : n / 10; saveToolOptions(); buildOptions(); toast(`Opacity ${Math.round(o.opacity * 100)}%`, 900); return; }
  if (combo === 'X') { swapColors(); return; }
  if (combo === 'D') { defaultColors(); return; }
  if (UI.tool === 'move' && e.key.startsWith('Arrow')) {
    const n = e.shiftKey ? 10 : 1, dx = e.key === 'ArrowLeft' ? -n : e.key === 'ArrowRight' ? n : 0, dy = e.key === 'ArrowUp' ? -n : e.key === 'ArrowDown' ? n : 0;
    nudge(dx, dy); e.preventDefault();
  }
}
function onKeyUp(e) { if (e.code === 'Space') { V.space = false; V.el.classList.remove('space'); } }
listeners.add((w) => { if (w === 'tool') { const t = TOOL[UI.tool]; if (t) store.set('lastOf.' + t.key, t.id); buildOptions(); V.el.style.cursor = ''; } });
