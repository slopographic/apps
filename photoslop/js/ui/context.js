/* PhotoSlop UI: right-click and keyboard (Menu key, Shift+F10) context menus.
 * A target element is marked with ctxTarget(el, kind, build): data-ctx="<kind>" names what it is
 * (canvas, layer, text, swatch, panel, tab, brush) and build(pos) returns its menu items, or null when
 * nothing applies (then no menu opens). Items reuse the menu bar's own items (MENUS, via M()), so the
 * action, enabled state and SlopCmd shortcut match the menus and the command palette. Rendered with SlopUI.menu. */
'use strict';

/** The menu-bar item for a group and label (or null). Context menus reuse it, so nothing is duplicated. */
function M(group, label, over) {
  const entry = MENUS.find(([n]) => n === group);
  const items = entry && (typeof entry[1] === 'function' ? entry[1]() : entry[1]);
  const it = items && items.find((x) => x && x.label === label);
  if (!it) { console.error('context menu: no menu item ' + group + ' › ' + label); return null; }
  return over ? Object.assign({}, it, over) : it;
}
/** Menu-bar items → SlopUI.menu rows: disabled state, dynamic labels and SlopCmd shortcuts. */
function suiItems(items) {
  const rows = items.filter(Boolean).map((it) => {
    if (it === '-') return '-';
    if (it.sub) return { label: it.label, sub: suiItems(it.sub), disabled: !menuEnabled(it) };
    return { label: it.dyn ? it.dyn() : it.label, key: menuKey(it), disabled: !menuEnabled(it), check: !!(it.check && it.check()), act: it.act };
  });
  // no separator at either end or doubled up
  return rows.filter((r, i) => r !== '-' || (i > 0 && rows[i - 1] !== '-' && i < rows.length - 1));
}
function showContextMenu(items, x, y) {
  const rows = suiItems(items);
  if (rows.some((r) => r && r !== '-')) SlopUI.menu(rows, x, y);
}
/** Marks an element as a context-menu target. */
function ctxTarget(el, kind, build) { el.dataset.ctx = kind; el.ctxBuild = build; return el; }
function openContextMenu(host, x, y) {
  const items = host.ctxBuild({ x, y });
  if (items) showContextMenu(items, x, y);
}

/* ---------- right-click ---------- */
document.addEventListener('contextmenu', (e) => {
  const host = e.target.closest && e.target.closest('[data-ctx]');
  if (!host || isTyping(e.target)) return;
  e.preventDefault();
  if (!SlopUI.openDialogs) openContextMenu(host, e.clientX, e.clientY);
});
/* ---------- keyboard: the Menu key or Shift+F10 opens the menu of the focused target ---------- */
document.addEventListener('keydown', (e) => {
  if (!(e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) || e.defaultPrevented) return;
  if (SlopUI.openDialogs || isTyping(e.target) || (e.target.closest && e.target.closest('.sui-menu'))) return;
  const el = document.activeElement;
  const host = el && el.closest && el.closest('[data-ctx]');
  const onCanvas = !host && (!el || el === document.body);
  const target = host || (onCanvas ? V.el : null);
  if (!target) return;
  const r = target.getBoundingClientRect();
  e.preventDefault();
  if (onCanvas) openContextMenu(target, r.left + r.width / 2, r.top + r.height / 2);
  else openContextMenu(target, r.left + 8, r.bottom);
});

