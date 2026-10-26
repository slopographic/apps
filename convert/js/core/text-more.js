/* More text and data conversions, added to CONVERSIONS in catalog.js (pure work in the modules named):
 *   html-to-md                          HTML to Markdown (html-md.js)
 *   csv-to-md, csv-to-html, csv-separator   a CSV table as a Markdown or HTML table, or with another separator (TSV)
 *                                       (csv.js reads and writes it, table-out.js draws the tables)
 *   jsonl-to-json, json-to-jsonl        JSON Lines both ways (jsonl.js)
 *   text-to-utf8                        text in an old encoding rewritten as UTF-8 (encoding.js)
 *   epub-to-txt, epub-to-md, epub-to-html   EPUB books (epub.js)
 *   ass-to-srt, ass-to-vtt, sbv-to-srt  more subtitle formats (subs-more.js)
 * Exports TEXT_MORE, TO_UTF8 (kept apart: the catalog puts it last) and DELIM (the Separator option the catalog's CSV conversions share). */
import { parseCsv, rowsToCsv } from './csv.js';
import { rowsToMarkdown, rowsToHtml } from './table-out.js';
import { htmlToMarkdown } from './html-md.js';
import { jsonlToJson, jsonToJsonl } from './jsonl.js';
import { toUtf8, ENCODINGS, encodingLabel } from './encoding.js';
import { readEpub, epubToText, epubToMarkdown, epubToHtml } from './epub.js';
import { parseAss, parseSbv, subsTo } from './subs-more.js';
import { decodeText, EOLS } from './text.js';
import { TEXT_KINDS } from './detect.js';
import { INDENT, SHIFT } from './data-more.js';
import { stemOf as base } from '../io/files.js';
import { tr } from './i18n.js';
/** A select choice [value, label] whose label is read in the current language. */
const ch = (v, label) => Object.defineProperty([v], 1, { get: label, enumerable: true });
/** A copy of an option with its getters kept (a spread would read the label once, in the language of that moment). */
const like = (o, more) => Object.defineProperties(Object.defineProperties({}, Object.getOwnPropertyDescriptors(o)), Object.getOwnPropertyDescriptors(more));

const textOf = async (f) => decodeText(new Uint8Array(await f.file.arrayBuffer()));
const out = (name, data, type) => ({ name, blob: new Blob([data], { type }) });
const extOf = (name) => (/\.([^.]+)$/.exec(String(name)) || [, 'txt'])[1].toLowerCase();

export const DELIM = { key: 'delimiter', type: 'select', get label() { return tr('convert.text.separator', 'Separator'); }, value: 'auto', options: [ch('auto', () => tr('convert.text.detect', 'Detect')), ch(',', () => tr('convert.text.comma', 'Comma')), ch(';', () => tr('convert.text.semicolon', 'Semicolon')), ch('\t', () => tr('convert.text.tab', 'Tab')), ch('|', () => tr('convert.text.pipe', 'Pipe'))] };
const HEADER = { key: 'header', type: 'checkbox', get label() { return tr('convert.text.first_row_has_column_names', 'First row has column names'); }, value: true };
const rowsOf = async (f, o) => parseCsv(await textOf(f), { delimiter: o.delimiter && o.delimiter !== 'auto' ? o.delimiter : undefined });
const SEP_NAME = { ',': 'comma', ';': 'semicolon', '|': 'pipe' };

async function csvSeparator(files, o = {}) {
  const f = files[0], to = o.to ?? '\t';
  const text = rowsToCsv(await rowsOf(f, o), { delimiter: to, eol: EOLS[o.eol] || '\n' });
  return [{ ...out(to === '\t' ? `${base(f.name)}.tsv` : `${base(f.name)}-${SEP_NAME[to] || 'new'}.csv`, text, to === '\t' ? 'text/tab-separated-values' : 'text/csv'), kind: 'csv' }];
}

async function toUtf8Run(files, o = {}) {
  const f = files[0], bytes = new Uint8Array(await f.file.arrayBuffer());
  const r = toUtf8(bytes, { from: o.from, bom: !!o.bom });
  const res = [{ ...out(`${base(f.name)}-utf8.${extOf(f.name)}`, r.text, 'text/plain;charset=utf-8'), kind: f.kind }];
  const enc = { enc: encodingLabel(r.from) };
  if (!o.from || o.from === 'auto') res.info = tr('convert.text.read_as_detected', 'Read as {enc} (detected), saved as UTF-8.', enc);
  else res.info = tr('convert.text.read_as', 'Read as {enc}, saved as UTF-8.', enc);
  return res;
}

