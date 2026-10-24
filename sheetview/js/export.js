/* Slop Sheets viewer: export. The Export menu offers CSV, TSV and XLSX, each for the visible rows (after filter and
 * sort, current sheet) or for all rows. XLSX with all rows holds every sheet; with visible rows, the current sheet only.
 * Files are made in the browser and downloaded; nothing is uploaded. */
import { csvBlob } from '../../shared/sheets/csv.js';
import { exportSheet, toXlsxBlob } from '../../shared/sheets/write.js';

/** The menu items for an open document. ctx: { doc, sheet, order }. */
export function exportItems(ctx, run) {
  const scopes = [['visible', 'Visible rows'], ['all', 'All rows']];
  const items = [];
  scopes.forEach(([scope, label], i) => {
    if (i) items.push('-');
    items.push({ label: `${label}: CSV`, act: () => run('csv', scope, ctx) });
    items.push({ label: `${label}: TSV`, act: () => run('tsv', scope, ctx) });
    items.push({ label: scope === 'visible' ? 'Visible rows: XLSX (this sheet)' : 'All rows: XLSX (every sheet)', act: () => run('xlsx', scope, ctx) });
  });
  return items;
}

const safeBase = (name) => String(name || 'Sheet').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Sheet';

/** Builds the file and downloads it. Returns the file name. */
export async function exportFile(kind, scope, { doc, sheet, order }) {
  const visible = scope === 'visible';
  const suffix = visible ? ' (visible rows)' : '';
  const base = safeBase(doc.name);
  let blob, name;
  if (kind === 'xlsx') {
    const sheets = visible ? [exportSheet(sheet, order)] : doc.sheets.map((s) => exportSheet(s));
    blob = await toXlsxBlob(sheets);
    name = `${base}${suffix}.xlsx`;
  } else {
    blob = csvBlob(sheet, visible ? order : null, kind === 'tsv' ? '\t' : ',');
    name = `${base}${suffix}.${kind}`;
  }
  window.SlopUI.download(blob, name);
  return name;
}

/** Convert… in the header (shared/convert/provided.js): every sheet of the open document, as one XLSX. */
addEventListener('slop:convert-files', (e) => e.detail.provide(async () => {
  const d = window.SlopSheetView && window.SlopSheetView.store.doc();
  if (!d) return null;
  return [{ name: `${safeBase(d.name)}.xlsx`, blob: await toXlsxBlob(d.sheets.map((s) => exportSheet(s))) }];
}, { app: 'Slop Sheets' }));