/* ---------- canvas ---------- */
function canvasItems({ x, y }) {
  const id = TRANSFORM.active ? 'transform' : UI.tool;
  if (BRUSH_OPTS()[id]) { openBrushPicker(x, y, id); return null; }
  if (id === 'redeye') return [{ label: 'Red-Eye Removal…', act: () => runFilter('redeye') }, '-', M('Edit', 'Undo')];
  if (id === 'transform') return [
    { label: 'Commit Transform', key: 'Enter', act: commitTransform }, { label: 'Cancel Transform', key: 'Escape', act: cancelTransform }, '-',
    { label: 'Flip Horizontal', act: () => { TRANSFORM.sx *= -1; dirty(true); } }, { label: 'Flip Vertical', act: () => { TRANSFORM.sy *= -1; dirty(true); } },
    { label: 'Rotate 90° Clockwise', act: () => { TRANSFORM.rot += Math.PI / 2; dirty(true); } }, { label: 'Rotate 90° Counter Clockwise', act: () => { TRANSFORM.rot -= Math.PI / 2; dirty(true); } },
    { label: 'Reset', act: () => { Object.assign(TRANSFORM, { tx: 0, ty: 0, sx: 1, sy: 1, rot: 0 }); dirty(true); } }];
  const p = toDoc({ clientX: x, clientY: y });
  const items = [];
  if (id === 'move') {
    const hits = D.layers.filter((L) => { if (!L.visible) return false; const lx = Math.floor(p.x - L.x), ly = Math.floor(p.y - L.y); return lx >= 0 && ly >= 0 && lx < L.canvas.width && ly < L.canvas.height && cxr(L.canvas).getImageData(lx, ly, 1, 1).data[3] > 10; }).reverse();
    if (hits.length) { for (const L of hits) items.push({ label: L.name, check: () => L.id === D.activeId, act: () => { D.activeId = L.id; UI.editMask = false; emit('doc'); } }); items.push('-'); }
  }
  if (D.sel) items.push(M('Select', 'Deselect'), M('Select', 'Inverse'), M('Select', 'Feather…'), '-',
    M('Layer', 'Layer via Copy'), M('Layer', 'Layer via Cut'), { label: 'Isolate Subject…', act: () => isolateSubject() }, '-',
    M('Edit', 'Fill with Foreground'), M('Edit', 'Stroke Selection…'), M('Edit', 'Clear'), '-');
  else if (['marquee', 'ellipse', 'lasso', 'polylasso', 'wand'].includes(id)) items.push(M('Select', 'All'), { label: 'Select Layer Pixels', act: () => selectLayerPixels(activeLayer()) }, '-');
  items.push(M('Edit', 'Free Transform'), M('Edit', 'Undo'), '-', M('Edit', 'Copy'), M('Edit', 'Copy Merged'));
  // Paste only when this app has a clipboard image (system images still paste with Ctrl+V)
  if (CLIP.canvas) items.push(M('Edit', 'Paste'));
  items.push('-', M('Layer', 'New Layer'), M('Layer', 'Duplicate Layer'));
  return items;
}
/** Load a layer's pixels as the selection (the menu's Select Pixels). */
function selectLayerPixels(L) { const c = mkCanvas(D.w, D.h); cx(c).drawImage(bakedLayer(L).canvas, L.x, L.y); D.sel = makeSel(c); commit('Load Selection'); }

/* ---------- layers and text ---------- */
function activateLayer(L) { if (D.activeId !== L.id) { D.activeId = L.id; UI.editMask = false; emit('doc'); } }
function layerItems(L) {
  activateLayer(L);
  return [M('Edit', 'Free Transform'), '-', M('Layer', 'Layer Properties…'), M('Layer', 'Duplicate Layer'), M('Layer', 'Delete Layer'), { label: 'Isolate Subject…', act: () => isolateSubject(L.id) }, '-',
    { label: 'Select Pixels', act: () => selectLayerPixels(L) }, (hasMask() ? M('Layer', 'Mask') : { label: 'Add layer mask', sub: maskAddItems() }), M('Layer', 'Layer Style'), { label: 'Apply Effect Preset…', act: () => fxPresetPick(L.id) }, { label: 'Save Effects as Preset…', act: () => fxPresetSaveDialog(L.id), en: () => !!(L.fx && L.fx.length) },{ label: L.clip ? 'Release Clipping Mask' : 'Create Clipping Mask', act: () => setClipping(L.id, !L.clip) }, '-',
    M('Layer', 'Rotate and Flip'), '-',
    M('Layer', 'Lock / Unlock Layer'), { label: L.visible ? 'Hide Layer' : 'Show Layer', act: () => setLayerProps(L.id, { visible: !L.visible }, L.visible ? 'Hide Layer' : 'Show Layer') }, '-',
    M('Layer', 'Merge Down'), M('Layer', 'Merge Visible'), M('Layer', 'Flatten Image')];
}
function textItems(L) { activateLayer(L); return [M('Layer', 'Edit Text'), M('Layer', 'Warp Text…'), M('Layer', 'Rasterize Type'), '-'].concat(layerItems(L)); }

/* ---------- swatches, panels, document tabs ---------- */
function swatchItems(c, custom) {
  return [{ label: 'Edit Colour…', act: () => { setColor('fg', c); editSwatch('fg'); } },
    { label: 'Set as Foreground', act: () => setColor('fg', c) }, { label: 'Set as Background', act: () => setColor('bg', c) },
    custom ? '-' : null, custom ? { label: 'Remove Swatch', act: () => removeSwatch(c) } : null];
}
function panelItems(p) {
  const all = $$('#panels .panel');
  return [{ label: p.classList.contains('collapsed') ? 'Expand Panel' : 'Collapse Panel', act: () => setPanelCollapsed(p, !p.classList.contains('collapsed')) }, '-',
    { label: 'Collapse All Panels', act: () => all.forEach((q) => setPanelCollapsed(q, true)) },
    { label: 'Expand All Panels', act: () => all.forEach((q) => setPanelCollapsed(q, false)) }];
}
function tabItems(rec) {
  return [M('File', 'Close', { act: () => closeDoc(rec) }), { label: 'Close Others', act: async () => { for (const r of DOCS.filter((d) => d !== rec)) await closeDoc(r); }, en: () => DOCS.length > 1 },
  ].filter(Boolean);
}
