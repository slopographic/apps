/* Slop Tables commands: every action in the menus, registered with SlopCmd (palette and remappable keys).
   Without SlopCmd, runShortcut() handles the Ctrl/⌘ keys below. Menus are built from the same list. */
import { S, $, toast } from './state.js';
import { undo, redo, canUndo, canRedo } from './history.js';
import * as A from './actions.js';
import * as F from './storage.js';
import * as Sh from './sheets.js';
import * as TPL from './templates.js';
import { NUMBER_FORMATS } from './numfmt.js';
import { clearRange } from './actions.js';
import { configCommands } from '../io/config.js';

/** Grid commands run only when no text field has focus (Ctrl+A, Ctrl+Z… belong to the field then). */
const idle = () => { const a = document.activeElement; return !S.edit && !(a && a.closest && a.closest('input, textarea, select, [contenteditable="true"]')); };

export const COMMANDS = [
  { id: 'file.new', title: 'New workbook', group: 'File', run: F.newBlank },
  { id: 'file.fromTemplate', title: 'From template…', group: 'File', run: () => TPL.openTemplates() },
  { id: 'file.saveTemplate', title: 'Save as template…', group: 'File', run: () => TPL.saveAsTemplate() },
  { id: 'file.open', title: 'Open from Slop Drive…', group: 'File', keys: ['Mod+O'], run: F.openFromDrive, when: () => !!window.SlopHub },
  { id: 'file.save', title: 'Save', group: 'File', keys: ['Mod+S'], run: () => F.save() },
  { id: 'file.saveAs', title: 'Save to Slop Drive…', group: 'File', run: () => F.save({ as: true }), when: () => !!window.SlopHub },
  { id: 'file.rename', title: 'Rename…', group: 'File', run: () => window.SlopDocTabs.rename(null) },
  { id: 'file.stab', title: 'Download .stab file', group: 'File', run: F.downloadNative },
  { id: 'file.csv', title: 'Download CSV (active sheet)', group: 'File', run: F.downloadCsv },
  { id: 'file.xlsx', title: 'Download XLSX', group: 'File', run: F.downloadXlsx },
  { id: 'edit.undo', title: 'Undo', group: 'Edit', keys: ['Mod+Z'], run: undo, when: () => idle() && canUndo() },
  { id: 'edit.redo', title: 'Redo', group: 'Edit', keys: ['Shift+Mod+Z', 'Mod+Y'], run: redo, when: () => idle() && canRedo() },
  { id: 'edit.selectAll', title: 'Select all', group: 'Edit', keys: ['Mod+A'], run: A.selectAll, when: idle },
  { id: 'edit.clear', title: 'Clear contents', group: 'Edit', run: () => clearRange('contents'), when: idle },
  { id: 'edit.clearAll', title: 'Clear contents and formats', group: 'Edit', run: () => clearRange('all'), when: idle },
  { id: 'format.bold', title: 'Bold', group: 'Format', keys: ['Mod+B'], run: () => A.toggleStyle('b'), when: idle },
  { id: 'format.italic', title: 'Italic', group: 'Format', keys: ['Mod+I'], run: () => A.toggleStyle('i'), when: idle },
  ...NUMBER_FORMATS.map(([label, code], i) => ({ id: 'format.nf' + i, title: 'Number format: ' + label, group: 'Format', run: () => A.setFormat(code) })),
  { id: 'view.freeze', title: 'Freeze panes at selection', group: 'View', run: () => A.freezeAt() },
  { id: 'view.unfreeze', title: 'Unfreeze panes', group: 'View', run: () => A.unfreeze() },
  { id: 'sheet.add', title: 'Add sheet', group: 'Sheets', run: () => Sh.add() },
  { id: 'sheet.rename', title: 'Rename sheet…', group: 'Sheets', run: () => Sh.rename() },
  { id: 'sheet.delete', title: 'Delete sheet', group: 'Sheets', run: () => Sh.remove() },
  { id: 'help.keys', title: 'Keyboard shortcuts…', group: 'Help', run: () => window.SlopCmd && window.SlopCmd.openKeymap(), when: () => !!window.SlopCmd },
  { id: 'help.about', title: 'About Slop Tables', group: 'Help', run: about },
];
COMMANDS.push(...configCommands()); // Config: export, plain template, import, ask AI (io/config.js)
const byId = Object.fromEntries(COMMANDS.map((c) => [c.id, c]));
export const run = (id) => byId[id] && byId[id].run();

