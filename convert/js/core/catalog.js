/* The conversion catalogue. Each entry says which file kinds it takes ('*' = any), its options, and a
 * run(files, options) that returns [{ name, blob }]. mode 'each' runs once per file, 'combine' once for
 * all files together. Pure orchestration: the work is done by the modules it imports. */
import { convertImage, imageForPdf } from './image.js';
import { imagesToPdf } from './pdf-images.js';
import { pdfToImages } from './pdf-raster.js';
import { mergePdfs, extractPages, splitPages } from './pdf-ops.js';
import { csvToJson, jsonToCsv, parseCsv } from './csv.js';
import { rowsToXlsx } from './xlsx.js';
import { markdownToHtml } from './markdown.js';
import { htmlToText } from './html-text.js';
import { bytesToBase64, base64ToBytes, urlEncode, urlDecode, setLineEndings, decodeText, EOLS } from './text.js';
import { detectKind, EXT_OF_KIND } from './detect.js';

const IMAGE = ['png', 'jpg', 'webp', 'bmp', 'gif', 'svg'];
const base = (name) => String(name).replace(/\.[^.]+$/, '') || 'file';
const SIZE = [
  { key: 'width', type: 'number', label: 'Width (px)', min: 1, max: 10000, hint: 'Leave blank to keep the original size. Height follows the proportions.' },
  { key: 'height', type: 'number', label: 'Height (px)', min: 1, max: 10000 },
];
const QUALITY = { key: 'quality', type: 'range', label: 'Quality', min: 10, max: 100, value: 90 };
const BACKGROUND = { key: 'background', type: 'color', label: 'Background for transparency', value: '#ffffff' };
const DELIM = { key: 'delimiter', type: 'select', label: 'Separator', value: 'auto', options: [['auto', 'Detect'], [',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab'], ['|', 'Pipe']] };
const EOL = { key: 'eol', type: 'select', label: 'Line endings', value: 'lf', options: [['lf', 'LF (Mac, Linux)'], ['crlf', 'CRLF (Windows)'], ['cr', 'CR (old Mac)']] };

function imageTo(to) {
  return async (files, o) => {
    const f = files[0];
    const r = await convertImage(f.file, { kind: f.kind, to, width: o.width, height: o.height, quality: (o.quality ?? 90) / 100, background: o.background, icoSize: o.icoSize });
    return [{ name: `${base(f.name)}.${r.ext}`, blob: r.blob }];
  };
}
const text = (blob) => blob.text();
const out = (name, data, type) => ({ name, blob: new Blob([data], { type }) });

