/* More data and text conversions, added to CONVERSIONS in catalog.js:
 *   xlsx-to-csv, xlsx-to-json, ods-to-xlsx, json-to-xlsx   spreadsheets, read by the shared reader (shared/sheets/read.js, the
 *                                      one Slop Tables and the vCard conversions use) and written by the shared writer
 *                                      (shared/sheets/write.js); the JSON side is sheet-json.js
 *   json-to-yaml, yaml-to-json, json-to-toml, toml-to-json, json-to-xml, json-format   structured.js
 *   srt-to-vtt, vtt-to-srt, subs-shift  subtitles.js
 * Exports DATA_MORE. */
import { read } from '../../../shared/sheets/read.js';
import { csvBlob } from '../../../shared/sheets/csv.js';
import { toXlsxBlob, exportSheet } from '../../../shared/sheets/write.js';
import { sheetRecords, tablesFromJson, workbookOf } from './sheet-json.js';
import { parseJson, formatJson, jsonToYaml, yamlToJson, jsonToToml, tomlToJson, jsonToXml } from './structured.js';
import { convertSubs } from './subtitles.js';
import { decodeText } from './text.js';
import { stemOf as base } from '../io/files.js';

const textOf = async (f) => decodeText(new Uint8Array(await f.file.arrayBuffer()));
const out = (name, data, type) => ({ name, blob: new Blob([data], { type }) });
const safe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Sheet';

/** The workbook's sheets, the first or all of them (those with any cell). */
async function sheetsOf(f, which) {
  const book = await read(f.file, { name: f.name });
  const all = book.sheets.filter((s) => s.height > 0);
  if (!all.length) throw new Error('This workbook has no cells with anything in them.');
  return which === 'all' ? all : all.slice(0, 1);
}

async function sheetToCsv(files, o = {}) {
  const f = files[0], sheets = await sheetsOf(f, o.sheet);
  const delim = o.delimiter === 'tab' ? '\t' : o.delimiter || ',';
  const many = sheets.length > 1;
  return sheets.map((s) => ({ name: many ? `${base(f.name)} - ${safe(s.name)}.csv` : `${base(f.name)}.csv`, blob: csvBlob(s, null, delim, { bom: o.bom !== false }) }));
}
async function sheetToJson(files, o = {}) {
  const f = files[0], sheets = await sheetsOf(f, o.sheet);
  const header = o.header !== false;
  const value = o.sheet === 'all' ? Object.fromEntries(sheets.map((s) => [s.name, sheetRecords(s, { header })])) : sheetRecords(sheets[0], { header });
  return [out(`${base(f.name)}.json`, JSON.stringify(value, null, 2) + '\n', 'application/json')];
}
async function odsToXlsx(files) {
  const f = files[0], book = await read(f.file, { name: f.name });
  return [{ name: `${base(f.name)}.xlsx`, blob: await toXlsxBlob(book.sheets.map((s) => exportSheet(s))) }];
}
async function jsonToXlsx(files) {
  const f = files[0], tables = tablesFromJson(parseJson(await textOf(f)));
  const r = [{ name: `${base(f.name)}.xlsx`, blob: await toXlsxBlob(workbookOf(tables)) }];
  r.preview = tables[0].rows.slice(0, 400).map((row) => row.map((v) => (v === null ? '' : String(v))).join('\t')).join('\n');   // the after panel
  return r;
}

const text = (fn, ext, type) => async (files, o = {}) => {
  const f = files[0], r = await fn(await textOf(f), o);
  const res = [out(`${base(f.name)}.${ext}`, typeof r === 'string' ? r : r.text, type)];
  if (r && r.dropped) res.info = `${r.dropped} empty (null) value${r.dropped === 1 ? ' was' : 's were'} left out: TOML has no null.`;
  return res;
};

const SHEET = { key: 'sheet', type: 'select', label: 'Sheets', value: 'first', options: [['first', 'The first sheet'], ['all', 'Every sheet']], hint: 'Every sheet: one CSV file per sheet, or one JSON object with a key per sheet.' };
export const INDENT = { key: 'indent', type: 'select', label: 'Indent', value: '2', options: [['2', '2 spaces'], ['4', '4 spaces'], ['tab', 'Tabs'], ['0', 'None (minified, one line)']] };
export const SHIFT = { key: 'shift', type: 'number', label: 'Shift the timing (seconds)', min: -36000, max: 36000, step: 0.001, value: 0, hint: 'A positive number shows every subtitle later, a negative one earlier. 0 keeps the timing.' };
const SHEETS_KW = ['excel', 'spreadsheet', 'sheet'];

