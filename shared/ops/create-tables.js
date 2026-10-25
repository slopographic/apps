/* Slop Tables' headless operation (registry: shared/ops/registry.js):
 *   table-data-to-spreadsheet   table data → a spreadsheet, built by Slop Tables' own engine (tables/js/io/build.js:
 *                               the cells typed as a person would, formulas computed, the header row bold) and written by
 *                               its own XLSX writer (tables/js/io/xlsx.js) or as .stab or CSV.
 * The input is a .json file ({ sheets: [{ name, rows: [[…]] }] } or { rows }) or a .csv / .tsv / .txt table; the assistant
 * saves it to Slop Drive first. No DOM: the engine and the writer run in any page and in Node. */
import { register } from './registry.js';
import { stem } from './load.js';

async function toSpreadsheet(files, o = {}) {
  const f = files[0], text = (await f.file.text()).replace(/^\uFEFF/, '');
  const [{ workbookFrom }, X, N, CSV] = await Promise.all([import('../../tables/js/io/build.js'), import('../../tables/js/io/xlsx.js'),
    import('../../tables/js/io/native.js'), import('../../tables/js/io/csv.js')]);
  const wb = workbookFrom(text);
  const fmt = o.format || 'xlsx', name = `${stem(f.name)}.${fmt}`;
  const blob = fmt === 'stab' ? N.toBlob(wb) : fmt === 'csv' ? new Blob([CSV.toCsv(wb.sheets[0])], { type: 'text/csv' }) : await X.toXlsx(wb);
  const out = [{ name, blob, kind: fmt }];
  out.info = `${wb.sheets.length} sheet${wb.sheets.length === 1 ? '' : 's'}: ${wb.sheets.map((s) => s.name).join(', ')}.`;
  return out;
}

export const CREATE_TABLES = register([
  { id: 'table-data-to-spreadsheet', label: 'Table data to spreadsheet', group: 'Create', from: ['json', 'csv', 'txt'], mode: 'each', ext: 'xlsx',
    description: 'Make a spreadsheet with Slop Tables from rows of values and formulas. Save the data to Slop Drive first (e.g. table.json: '
      + '{ "sheets": [{ "name": "Sales", "rows": [["Item", "Qty"], ["Tea", 2], ["Total", "=SUM(B2:B2)"]] }] }, or a CSV), then run this on it.',
    keywords: ['spreadsheet', 'excel', 'xlsx', 'table', 'sheet', 'workbook', 'create', 'make', 'generate', 'data', 'csv'],
    options: [{ key: 'format', type: 'select', label: 'Make', value: 'xlsx', options: [['xlsx', 'Excel (.xlsx)'], ['stab', 'Slop Tables (.stab)'], ['csv', 'CSV (first sheet)']] }],
    run: toSpreadsheet },
], { app: 'tables', label: 'Slop Tables' });