const book = async (f) => readEpub(f.file);
const subs = (parse, to) => async (files, o = {}) => {
  const f = files[0];
  return [out(`${base(f.name)}.${to}`, subsTo(parse(await textOf(f)), to, o), to === 'vtt' ? 'text/vtt' : 'application/x-subrip')];
};
const EPUB_NOTE = () => tr('convert.text.epub_note', 'DRM-free books only. Pictures become their alt text (in HTML they are kept). Page layout and fonts are not kept.');

export const TEXT_MORE = [
  { id: 'html-to-md', get label() { return tr('convert.text.html_to_markdown', 'HTML to Markdown'); }, group: 'Text', from: ['html'], ext: 'md', mode: 'each', keywords: ['markdown', 'md', 'web page'], options: [], // i18n-ignore: group is an id (groupLabel)
    run: async (files) => [out(`${base(files[0].name)}.md`, htmlToMarkdown(await textOf(files[0])), 'text/markdown')] },
  { id: 'csv-to-md', get label() { return tr('convert.text.csv_to_markdown_table', 'CSV to Markdown table'); }, group: 'Data', from: ['csv'], ext: 'md', mode: 'each', keywords: ['markdown', 'table', 'github'], // i18n-ignore: group is an id (groupLabel)
    options: [DELIM, HEADER, { key: 'align', type: 'checkbox', get label() { return tr('convert.text.right_align_columns_of_numbers', 'Right-align columns of numbers'); }, value: true }],
    run: async (files, o = {}) => [out(`${base(files[0].name)}.md`, rowsToMarkdown(await rowsOf(files[0], o), { header: o.header !== false, align: o.align === false ? 'none' : 'auto' }), 'text/markdown')] },
  { id: 'csv-to-html', get label() { return tr('convert.text.csv_to_html_table', 'CSV to HTML table'); }, group: 'Data', from: ['csv'], ext: 'html', mode: 'each', keywords: ['table', 'web page'], // i18n-ignore: group is an id (groupLabel)
    options: [DELIM, HEADER, { key: 'standalone', type: 'checkbox', get label() { return tr('convert.text.full_web_page_not_just_the', 'Full web page (not just the table)'); }, value: true }],
    run: async (files, o = {}) => [out(`${base(files[0].name)}.html`, rowsToHtml(await rowsOf(files[0], o), { header: o.header !== false, standalone: o.standalone !== false, title: base(files[0].name) }), 'text/html')] },
  { id: 'csv-separator', get label() { return tr('convert.text.change_csv_separator_or_tsv', 'Change CSV separator (or TSV)'); }, group: 'Data', from: ['csv'], ext: 'csv', mode: 'each', keywords: ['tsv', 'tab', 'semicolon', 'delimiter', 'comma'], // i18n-ignore: group is an id (groupLabel)
    options: [like(DELIM, { get label() { return tr('convert.text.separator_in_the_file', 'Separator in the file'); } }),
      { key: 'to', type: 'select', get label() { return tr('convert.text.new_separator', 'New separator'); }, value: '\t', options: [ch('\t', () => tr('convert.text.tab_tsv', 'Tab (TSV)')), ch(',', () => tr('convert.text.comma', 'Comma')), ch(';', () => tr('convert.text.semicolon', 'Semicolon')), ch('|', () => tr('convert.text.pipe', 'Pipe'))] },
      { key: 'eol', type: 'select', get label() { return tr('convert.text.line_endings', 'Line endings'); }, value: 'lf', options: [ch('lf', () => tr('convert.text.lf_mac_linux', 'LF (Mac, Linux)')), ch('crlf', () => tr('convert.text.crlf_windows', 'CRLF (Windows)'))] }],
    run: csvSeparator },
  { id: 'jsonl-to-json', get label() { return tr('convert.text.json_lines_to_json', 'JSON Lines to JSON'); }, group: 'Data', from: ['jsonl'], ext: 'json', mode: 'each', keywords: ['ndjson', 'jsonl', 'array'], options: [INDENT], // i18n-ignore: group is an id (groupLabel)
    run: async (files, o = {}) => [out(`${base(files[0].name)}.json`, jsonlToJson(await textOf(files[0]), o), 'application/json')] },
  { id: 'json-to-jsonl', get label() { return tr('convert.text.json_to_json_lines', 'JSON to JSON Lines'); }, group: 'Data', from: ['json'], ext: 'jsonl', mode: 'each', keywords: ['ndjson', 'jsonl', 'lines'], options: [], // i18n-ignore: group is an id (groupLabel)
    run: async (files) => { const r = jsonToJsonl(await textOf(files[0])); const res = [out(`${base(files[0].name)}.jsonl`, r.text, 'application/x-ndjson')]; res.info = `${r.count} line${r.count === 1 ? '' : 's'}.`; return res; } },
  { id: 'epub-to-txt', get label() { return tr('convert.text.epub_to_text', 'EPUB to text'); }, group: 'Documents', from: ['epub'], ext: 'txt', mode: 'each', keywords: ['ebook', 'book', 'txt'], get note() { return EPUB_NOTE(); }, options: [], // i18n-ignore: group is an id (groupLabel)
    run: async (files) => [out(`${base(files[0].name)}.txt`, epubToText(await book(files[0])), 'text/plain')] },
  { id: 'epub-to-md', get label() { return tr('convert.text.epub_to_markdown', 'EPUB to Markdown'); }, group: 'Documents', from: ['epub'], ext: 'md', mode: 'each', keywords: ['ebook', 'book', 'markdown'], get note() { return EPUB_NOTE(); }, options: [], // i18n-ignore: group is an id (groupLabel)
    run: async (files) => [out(`${base(files[0].name)}.md`, epubToMarkdown(await book(files[0])), 'text/markdown')] },
  { id: 'epub-to-html', get label() { return tr('convert.text.epub_to_html', 'EPUB to HTML'); }, group: 'Documents', from: ['epub'], ext: 'html', mode: 'each', keywords: ['ebook', 'book', 'web page'], get note() { return EPUB_NOTE(); }, options: [], // i18n-ignore: group is an id (groupLabel)
    run: async (files) => [out(`${base(files[0].name)}.html`, epubToHtml(await book(files[0])), 'text/html')] },
  { id: 'ass-to-srt', get label() { return tr('convert.text.ass_ssa_to_srt', 'ASS/SSA to SRT'); }, group: 'Subtitles', from: ['ass'], ext: 'srt', mode: 'each', keywords: ['subtitles', 'aegisub', 'subrip', 'anime'], options: [SHIFT], run: subs(parseAss, 'srt') }, // i18n-ignore: group is an id (groupLabel)
  { id: 'ass-to-vtt', get label() { return tr('convert.text.ass_ssa_to_vtt', 'ASS/SSA to VTT'); }, group: 'Subtitles', from: ['ass'], ext: 'vtt', mode: 'each', keywords: ['subtitles', 'aegisub', 'webvtt'], options: [SHIFT], run: subs(parseAss, 'vtt') }, // i18n-ignore: group is an id (groupLabel)
  { id: 'sbv-to-srt', get label() { return tr('convert.text.sbv_youtube_to_srt', 'SBV (YouTube) to SRT'); }, group: 'Subtitles', from: ['sbv'], ext: 'srt', mode: 'each', keywords: ['subtitles', 'youtube', 'captions'], options: [SHIFT], run: subs(parseSbv, 'srt') }, // i18n-ignore: group is an id (groupLabel)
];

// Last in the catalog, so it is never the first (default) choice for a kind
export const TO_UTF8 = { id: 'text-to-utf8', get label() { return tr('convert.text.text_encoding_to_utf_8', 'Text encoding to UTF-8'); }, group: 'Text', from: TEXT_KINDS, ext: 'txt', mode: 'each', keywords: ['encoding', 'charset', 'ansi', 'latin-1', 'windows-1252', 'mojibake', 'utf8'], // i18n-ignore: group is an id (groupLabel)
  options: [{ key: 'from', type: 'select', get label() { return tr('convert.text.the_file_s_encoding', 'The file’s encoding'); }, value: 'auto', options: ENCODINGS, get hint() { return tr('convert.text.detect_reads_utf_8_and_utf', 'Detect reads UTF-8 and UTF-16, and takes anything else as Western (Windows-1252). Choose the encoding when the letters still look wrong.'); } },
    { key: 'bom', type: 'checkbox', get label() { return tr('convert.text.mark_the_file_as_utf_8', 'Mark the file as UTF-8 (for Excel and Notepad)'); }, value: false }],
  run: toUtf8Run };
