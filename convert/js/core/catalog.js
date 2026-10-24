/* The conversion catalogue. Each entry says which file kinds it takes ('*' = any), its options, and a
 * run(files, options) that returns [{ name, blob }]. mode 'each' runs once per file, 'combine' once for
 * all files together. Pure orchestration: the work is done by the modules it imports. */
import { convertImage, imageForPdf } from './image.js';
import { imagesToPdf } from './pdf-images.js';
import { pdfToImages } from './pdf-raster.js';
import { pdfToHtml } from './pdf-html.js';
import { pdfToDocx, pdfToXlsx } from '../../../shared/convert/pdf-office.js';
import { pdfToPptx } from '../../../shared/convert/pdf-pptx.js';
import { mergePdfs, extractPages, splitPages } from './pdf-ops.js';
import { csvToJson, jsonToCsv, parseCsv } from './csv.js';
import { rowsToXlsx } from './xlsx.js';
import { markdownToHtml } from './markdown.js';
import { htmlToText } from './html-text.js';
import { bytesToBase64, base64ToBytes, urlEncode, urlDecode, setLineEndings, decodeText, EOLS } from './text.js';
import { detectKind, EXT_OF_KIND } from './detect.js';
import { csvToVcf, xlsxToVcf, vcfToCsv, vcfToXlsx, vcfToJson } from './vcf.js';
import { stemOf as base } from '../io/files.js';
import { decodeAudio, channelsOf, encodeWav, encodeMp3, loadLame } from './audio.js';
import { convertVideo } from './ffmpeg-engine.js';
import { emlToHtml, emlToText, emlAttachmentsZip, icsToCsv, icsToJson, xmlToJson, unzipEntries, zipFiles } from './mail.js';

const IMAGE = ['png', 'jpg', 'webp', 'bmp', 'gif', 'svg', 'avif', 'ico'];
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
const AUDIO_IN = ['mp4', 'webm', 'mov', 'm4a', 'mp3', 'wav', 'ogg', 'flac'];
const BITRATE = { key: 'bitrate', type: 'select', label: 'Bitrate', value: '128', options: [['128', '128 kbps'], ['192', '192 kbps'], ['320', '320 kbps']] };
/** The sound of a video or audio file, as WAV or MP3. Video files give their audio track only. */
function audioTo(to) {
  return async (files, o) => {
    const f = files[0];
    const buf = await decodeAudio(new Uint8Array(await f.file.arrayBuffer()));
    const chans = channelsOf(buf);
    if (to === 'wav') return [{ name: `${base(f.name)}.wav`, blob: new Blob([encodeWav(chans, buf.sampleRate)], { type: 'audio/wav' }) }];
    const lame = await loadLame();
    return [{ name: `${base(f.name)}.mp3`, blob: encodeMp3(lame, chans, buf.sampleRate, Number(o.bitrate) || 128) }];
  };
}
const VIDEO_IN = ['mp4', 'webm', 'mov'];
const CRF = { key: 'crf', type: 'range', label: 'Quality (lower is better)', min: 18, max: 40, value: 23 };
const TIME = { key: 'time', type: 'number', label: 'Time (seconds)', min: 0, max: 36000, value: 1, hint: 'The moment to take the picture from. Past the end, the last frame is used.' };
const GIF_WIDTH = { key: 'width', type: 'number', label: 'Width (px)', min: 16, max: 1920, value: 480, hint: 'Height follows the picture proportions.' };
const GIF_FPS = { key: 'fps', type: 'number', label: 'Frames per second', min: 1, max: 30, value: 10 };
/** Video conversions with ffmpeg.wasm. Where the codecs already fit the new container, the streams are copied (no quality loss). */
function videoTo(to) {
  return async (files, o) => {
    const f = files[0];
    const base_ = base(f.name);
    const q = Number(o.crf ?? 23);
    if (to === 'mp4') return [await convertVideo(f.file, {
      name: base_, output: 'mp4',
      args: (i, out) => ['-i', i, '-c', 'copy', '-movflags', '+faststart', out],
      fallback: (i, out) => ['-i', i, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(q), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out],
    })];
    if (to === 'mov') return [await convertVideo(f.file, {
      name: base_, output: 'mov',
      args: (i, out) => ['-i', i, '-c', 'copy', '-f', 'mov', out],
      fallback: (i, out) => ['-i', i, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(q), '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-f', 'mov', out],
    })];
    if (to === 'webm') return [await convertVideo(f.file, {
      name: base_, output: 'webm',
      args: (i, out) => ['-i', i, '-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libvorbis', '-b:a', '96k', out],
    })];
    if (to === 'gif') {
      const w = Math.max(16, Math.round(Number(o.width) || 480)), fps = Math.max(1, Math.min(30, Math.round(Number(o.fps) || 10)));
      return [await convertVideo(f.file, {
        name: base_, output: 'gif',
        args: (i, out) => ['-i', i, '-vf', `fps=${fps},scale=${w}:-2:flags=lanczos`, '-loop', '0', out],
      })];
    }
    // a single frame as a picture: webp, png or jpg
    const t = Math.max(0, Number(o.time) || 0);
    const extra = to === 'webp' ? ['-quality', '85'] : to === 'jpg' ? ['-q:v', '3'] : [];
    return [await convertVideo(f.file, {
      name: base_, output: to,
      args: (i, out) => ['-ss', String(t), '-i', i, '-frames:v', '1', ...extra, out],
    })];
  };
}

