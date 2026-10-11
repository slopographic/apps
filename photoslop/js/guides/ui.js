/* PhotoSlop guides: View-menu items, New Guide / Grid Settings dialogs and the shared GuideGuide-style panel. */
'use strict';

function guidesMenuItems() {
  return [
    { label: 'Rulers', key: 'Ctrl+R', check: () => GUIDE_PREFS.rulers, act: () => togglePref('rulers', true) },
    { label: 'Grid', key: "Ctrl+'", check: () => GUIDE_PREFS.grid, act: () => togglePref('grid', false) },
    { label: 'Grid Settings…', act: () => dlgGridSettings() },
    '-',
    { label: 'Show Guides', key: 'Ctrl+;', check: () => GUIDE_PREFS.show, act: () => togglePref('guides', true) },
    { label: 'Lock Guides', key: 'Alt+Ctrl+;', check: () => GUIDE_PREFS.lock, act: () => togglePref('lockGuides', false, 'Lock guides') },
    { label: 'Clear Guides', act: () => clearGuides(), en: () => !!(D.guides && D.guides.length) },
    { label: 'New Guide…', act: () => dlgNewGuide(-1) },
    { label: 'New Guide Layout…', key: 'Alt+Shift+Ctrl+;', act: () => openGuidesPanel() },
    { label: 'New Guides from Shape', act: () => guidesFromBounds(), en: () => !!(D.sel || activeLayer()) },
    '-',
    { label: 'Snap', key: 'Shift+Ctrl+;', check: () => GUIDE_PREFS.snap, act: () => togglePref('snap', true, 'Snap') },
    { label: 'Snap To', sub: [
      { label: 'Guides', check: () => GUIDE_PREFS.snapTo('guides'), act: () => togglePref('snapTo.guides', true) },
      { label: 'Grid', check: () => GUIDE_PREFS.snapTo('grid'), act: () => togglePref('snapTo.grid', true) },
      { label: 'Document Bounds & Centre', check: () => GUIDE_PREFS.snapTo('bounds'), act: () => togglePref('snapTo.bounds', true) },
    ] },
  ];
}
/** Guides on the edges and centre of the selection (or the active layer's pixels). */
function guidesFromBounds() {
  const b = D.sel ? D.sel.bounds : activeLayer() && layerBoundsDoc(activeLayer());
  if (!b) { toast('Nothing to take bounds from'); return; }
  applyGuides([{ o: 'v', pos: b.x }, { o: 'v', pos: b.x + b.w / 2 }, { o: 'v', pos: b.x + b.w }, { o: 'h', pos: b.y }, { o: 'h', pos: b.y + b.h / 2 }, { o: 'h', pos: b.y + b.h }], 'add');
}

/** New Guide… (idx < 0) or edit the position of guide idx. Positions accept units: 50%, 2in, 10mm. */
function dlgNewGuide(idx) {
  const g = idx >= 0 ? D.guides[idx] : null;
  const o = SlopUI.select([['v', 'Vertical'], ['h', 'Horizontal']], g ? g.o : store.get('lastGuideO', 'v'));
  const pos = h('input', { type: 'text', class: 'sui-input', value: g ? fmtPos(g.pos) : '50%', spellcheck: 'false', 'aria-label': 'Position' });
  const hint = h('p', { class: 'dlg-p' }, 'Position from the top-left corner. Units: px, %, mm, in, pt (72 ppi).');
  dialog({ title: g ? 'Edit Guide' : 'New Guide', body: h('div', { class: 'form' }, field('Orientation', o), field('Position', pos), hint),
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true, act: () => {
      const len = SlopGuides.parseLen(pos.value, 'px');
      if (!len) { toast('Type a position like 120, 50% or 2in'); return false; }
      const v = SlopGuides.toPx(len, { ref: o.value === 'v' ? D.w : D.h });
      store.set('lastGuideO', o.value);
      if (g) { const l = D.guides.slice(); l[idx] = { o: o.value, pos: v }; setGuides(l, 'Move Guide'); }
      else addGuide(o.value, v);
    } }] });
}
function dlgGridSettings() {
  const size = numInput(GUIDE_PREFS.gridSize, 1, 10000), sub = numInput(GUIDE_PREFS.gridSub, 1, 20);
  const color = h('input', { type: 'color', value: GUIDE_PREFS.gridColor, 'aria-label': 'Grid colour' });
  const gcolor = h('input', { type: 'color', value: GUIDE_PREFS.color, 'aria-label': 'Guide colour' });
  const show = h('input', { type: 'checkbox', checked: GUIDE_PREFS.grid });
  const before = { grid: GUIDE_PREFS.grid, gridSize: GUIDE_PREFS.gridSize, gridSub: GUIDE_PREFS.gridSub, gridColor: GUIDE_PREFS.gridColor, guideColor: GUIDE_PREFS.color };
  const live = () => { store.set('grid', show.checked); store.set('gridSize', clamp(+size.value || 50, 1, 10000)); store.set('gridSub', clamp(Math.round(+sub.value) || 1, 1, 20)); store.set('gridColor', color.value); store.set('guideColor', gcolor.value); dirty(); };
  [size, sub, color, gcolor, show].forEach((i) => i.addEventListener('input', live));
  dialog({ title: 'Grid & Guides', body: h('div', { class: 'form' },
    h('label', { class: 'field opt-check' }, show, h('span', null, 'Show grid')),
    field('Gridline every', size, 'px'), field('Subdivisions', sub), field('Grid colour', color), field('Guide colour', gcolor)),
  buttons: [{ label: 'Cancel', act: () => { for (const k in before) store.set(k, before[k]); dirty(); } }, { label: 'OK', primary: true }] });
}

/* ---------- the shared GuideGuide-style panel ---------- */
function openGuidesPanel() {
  if (typeof SlopGuides === 'undefined' || !SlopGuides.openPanel) { toast('Guide layouts are unavailable'); return null; }
  if (SlopGuides.panel) { SlopGuides.panel.close(); return null; }
  return SlopGuides.openPanel({
    title: 'Guide Layout', stateKey: 'slopshop.guidePanel',
    targets: [
      { id: 'canvas', label: 'Canvas', rect: () => ({ x: 0, y: 0, w: D.w, h: D.h }) },
      { id: 'selection', label: 'Selection', rect: () => (D.sel ? Object.assign({}, D.sel.bounds) : null) },
      { id: 'layer', label: 'Layer bounds', rect: () => { const L = activeLayer(); return L ? layerBoundsDoc(L) : null; } },
    ],
    preview: (gs) => { V.guidePreview = gs; dirty(); },
    apply: (gs, o) => applyGuides(gs, o.mode),
    clear: () => clearGuides(),
    toast: (m) => toast(m),
  });
}
