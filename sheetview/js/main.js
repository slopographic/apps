/* Slop Sheets viewer: boot. Opens files (Open button, drop, several at once as tabs, or ?drive=<id> from Slop Drive),
 * wires the header, the Export and Menu buttons, the commands, the table style choices and Open in Slop Table.
 * Module script; the classic scripts (apps, slopui, hub, drop, commands) load first.
 * Test hook: window.SlopSheetView.open(files) takes File objects the way the Open button does. */
import { read } from '../../shared/sheets/read.js';
import { csvBlob } from '../../shared/sheets/csv.js';
import { createStore } from './state.js';
import { createView } from './view.js';
import { exportItems, exportFile } from './export.js';
import { STYLES, PALETTES, loadAppearance, saveAppearance } from './appearance.js';

const $ = (id) => document.getElementById(id);
const toast = (msg) => { if (window.SlopUI) window.SlopUI.toast(msg); };
const ACCEPT = '.xlsx,.xlsm,.csv,.tsv,.xls,.ods';
const MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet', 'text/csv', 'text/tab-separated-values', 'text/plain',
];

const appearance = loadAppearance();
let view = null;
const store = createStore(() => { if (view) view.render(); });

/** Reads one file into a new tab. Throws the reason when it cannot be read (the drop panel shows it). */
async function openFile(file) {
  const parsed = await read(file, { name: file.name });
  store.addDoc(parsed, { name: file.name });
  return file.name;
}

/** The Open button: each file in turn; a file that fails gets its own message and the rest still open. */
async function openFiles(files) {
  for (const f of files) {
    try { await openFile(f); } catch (e) { window.SlopUI.alert(`Could not open ${f.name}`, e.message); }
  }
}

async function pickFiles() {
  const files = await window.SlopUI.pickFiles({ accept: ACCEPT, multiple: true });
  if (files && files.length) await openFiles(files);
}

/** Opens the file a Slop Drive "Open in" handoff points at (?drive=<id>). */
async function openLaunch() {
  const launch = await window.SlopHub.consumeLaunch();
  if (!launch || !launch.blob) return;
  try {
    const parsed = await read(launch.blob, { name: launch.name });
    store.addDoc(parsed, { name: launch.name });
  } catch (e) {
    window.SlopUI.alert(`Could not open ${launch.name}`, e.message);
  }
}

/** The current sheet, all rows, as CSV, opened in Slop Table through Slop Drive. */
async function openInTables() {
  const d = store.doc();
  if (!d) return;
  const sheet = store.sheet();
  const name = `${d.name}${d.sheets.length > 1 ? ' - ' + sheet.name : ''}.csv`;
  try {
    // No byte-order mark: Slop Tables reads the text as it is, and a BOM would sit in cell A1.
    await window.SlopHub.sendTo('tables', csvBlob(sheet, null, ',', { bom: false }), name);
    toast('Opened in Slop Table');
  } catch (e) {
    toast('Could not send to Slop Table: ' + e.message);
  }
}

async function runExport(kind, scope, ctx) {
  try {
    const name = await exportFile(kind, scope, ctx);
    toast(`Exported ${name}`);
  } catch (e) {
    toast('Could not export: ' + e.message);
  }
}

function exportContext() {
  const d = store.doc();
  return d ? { doc: d, sheet: store.sheet(), order: store.order() } : null;
}

function exportMenu(anchor) {
  const ctx = exportContext();
  if (!ctx) { toast('Open a spreadsheet first'); return; }
  const r = anchor.getBoundingClientRect();
  window.SlopUI.menu(exportItems(ctx, runExport), r.left, r.bottom + 4);
}

function menuItems() {
  const has = !!store.doc();
  const v = store.view();
  const nothingToClear = !v || (!v.sort && ![...v.filters.values()].length);
  return [
    { label: 'Open spreadsheet…', key: cmdKey('open'), act: pickFiles },
    '-',
    ...exportItems(exportContext() || { doc: null, sheet: null, order: [] }, runExport).map((it) => (it === '-' ? it : { ...it, disabled: !has })),
    '-',
    { label: 'Open current sheet in Slop Table', disabled: !has, act: openInTables },
    { label: 'Clear sort and filters', disabled: !has || nothingToClear, act: () => store.clearView() },
  ];
}

const cmdKey = (id) => (window.SlopCtx ? SlopCtx.keyFor('sheetview.' + id) : '');

