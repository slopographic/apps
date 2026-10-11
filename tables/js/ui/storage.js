/* Files: open and save through Slop Drive (SlopHub), CSV and TSV import, the launch from ?drive=<id>,
   and downloads for when Slop Drive is not available. A zero-byte .stab from Drive's New menu is a blank
   workbook that saves back to that same Drive file. */
import { S, $, emit, toast, redraw, sheet } from './state.js';
import { Workbook } from '../engine/index.js';
import { toBlob, fromBlob, fromNative, MIME, EXT } from '../io/native.js';
import { toCsv, parseCsv } from '../io/csv.js';
import { toXlsx } from '../io/xlsx.js';
import { resetHistory } from './history.js';
import { readDraft, writeDraftNow } from './drafts.js';

const hub = () => window.SlopHub || null;
const CSV_TYPES = ['text/csv', 'text/tab-separated-values'];
const isCsv = (rec) => CSV_TYPES.includes(rec.type) || /\.(csv|tsv)$/i.test(rec.name || '');
const safe = (s) => String(s).replace(/[\\/:*?"<>|]/g, '-').trim() || 'Untitled spreadsheet';
export const fileName = (ext = EXT) => `${safe(S.file.name)}.${ext}`;

/** Make wb the open workbook. */
function install(wb, file) {
  S.wb = wb;
  S.si = Math.min(wb.active || 0, wb.sheets.length - 1);
  S.sel = { r: 0, c: 0, er: 0, ec: 0 };
  S.edit = null;
  S.file = { name: safe(file.name), driveId: file.driveId || null, folderId: file.folderId ?? null, dirty: !!file.dirty };
  resetHistory();
  const vp = $('vp');
  if (vp) { vp.scrollTop = 0; vp.scrollLeft = 0; }
  emit('open');
  redraw();
}

const confirmDiscard = () => (S.file.dirty
  ? window.SlopUI.confirm('Discard changes?', 'This workbook has changes that are not saved to Slop Drive. Continue anyway?', 'Continue', { danger: true })
  : Promise.resolve(true));

async function importCsv(blob, name) {
  const delim = /\.tsv$/i.test(name) || /tab-separated/.test(blob.type) ? '\t' : ',';
  const rows = parseCsv(await blob.text(), delim), wb = new Workbook(), sh = wb.sheets[0];
  wb.batch(() => rows.forEach((row, r) => row.forEach((v, c) => { if (v !== '') wb.input(sh, r, c, v); })));
  return wb;
}

/** Open a Slop Drive record (from the picker or ?drive=). Resolves true when it is now open. */
export async function openRecord(rec, { ask = true } = {}) {
  if (!rec) return false;
  if (ask && !(await confirmDiscard())) return false;
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
  install(wb, isCsv(rec) ? { name, folderId: rec.folderId, dirty: true } : { name, driveId: rec.id, folderId: rec.folderId });
  if (!isCsv(rec)) setUrl(rec.id);
  return true;
}

export async function openFromDrive() {
  const h = hub();
  if (!h) return;
  const rec = await h.pickFromDrive({ accept: [MIME, ...CSV_TYPES] });
  if (rec) await openRecord(rec);
}

export async function newBlank() {
  if (!(await confirmDiscard())) return;
  install(new Workbook(), { name: 'Untitled spreadsheet' });
  setUrl(null);
}

/** Save to the file's Drive record, or ask for a folder the first time. Without Slop Drive it downloads. */
export async function save({ as = false } = {}) {
  const h = hub(), name = fileName(), blob = toBlob(S.wb);
  if (!h) { window.SlopUI.download(blob, name); markSaved(); return true; }
  try {
    if (S.file.driveId && !as) {
      const prev = await h.get(S.file.driveId);
      await h.put(blob, { id: S.file.driveId, name, from: 'tables', folderId: prev ? prev.folderId : S.file.folderId });
    } else {
      const folderId = await h.pickFolder({ title: `Save “${name}” to Slop Drive`, start: await h.appFolderId('tables') });
      if (folderId === undefined) return false;
      S.file.driveId = await h.put(blob, { name, from: 'tables', folderId });
      S.file.folderId = folderId;
      setUrl(S.file.driveId);
    }
    markSaved();
    toast('Saved to Slop Drive');
    return true;
  } catch (err) {
    window.SlopUI.alert('Could not save', err.message || String(err));
    return false;
  }
}

function markSaved() { S.file.dirty = false; emit('saved'); redraw(); writeDraftNow(); }
function setUrl(id) {
  const u = new URL(location.href);
  if (id) u.searchParams.set('drive', id); else u.searchParams.delete('drive');
  history.replaceState(null, '', u.pathname + u.search + u.hash);
}

/** Open wb as a new, unsaved workbook (a template). Asks first when the current workbook has unsaved changes. */
export async function useWorkbook(wb, name) {
  if (!(await confirmDiscard())) return false;
  install(wb, { name: name || 'Untitled spreadsheet' });
  setUrl(null);
  return true;
}

export const downloadNative = () => window.SlopUI.download(toBlob(S.wb), fileName());
export const downloadCsv = () => window.SlopUI.download(new Blob([toCsv(sheet())], { type: 'text/csv' }), fileName('csv'));
export async function downloadXlsx() { window.SlopUI.download(await toXlsx(S.wb), fileName('xlsx')); }

/** Startup: ?drive=<id> first, then the unsaved draft, then a blank workbook. */
export async function launch() {
  const h = hub();
  if (h) { try { h.register('tables'); } catch (e) { /* hub without register */ } }
  let rec = null;
  try { rec = h ? await h.consumeLaunch() : null; } catch (e) { rec = null; }
  if (rec && await openRecord(rec, { ask: false })) return;
  let draft = null;
  try { draft = await readDraft(); } catch (e) { draft = null; }
  if (draft && draft.json) {
    try {
      install(fromNative(JSON.parse(draft.json)), { name: draft.name, driveId: draft.driveId, folderId: draft.folderId, dirty: true });
      toast('Restored your unsaved workbook');
      return;
    } catch (e) { /* damaged draft: start blank */ }
  }
  install(new Workbook(), { name: 'Untitled spreadsheet' });
}
