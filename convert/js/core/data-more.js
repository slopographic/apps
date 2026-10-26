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
import { tr } from './i18n.js';
/** A select choice [value, label] whose label is read in the current language. */
const ch = (v, label) => Object.defineProperty([v], 1, { get: label, enumerable: true });
/** A copy of an option with its getters kept (a spread would read the label once, in the language of that moment). */
const like = (o, more) => Object.defineProperties(Object.defineProperties({}, Object.getOwnPropertyDescriptors(o)), Object.getOwnPropertyDescriptors(more));

const textOf = async (f) => decodeText(new Uint8Array(await f.file.arrayBuffer()));
const out = (name, data, type) => ({ name, blob: new Blob([data], { type }) });
const safe = (s) => String(s).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Sheet'; // i18n-ignore: a file name

/** The workbook's sheets, the first or all of them (those with any cell). */
async function sheetsOf(f, which) {
  const book = await read(f.file, { name: f.name });
  const all = book.sheets.filter((s) => s.height > 0);
  if (!all.length) throw new Error(tr('convert.data.no_cells', 'This workbook has no cells with anything in them.'));
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
  if (r && r.dropped) res.info = tr('convert.data.nulls_dropped', ['{n} empty (null) values were left out: TOML has no null.', '{n} empty (null) value was left out: TOML has no null.'], { n: r.dropped });
  return res;
};

const SHEET = { key: 'sheet', type: 'select', get label() { return tr('convert.data.sheets', 'Sheets'); }, value: 'first', options: [ch('first', () => tr('convert.data.the_first_sheet', 'The first sheet')), ch('all', () => tr('convert.data.every_sheet', 'Every sheet'))], get hint() { return tr('convert.data.every_sheet_one_csv_file_per', 'Every sheet: one CSV file per sheet, or one JSON object with a key per sheet.'); } };
export const INDENT = { key: 'indent', type: 'select', get label() { return tr('convert.data.indent', 'Indent'); }, value: '2', options: [ch('2', () => tr('convert.data.2_spaces', '2 spaces')), ch('4', () => tr('convert.data.4_spaces', '4 spaces')), ch('tab', () => tr('convert.data.tabs', 'Tabs')), ch('0', () => tr('convert.data.none_minified_one_line', 'None (minified, one line)'))] };
export const SHIFT = { key: 'shift', type: 'number', get label() { return tr('convert.data.shift_the_timing_seconds', 'Shift the timing (seconds)'); }, min: -36000, max: 36000, step: 0.001, value: 0, get hint() { return tr('convert.data.a_positive_number_shows_every_subtitle', 'A positive number shows every subtitle later, a negative one earlier. 0 keeps the timing.'); } };
const SHEETS_KW = ['excel', 'spreadsheet', 'sheet'];