function registerCommands() {
  if (!window.SlopCmd) return;
  SlopCmd.init({ app: 'sheetview' });
  const C = (id, title, keys, run, extra = {}) => ({ id: 'sheetview.' + id, title, group: 'File', keys, run, ...extra });
  SlopCmd.register([
    C('open', 'Open spreadsheet…', ['Mod+O'], pickFiles, { keywords: ['load', 'csv', 'xlsx', 'computer'] }),
    C('hub', 'Open current sheet in Slop Table', [], openInTables, { keywords: ['tables', 'edit', 'drive'], when: () => !!store.doc() }),
    C('export-visible-csv', 'Export visible rows as CSV', [], () => runExport('csv', 'visible', exportContext()), { keywords: ['save', 'filter'], when: () => !!store.doc() }),
    C('export-all-xlsx', 'Export all rows as XLSX', [], () => runExport('xlsx', 'all', exportContext()), { keywords: ['excel', 'save'], when: () => !!store.doc() }),
    C('clear', 'Clear sort and filters', [], () => store.clearView(), { keywords: ['reset', 'sort', 'filter'], when: () => !!store.doc() }),
  ]);
}

function wireHeader() {
  $('sv-open').addEventListener('click', pickFiles);
  $('sv-open2').addEventListener('click', pickFiles);
  $('sv-export').addEventListener('click', (e) => exportMenu(e.currentTarget));
  $('sv-hub').addEventListener('click', openInTables);
  $('sv-clear').addEventListener('click', () => store.clearView());
  $('sv-cmd').addEventListener('click', () => { if (window.SlopCmd && SlopCmd.open) SlopCmd.open(); });
  $('sv-menu').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    window.SlopUI.menu(menuItems(), r.left, r.bottom + 4);
  });

  const fill = (sel, list, value) => {
    sel.replaceChildren(...list.map(([id, label]) => { const o = document.createElement('option'); o.value = id; o.textContent = label; return o; }));
    sel.value = value;
  };
  const style = $('sv-style'), palette = $('sv-palette');
  fill(style, STYLES, appearance.style);
  fill(palette, PALETTES, appearance.palette);
  const change = () => {
    appearance.style = style.value;
    appearance.palette = palette.value;
    saveAppearance(appearance);
    view.restyle(appearance);
  };
  style.addEventListener('change', change);
  palette.addEventListener('change', change);
}

function wireDrop() {
  const drop = window.SlopDrop.attach($('sv-drop'), {
    accept: { types: MIME, exts: ['.xlsx', '.xlsm', '.csv', '.tsv', '.xls', '.ods'], noun: 'a spreadsheet' },
    limit: 20,
    compact: true,
    targets: [document.querySelector('.sv-app')],
    process: async (file) => openFile(file),
  });
  // The empty page shows what a sheet looks like here and how (SlopDrop's preview); the sample goes through the strip.
  const empty = $('sv-empty'), sample = document.createElement('button');
  empty.insertBefore(window.SlopDrop.panel.preview({
    picture: { src: '../assets/shots/sheetview.jpg', alt: 'A price list open in Slop Sheets, sorted by price' },
    steps: ['Drop an .xlsx, .csv or .tsv file', 'Sort and filter any column', 'Export the rows you need'],
  }), empty.querySelector('.sv-empty-b'));
  sample.type = 'button'; sample.className = 'sd-sample'; sample.id = 'sv-sample'; sample.textContent = 'Try it with a sample price list';
  sample.addEventListener('click', () => drop.run(window.SlopSamples.docs.xlsx().then((f) => [f])));
  empty.querySelector('.sv-empty-b').append(sample);
}

async function boot() {
  SlopHub.register('sheetview');
  view = createView(store, {
    empty: $('sv-empty'), view: $('sv-view'), grid: $('sv-grid'), docs: $('sv-docs'), sheets: $('sv-sheets'),
    name: $('sv-name'), status: $('sv-status'), clear: $('sv-clear'),
  }, appearance);
  wireHeader();
  wireDrop();
  registerCommands();
  window.SlopSheetView = { open: (files) => openFiles(Array.from(files)), store };
  view.render();
  try { await openLaunch(); } catch (e) { toast('Could not open that file: ' + e.message); }
  view.render();
  document.body.classList.add('ready');
}

// Module scripts run once the page is parsed, so the elements exist here.
boot().catch((e) => { console.error(e); document.body.classList.add('ready'); toast('Slop Sheets could not start: ' + e.message); });
