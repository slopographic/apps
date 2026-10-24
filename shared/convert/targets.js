/* The conversions the Convert dialog offers. Every target is a converter from convert/js/core/catalog.js (its run and options are
 * reused as they are), except two things added here: a PDF converter presented once per output (PDF to PNG, PDF to JPG, from
 * the one "PDF to images" converter), and PDF to text, which no converter in convert/js has yet. A target says which kinds it
 * takes (from), how many files it needs (min) and its options. Classic conventions, ES module. */
import { CONVERSIONS } from '../../convert/js/core/catalog.js';
import { readPages } from './pdf-layout.js';
import { htmlToPdf } from './html-pdf.js';

/** A converter with some options fixed (PDF to PNG is "PDF to images" with the format set and the format choice hidden). */
function preset(base, id, label, fixed, hide) {
  return { ...base, id, label, options: base.options.filter((o) => !hide.includes(o.key)), run: (files, o) => base.run(files, { ...o, ...fixed }) };
}

/** PDF to text: the text layer of each page in reading order (pdf-layout.js), pages separated by a blank line. */
async function pdfToText(files, o) {
  const f = files[0];
  const stem = String(f.name).replace(/\.[^.]+$/, '') || 'document';
  const pages = await readPages(new Uint8Array(await f.file.arrayBuffer()), o.pages);
  const parts = pages.map((pg) => pg.lines.map((ln) => ln.cells.map((c) => c.text).join('  ')).join('\n'));
  return [{ name: `${stem}.txt`, blob: new Blob([parts.join('\n\n').trim()], { type: 'text/plain' }) }];
}
const PDF_TEXT = {
  id: 'pdf-to-text', label: 'PDF to text', group: 'PDF', from: ['pdf'], ext: 'txt', mode: 'each', options: [
    { key: 'pages', type: 'text', label: 'Pages', placeholder: 'All pages, or e.g. 1-3, 7', hint: 'Blank for every page. Scanned pages have no text unless they were OCR’d.' },
  ], run: pdfToText,
};

/** HTML to a picture PDF (html-pdf.js): the page is drawn as pictures, so its text is not selectable. */
const HTML_PDF = {
  id: 'html-to-pdf', label: 'Picture PDF (HTML)', group: 'PDF', from: ['html'], ext: 'pdf', mode: 'each', options: [],
  note: 'Picture PDF: text is not selectable or searchable. Scripts do not run; remote images, fonts and links are not loaded.',
  run: async (files) => {
    const f = files[0];
    const stem = String(f.name).replace(/\.[^.]+$/, '') || 'document';
    return [{ name: `${stem}.pdf`, blob: await htmlToPdf(f.file) }];
  },
};

export const TARGETS = [...CONVERSIONS.flatMap((c) => {
  if (c.id === 'pdf-to-images') {
    return [
      { ...preset(c, 'pdf-to-png', 'PDF to PNG', { format: 'png' }, ['format', 'quality']), ext: 'png' },
      { ...preset(c, 'pdf-to-jpg', 'PDF to JPG', { format: 'jpg' }, ['format']), ext: 'jpg' },
      PDF_TEXT,
    ];
  }
  if (c.id === 'merge-pdf') return [{ ...c, min: 2 }];
  return [c];
}), HTML_PDF];

/** The targets every one of the given kinds can take, for `count` files. */
export function targetsFor(kinds, count) {
  return TARGETS.filter((t) => count >= (t.min || 1) && kinds.every((k) => t.from.includes('*') || t.from.includes(k)));
}