export const DATA_MORE = [
  { id: 'xlsx-to-csv', get label() { return tr('convert.data.spreadsheet_to_csv', 'Spreadsheet to CSV'); }, group: 'Data', from: ['xlsx', 'ods'], ext: 'csv', mode: 'each', keywords: [...SHEETS_KW, 'xlsx', 'ods'], options: [SHEET, // i18n-ignore: group is an id (groupLabel)
    { key: 'delimiter', type: 'select', get label() { return tr('convert.data.separator', 'Separator'); }, value: ',', options: [ch(',', () => tr('convert.data.comma', 'Comma')), ch(';', () => tr('convert.data.semicolon', 'Semicolon')), ch('tab', () => tr('convert.data.tab', 'Tab'))] },
    { key: 'bom', type: 'checkbox', get label() { return tr('convert.data.mark_the_file_as_utf_8', 'Mark the file as UTF-8 (for Excel)'); }, value: true }], run: sheetToCsv },
  { id: 'xlsx-to-json', get label() { return tr('convert.data.spreadsheet_to_json', 'Spreadsheet to JSON'); }, group: 'Data', from: ['xlsx', 'ods'], ext: 'json', mode: 'each', keywords: [...SHEETS_KW, 'xlsx', 'ods'], options: [SHEET, // i18n-ignore: group is an id (groupLabel)
    { key: 'header', type: 'checkbox', get label() { return tr('convert.data.first_row_has_column_names', 'First row has column names'); }, value: true, get hint() { return tr('convert.data.on_one_object_per_row_off', 'On: one object per row. Off: one array per row.'); } }], run: sheetToJson },
  { id: 'ods-to-xlsx', get label() { return tr('convert.data.ods_to_xlsx', 'ODS to XLSX'); }, group: 'Data', from: ['ods'], ext: 'xlsx', mode: 'each', keywords: ['excel', 'libreoffice', 'openoffice'], options: [], run: odsToXlsx }, // i18n-ignore: group is an id (groupLabel)
  { id: 'json-to-xlsx', get label() { return tr('convert.data.json_to_xlsx', 'JSON to XLSX'); }, group: 'Data', from: ['json'], ext: 'xlsx', mode: 'each', keywords: ['excel', 'spreadsheet'], options: [], run: jsonToXlsx }, // i18n-ignore: group is an id (groupLabel)
  { id: 'json-to-yaml', get label() { return tr('convert.data.json_to_yaml', 'JSON to YAML'); }, group: 'Data', from: ['json'], ext: 'yaml', mode: 'each', keywords: ['yml'], options: [], run: text((t) => jsonToYaml(t), 'yaml', 'application/yaml') }, // i18n-ignore: group is an id (groupLabel)
  { id: 'yaml-to-json', get label() { return tr('convert.data.yaml_to_json', 'YAML to JSON'); }, group: 'Data', from: ['yaml'], ext: 'json', mode: 'each', keywords: ['yml'], options: [INDENT], run: text((t, o) => yamlToJson(t, o), 'json', 'application/json') }, // i18n-ignore: group is an id (groupLabel)
  { id: 'json-to-toml', get label() { return tr('convert.data.json_to_toml', 'JSON to TOML'); }, group: 'Data', from: ['json'], ext: 'toml', mode: 'each', keywords: ['config'], options: [], run: text((t) => jsonToToml(t), 'toml', 'application/toml') }, // i18n-ignore: group is an id (groupLabel)
  { id: 'toml-to-json', get label() { return tr('convert.data.toml_to_json', 'TOML to JSON'); }, group: 'Data', from: ['toml'], ext: 'json', mode: 'each', keywords: ['config'], options: [INDENT], run: text((t, o) => tomlToJson(t, o), 'json', 'application/json') }, // i18n-ignore: group is an id (groupLabel)
  { id: 'json-to-xml', get label() { return tr('convert.data.json_to_xml', 'JSON to XML'); }, group: 'Data', from: ['json'], ext: 'xml', mode: 'each', options: [{ key: 'root', type: 'text', get label() { return tr('convert.data.root_element_name', 'Root element name'); }, value: 'root', placeholder: 'root' }], run: text((t, o) => jsonToXml(t, o), 'xml', 'application/xml') }, // i18n-ignore: group is an id (groupLabel)
  { id: 'json-format', get label() { return tr('convert.data.format_json_pretty_or_minified', 'Format JSON (pretty or minified)'); }, group: 'Data', from: ['json'], ext: 'json', mode: 'each', keywords: ['beautify', 'pretty', 'minify', 'validate'], options: [INDENT], // i18n-ignore: group is an id (groupLabel)
    run: async (files, o = {}) => { const f = files[0]; return [out(`${base(f.name)}-${o.indent === '0' ? 'min' : 'pretty'}.json`, formatJson(await textOf(f), o), 'application/json')]; } },
  { id: 'srt-to-vtt', get label() { return tr('convert.data.srt_to_vtt', 'SRT to VTT'); }, group: 'Subtitles', from: ['srt'], ext: 'vtt', mode: 'each', keywords: ['subtitles', 'webvtt', 'captions'], options: [SHIFT], run: text((t, o) => convertSubs(t, 'vtt', o), 'vtt', 'text/vtt') }, // i18n-ignore: group is an id (groupLabel)
  { id: 'vtt-to-srt', get label() { return tr('convert.data.vtt_to_srt', 'VTT to SRT'); }, group: 'Subtitles', from: ['vtt'], ext: 'srt', mode: 'each', keywords: ['subtitles', 'subrip', 'captions'], options: [SHIFT], run: text((t, o) => convertSubs(t, 'srt', o), 'srt', 'application/x-subrip') }, // i18n-ignore: group is an id (groupLabel)
  { id: 'subs-shift', get label() { return tr('convert.data.shift_subtitle_timing', 'Shift subtitle timing'); }, group: 'Subtitles', from: ['srt', 'vtt'], ext: 'srt', mode: 'each', keywords: ['sync', 'delay', 'offset', 'subtitles'], options: [like(SHIFT, { value: 1 })], // i18n-ignore: group is an id (groupLabel)
    run: async (files, o = {}) => {
      const f = files[0], vtt = f.kind === 'vtt';
      return [out(`${base(f.name)}-shifted.${vtt ? 'vtt' : 'srt'}`, convertSubs(await textOf(f), vtt ? 'vtt' : 'srt', o), vtt ? 'text/vtt' : 'application/x-subrip')];
    } },
];
