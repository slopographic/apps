/* Operations that make a new file from an outline, with the apps' own engines run headlessly (no app window):
 *   outline-to-presentation   Slop Slides: the outline (JSON or Markdown, slides/js/core/outline.js) → a deck → PowerPoint,
 *                             PDF or .sslide, through the editor's own writers (slides/js/io/pptx.js, pdf.js). The engine is
 *                             File convert's loader of Slop Slides' scripts (convert/js/core/slides-out.js slidesEngine).
 *   outline-to-document       Slop Docs: the outline (JSON or Markdown, docs/js/model/build.js) → a document → Word, PDF,
 *                             Markdown or .sdoc, through Slop Docs' own writers (convert/js/core/doc-out.js engine).
 * The input is the outline as a .json, .md or .txt file (the assistant saves it to Slop Drive first). The outline's shapes
 * are in the headers of slides/js/core/outline.js and docs/js/model/build.js. */
import { register } from './registry.js';
import { stem } from './load.js';

const SLIDE_SIZES = [['', 'As the outline says (16:9)'], ['16:9', '16:9'], ['4:3', '4:3'], ['16:10', '16:10'], ['A4', 'A4']];
const THEMES = [['', 'As the outline says (Slopographic)'], ['slop', 'Slopographic'], ['paper', 'Paper'], ['midnight', 'Midnight'], ['editorial', 'Editorial'],
  ['aurora', 'Aurora'], ['terminal', 'Terminal'], ['sunset', 'Sunset'], ['chalk', 'Chalkboard']];
const IN = ['json', 'md', 'txt'];
const text = async (f) => (await f.file.text()).replace(/^\uFEFF/, '');
const SLIDE_HELP = 'JSON { "title", "subtitle", "theme", "slides": [{ "title", "bullets": [..], "notes", "layout" }] }, or Markdown: "# Title", "## Slide", "- bullet", "> note".';
const DOC_HELP = 'JSON { "title", "subtitle", "blocks": [{ "type": "heading", "text", "level" } | { "type": "paragraph", "text" } | { "type": "bullets", "items": [..] } | { "type": "table", "rows": [[..]] }] }, or Markdown.';

let slidesP = null;
/** window.SS with the outline builder and both writers. */
async function slides() {
  if (!slidesP) slidesP = (async () => {
    const { slidesEngine } = await import('../../convert/js/core/slides-out.js');
    const { script } = await import('../../convert/js/core/doc-out.js');
    const S = await slidesEngine();
    if (!S.pptx) await script(new URL('../../slides/js/io/pptx.js', import.meta.url).href);
    if (!S.outline) await script(new URL('../../slides/js/core/outline.js', import.meta.url).href);
    return globalThis.SS;
  })().catch((e) => { slidesP = null; throw e; });
  return slidesP;
}

async function toPresentation(files, o = {}) {
  const f = files[0], S = await slides();
  const outline = S.outline.parse(await text(f));
  if (o.theme) outline.theme = o.theme;
  if (o.size) outline.size = o.size;
  if (!outline.title) outline.title = stem(f.name);
  const deck = S.outline.build(outline), fmt = o.format || 'pptx', name = `${stem(f.name)}.${fmt}`;
  const n = `${deck.slides.length} slide${deck.slides.length === 1 ? '' : 's'}.`;
  if (fmt === 'pdf') {
    const r = await S.pdfExport.write(deck);
    const out = [{ name, blob: r.blob, kind: 'pdf' }];
    out.info = n + (r.missing.length ? ` Some text needs a font that was not downloaded (${r.missing.join(', ')}).` : '');
    return out;
  }
  if (fmt === 'sslide') return Object.assign([{ name, blob: new Blob([JSON.stringify(deck)], { type: 'application/x-slop-slides' }), kind: 'sslide' }], { info: n });
  const r = await S.pptx.write(deck);
  return Object.assign([{ name, blob: r.blob, kind: 'pptx' }], { info: n + ' Speaker notes stay in the .sslide and PDF outputs only.' });
}

async function toDocument(files, o = {}) {
  const f = files[0];
  const [{ engine, ensureFaces, docPdf }, { buildDoc, parseOutline }] = await Promise.all([import('../../convert/js/core/doc-out.js'), import('../../docs/js/model/build.js')]);
  const E = await engine(), outline = parseOutline(await text(f));
  if (o.page) outline.page = o.page;
  const doc = buildDoc(outline);
  if (o.page) doc.section = { ...doc.section, size: o.page };
  if (!doc.meta.title) doc.meta = { ...doc.meta, title: stem(f.name) };
  const fmt = o.format || 'docx', name = `${stem(f.name)}.${fmt}`;
  if (fmt === 'pdf') { await ensureFaces(E, doc); const out = await docPdf(E, doc, name); out[0].kind = 'pdf'; return out; }
  if (fmt === 'md') return [{ name, blob: new Blob([E.SD.toMarkdown(doc)], { type: 'text/markdown' }), kind: 'md' }];
  if (fmt === 'sdoc') return [{ name, blob: E.SD.sdocBlob(doc), kind: 'sdoc' }];
  const made = await E.exportDocx(doc);
  return [{ name, blob: new Blob([made], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), kind: 'docx' }];
}

export const CREATE_SLIDES = register([
  { id: 'outline-to-presentation', label: 'Outline to presentation', group: 'Create', from: IN, mode: 'each', ext: 'pptx',
    description: 'Make a presentation from an outline with Slop Slides (title slide, then one slide per item with its bullet points and speaker notes). '
      + 'Save the outline to Slop Drive first (e.g. outline.json), then run this on it. ' + SLIDE_HELP,
    keywords: ['presentation', 'slides', 'deck', 'powerpoint', 'pptx', 'keynote', 'outline', 'create', 'make', 'generate', 'slideshow'],
    options: [{ key: 'format', type: 'select', label: 'Make', value: 'pptx', options: [['pptx', 'PowerPoint (.pptx)'], ['pdf', 'PDF'], ['sslide', 'Slop Slides (.sslide)']] },
      { key: 'theme', type: 'select', label: 'Theme', value: '', options: THEMES }, { key: 'size', type: 'select', label: 'Slide size', value: '', options: SLIDE_SIZES }],
    run: toPresentation },
], { app: 'slides', label: 'Slop Slides' });

export const CREATE_DOCS = register([
  { id: 'outline-to-document', label: 'Outline to document', group: 'Create', from: IN, mode: 'each', ext: 'docx',
    description: 'Make a document from an outline with Slop Docs (title, headings, paragraphs, lists, tables). Save the outline to Slop Drive first '
      + '(e.g. outline.json or report.md), then run this on it. ' + DOC_HELP,
    keywords: ['document', 'word', 'docx', 'report', 'letter', 'essay', 'outline', 'create', 'make', 'generate', 'write'],
    options: [{ key: 'format', type: 'select', label: 'Make', value: 'docx', options: [['docx', 'Word (.docx)'], ['pdf', 'PDF'], ['md', 'Markdown'], ['sdoc', 'Slop Docs (.sdoc)']] },
      { key: 'page', type: 'select', label: 'Page size', value: '', options: [['', 'As the outline says (A4)'], ['A4', 'A4'], ['Letter', 'US Letter']] }],
    run: toDocument },
], { app: 'docs', label: 'Slop Docs' });