export const DATA_MORE = [
  { id: 'xlsx-to-csv', label: 'Spreadsheet to CSV', group: 'Data', from: ['xlsx', 'ods'], ext: 'csv', mode: 'each', keywords: [...SHEETS_KW, 'xlsx', 'ods'], options: [SHEET,
    { key: 'delimiter', type: 'select', label: 'Separator', value: ',', options: [[',', 'Comma'], [';', 'Semicolon'], ['tab', 'Tab']] },
    { key: 'bom', type: 'checkbox', label: 'Mark the file as UTF-8 (for Excel)', value: true }], run: sheetToCsv },
  { id: 'xlsx-to-json', label: 'Spreadsheet to JSON', group: 'Data', from: ['xlsx', 'ods'], ext: 'json', mode: 'each', keywords: [...SHEETS_KW, 'xlsx', 'ods'], options: [SHEET,
    { key: 'header', type: 'checkbox', label: 'First row has column names', value: true, hint: 'On: one object per row. Off: one array per row.' }], run: sheetToJson },
  { id: 'ods-to-xlsx', label: 'ODS to XLSX', group: 'Data', from: ['ods'], ext: 'xlsx', mode: 'each', keywords: ['excel', 'libreoffice', 'openoffice'], options: [], run: odsToXlsx },
  { id: 'json-to-xlsx', label: 'JSON to XLSX', group: 'Data', from: ['json'], ext: 'xlsx', mode: 'each', keywords: ['excel', 'spreadsheet'], options: [], run: jsonToXlsx },
  { id: 'json-to-yaml', label: 'JSON to YAML', group: 'Data', from: ['json'], ext: 'yaml', mode: 'each', keywords: ['yml'], options: [], run: text((t) => jsonToYaml(t), 'yaml', 'application/yaml') },
  { id: 'yaml-to-json', label: 'YAML to JSON', group: 'Data', from: ['yaml'], ext: 'json', mode: 'each', keywords: ['yml'], options: [INDENT], run: text((t, o) => yamlToJson(t, o), 'json', 'application/json') },
  { id: 'json-to-toml', label: 'JSON to TOML', group: 'Data', from: ['json'], ext: 'toml', mode: 'each', keywords: ['config'], options: [], run: text((t) => jsonToToml(t), 'toml', 'application/toml') },
  { id: 'toml-to-json', label: 'TOML to JSON', group: 'Data', from: ['toml'], ext: 'json', mode: 'each', keywords: ['config'], options: [INDENT], run: text((t, o) => tomlToJson(t, o), 'json', 'application/json') },
  { id: 'json-to-xml', label: 'JSON to XML', group: 'Data', from: ['json'], ext: 'xml', mode: 'each', options: [{ key: 'root', type: 'text', label: 'Root element name', value: 'root', placeholder: 'root' }], run: text((t, o) => jsonToXml(t, o), 'xml', 'application/xml') },
  { id: 'json-format', label: 'Format JSON (pretty or minified)', group: 'Data', from: ['json'], ext: 'json', mode: 'each', keywords: ['beautify', 'pretty', 'minify', 'validate'], options: [INDENT],
    run: async (files, o = {}) => { const f = files[0]; return [out(`${base(f.name)}-${o.indent === '0' ? 'min' : 'pretty'}.json`, formatJson(await textOf(f), o), 'application/json')]; } },
  { id: 'srt-to-vtt', label: 'SRT to VTT', group: 'Subtitles', from: ['srt'], ext: 'vtt', mode: 'each', keywords: ['subtitles', 'webvtt', 'captions'], options: [SHIFT], run: text((t, o) => convertSubs(t, 'vtt', o), 'vtt', 'text/vtt') },
  { id: 'vtt-to-srt', label: 'VTT to SRT', group: 'Subtitles', from: ['vtt'], ext: 'srt', mode: 'each', keywords: ['subtitles', 'subrip', 'captions'], options: [SHIFT], run: text((t, o) => convertSubs(t, 'srt', o), 'srt', 'application/x-subrip') },
  { id: 'subs-shift', label: 'Shift subtitle timing', group: 'Subtitles', from: ['srt', 'vtt'], ext: 'srt', mode: 'each', keywords: ['sync', 'delay', 'offset', 'subtitles'], options: [{ ...SHIFT, value: 1 }],
    run: async (files, o = {}) => {
      const f = files[0], vtt = f.kind === 'vtt';
      return [out(`${base(f.name)}-shifted.${vtt ? 'vtt' : 'srt'}`, convertSubs(await textOf(f), vtt ? 'vtt' : 'srt', o), vtt ? 'text/vtt' : 'application/x-subrip')];
    } },
];
