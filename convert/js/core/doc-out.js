/* Text and Markdown to PDF and to Word (DOCX), with Slop Docs' own engine, so the result is what Slop Docs makes: its
 * Markdown and text import (docs/js/io/sdoc.js), its page layout (docs/js/layout), its PDF writer (docs/js/io/pdf.js, which
 * draws text with the shared run drawer shared/fonts/pdf-runs.js) and its DOCX writer (docs/js/io/docx.js). Text in any
 * writing system works: the document faces are the site's own (shared/fonts), and a script they cannot set (Arabic,
 * Chinese, Devanagari…) gets its Noto language font through SlopFontJIT, which asks before the first download.
 * Browser only. Exports textToPdf, textToDocx and DOC_OUT (the catalog entries). */
import { stemOf as base } from '../io/files.js';
import { decodeText } from './text.js';

const SHARED = new URL('../../../shared/', import.meta.url).href;
// classic scripts the engine reads as globals: scripts and bidi (layout), the run drawer (PDF), JIT language fonts and SlopUI
// (the download question)
const CLASSIC = [['SlopScripts', 'fonts/scripts.js'], ['SlopBidi', 'fonts/bidi.js'], ['SlopPdfRuns', 'fonts/pdf-runs.js'], ['SlopFontJIT', 'fonts/jit.js'], ['SlopUI', 'slopui.js']];
let readyP = null;

function script(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = SHARED + src; s.async = false; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s); });
}
/** The engine modules, and its classic helpers once. */
function engine() {
  if (!readyP) {
    readyP = (async () => {
      if (!document.querySelector('link[href*="slopui.css"]')) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: SHARED + 'slopui.css' }));
      for (const [g, src] of CLASSIC) if (!globalThis[g]) await script(src);
      const [SD, layout, reg, lang, docx] = await Promise.all([
        import('../../../docs/js/io/sdoc.js'), import('../../../docs/js/layout/index.js'), import('../../../docs/js/fonts/registry.js'),
        import('../../../docs/js/fonts/lang-doc.js'), import('../../../docs/js/io/docx.js')]);
      return { SD, layoutDoc: layout.layoutDoc, reg, lang, exportDocx: docx.exportDocx, exportPdf: async (...a) => (await import('../../../docs/js/io/pdf.js')).exportPdf(...a) };
    })();
    readyP.catch(() => { readyP = null; });
  }
  return readyP;
}

const FONTS = { sans: 'Carlito', serif: 'Tinos', mono: 'Cousine' };

/** A Slop Docs document from the file: Markdown (headings, lists, quotes, code, bold, italic) or plain text, one paragraph a line. */
async function docOf(E, f, { markdown, page = 'A4', font = 'sans' }) {
  const text = decodeText(new Uint8Array(await f.file.arrayBuffer()));
  const doc = markdown ? E.SD.fromMarkdown(text) : E.SD.fromText(text);
  doc.section = { ...doc.section, size: page === 'letter' ? 'Letter' : 'A4' };
  doc.meta.title = base(f.name);
  const face = FONTS[font] || FONTS.sans;
  if (face !== 'Carlito') for (const b of doc.blocks) if (b.type === 'p' && b.style !== 'Code') b.runs = (b.runs || []).map((r) => (r.font ? r : { ...r, font: face }));
  return doc;
}

/** The faces the runs use, loaded (the layout measures with them). */
async function ensureFaces(E, doc) {
  const want = new Map();
  for (const b of doc.blocks) for (const r of (b.runs || [])) { const k = `${r.font || ''}|${!!r.b}|${!!r.i}`; if (!want.has(k)) want.set(k, { font: r.font || 'Carlito', b: !!r.b, i: !!r.i }); }
  for (const h of ['Carlito', 'Caladea', 'Cousine']) { want.set(h + '|b', { font: h, b: true, i: false }); want.set(h + '|', { font: h, b: false, i: false }); }
  await E.reg.ensureFaces([...want.values()]);
}

export async function textToPdf(files, o = {}, markdown = false) {
  const f = files[0], E = await engine();
  const doc = await docOf(E, f, { markdown, page: o.page, font: o.font });
  await ensureFaces(E, doc);
  let info = '';
  if (E.lang.mayNeedLang(doc) && !(await E.lang.ensureDocLang(doc, { force: true }))) info = 'Some characters need a language font that was not downloaded, so they may show as boxes.';
  const bytes = await E.exportPdf(doc, E.layoutDoc(doc), { title: base(f.name) });
  const out = [{ name: `${base(f.name)}.pdf`, blob: new Blob([bytes], { type: 'application/pdf' }) }];
  if (info) out.info = info;
  return out;
}

export async function textToDocx(files, o = {}, markdown = true) {
  const f = files[0], E = await engine();
  const doc = await docOf(E, f, { markdown, page: o.page, font: o.font });
  const made = await E.exportDocx(doc);
  const type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return [{ name: `${base(f.name)}.docx`, blob: new Blob([made], { type }) }];   // a Blob or bytes from the writer, typed either way
}

const PAGE = { key: 'page', type: 'select', label: 'Page size', value: 'a4', options: [['a4', 'A4'], ['letter', 'US Letter']] };
const FONT = { key: 'font', type: 'select', label: 'Font', value: 'sans', options: [['sans', 'Sans serif (Calibri-like)'], ['serif', 'Serif (Times-like)'], ['mono', 'Monospaced']] };
const MD_NOTE = 'Headings, lists, quotes, code blocks, bold, italic and code spans are kept. Tables, links and images stay as the Markdown text that was typed.';

export const DOC_OUT = [
  { id: 'md-to-pdf', label: 'Markdown to PDF', group: 'Documents', from: ['md'], ext: 'pdf', mode: 'each', note: MD_NOTE, options: [PAGE, FONT], keywords: ['md', 'print'], run: (f, o) => textToPdf(f, o, true) },
  { id: 'txt-to-pdf', label: 'Text to PDF', group: 'Documents', from: ['txt'], ext: 'pdf', mode: 'each', options: [PAGE, { ...FONT, value: 'mono' }], keywords: ['txt', 'print', 'notepad'], run: (f, o) => textToPdf(f, o, false) },
  { id: 'md-to-docx', label: 'Markdown to Word (DOCX)', group: 'Documents', from: ['md'], ext: 'docx', mode: 'each', note: MD_NOTE, options: [PAGE, FONT], keywords: ['word', 'md', 'doc'], run: (f, o) => textToDocx(f, o, true) },
  { id: 'txt-to-docx', label: 'Text to Word (DOCX)', group: 'Documents', from: ['txt'], ext: 'docx', mode: 'each', options: [PAGE, FONT], keywords: ['word', 'txt', 'doc'], run: (f, o) => textToDocx(f, o, false) },
];
