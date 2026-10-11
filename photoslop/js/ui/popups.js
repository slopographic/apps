/* PhotoSLOP UI: brush picker, context menus and system paste */
'use strict';

/* ---------- right-click: brush picker & context menus ---------- */
const BRUSH_OPTS = () => ({ brush: T.brush, pencil: T.pencil, eraser: T.eraser, clone: T.clone, smudge: T.smudge, dodge: T.dodge, blur: T.blur, sharpen: T.sharpen, sponge: T.sponge });
let popover = null;
function closePopover() { if (popover) { popover.remove(); popover = null; } }
function openBrushPicker(x, y, toolId = UI.tool) {
  closeMenus(); closePopover();
  const o = BRUSH_OPTS()[toolId]; if (!o) return;
  const t = TOOL[toolId];
  const el = h('div', { class: 'brush-pop', role: 'dialog', 'aria-label': 'Brush picker' });
  const row = (label, key, min, max, toV = (v) => v, fromV = (v) => v, unit = 'px') => {
    const r = h('input', { type: 'range', min, max, value: Math.round(fromV(o[key])), 'aria-label': label });
    const n = h('input', { type: 'number', min, max, value: Math.round(fromV(o[key])), class: 'opt-num', 'aria-label': label });
    const set = (v) => { v = clamp(+v, min, max); o[key] = toV(v); r.value = v; if (document.activeElement !== n) n.value = v; saveToolOptions(); buildOptions(); dirty(); };
    r.addEventListener('input', () => set(r.value)); n.addEventListener('change', () => set(n.value));
    return h('label', { class: 'bp-row' }, h('span', null, label), r, n, h('span', { class: 'opt-u' }, unit));
  };
  el.append(h('div', { class: 'bp-head' }, h('b', null, t.name.replace(' Tool', '')), h('span', null, 'Right-click on the canvas any time')));
  el.append(row('Size', 'size', 1, toolId === 'pencil' ? 200 : 1000));
  if (o.hardness != null) el.append(row('Hardness', 'hardness', 0, 100, (v) => v / 100, (v) => v * 100, '%'));
  if (o.opacity != null) el.append(row('Opacity', 'opacity', 1, 100, (v) => v / 100, (v) => v * 100, '%'));
  if (o.tip != null) {
    for (const pack of allPacks()) {
      if (!pack.brushes.length) continue;
      const grid = h('div', { class: 'bp-grid' });
      for (const p of pack.brushes) {
        const b = h('button', { type: 'button', class: 'bp-preset' + (o.preset === p.name ? ' on' : ''), title: `${p.name} · ${p.size}px`, 'aria-label': p.name }, presetPreview(p), h('span', null, p.name), h('em', null, p.size));
        b.addEventListener('click', () => { applyPreset(p); closePopover(); toast(`${p.name} brush`, 900); });
        grid.append(b);
      }
      el.append(h('div', { class: 'bp-sub' }, pack.name), grid);
    }
    el.append(h('div', { class: 'bp-sub bp-tip' }, 'Tip: hold Shift and drag on the canvas: left/right = size, up/down = hardness (+Alt: opacity)'));
  }
  document.body.append(el);
  const r = el.getBoundingClientRect();
  el.style.left = clamp(x, 4, innerWidth - r.width - 4) + 'px';
  el.style.top = clamp(y, 4, innerHeight - r.height - 4) + 'px';
  popover = el;
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); closePopover(); } });
  setTimeout(() => { const f = el.querySelector('input[type=range]'); if (f) f.focus(); }, 0);
}
document.addEventListener('pointerdown', (e) => { if (popover && !e.target.closest('.brush-pop')) closePopover(); }, true);
function showContextMenu(items, x, y) { closeMenus(); closePopover(); const m = renderMenu(items, x, y, 0); openMenu = { btn: null, m }; const f = m.querySelector('.menu-row:not([disabled])'); if (f) f.focus({ preventScroll: true }); }
function openCanvasContext(e) {
  const id = TRANSFORM.active ? 'transform' : UI.tool, x = e.clientX, y = e.clientY;
  if (BRUSH_OPTS()[id]) { openBrushPicker(x, y, id); return; }
  if (id === 'transform') { showContextMenu([{ label: 'Commit Transform', key: 'Enter', act: commitTransform }, { label: 'Cancel Transform', key: 'Escape', act: cancelTransform }, '-', { label: 'Flip Horizontal', act: () => { TRANSFORM.sx *= -1; dirty(true); } }, { label: 'Flip Vertical', act: () => { TRANSFORM.sy *= -1; dirty(true); } }, { label: 'Rotate 90° Clockwise', act: () => { TRANSFORM.rot += Math.PI / 2; dirty(true); } }, { label: 'Rotate 90° Counter Clockwise', act: () => { TRANSFORM.rot -= Math.PI / 2; dirty(true); } }, { label: 'Reset', act: () => { Object.assign(TRANSFORM, { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 }); dirty(true); } }], x, y); return; }
  const p = toDoc(e);
  const items = [];
  if (id === 'move') {
    const hits = D.layers.filter((L) => { if (!L.visible) return false; const lx = Math.floor(p.x - L.x), ly = Math.floor(p.y - L.y); return lx >= 0 && ly >= 0 && lx < L.canvas.width && ly < L.canvas.height && cxr(L.canvas).getImageData(lx, ly, 1, 1).data[3] > 10; }).reverse();
    if (hits.length) { for (const L of hits) items.push({ label: L.name, check: () => L.id === D.activeId, act: () => { D.activeId = L.id; UI.editMask = false; emit('doc'); } }); items.push('-'); }
  }
  if (D.sel) items.push(
    { label: 'Deselect', key: 'Ctrl+D', act: deselect }, { label: 'Select Inverse', key: 'Shift+Ctrl+I', act: selectInverse },
    { label: 'Feather…', key: 'Shift+F6', act: () => dlgNumber('Feather Selection', 'Feather radius', 8, 0.5, 250, 'px', (v) => featherSel(v)) }, '-',
    { label: 'Layer via Copy', key: 'Ctrl+J', act: () => layerViaCopy(false) }, { label: 'Layer via Cut', key: 'Shift+Ctrl+J', act: () => layerViaCopy(true) }, '-',
    { label: 'Fill with Foreground', key: 'Alt+Backspace', act: () => fillSelection(C.fg, 'Fill') }, { label: 'Stroke…', act: dlgStroke }, { label: 'Clear', key: 'Delete', act: () => clearSelectionPixels() }, '-');
  else if (['marquee', 'ellipse', 'lasso', 'polylasso', 'wand'].includes(id)) items.push({ label: 'Select All', key: 'Ctrl+A', act: selectAll }, { label: 'Select Layer Pixels', act: () => { const L = activeLayer(); const c = mkCanvas(D.w, D.h); cx(c).drawImage(bakedLayer(L).canvas, L.x, L.y); D.sel = makeSel(c); commit('Load Selection'); } }, '-');
  items.push(
    { label: 'Free Transform', key: 'Ctrl+T', act: startTransform, need: 'layer' },
    { label: 'Undo', key: 'Ctrl+Z', act: undo, en: () => Hist.idx > 0, dyn: () => (Hist.idx > 0 ? 'Undo ' + Hist.states[Hist.idx].label : 'Undo') },
    '-',
    { label: 'Copy', key: 'Ctrl+C', act: () => copySel(false) }, { label: 'Copy Merged', key: 'Shift+Ctrl+C', act: () => copySel(true) },
    { label: 'Paste', key: 'Ctrl+V', act: () => pasteFromSystem(false) },
    '-',
    { label: 'New Layer', key: 'Shift+Ctrl+N', act: () => addLayer() }, { label: 'Duplicate Layer', act: () => duplicateLayer() });
  showContextMenu(items, x, y);
}
function layerContextMenu(e, L) {
  e.preventDefault();
  if (D.activeId !== L.id) { D.activeId = L.id; UI.editMask = false; emit('doc'); }
  showContextMenu([
    { label: 'Layer Properties…', act: dlgLayerProps },
    { label: 'Duplicate Layer', act: () => duplicateLayer() }, { label: 'Delete Layer', act: () => deleteLayer() },
    '-',
    { label: 'Select Pixels', act: () => { const c = mkCanvas(D.w, D.h); cx(c).drawImage(bakedLayer(L).canvas, L.x, L.y); D.sel = makeSel(c); commit('Load Selection'); } },
    L.mask ? { label: 'Delete Layer Mask', act: () => { UI.editMask = false; setLayerProps(L.id, { mask: null }, 'Delete Mask'); } } : { label: 'Add Layer Mask', act: () => addMask(D.sel ? 'sel' : 'reveal') },
    L.mask ? { label: 'Apply Layer Mask', act: applyMask } : null,
    L.text ? { label: 'Rasterize Type', act: () => rasterizeText(L) } : null,
    { label: 'Layer Style', sub: filterMenu('style') },
    '-',
    { label: L.locked ? 'Unlock Layer' : 'Lock Layer', act: () => setLayerProps(L.id, { locked: !L.locked }, L.locked ? 'Unlock Layer' : 'Lock Layer') },
    { label: L.visible ? 'Hide Layer' : 'Show Layer', act: () => setLayerProps(L.id, { visible: !L.visible }, L.visible ? 'Hide Layer' : 'Show Layer') },
    '-',
    { label: 'Merge Down', key: 'Ctrl+E', act: mergeDown }, { label: 'Merge Visible', key: 'Shift+Ctrl+E', act: mergeVisible }, { label: 'Flatten Image', act: flattenImage },
  ].filter(Boolean), e.clientX, e.clientY);
}

