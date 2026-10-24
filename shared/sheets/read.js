/* Slop Sheets: the reader. read(file) takes a File, Blob, ArrayBuffer or Uint8Array and resolves with
 *   { name, format: 'xlsx' | 'ods' | 'csv' | 'tsv', sheets: [{ name, rows, text, width, height, fmt, bold, … }], skipped }
 * Formats: .xlsx and .xlsm (by their zip signature), .ods (a zip with content.xml), .csv and .tsv (RFC 4180; a file with
 * no name hint is sniffed for tabs). Not supported: .xls (the old binary format), which rejects with a clear message.
 * XLSX and ODS sheets also carry what an editor needs (formulas, italic, cols, heights, merges, freeze, charts: see
 * buildSheet in xlsx.js), and skipped lists what the file holds that is not read (pictures, macros, …; [] for CSV).
 * Node-safe: the DOM is only touched inside the XML parser, which runs in the browser and in the node test shim. */
import { readXlsx } from './xlsx.js';
import { readOds } from './ods.js';
import { readZip } from '../office/zip.js';
import { decodeText, parseDelimited, sheetFromGrid } from './csv.js';

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const startsWith = (u8, sig) => sig.every((b, i) => u8[i] === b);

export const UNSUPPORTED = 'Old .xls files are not supported. Open the file in Excel or LibreOffice and save it as .xlsx, .ods or .csv.';

/** The name without its extension, for a sheet or a document title. */
export const baseName = (name = '') => String(name).replace(/\.[^.]*$/, '') || 'Untitled';

async function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  if (input && typeof input.arrayBuffer === 'function') return new Uint8Array(await input.arrayBuffer());
  throw new TypeError('read() expects a File, Blob, ArrayBuffer or Uint8Array');
}

export async function read(input, { name = input && input.name ? input.name : '' } = {}) {
  const u8 = await toBytes(input);
  const ext = (/\.([a-z0-9]+)$/i.exec(name) || [, ''])[1].toLowerCase();
  if (startsWith(u8, OLE) || ext === 'xls' && !startsWith(u8, ZIP)) throw new Error(UNSUPPORTED);
  if (ext === 'ods' && !startsWith(u8, ZIP)) throw new Error('This .ods file is not a valid spreadsheet (it is not a zip package).');
  if (startsWith(u8, ZIP)) {
    const files = await readZip(u8);
    const ods = files.has('content.xml') && !files.has('xl/workbook.xml');
    const { sheets, skipped } = ods ? readOds(files) : await readXlsx(files);
    return { name: baseName(name), format: ods ? 'ods' : 'xlsx', sheets, skipped };
  }
  if (['xlsx', 'xlsm'].includes(ext)) throw new Error('This .xlsx file is not a valid workbook (it is not a zip package).');
  const text = decodeText(u8);
  const delim = ext === 'tsv' || (ext !== 'csv' && sniffTab(text)) ? '\t' : ',';
  const grid = parseDelimited(text, delim);
  return { name: baseName(name), format: delim === '\t' ? 'tsv' : 'csv', sheets: [sheetFromGrid(baseName(name) || 'Sheet1', grid)], skipped: [] };
}

/** A file with no extension: tabs in the first line and no commas there means TSV. */
function sniffTab(text) {
  const firstLine = text.split(/\r\n|\n|\r/, 1)[0];
  return firstLine.includes('\t') && !firstLine.includes(',');
}
