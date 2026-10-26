/* PowerPoint (PPTX) to PDF, to pictures and to plain text, with Slop Slides' own engine (single source): its PPTX import
 * (slides/js/io/pptx-in*.js), its display list and canvas renderer (slides/js/render) and its PDF export
 * (slides/js/io/pdf*.js: real text in the slide fonts, language fonts through SlopFontJIT, which asks first). The scripts
 * are the ones slides/js/manifest.js lists, loaded once as classic scripts into window.SS; inside Slop Slides the
 * editor's own are used. Browser only. Exports SLIDES_IN (the catalog entries) and slidesEngine. */
import { stemOf as base } from '../io/files.js';
import { script, textHelpers } from './doc-out.js';
import { writeZip } from '../io/zip.js';
import { canvasToBlob } from './image.js';
import { deckText } from './deck-text.js';
import { tr } from './i18n.js';
/** A select choice [value, label] whose label is read in the current language. */
const ch = (v, label) => Object.defineProperty([v], 1, { get: label, enumerable: true });

const ROOT = new URL('../../../', import.meta.url).href;
const ENGINE_IO = /\/(pptx-in[^/]*|pdf[^/]*)\.js$/;   // of the io package: the reader and the PDF writer
let readyP = null;

/** window.SS with the PPTX reader, the renderer and the PDF writer. */
export function slidesEngine() {
  if (!readyP) {
    readyP = (async () => {
      await textHelpers();
      const S = globalThis.SS;
      if (S && S.pptxIn && S.pdfExport && S.canvasRender && S.scene) return S;
      if (!globalThis.SS_MANIFEST) await script(ROOT + 'slides/js/manifest.js');
      const M = globalThis.SS_MANIFEST;
      for (const f of [...M.core, ...M.render, ...M.io.filter((x) => ENGINE_IO.test(x))]) await script(ROOT + f);
      return globalThis.SS;
    })();
    readyP.catch(() => { readyP = null; });
  }
  return readyP;
}

/** The PowerPoint file as a deck, and what the import left out (a sentence, or ''). */
async function readDeck(S, f) {
  let r;
  try { r = await S.pptxIn.read(f.file, f.name); }
  catch (e) { throw new Error(/not a PowerPoint|zip|central directory/i.test(e.message) ? tr('convert.slides.not_pptx', '{name} is not a PowerPoint presentation.', { name: f.name }) : tr('convert.slides.could_not_read', 'Could not read {name}: {error}', { name: f.name, error: e.message })); }
  return { deck: r.deck, left: S.pptxIn.summary(r.report) };
}
const shown = (deck, o) => deck.slides.filter((s) => o.hidden || !s.hidden);
const withInfo = (outs, notes) => { const t = notes.filter(Boolean).join(' '); if (t) outs.info = t; return outs; };
const hiddenNote = (deck, o) => { const n = deck.slides.filter((s) => s.hidden).length; return n && !o.hidden ? tr('convert.slides.hidden_left_out', ['{n} hidden slides are left out.', '{n} hidden slide is left out.'], { n }) : ''; };

async function toPdf(files, o = {}) {
  const f = files[0], S = await slidesEngine(), { deck, left } = await readDeck(S, f);
  const r = await S.pdfExport.write(deck, { hidden: !!o.hidden });
  const missing = r.missing.length ? tr('convert.slides.font_missing', 'Some text needs a font that was not downloaded ({fonts}), so it shows as boxes.', { fonts: r.missing.join(', ') }) : '';
  return withInfo([{ name: `${base(f.name)}.pdf`, blob: r.blob }], [tr('convert.slides.n_pages', ['{n} pages.', '{n} page.'], { n: r.pages }), hiddenNote(deck, o), left, missing]);
}

