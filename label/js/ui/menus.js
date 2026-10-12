/* SlopLabel — ui/menus: the menu bar (File, Edit, Insert, Object, Data, View, Help) on SlopUI menus. */
'use strict';

/** Add an object centred on the label (menu inserts). */
function insertCentered(type, props = {}) {
  const L = App.doc.label, o = makeObject(type, Object.assign(styleProps(App.doc, type), props));
  syncAutoSize(App.doc, o, previewGet());
  o.x = round(Math.max(0, (L.w - o.w) / 2), 2); o.y = round(Math.max(0, (L.h - o.h) / 2), 2);
  addObject(o);
  if (type === 'text' || type === 'para' || type === 'barcode') focusContent();
}
function menuFile() {
  const hub = hubAvailable(), send = sendToItems();
  return [
    { label: 'New…', act: templatesDialog }, { label: 'New tab', act: newBlankTab }, { label: 'Close tab', act: closeCurrentTab },
    { label: 'Open…', key: K('open'), act: openFilesDialog }, { label: 'Import ZPL…', act: importZPLDialog },
    { label: 'Config', sub: window.SlopConfigDialog ? SlopConfigDialog.menuItems({ app: 'label' }) : [] },
    { label: 'Save', key: K('save'), act: saveProject }, { label: 'Download project (.sloplabel)', act: downloadProject }, '-',
    hub ? { label: 'Open project from Slop Drive…', act: openProjectDrive } : null,
    hub ? { label: 'Insert image from Slop Drive…', act: imageFromDrive } : null, hub ? { label: 'Data from Slop Drive…', act: dataFromDrive } : null, hub ? '-' : null,
    { label: 'Print…', key: K('print'), act: openPrintDialog },
    { label: 'Export', sub: [{ label: 'PDF', act: exportPDFQuick }, { label: 'PNG (current label)', act: exportPNG }, { label: 'SVG (current label)', act: exportSVG }, { label: 'ZPL (Zebra)', act: exportZPLQuick }, '-', { label: 'More formats and options…', act: openPrintDialog }] },
    send.length ? { label: 'Send to', sub: send } : null,
    { label: 'Share print form link…', act: shareFormLink }, '-',
    { label: 'Presets…', act: presetsDialog }, { label: 'Save as config…', act: saveConfigDialog }, { label: 'Configs…', act: configsDialog }, '-',
    { label: 'Label setup…', act: () => labelSetupDialog() },
    { label: 'Download app (offline .html)', act: async () => { try { const n = await downloadOfflineApp(); SlopUI.toast(`Saved sloplabel.html (${Math.round(n / 1024)} KB)`); } catch (e) { SlopUI.alert('Could not build the offline app', e.message); } } },
  ];
}
function menuEdit() {
  const has = App.sel.length > 0;
  return [
    { label: App.hist.canUndo ? 'Undo ' + App.hist.undoLabel : 'Undo', key: K('undo'), disabled: !App.hist.canUndo, act: undo },
    { label: App.hist.canRedo ? 'Redo ' + App.hist.redoLabel : 'Redo', key: K('redo'), disabled: !App.hist.canRedo, act: redo }, '-',
    { label: 'Cut', key: K('cut'), disabled: !has, act: cutSel }, { label: 'Copy', key: K('copy'), disabled: !has, act: copySel }, { label: 'Paste', key: 'Ctrl+V', act: () => pasteClip() || SlopUI.toast('Nothing to paste') },
    { label: 'Duplicate', key: K('duplicate'), disabled: !has, act: () => duplicateSel() }, { label: 'Delete', key: K('delete'), disabled: !has, act: deleteSel }, '-',
    { label: 'Select all', key: K('selectAll'), act: selectAll }, { label: 'Deselect', key: K('deselect'), disabled: !has, act: deselect },
  ];
}
function menuInsert() {
  return [
    { label: 'Text', key: K('tool.text'), act: () => insertCentered('text') }, { label: 'Paragraph', key: K('tool.para'), act: () => insertCentered('para') },
    { label: 'Barcode (Code 128)', key: K('tool.barcode'), act: () => insertCentered('barcode', defaultsFor('barcode')) },
    { label: 'EAN-13', act: () => insertCentered('barcode', { symbology: 'ean13', content: '590123412345', module: 0.33, hr: 'below', name: 'EAN-13' }) },
    { label: 'GS1-128', act: () => insertCentered('barcode', { symbology: 'gs1-128', content: '(01)09501101530003(10)LOT42', module: 0.33, name: 'GS1-128' }) },
    { label: 'QR code', key: K('tool.qr'), act: () => insertCentered('barcode', defaultsFor('qr')) },
    { label: 'Data Matrix', act: () => insertCentered('barcode', { symbology: 'datamatrix', content: 'SLOP-12345', module: 0.5, hr: 'none', name: 'Data Matrix' }) },
    { label: 'Image…', key: K('tool.image'), act: () => insertImageFile() }, '-',
    { label: 'Box', key: K('tool.rect'), act: () => insertCentered('rect') }, { label: 'Line', key: K('tool.line'), act: () => insertCentered('line', { h: 0.5 }) }, { label: 'Ellipse', key: K('tool.ellipse'), act: () => insertCentered('ellipse') }, { label: 'Inverse box', key: K('tool.inverse'), act: () => insertCentered('inverse') }, '-',
    { label: 'Variable', sub: Object.entries(VAR_TYPES).map(([t, l]) => ({ label: l + '…', act: () => varDialog(null, t) })) },
  ];
}
function menuObject() {
  const has = App.sel.length > 0, objs = selObjs();
  return [
    { label: 'Align', disabled: !has, sub: alignItems() },
    { label: 'Arrange', disabled: !has, sub: [{ label: 'Bring to front', key: K('front'), act: () => orderSel('front') }, { label: 'Bring forward', key: K('forward'), act: () => orderSel('forward') }, { label: 'Send backward', key: K('backward'), act: () => orderSel('backward') }, { label: 'Send to back', key: K('back'), act: () => orderSel('back') }] },
    { label: 'Rotate 90° clockwise', disabled: !has, act: () => rotateSel(90) }, { label: 'Rotate 90° counter-clockwise', disabled: !has, act: () => rotateSel(270) }, '-',
    { label: 'Group', key: K('group'), disabled: App.sel.length < 2, act: groupSel }, { label: 'Ungroup', key: K('ungroup'), disabled: !objs.some((o) => o.group), act: ungroupSel },
    { label: objs.length && objs.every((o) => o.locked) ? 'Unlock' : 'Lock', key: K('lock'), disabled: !has, act: toggleLock },
    { label: objs.length && objs.every((o) => o.hidden) ? 'Show' : 'Hide', disabled: !has, act: toggleHide }, '-',
    { label: 'Properties', act: () => showDock('props') }, { label: 'Object list', act: () => showDock('objects') },
  ];
}
function menuData() {
  const D = App.doc.data, n = recordCount(App.doc);
  return [
    { label: 'Import CSV / Excel / JSON…', act: () => importDataDialog() }, { label: 'Paste data…', act: pasteDataDialog },
    hubAvailable() ? { label: 'From Slop Drive…', act: dataFromDrive } : null,
    { label: 'Map columns…', disabled: !D, act: () => mapColumnsDialog(D) }, { label: 'Remove data', disabled: !D, act: () => editDoc((d) => { d.data = null; }, 'Remove data') }, '-',
    { label: 'Previous record', key: K('prevRecord'), disabled: n < 2, act: () => setRecord(App.rec - 1) }, { label: 'Next record', key: K('nextRecord'), disabled: n < 2, act: () => setRecord(App.rec + 1) }, '-',
    { label: 'Variables', act: () => showDock('vars') }, { label: 'Data table', act: () => showDock('data') },
  ];
}
function menuView() {
  const d = App.doc, rulers = !$('workspace').classList.contains('no-rulers');
  return [
    { label: 'Zoom in', key: K('zoomIn'), act: () => zoomTo(App.zoom * 1.25) }, { label: 'Zoom out', key: K('zoomOut'), act: () => zoomTo(App.zoom / 1.25) },
    { label: 'Fit label', key: K('fit'), act: fitView }, { label: 'Actual size', key: K('actual'), act: zoomActual }, '-',
    { label: 'Rulers', check: rulers, act: () => { $('workspace').classList.toggle('no-rulers'); lsSet('sloplabel-rulers', rulers ? '0' : '1'); } },
    { label: 'Grid', check: d.grid.show, act: () => editDoc((x) => { x.grid.show = !x.grid.show; }, 'Grid') },
    { label: 'Snap to grid', check: d.grid.snap, act: () => editDoc((x) => { x.grid.snap = !x.grid.snap; }, 'Snap') }, '-',
    { label: 'Theme', sub: THEMES.map(([id, l]) => ({ label: l, check: document.documentElement.dataset.theme === id, act: () => setTheme(id) })) },
  ];
}
function menuHelp() {
  const C = window.SlopCmd;
  return [
    C ? { label: 'Search commands…', key: C.keyFor('cmd.palette'), act: () => C.open() } : null, C ? { label: 'Keyboard shortcuts…', key: C.keyFor('cmd.keymap'), act: () => C.openKeymap() } : null, C ? '-' : null,
    { label: 'About SlopLabel', act: aboutDialog }, { label: 'Start from a template…', act: templatesDialog }, '-', { label: 'Slopographic home', act: () => { location.href = '../'; } },
  ];
}
const MENUS = [['File', menuFile], ['Edit', menuEdit], ['Insert', menuInsert], ['Object', menuObject], ['Data', menuData], ['View', menuView], ['Help', menuHelp]];
function initMenus() {
  const nav = $('menus');
  let openBtn = null;
  const openMenu = (b, fn) => {
    const r = b.getBoundingClientRect();
    document.querySelectorAll('.mb.open').forEach((x) => x.classList.remove('open'));
    b.classList.add('open'); openBtn = b;
    const m = SlopUI.menu(fn(), r.left, r.bottom + 1);
    new MutationObserver((_, obs) => { if (!m.isConnected) { b.classList.remove('open'); if (openBtn === b) openBtn = null; obs.disconnect(); } }).observe(document.body, { childList: true });
  };
  for (const [name, fn] of MENUS) {
    const b = mk('button', { type: 'button', class: 'mb', 'aria-haspopup': 'menu' }, name);
    b.addEventListener('click', () => { if (openBtn === b) { SlopUI.closeMenu(); return; } openMenu(b, fn); });
    b.addEventListener('pointerenter', () => { if (openBtn && openBtn !== b && document.querySelector('.sui-menu')) openMenu(b, fn); });
    nav.append(b);
  }
}