export const CONVERSIONS = [
  { id: 'to-png', label: 'To PNG', group: 'Images', from: ['jpg', 'webp', 'bmp', 'gif', 'svg'], ext: 'png', mode: 'each', options: [...SIZE], run: imageTo('png') },
  { id: 'to-jpg', label: 'To JPG', group: 'Images', from: ['png', 'webp', 'bmp', 'gif', 'svg'], ext: 'jpg', mode: 'each', options: [...SIZE, QUALITY, BACKGROUND], run: imageTo('jpg') },
  { id: 'to-webp', label: 'To WebP', group: 'Images', from: ['png', 'jpg', 'bmp', 'gif', 'svg'], ext: 'webp', mode: 'each', options: [...SIZE, QUALITY], run: imageTo('webp') },
  { id: 'to-bmp', label: 'To BMP', group: 'Images', from: ['png', 'jpg', 'webp', 'gif', 'svg'], ext: 'bmp', mode: 'each', options: [...SIZE, BACKGROUND], run: imageTo('bmp') },
  { id: 'to-ico', label: 'To ICO (icon)', group: 'Images', from: IMAGE, ext: 'ico', mode: 'each', options: [{ key: 'icoSize', type: 'select', label: 'Icon size', value: 256, options: [[16, '16 × 16'], [32, '32 × 32'], [48, '48 × 48'], [64, '64 × 64'], [128, '128 × 128'], [256, '256 × 256']] }, BACKGROUND], run: imageTo('ico') },
  { id: 'images-to-pdf', label: 'Images to PDF', group: 'PDF', from: IMAGE, ext: 'pdf', mode: 'combine', options: [
    { key: 'page', type: 'select', label: 'Page size', value: 'a4', options: [['a4', 'A4'], ['letter', 'US Letter'], ['fit', 'Fit to each image']] },
    { key: 'margin', type: 'select', label: 'Margin', value: 36, options: [[0, 'None'], [18, 'Small (¼ inch)'], [36, 'Normal (½ inch)']] },
  ], run: async (files, o) => {
    const items = [];
    for (const f of files) items.push(await imageForPdf(f.file, f.kind));
    const bytes = await imagesToPdf(items, { page: o.page, margin: Number(o.margin) });
    return [{ name: files.length === 1 ? `${base(files[0].name)}.pdf` : 'images.pdf', blob: new Blob([bytes], { type: 'application/pdf' }) }];
  } },
  { id: 'pdf-to-images', label: 'PDF to images', group: 'PDF', from: ['pdf'], mode: 'each', options: [
    { key: 'format', type: 'select', label: 'Format', value: 'png', options: [['png', 'PNG'], ['jpg', 'JPG']] },
    { key: 'pages', type: 'text', label: 'Pages', placeholder: 'All pages, or e.g. 1-3, 7', hint: 'Blank for every page.' },
    { key: 'scale', type: 'select', label: 'Resolution', value: 2, options: [[1, '72 dpi'], [2, '144 dpi'], [3, '216 dpi']] },
    QUALITY,
  ], run: async (files, o) => {
    const f = files[0];
    const pages = await pdfToImages(new Uint8Array(await f.file.arrayBuffer()), { pages: o.pages, scale: o.scale, format: o.format, quality: (o.quality ?? 92) / 100 });
    return pages.map((p) => ({ name: `${base(f.name)}-page-${p.pageNo}.${o.format === 'jpg' ? 'jpg' : 'png'}`, blob: p.blob }));
  } },
  { id: 'merge-pdf', label: 'Merge PDFs', group: 'PDF', from: ['pdf'], mode: 'combine', options: [], run: async (files) => {
    const bytes = await mergePdfs(await Promise.all(files.map(async (f) => new Uint8Array(await f.file.arrayBuffer()))));
    return [{ name: 'merged.pdf', blob: new Blob([bytes], { type: 'application/pdf' }) }];
  } },
  { id: 'split-pdf', label: 'Split PDF', group: 'PDF', from: ['pdf'], mode: 'each', options: [
    { key: 'pages', type: 'text', label: 'Pages to extract', placeholder: 'Blank: one file per page', hint: 'e.g. 2-4, 9 makes one PDF with those pages. Blank splits every page into its own file.' },
  ], run: async (files, o) => {
    const f = files[0];
    const bytes = new Uint8Array(await f.file.arrayBuffer());
    if (String(o.pages || '').trim()) return [{ name: `${base(f.name)}-pages.pdf`, blob: new Blob([await extractPages(bytes, o.pages)], { type: 'application/pdf' }) }];
    return (await splitPages(bytes)).map((p) => ({ name: `${base(f.name)}-page-${p.pageNo}.pdf`, blob: new Blob([p.bytes], { type: 'application/pdf' }) }));
  } },
  { id: 'csv-to-json', label: 'CSV to JSON', group: 'Data', from: ['csv', 'txt'], ext: 'json', mode: 'each', options: [
    DELIM,
    { key: 'header', type: 'checkbox', label: 'First row has column names', value: true },
    { key: 'numbers', type: 'checkbox', label: 'Write plain numbers as JSON numbers', value: false },
  ], run: async (files, o) => {
    const { json } = csvToJson(decodeText(new Uint8Array(await files[0].file.arrayBuffer())), { header: o.header !== false, numbers: !!o.numbers, delimiter: o.delimiter === 'auto' ? undefined : o.delimiter });
    return [out(`${base(files[0].name)}.json`, json, 'application/json')];
  } },
  { id: 'json-to-csv', label: 'JSON to CSV', group: 'Data', from: ['json', 'txt'], ext: 'csv', mode: 'each', options: [
    { key: 'delimiter', type: 'select', label: 'Separator', value: ',', options: [[',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab']] }, EOL,
  ], run: async (files, o) => {
    const csv = jsonToCsv(decodeText(new Uint8Array(await files[0].file.arrayBuffer())), { delimiter: o.delimiter, eol: EOLS[o.eol] || '\n' });
    return [out(`${base(files[0].name)}.csv`, csv, 'text/csv')];
  } },
  { id: 'csv-to-xlsx', label: 'CSV to XLSX', group: 'Data', from: ['csv', 'txt'], ext: 'xlsx', mode: 'each', options: [DELIM], run: async (files, o) => {
    const rows = parseCsv(decodeText(new Uint8Array(await files[0].file.arrayBuffer())), { delimiter: o.delimiter === 'auto' ? undefined : o.delimiter });
    return [{ name: `${base(files[0].name)}.xlsx`, blob: await rowsToXlsx(rows) }];
  } },
  { id: 'md-to-html', label: 'Markdown to HTML', group: 'Text', from: ['md', 'txt'], ext: 'html', mode: 'each', options: [
    { key: 'standalone', type: 'checkbox', label: 'Full web page (not just the fragment)', value: true },
  ], run: async (files, o) => {
    const html = markdownToHtml(await text(files[0].file), { standalone: o.standalone !== false, title: base(files[0].name) });
    return [out(`${base(files[0].name)}.html`, html, 'text/html')];
  } },
  { id: 'html-to-text', label: 'HTML to plain text', group: 'Text', from: ['html'], ext: 'txt', mode: 'each', options: [], run: async (files) => {
    return [out(`${base(files[0].name)}.txt`, htmlToText(await text(files[0].file)), 'text/plain')];
  } },
  { id: 'base64-encode', label: 'Base64 encode', group: 'Encoding', from: ['*'], mode: 'each', options: [
    { key: 'wrap', type: 'select', label: 'Line length', value: 0, options: [[0, 'One line'], [76, '76 characters (MIME)']] },
  ], run: async (files, o) => {
    const bytes = new Uint8Array(await files[0].file.arrayBuffer());
    return [out(`${base(files[0].name)}.base64.txt`, bytesToBase64(bytes, { wrap: Number(o.wrap) || 0 }), 'text/plain')];
  } },
  { id: 'base64-decode', label: 'Base64 decode', group: 'Encoding', from: ['txt', 'csv', 'json', 'md', 'html'], mode: 'each', options: [], run: async (files) => {
    const bytes = base64ToBytes(await text(files[0].file));
    const kind = detectKind('', '', bytes.subarray(0, 512));
    const ext = EXT_OF_KIND[kind] || 'bin';
    const name = base(files[0].name).replace(/\.base64$/, '');
    return [{ name: `${name}.${ext}`, blob: new Blob([bytes]) }];
  } },
  { id: 'url-encode', label: 'URL encode', group: 'Encoding', from: ['txt', 'csv', 'json', 'md', 'html'], ext: 'txt', mode: 'each', options: [
    { key: 'full', type: 'checkbox', label: 'Keep URL punctuation (: / ? & =)', value: false },
  ], run: async (files, o) => [out(`${base(files[0].name)}.url.txt`, urlEncode(await text(files[0].file), { full: !!o.full }), 'text/plain')] },
  { id: 'url-decode', label: 'URL decode', group: 'Encoding', from: ['txt', 'csv', 'json', 'md', 'html'], ext: 'txt', mode: 'each', options: [], run: async (files) => {
    return [out(`${base(files[0].name)}.decoded.txt`, urlDecode(await text(files[0].file)), 'text/plain')];
  } },
  { id: 'line-endings', label: 'Line endings', group: 'Text', from: ['txt', 'csv', 'json', 'md', 'html'], mode: 'each', options: [EOL], run: async (files, o) => {
    const f = files[0];
    const ext = /\.[^.]+$/.test(f.name) ? f.name.split('.').pop().toLowerCase() : 'txt';
    const body = setLineEndings(decodeText(new Uint8Array(await f.file.arrayBuffer())), o.eol);
    return [out(`${base(f.name)}-${o.eol}.${ext}`, body, 'text/plain')];
  } },
];

export const conversionById = (id) => CONVERSIONS.find((c) => c.id === id);

/** Conversions that accept every one of the given kinds (intersection). */
export function conversionsFor(kinds, only = null) {
  const list = only ? CONVERSIONS.filter((c) => c.id === only) : CONVERSIONS;
  return list.filter((c) => kinds.every((k) => c.from.includes('*') || c.from.includes(k)));
}