function about() {
  window.SlopUI.alert('Slop Tables', 'A spreadsheet that runs entirely in this browser. Workbooks are saved to Slop Drive on this device; nothing is uploaded. Formulas: the engine has over 300 functions.');
}

/** Ctrl/⌘ shortcuts when SlopCmd is not loaded. */
export function runShortcut(e) {
  const k = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  for (const c of COMMANDS) for (const key of c.keys || []) {
    const parts = key.split('+'), want = parts.pop();
    if (!parts.includes('Mod')) continue;
    if (k !== want.toUpperCase() || parts.includes('Shift') !== !!e.shiftKey) continue;
    if (c.when && !c.when()) continue;
    c.run();
    return true;
  }
  return false;
}

/** Register with SlopCmd and wire the ⌘K button. */
export function init() {
  const C = window.SlopCmd;
  if (!C) return;
  C.init({ app: 'tables' });
  C.register(COMMANDS.map((c) => ({ id: c.id, title: c.title, group: c.group, keys: c.keys || [], when: c.when, run: () => c.run() })));
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'tb'; b.id = 'btnCmd'; b.title = 'Search commands'; b.setAttribute('aria-label', 'Search commands');
  b.textContent = '⌘K';
  b.addEventListener('click', () => C.open());
  $('btnSave').before(b);
}

const keyText = (c) => (window.SlopCmd ? window.SlopCmd.keyFor(c.id) : (c.keys || [])[0]) || '';
const item = (id, label) => { const c = byId[id]; return { label: label || c.title, key: keyText(c), disabled: !!(c.when && !c.when()), act: () => c.run() }; };

/** The menus in the top bar. */
export function menus() {
  const paste = () => (navigator.clipboard && navigator.clipboard.readText ? navigator.clipboard.readText().then(A.paste, () => toast('Use Ctrl+V to paste')) : toast('Use Ctrl+V to paste'));
  return {
    File: [item('file.new'), item('file.fromTemplate'), item('file.open'), '-', item('file.save'), item('file.saveAs'), item('file.saveTemplate'), '-',
      { label: 'Config', sub: ['tables.config.export', 'tables.config.template', 'tables.config.import', 'tables.config.ai'].map((id) => item(id)) }, '-',
      { label: 'Download', sub: [item('file.stab', 'Download .stab (Slop Tables file)'), item('file.csv'), item('file.xlsx')] }],
    Edit: [item('edit.undo'), item('edit.redo'), '-',
      { label: 'Cut', key: 'Ctrl+X', act: () => document.execCommand('cut') },
      { label: 'Copy', key: 'Ctrl+C', act: () => document.execCommand('copy') },
      { label: 'Paste', key: 'Ctrl+V', act: paste }, '-',
      item('edit.selectAll'), item('edit.clear', 'Clear contents'), item('edit.clearAll')],
    Format: [item('format.bold'), item('format.italic'), '-',
      { label: 'Number format', sub: NUMBER_FORMATS.map((_, i) => item('format.nf' + i)) }],
    View: [item('view.freeze'), item('view.unfreeze')],
    Sheets: [item('sheet.add'), item('sheet.rename'), item('sheet.delete')],
    Help: [window.SlopCmd ? { label: 'Search commands…', key: keyText({ id: 'cmd.palette' }), act: () => window.SlopCmd.open() } : null,
      item('help.keys'), '-', item('help.about')],
  };
}
