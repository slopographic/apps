/* Files: open and save through Slop Drive (SlopHub), CSV and TSV import, the launch from ?drive=<id>,
   and downloads for when Slop Drive is not available. Each workbook is a tab (ui/tabs.js): Save and Save as new go
   through the strip's saveToDrive (drive.js), and a zero-byte .stab from Drive's New menu is a blank workbook that
   saves back to that same Drive file. A CSV opens as an unsaved import, so its Drive record is never overwritten. */
import { S, emit, sheet } from './state.js';
import { Workbook } from '../engine/index.js';
import { toBlob, fromBlob, MIME, EXT } from '../io/native.js';
import { toCsv, parseCsv } from '../io/csv.js';
import { toXlsx } from '../io/xlsx.js';
import { tabs } from './tabs.js';

const hub = () => window.SlopHub || null;
const CSV_TYPES = ['text/csv', 'text/tab-separated-values'];
const isCsv = (rec) => CSV_TYPES.includes(rec.type) || /\.(csv|tsv)$/i.test(rec.name || '');
const safe = (s) => String(s).replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled spreadsheet';
export const fileName = (ext = EXT) => `${safe(S.file.name)}.${ext}`;

async function importCsv(blob, name) {
  const delim = /\.tsv$/i.test(name) || /tab-separated/.test(blob.type) ? '\t' : ',';
  const rows = parseCsv(await blob.text(), delim), wb = new Workbook(), sh = wb.sheets[0];
  wb.batch(() => rows.forEach((row, r) => row.forEach((v, c) => { if (v !== '') wb.input(sh, r, c, v); })));
  return wb;
}

/** Open a Slop Drive record in a tab (the picker or ?drive=). A tab already showing it is brought forward. Resolves true when open. */
export async function openRecord(rec) {
  if (!rec) return false;
  const name = (rec.name || '').replace(/\.[^.]+$/, '') || 'Untitled spreadsheet';
  let wb;
  if (/spreadsheetml|opendocument\.spreadsheet|excel/.test(rec.type || '') || /\.(xlsx|xlsm|ods|xls)$/i.test(rec.name || '')) {
    window.SlopUI.alert('Not supported yet', 'Slop Tables opens its own .stab files and CSV for now. XLSX and ODS import is the next step; export CSV from the other app to bring the data in.');
    return false;
  }
  try {
    if (isCsv(rec)) wb = await importCsv(rec.blob, rec.name || '');
    else if (!rec.blob || rec.blob.size === 0) wb = new Workbook();
    else wb = await fromBlob(rec.blob);
  } catch (err) {
    window.SlopUI.alert('Could not open that file', 'This is not a Slop Tables file. ' + (err.message && !/JSON/.test(err.message) ? err.message : ''));
    return false;
  }
  // A CSV is imported as a new, unsaved workbook: its Drive record must not be overwritten with .stab data.
  if (isCsv(rec)) { tabs.open(wb, { name, dirty: true }, null); return true; }
  const open = tabs.tabFor(rec.id);
  if (open) tabs.api().activate(open.doc);
  else tabs.open(wb, { name, folderId: rec.folderId }, rec.id);
  return true;
}

export async function openFromDrive() {
  const h = hub();
  if (!h) return;
  const rec = await h.pickFromDrive({ accept: [MIME, ...CSV_TYPES] });
  if (rec) await openRecord(rec);
}

/** File ▸ New workbook: a blank workbook in a new tab. */
export async function newBlank() {
  tabs.newTab();
}

/** Save the open workbook to its Drive file (in place), or to a new file the person picks the folder for. Without Slop Drive it downloads. */
export async function save({ as = false } = {}) {
  const T = tabs.current();
  if (!T) return false;
  tabs.sync();
  if (!hub()) { window.SlopUI.download(toBlob(S.wb), fileName()); T.file.dirty = false; emit('saved'); return true; }
  const api = tabs.api(), prev = api.driveIdOf(T);
  try {
    if (as) api.setDriveId(T, null);
    const id = await api.saveToDrive(T);   // drive.js: the same record, or a new file in a folder the person picks
    if (!id) { if (as) api.setDriveId(T, prev); return false; }
    tabs.setUrl(id);
    return true;
  } catch (err) {
    window.SlopUI.alert('Could not save', err.message || String(err));
    return false;
  }
}

/** Open wb as a new, unsaved workbook in a new tab (a template). */
export async function useWorkbook(wb, name) {
  tabs.open(wb, { name: name || 'Untitled spreadsheet' }, null);
  return true;
}

export const downloadNative = () => { window.SlopUI.download(toBlob(S.wb), fileName()); SlopSupport.afterExport('tables'); };
export const downloadCsv = () => { window.SlopUI.download(new Blob([toCsv(sheet())], { type: 'text/csv' }), fileName('csv')); SlopSupport.afterExport('tables'); };
export async function downloadXlsx() { window.SlopUI.download(await toXlsx(S.wb), fileName('xlsx')); SlopSupport.afterExport('tables'); }

/* Startup reads are time-limited: a storage that never answers (a stalled hub) must not keep the page from
   opening, or it stays blank. A late answer is ignored. */
const START_MS = 1500;
const within = (p, fallback) => new Promise((res) => {
  const t = setTimeout(() => res(fallback), START_MS);
  Promise.resolve(p).then((v) => { clearTimeout(t); res(v); }, () => { clearTimeout(t); res(fallback); });
});

/** Startup: the launch from ?drive=<id> (read first, since showing a tab rewrites the address bar), then the open tabs
 * from this device, then a blank workbook when there are none. */
export async function launch() {
  const h = hub();
  if (h) { try { h.register('tables'); } catch (e) { /* hub without register */ } }
  const rec = h ? await within(Promise.resolve().then(() => h.consumeLaunch()), null) : null;
  tabs.init();
  await within(Promise.resolve().then(() => tabs.restore()).catch(() => 0), 0); // storage blocked or stalled: start blank
  if (!tabs.current()) tabs.newTab();
  if (!rec) return;
  const blank = tabs.isPristine(tabs.current()) ? tabs.current() : null;
  if (await openRecord(rec) && blank && tabs.current() !== blank) tabs.api().close(blank);
}