const text = (blob) => blob.text();
const out = (name, data, type) => ({ name, blob: new Blob([data], { type }) });

export const CONVERSIONS = [
  { id: 'to-mp4', label: 'To MP4', group: 'Audio and video', from: ['webm', 'mov'], ext: 'mp4', mode: 'each', options: [CRF], run: videoTo('mp4') },
  { id: 'to-mov', label: 'To MOV', group: 'Audio and video', from: ['mp4', 'webm'], ext: 'mov', mode: 'each', options: [CRF], run: videoTo('mov') },
  { id: 'to-webm', label: 'To WebM', group: 'Audio and video', from: VIDEO_IN, ext: 'webm', mode: 'each', options: [], run: videoTo('webm') },
  { id: 'video-to-gif', label: 'To GIF', group: 'Audio and video', from: VIDEO_IN, ext: 'gif', mode: 'each', options: [GIF_WIDTH, GIF_FPS], run: videoTo('gif') },
  { id: 'frame-to-webp', label: 'Frame to WebP', group: 'Audio and video', from: VIDEO_IN, ext: 'webp', mode: 'each', options: [TIME], run: videoTo('webp') },
  { id: 'frame-to-png', label: 'Frame to PNG', group: 'Audio and video', from: VIDEO_IN, ext: 'png', mode: 'each', options: [TIME], run: videoTo('png') },
  { id: 'frame-to-jpg', label: 'Frame to JPG', group: 'Audio and video', from: VIDEO_IN, ext: 'jpg', mode: 'each', options: [TIME], run: videoTo('jpg') },
  { id: 'to-wav', label: 'To WAV', group: 'Audio and video', from: AUDIO_IN, ext: 'wav', mode: 'each', options: [], run: audioTo('wav') },
  { id: 'to-mp3', label: 'To MP3', group: 'Audio and video', from: AUDIO_IN, ext: 'mp3', mode: 'each', options: [BITRATE], run: audioTo('mp3') },
  { id: 'to-png', label: 'To PNG', group: 'Images', from: ['jpg', 'webp', 'bmp', 'gif', 'svg', 'avif', 'ico'], ext: 'png', mode: 'each', options: [...SIZE], run: imageTo('png') },
  { id: 'to-jpg', label: 'To JPG', group: 'Images', from: ['png', 'webp', 'bmp', 'gif', 'svg', 'avif', 'ico'], ext: 'jpg', mode: 'each', options: [...SIZE, QUALITY, BACKGROUND], run: imageTo('jpg') },
  { id: 'to-webp', label: 'To WebP', group: 'Images', from: ['png', 'jpg', 'bmp', 'gif', 'svg', 'avif', 'ico'], ext: 'webp', mode: 'each', options: [...SIZE, QUALITY], run: imageTo('webp') },
  { id: 'to-bmp', label: 'To BMP', group: 'Images', from: ['png', 'jpg', 'webp', 'gif', 'svg', 'avif', 'ico'], ext: 'bmp', mode: 'each', options: [...SIZE, BACKGROUND], run: imageTo('bmp') },
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
  { id: 'pdf-to-images', label: 'PDF to images', group: 'PDF', from: ['pdf'], ext: 'png', mode: 'each', options: [
    { key: 'format', type: 'select', label: 'Format', value: 'png', options: [['png', 'PNG'], ['jpg', 'JPG']] },
    { key: 'pages', type: 'text', label: 'Pages', placeholder: 'All pages, or e.g. 1-3, 7', hint: 'Blank for every page.' },
    { key: 'scale', type: 'select', label: 'Resolution', value: 2, options: [[1, '72 dpi'], [2, '144 dpi'], [3, '216 dpi']] },
    QUALITY,
  ], run: async (files, o) => {
    const f = files[0];
    const pages = await pdfToImages(new Uint8Array(await f.file.arrayBuffer()), { pages: o.pages, scale: o.scale, format: o.format, quality: (o.quality ?? 92) / 100 });
    return pages.map((p) => ({ name: `${base(f.name)}-page-${p.pageNo}.${o.format === 'jpg' ? 'jpg' : 'png'}`, blob: p.blob }));
  } },
  { id: 'pdf-to-html', label: 'PDF to HTML', group: 'PDF', from: ['pdf'], ext: 'html', mode: 'each',
    note: 'A close copy, not an identical one. Each page’s text and images stay where they were, in reading order. Vector drawing, colours and the exact fonts are not kept.',
    options: [{ key: 'pages', type: 'text', label: 'Pages', placeholder: 'All pages, or e.g. 1-3, 7', hint: 'Blank for every page.' }],
    run: async (files, o) => {
      const f = files[0];
      const html = await pdfToHtml(new Uint8Array(await f.file.arrayBuffer()), { pages: o.pages, title: base(f.name) });
      return [out(`${base(f.name)}.html`, html, 'text/html')];
    } },
  { id: 'pdf-to-docx', label: 'PDF to Word (DOCX)', group: 'PDF', from: ['pdf'], ext: 'docx', mode: 'each',
    note: 'Text-based. Paragraphs and column-aligned tables are kept as Word text and tables. Images, drawings, colours and fonts are not. Pages with no text layer are marked.',
    options: [{ key: 'pages', type: 'text', label: 'Pages', placeholder: 'All pages, or e.g. 1-3, 7', hint: 'Blank for every page.' }], run: async (files, o) => {
      const f = files[0];
      return [{ name: `${base(f.name)}.docx`, blob: await pdfToDocx(new Uint8Array(await f.file.arrayBuffer()), { pages: o.pages, title: base(f.name) }) }];
    } },
  { id: 'pdf-to-xlsx', label: 'PDF to Excel (XLSX)', group: 'PDF', from: ['pdf'], ext: 'xlsx', mode: 'each',
    note: 'Text-based. Each line goes to a row and each column of text to a column, so tables aligned in columns become a grid. Numbers become numbers. No images, formulas or formats.',
    options: [{ key: 'pages', type: 'text', label: 'Pages', placeholder: 'All pages, or e.g. 1-3, 7', hint: 'Blank for every page.' }], run: async (files, o) => {
      const f = files[0];
      return [{ name: `${base(f.name)}.xlsx`, blob: await pdfToXlsx(new Uint8Array(await f.file.arrayBuffer()), { pages: o.pages }) }];
    } },
  { id: 'pdf-to-pptx', label: 'PDF to PowerPoint (PPTX)', group: 'PDF', from: ['pdf'], ext: 'pptx', mode: 'each',
    note: 'One slide per page, each page a picture at 144 dpi. The text is not editable in the deck.',
    options: [{ key: 'pages', type: 'text', label: 'Pages', placeholder: 'All pages, or e.g. 1-3, 7', hint: 'Blank for every page.' }], run: async (files, o) => {
      const f = files[0];
      return [{ name: `${base(f.name)}.pptx`, blob: await pdfToPptx(new Uint8Array(await f.file.arrayBuffer()), { pages: o.pages }) }];
    } },
  { id: 'merge-pdf', label: 'Merge PDFs', group: 'PDF', from: ['pdf'], ext: 'pdf', mode: 'combine', options: [], run: async (files) => {
    const bytes = await mergePdfs(await Promise.all(files.map(async (f) => new Uint8Array(await f.file.arrayBuffer()))));
    return [{ name: 'merged.pdf', blob: new Blob([bytes], { type: 'application/pdf' }) }];
  } },
  { id: 'split-pdf', label: 'Split PDF', group: 'PDF', from: ['pdf'], ext: 'pdf', mode: 'each', options: [
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
  { id: 'csv-to-vcf', label: 'CSV to vCard', group: 'Data', from: ['csv', 'txt'], ext: 'vcf', mode: 'each', options: [DELIM], run: csvToVcf },
  { id: 'xlsx-to-vcf', label: 'XLSX to vCard', group: 'Data', from: ['xlsx'], ext: 'vcf', mode: 'each', options: [], run: xlsxToVcf },
  { id: 'vcf-to-csv', label: 'vCard to CSV', group: 'Data', from: ['vcf'], ext: 'csv', mode: 'each', options: [], run: vcfToCsv },
  { id: 'vcf-to-xlsx', label: 'vCard to XLSX', group: 'Data', from: ['vcf'], ext: 'xlsx', mode: 'each', options: [], run: vcfToXlsx },
  { id: 'vcf-to-json', label: 'vCard to JSON', group: 'Data', from: ['vcf'], ext: 'json', mode: 'each', options: [], run: vcfToJson },
  { id: 'md-to-html', label: 'Markdown to HTML', group: 'Text', from: ['md', 'txt'], ext: 'html', mode: 'each', options: [
    { key: 'standalone', type: 'checkbox', label: 'Full web page (not just the fragment)', value: true },
  ], run: async (files, o) => {
    const html = markdownToHtml(await text(files[0].file), { standalone: o.standalone !== false, title: base(files[0].name) });
    return [out(`${base(files[0].name)}.html`, html, 'text/html')];
  } },
  { id: 'html-to-text', label: 'HTML to plain text', group: 'Text', from: ['html'], ext: 'txt', mode: 'each', options: [], run: async (files) => {
    return [out(`${base(files[0].name)}.txt`, htmlToText(await text(files[0].file)), 'text/plain')];
  } },
  { id: 'base64-encode', label: 'Base64 encode', group: 'Encoding', from: ['*'], ext: 'txt', mode: 'each', options: [
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
  { id: 'line-endings', label: 'Line endings', group: 'Text', from: ['txt', 'csv', 'json', 'md', 'html'], ext: 'txt', mode: 'each', options: [EOL], run: async (files, o) => {
    const f = files[0];
    const ext = /\.[^.]+$/.test(f.name) ? f.name.split('.').pop().toLowerCase() : 'txt';
    const body = setLineEndings(decodeText(new Uint8Array(await f.file.arrayBuffer())), o.eol);
    return [out(`${base(f.name)}-${o.eol}.${ext}`, body, 'text/plain')];
  } },
  // Mail, calendar and XML. The readers are the apps' own (shared/mail, shared/calendar); see core/mail.js.
  { id: 'eml-to-html', label: 'Email to HTML', group: 'Email', from: ['eml'], ext: 'html', mode: 'each', options: [], run: async (files) => { const f = files[0]; return [{ name: `${base(f.name)}.html`, blob: new Blob([await emlToHtml(new Uint8Array(await f.file.arrayBuffer()))], { type: 'text/html' }) }]; } },
  { id: 'eml-to-text', label: 'Email to plain text', group: 'Email', from: ['eml'], ext: 'txt', mode: 'each', options: [], run: async (files) => { const f = files[0]; return [{ name: `${base(f.name)}.txt`, blob: new Blob([await emlToText(new Uint8Array(await f.file.arrayBuffer()))], { type: 'text/plain' }) }]; } },
  { id: 'eml-attachments', label: 'Email attachments to ZIP', group: 'Email', from: ['eml'], ext: 'zip', mode: 'each', options: [], run: async (files) => { const f = files[0]; return [{ name: `${base(f.name)}-attachments.zip`, blob: await emlAttachmentsZip(new Uint8Array(await f.file.arrayBuffer())) }]; } },
  { id: 'ics-to-csv', label: 'Calendar to CSV', group: 'Calendar', from: ['ics'], ext: 'csv', mode: 'each', options: [], run: async (files) => { const f = files[0]; return [{ name: `${base(f.name)}.csv`, blob: new Blob([await icsToCsv(await text(f.file))], { type: 'text/csv' }) }]; } },
  { id: 'ics-to-json', label: 'Calendar to JSON', group: 'Calendar', from: ['ics'], ext: 'json', mode: 'each', options: [], run: async (files) => { const f = files[0]; return [{ name: `${base(f.name)}.json`, blob: new Blob([await icsToJson(await text(f.file))], { type: 'application/json' }) }]; } },
  { id: 'xml-to-json', label: 'XML to JSON', group: 'Data', from: ['xml'], ext: 'json', mode: 'each', options: [], run: async (files) => { const f = files[0]; return [{ name: `${base(f.name)}.json`, blob: new Blob([xmlToJson(await text(f.file))], { type: 'application/json' }) }]; } },
  { id: 'unzip', label: 'Unzip', group: 'Archives', from: ['zip'], mode: 'each', options: [], run: async (files) => unzipEntries(files[0].file) },
  { id: 'zip-files', label: 'Files to ZIP', group: 'Archives', from: ['*'], ext: 'zip', mode: 'combine', options: [], run: async (files) => [{ name: 'files.zip', blob: await zipFiles(files) }] },
];

export const conversionById = (id) => CONVERSIONS.find((c) => c.id === id);

/** Conversions that accept every one of the given kinds (intersection). */
/** The kind a conversion makes, for its picture (SlopFlow): a format option wins (PDF to images), then the converter's ext.
 *  Base64 decode makes whatever the text held, so it is a plain 'file'. */
export function outKind(conv, opts = {}) {
  if (!conv) return '';
  return (opts && typeof opts.format === 'string' && opts.format) || conv.ext || 'file';
}

export function conversionsFor(kinds, only = null) {
  const list = only ? CONVERSIONS.filter((c) => c.id === only) : CONVERSIONS;
  return list.filter((c) => kinds.every((k) => c.from.includes('*') || c.from.includes(k)));
}
