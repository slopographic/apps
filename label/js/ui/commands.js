/* SlopLabel — ui/commands: every tool and menu action registered with the shared command palette
 * (shared/commands, window.SlopCmd). SlopCmd owns the keyboard: people can search any action with
 * Ctrl/⌘+K and rebind every shortcut (Help ▸ Keyboard shortcuts…). K(id) gives a menu's key label. */
'use strict';

const K = (id) => (window.SlopCmd ? SlopCmd.keyFor('label.' + id) : '') || undefined;
const runCmd = (id) => window.SlopCmd && SlopCmd.run('label.' + id, { source: 'menu' });
const inFormMode = () => document.body.classList.contains('form-mode');
const hasSel = () => App.sel.length > 0;
const ICO = (svg) => `<svg viewBox="0 0 24 24" aria-hidden="true">${svg}</svg>`;
function nudgeStep(big) { const base = App.doc.grid.snap && +App.doc.grid.size ? +App.doc.grid.size : U() === 'in' ? 0.254 : 0.1; return base * (big ? 10 : 1); }
const toggleRulers = () => { const on = !$('workspace').classList.contains('no-rulers'); $('workspace').classList.toggle('no-rulers'); lsSet('sloplabel-rulers', on ? '0' : '1'); };

function labelCommands() {
  const C = [];
  const add = (group, id, title, run, o = {}) => C.push(Object.assign({ id: 'label.' + id, title, group, run }, o));
  /* File */
  add('File', 'new', 'New from template…', templatesDialog, { keywords: ['template', 'start', 'gallery'] });
  add('File', 'open', 'Open…', openFilesDialog, { keys: ['Mod+O'], keywords: ['load', 'project', 'zpl', 'csv'] });
  add('File', 'importZPL', 'Import ZPL…', importZPLDialog, { keywords: ['zebra', 'zpl'] });
  add('File', 'save', 'Save project', saveProject, { keys: ['Mod+S'], keywords: ['download', '.sloplabel'] });
  add('File', 'print', 'Print…', openPrintDialog, { keys: ['Mod+P'], keywords: ['pdf', 'zpl', 'epl', 'tspl', 'output'] });
  add('File', 'exportPDF', 'Export PDF', exportPDFQuick, { keywords: ['save as'] });
  add('File', 'exportPNG', 'Export PNG (current label)', exportPNG, { keywords: ['image', 'picture'] });
  add('File', 'exportSVG', 'Export SVG (current label)', exportSVG, { keywords: ['vector'] });
  add('File', 'exportZPL', 'Export ZPL (Zebra)', exportZPLQuick, { keywords: ['zebra', 'printer'] });
  add('File', 'shareForm', 'Share print form link…', shareFormLink, { keywords: ['link', 'url', 'form'] });
  add('File', 'setup', 'Label setup…', () => labelSetupDialog(), { keywords: ['size', 'stock', 'avery', 'roll', 'printer', 'dpi'] });
  add('File', 'tab.new', 'New tab', newBlankTab, { keywords: ['tab', 'blank', 'document', 'label'] });
  add('File', 'tab.close', 'Close tab', closeCurrentTab, { keywords: ['tab', 'close', 'document'] });
  add('File', 'presets', 'Presets…', presetsDialog, { keywords: ['preset', 'avery', 'sheet', 'size', 'gallery', 'template'] });
  add('File', 'saveConfig', 'Save as config…', saveConfigDialog, { keywords: ['config', 'save', 'setup', 'reuse'] });
  add('File', 'configs', 'Configs…', configsDialog, { keywords: ['config', 'list', 'apply', 'rename', 'export', 'import'] });
  add('File', 'imageFromDrive', 'Insert image from Slop Drive…', imageFromDrive, { when: hubAvailable, keywords: ['hub'] });
  add('File', 'dataFromDrive', 'Data from Slop Drive…', dataFromDrive, { when: hubAvailable, keywords: ['hub', 'csv'] });
  add('File', 'offline', 'Download app (offline .html)', async () => { try { const n = await downloadOfflineApp(); SlopUI.toast(`Saved sloplabel.html (${Math.round(n / 1024)} KB)`); } catch (e) { SlopUI.alert('Could not build the offline app', e.message); } }, { keywords: ['offline', 'single file'] });
  /* Edit */
  add('Edit', 'undo', 'Undo', undo, { keys: ['Mod+Z'], when: () => App.hist.canUndo });
  add('Edit', 'redo', 'Redo', redo, { keys: ['Mod+Y', 'Shift+Mod+Z'], when: () => App.hist.canRedo });
  add('Edit', 'cut', 'Cut', cutSel, { keys: ['Mod+X'], when: hasSel });
  add('Edit', 'copy', 'Copy', copySel, { keys: ['Mod+C'], when: hasSel });
  add('Edit', 'paste', 'Paste', () => pasteClip() || SlopUI.toast('Nothing to paste'), { keywords: ['clipboard'] });
  add('Edit', 'duplicate', 'Duplicate', () => duplicateSel(), { keys: ['Mod+D'], when: hasSel });
  add('Edit', 'delete', 'Delete', deleteSel, { keys: ['Delete', 'Backspace'], when: hasSel, keywords: ['remove'] });
  add('Edit', 'selectAll', 'Select all', selectAll, { keys: ['Mod+A'], when: () => !isTyping(document.activeElement) }); // in a field Ctrl+A selects its text
  add('Edit', 'deselect', 'Deselect', () => { if (Drag) return; deselect(); setTool('select'); }, { keys: ['Escape'], keywords: ['select none'] });
  add('Edit', 'editContent', 'Edit content', focusContent, { keys: ['Enter'], when: () => App.sel.length === 1, keywords: ['text', 'value'] });
  /* Tools */
  for (const t of TOOLS) {
    if (!t || t === '-') continue;
    add('Tools', 'tool.' + t.id, t.name + ' tool', t.id === 'image' ? () => { setTool('select'); insertImageFile(); } : () => setTool(t.id),
      { keys: t.key ? [t.key] : [], icon: ICO(t.svg), checked: () => App.tool === t.id, keywords: ['tool', t.id] });
  }
  /* Insert */
  add('Insert', 'insert.text', 'Insert text', () => insertCentered('text'));
  add('Insert', 'insert.para', 'Insert paragraph', () => insertCentered('para'));
  add('Insert', 'insert.barcode', 'Insert barcode (Code 128)', () => insertCentered('barcode', defaultsFor('barcode')), { keywords: ['code128', '1d'] });
  add('Insert', 'insert.ean13', 'Insert EAN-13', () => insertCentered('barcode', { symbology: 'ean13', content: '590123412345', module: 0.33, hr: 'below', name: 'EAN-13' }), { keywords: ['retail', 'upc', 'gtin'] });
  add('Insert', 'insert.gs1', 'Insert GS1-128', () => insertCentered('barcode', { symbology: 'gs1-128', content: '(01)09501101530003(10)LOT42', module: 0.33, name: 'GS1-128' }), { keywords: ['ucc', 'ean128', 'sscc'] });
  add('Insert', 'insert.qr', 'Insert QR code', () => insertCentered('barcode', defaultsFor('qr')), { keywords: ['2d'] });
  add('Insert', 'insert.datamatrix', 'Insert Data Matrix', () => insertCentered('barcode', { symbology: 'datamatrix', content: 'SLOP-12345', module: 0.5, hr: 'none', name: 'Data Matrix' }), { keywords: ['2d', 'gs1'] });
  add('Insert', 'insert.image', 'Insert image…', () => insertImageFile(), { keywords: ['picture', 'logo'] });
  add('Insert', 'insert.rect', 'Insert box', () => insertCentered('rect'), { keywords: ['rectangle', 'frame'] });
  add('Insert', 'insert.line', 'Insert line', () => insertCentered('line', { h: 0.5 }));
  add('Insert', 'insert.ellipse', 'Insert ellipse', () => insertCentered('ellipse'), { keywords: ['circle', 'oval'] });
  add('Insert', 'insert.inverse', 'Insert inverse box', () => insertCentered('inverse'), { keywords: ['reverse', 'black'] });
  for (const [t, l] of Object.entries(VAR_TYPES)) add('Insert', 'var.' + t, 'New variable: ' + l + '…', () => varDialog(null, t), { keywords: ['variable', 'field', t] });
  /* Object */
  const A = [['left', 'Align left'], ['hcenter', 'Align centre horizontally'], ['right', 'Align right'], ['top', 'Align top'], ['vcenter', 'Align centre vertically'], ['bottom', 'Align bottom']];
  for (const [how, l] of A) add('Object', 'align.' + how, l, () => alignSel(how), { when: hasSel, keywords: ['align'] });
  add('Object', 'distribute.h', 'Distribute horizontally', () => distributeSel('h'), { when: () => App.sel.length >= 3 });
  add('Object', 'distribute.v', 'Distribute vertically', () => distributeSel('v'), { when: () => App.sel.length >= 3 });
  add('Object', 'front', 'Bring to front', () => orderSel('front'), { keys: ['Shift+Mod+]'], when: hasSel, keywords: ['arrange', 'order'] });
  add('Object', 'forward', 'Bring forward', () => orderSel('forward'), { keys: ['Mod+]'], when: hasSel, keywords: ['arrange', 'order'] });
  add('Object', 'backward', 'Send backward', () => orderSel('backward'), { keys: ['Mod+['], when: hasSel, keywords: ['arrange', 'order'] });
  add('Object', 'back', 'Send to back', () => orderSel('back'), { keys: ['Shift+Mod+['], when: hasSel, keywords: ['arrange', 'order'] });
  add('Object', 'rotateCW', 'Rotate 90° clockwise', () => rotateSel(90), { when: hasSel, keywords: ['turn'] });
  add('Object', 'rotateCCW', 'Rotate 90° counter-clockwise', () => rotateSel(270), { when: hasSel, keywords: ['turn'] });
  add('Object', 'group', 'Group', groupSel, { keys: ['Mod+G'], when: () => App.sel.length >= 2 });
  add('Object', 'ungroup', 'Ungroup', ungroupSel, { keys: ['Shift+Mod+G'], when: () => selObjs().some((o) => o.group) });
  add('Object', 'lock', 'Lock / unlock', toggleLock, { keys: ['Mod+L'], when: hasSel });
  add('Object', 'hide', 'Hide / show', toggleHide, { when: hasSel, keywords: ['visible'] });
  const N = [['Left', -1, 0], ['Right', 1, 0], ['Up', 0, -1], ['Down', 0, 1]];
  for (const [d, x, y] of N) {
    add('Object', 'nudge' + d, 'Nudge ' + d.toLowerCase(), () => { const s = nudgeStep(false); nudge(x * s, y * s); }, { keys: ['Arrow' + d], when: hasSel, repeat: true, keywords: ['move'] });
    add('Object', 'nudge' + d + '10', 'Nudge ' + d.toLowerCase() + ' ×10', () => { const s = nudgeStep(true); nudge(x * s, y * s); }, { keys: ['Shift+Arrow' + d], when: hasSel, repeat: true, keywords: ['move'] });
  }
  add('Object', 'props', 'Show properties', () => showDock('props'), { keywords: ['panel', 'inspector'] });
  add('Object', 'objects', 'Show object list', () => showDock('objects'), { keywords: ['layers', 'panel'] });
  /* Data */
  const multi = () => recordCount(App.doc) > 1;
  add('Data', 'import', 'Import CSV / Excel / JSON…', () => importDataDialog(), { keywords: ['merge', 'xlsx', 'spreadsheet'] });
  add('Data', 'pasteData', 'Paste data…', pasteDataDialog, { keywords: ['merge', 'table'] });
  add('Data', 'map', 'Map columns…', () => mapColumnsDialog(App.doc.data), { when: () => !!App.doc.data });
  add('Data', 'remove', 'Remove data', () => editDoc((d) => { d.data = null; }, 'Remove data'), { when: () => !!App.doc.data });
  add('Data', 'prevRecord', 'Previous record', () => setRecord(App.rec - 1), { keys: ['PageUp'], when: multi, repeat: true });
  add('Data', 'nextRecord', 'Next record', () => setRecord(App.rec + 1), { keys: ['PageDown'], when: multi, repeat: true });
  add('Data', 'vars', 'Show variables', () => showDock('vars'), { keywords: ['panel'] });
  add('Data', 'table', 'Show data table', () => showDock('data'), { keywords: ['panel', 'records'] });
  /* View */
  add('View', 'zoomIn', 'Zoom in', () => zoomTo(App.zoom * 1.25), { keys: ['Mod+=', 'Mod++'], repeat: true });
  add('View', 'zoomOut', 'Zoom out', () => zoomTo(App.zoom / 1.25), { keys: ['Mod+-'], repeat: true });
  add('View', 'fit', 'Fit label', fitView, { keys: ['Mod+0'], keywords: ['zoom'] });
  add('View', 'actual', 'Actual size', zoomActual, { keys: ['Mod+1'], keywords: ['zoom', '100%'] });
  add('View', 'rulers', 'Rulers', toggleRulers, { checked: () => !$('workspace').classList.contains('no-rulers') });
  add('View', 'grid', 'Grid', () => editDoc((x) => { x.grid.show = !x.grid.show; }, 'Grid'), { checked: () => App.doc.grid.show });
  add('View', 'snap', 'Snap to grid', () => editDoc((x) => { x.grid.snap = !x.grid.snap; }, 'Snap'), { checked: () => App.doc.grid.snap });
  for (const [id, l] of THEMES) add('View', 'theme.' + id, 'Theme: ' + l, () => setTheme(id), { checked: () => document.documentElement.dataset.theme === id, keywords: ['appearance', 'dark', 'light'] });
  /* Help */
  add('Help', 'about', 'About SlopLabel', aboutDialog);
  add('Help', 'home', 'Slopographic home', () => { location.href = '../'; });
  // nothing runs from the keyboard in print-form mode
  for (const c of C) { const w = c.when; c.when = w ? () => !inFormMode() && w() : () => !inFormMode(); }
  return C;
}
/** Refresh tooltips that show shortcuts (after a rebind). */
function updateKeyTitles() {
  const t = (id, name, k) => { const el = $(id); if (el) el.title = k ? `${name} (${k})` : name; };
  t('btnUndo', 'Undo', K('undo')); t('btnRedo', 'Redo', K('redo')); t('btnPrint', 'Print', K('print')); t('zoomVal', 'Fit label', K('fit'));
  t('btnCmd', 'Search commands', window.SlopCmd && SlopCmd.keyFor('cmd.palette'));
  document.querySelectorAll('.tool[data-tool]').forEach((b) => { const tool = toolById(b.dataset.tool); const k = K('tool.' + tool.id); b.title = k ? `${tool.name} (${k})` : tool.name; });
}
function initCommands() {
  if (!window.SlopCmd) return false;
  SlopCmd.init({ app: 'label' });
  SlopCmd.register(labelCommands().concat(window.SlopConfigDialog ? SlopConfigDialog.commands({ app: 'label', prefix: 'label' }) : []));
  SlopCmd.on('change', updateKeyTitles);
  const b = $('btnCmd');
  if (b) b.addEventListener('click', () => SlopCmd.open());
  updateKeyTitles();
  return true;
}