async function toImages(files, o = {}) {
  const f = files[0], S = await slidesEngine(), { deck, left } = await readDeck(S, f);
  const slides = shown(deck, o);
  if (!slides.length) throw new Error(tr('convert.slides.all_hidden', 'Every slide is hidden.'));
  if (S.fonts.load) await S.fonts.load();
  await S.canvasRender.preload(deck);
  const scale = Math.max(0.5, Math.min(4, Number(o.scale) || 2)), width = Math.round(deck.size.w * scale);
  const entries = [], pad = String(deck.slides.length).length;
  for (const s of slides) {
    const n = deck.slides.indexOf(s) + 1;
    const cv = S.canvasRender.slideToCanvas(deck, s, width, { scene: { editor: false } });
    entries.push({ path: `${base(f.name)}-slide-${String(n).padStart(pad, '0')}.png`, data: await canvasToBlob(cv, 'image/png'), store: true });
  }
  return withInfo([{ name: `${base(f.name)}-slides.zip`, blob: await writeZip(entries) }], [tr('convert.slides.n_pictures', ['{n} pictures, {w} px wide.', '{n} picture, {w} px wide.'], { n: entries.length, w: width }), hiddenNote(deck, o), left]);
}

async function toText(files, o = {}) {
  const f = files[0], S = await slidesEngine(), { deck } = await readDeck(S, f);
  return [{ name: `${base(f.name)}.txt`, blob: new Blob([deckText(deck, { notes: o.notes !== false, hidden: !!o.hidden })], { type: 'text/plain' }) }];
}

const HIDDEN = { key: 'hidden', type: 'checkbox', get label() { return tr('convert.slides.include_hidden_slides', 'Include hidden slides'); }, value: false };
const PPT = ['powerpoint', 'ppt', 'slides', 'presentation', 'deck', 'slideshow'];
const READ_NOTE = 'Read by the Slop Slides engine: text, shapes, pictures, tables, backgrounds and theme. Charts, SmartArt, video and sound are left out (the status line counts them); shadows are not drawn.'; // i18n-ignore: the English fallback of convert.slides.note_*

export const SLIDES_IN = [
  { id: 'pptx-to-pdf', get label() { return tr('convert.slides.powerpoint_to_pdf', 'PowerPoint to PDF'); }, group: 'Presentations', from: ['pptx'], ext: 'pdf', mode: 'each', get note() { return tr('convert.slides.note_pdf', READ_NOTE + ' One page per slide, with real, searchable text.'); }, // i18n-ignore: group is an id
    options: [HIDDEN], keywords: [...PPT, 'pptx', 'print', 'handout'], run: toPdf },
  { id: 'pptx-to-images', get label() { return tr('convert.slides.powerpoint_to_pictures_png', 'PowerPoint to pictures (PNG)'); }, group: 'Presentations', from: ['pptx'], ext: 'zip', mode: 'each', get note() { return tr('convert.slides.note_images', READ_NOTE + ' One PNG per slide, in a ZIP.'); }, // i18n-ignore: group is an id
    options: [{ key: 'scale', type: 'select', get label() { return tr('convert.slides.picture_size', 'Picture size'); }, value: 2, options: [ch(1, () => tr('convert.slides.scale_1', '1× (960 px wide for 16:9)')), ch(2, () => tr('convert.slides.scale_2', '2× (1920 px wide)')), ch(3, () => tr('convert.slides.scale_3', '3× (2880 px wide)'))] }, HIDDEN],
    keywords: [...PPT, 'pptx', 'png', 'image', 'images', 'pictures', 'jpg', 'thumbnail', 'export slides'], run: toImages }, // i18n-ignore: search keywords
  { id: 'pptx-to-text', get label() { return tr('convert.slides.powerpoint_to_plain_text', 'PowerPoint to plain text'); }, group: 'Presentations', from: ['pptx'], ext: 'txt', mode: 'each', // i18n-ignore: group is an id (groupLabel)
    get note() { return tr('convert.slides.each_slide_s_title_and_text', 'Each slide’s title and text in reading order, tables one row a line, and the speaker notes if you like.'); },
    options: [{ key: 'notes', type: 'checkbox', get label() { return tr('convert.slides.include_speaker_notes', 'Include speaker notes'); }, value: true }, HIDDEN], keywords: [...PPT, 'pptx', 'txt', 'notes', 'outline', 'extract text'], run: toText }, // i18n-ignore: search keywords
];