/* ---------- pasting from the system clipboard ---------- */
let catcher = null;
function armPasteCatcher() {
  // Some browsers only fire 'paste' at an editable element: give them one for this keystroke.
  if (!catcher) { catcher = h('textarea', { class: 'paste-catcher', 'aria-hidden': 'true', tabindex: '-1' }); document.body.append(catcher); }
  catcher.value = ''; catcher.focus({ preventScroll: true });
  setTimeout(() => { if (document.activeElement === catcher) catcher.blur(); }, 400);
}
async function clipboardImage() {
  if (!navigator.clipboard || !navigator.clipboard.read) return null;
  const items = await navigator.clipboard.read();
  for (const it of items) { const type = it.types.find((t) => t.startsWith('image/')); if (type) return it.getType(type); }
  return null;
}
async function pasteFromSystem(inPlace) {
  try {
    const blob = await clipboardImage();
    if (blob) {
      const c = await fileToCanvas(blob);
      if (CLIP.canvas && c.width === CLIP.canvas.width && c.height === CLIP.canvas.height) { pasteInternal(inPlace); return; }
      pasteCanvas(c, null, null, 'Pasted Image'); return;
    }
  } catch (e) { /* permission denied or unsupported: fall back to the internal clipboard */ }
  if (CLIP.canvas) pasteInternal(inPlace);
  else toast(`Copy an image anywhere, then press ${MOD}V here to paste it`);
}
async function newFromClipboard() {
  let c = null;
  try { const blob = await clipboardImage(); if (blob) c = await fileToCanvas(blob); } catch (e) { /* fall through */ }
  if (!c && CLIP.canvas) c = copyCanvas(CLIP.canvas);
  if (!c) { toast('The clipboard has no image'); return; }
  openDocTab(c.width, c.height, [{ name: 'Background', canvas: c }], 'Pasted image');
}

function brushPickerButton() {
  const o = BRUSH_OPTS()[UI.tool];
  const b = h('button', { type: 'button', class: 'bp-btn', title: 'Brush picker (or right-click the canvas)', 'aria-label': 'Open brush picker' },
    dabCanvas(clamp(o.size, 4, 22), o.hardness != null ? o.hardness : 1, theme() === 'pro' ? '#e8e8e8' : '#111111', o.tip || 'round', 0), h('span', null, o.size), h('i', null, '▾'));
  b.addEventListener('click', () => { const r = b.getBoundingClientRect(); openBrushPicker(r.left, r.bottom + 4); });
  return b;
}
