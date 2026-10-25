/* Slop Compare's headless operation, for Slop Workflows and any app's AI panel (registry: shared/ops/registry.js):
 *   diff.report   two files in (texts, code, JSON, CSV, two PDFs or two pictures), one report out: the HTML page or the PDF
 *                 that Slop Compare downloads, or the .patch of two texts. The comparison is Slop Compare's own
 *                 (diff/js/io/files.js compareSides, the same options as the page: diff/js/core/compare.js OPTIONS), so the
 *                 step and the page always agree. The first file is A (the original), the second B.
 * reportOf(files, options) → { name, blob, kind, summary } is the work, for the tests and the page alike. */
import { register } from './registry.js';
import { compareSides, withUrls } from '../../diff/js/io/files.js';
import { reportHtml, reportName } from '../../diff/js/core/report.js';
import { summary } from '../../diff/js/core/kind.js';
import { unified } from '../../diff/js/core/patch.js';
import { diffLines } from '../../diff/js/core/text.js';

const MIME = { html: 'text/html', pdf: 'application/pdf', patch: 'text/x-diff' };

export async function reportOf(files, o = {}) {
  if (files.length !== 2) throw new Error(`Compare takes two files, the original first; this step got ${files.length}.`);
  const [a, b] = files.map((f) => ({ name: f.name, type: f.file.type || '', file: f.file }));
  const format = MIME[o.format] ? o.format : 'html';
  const r = await compareSides(a, b, o);
  const names = { nameA: a.name, nameB: b.name };
  let blob;
  if (format === 'patch') {
    if (r.kind === 'image' || r.kind === 'pdf') throw new Error('A .patch is made from two texts: choose the HTML or PDF report for PDFs and pictures.');
    const text = r.text || diffLines(await a.file.text(), await b.file.text(), { ignoreWs: r.opts.ignoreWs, ignoreCase: r.opts.ignoreCase });
    blob = new Blob([unified(text, { nameA: `a/${a.name}`, nameB: `b/${b.name}` })], { type: MIME.patch });
  } else if (format === 'pdf') {
    const { reportPdf } = await import('../../diff/js/io/report-pdf.js');
    blob = new Blob([await reportPdf(withUrls(r), names)], { type: MIME.pdf });
  } else blob = new Blob([reportHtml(withUrls(r), names)], { type: MIME.html });
  return { name: reportName(a.name, b.name, format), blob, kind: format, summary: summary(r) };
}

async function run(files, o) {
  const r = await reportOf(files, o);
  const out = [{ name: r.name, blob: r.blob, kind: r.kind }];
  out.info = r.summary;
  return out;
}

export const DIFF_OPS = register([
  { id: 'diff.report', label: 'Compare two files', group: 'Files', from: ['*'], mode: 'combine', out: (k, o) => (o && MIME[o.format] ? o.format : 'html'),
    description: 'Compares two files (texts, code, JSON, CSV, PDFs or pictures) and makes a report of every change, or a .patch.',
    keywords: ['compare', 'diff', 'difference', 'changes', 'patch', 'report', 'versions'],
    options: [
      { key: 'format', type: 'select', label: 'Make', value: 'html', options: [['html', 'A report (HTML)'], ['pdf', 'A report (PDF)'], ['patch', 'A .patch (texts)']] },
      { key: 'mode', type: 'select', label: 'Compare as', value: 'auto', options: [['auto', 'Automatic'], ['text', 'Text'], ['json', 'JSON (by key)'], ['csv', 'CSV (by row)']] },
      { key: 'view', type: 'select', label: 'Report view', value: 'split', options: [['split', 'Side by side'], ['unified', 'Unified']] },
      { key: 'ignoreWs', type: 'checkbox', label: 'Ignore whitespace', value: false },
      { key: 'ignoreCase', type: 'checkbox', label: 'Ignore case', value: false },
      { key: 'pdfView', type: 'select', label: 'PDFs', value: 'text', options: [['text', 'Compare the text'], ['visual', 'Compare the pages as pictures']] },
      { key: 'threshold', type: 'range', label: 'Picture threshold (%)', min: 0, max: 100, value: 10 },
    ],
    run },
], { app: 'diff', label: 'Slop Compare' });
