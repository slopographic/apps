/* Two PDF conversions the catalog takes from the shared PDF code (shared/convert): PDF to text (the text layer of each
 * page in reading order, pdf-layout.js) and HTML to a picture PDF (html-pdf.js). They were the Convert dialog's own; the
 * catalog is now the one list, so File convert offers them too. */
import { readPages } from '../../../shared/convert/pdf-layout.js';
import { htmlToPdf } from '../../../shared/convert/html-pdf.js';
import { stemOf as base } from '../io/files.js';

const PAGES = { key: 'pages', type: 'text', label: 'Pages', placeholder: 'All pages, or e.g. 1-3, 7', hint: 'Blank for every page. Scanned pages have no text unless they were OCR’d.' };

export const PDF_EXTRA = [
  { id: 'pdf-to-text', label: 'PDF to text', group: 'PDF', from: ['pdf'], ext: 'txt', mode: 'each', options: [PAGES], keywords: ['txt', 'words', 'extract'],
    run: async (files, o) => {
      const f = files[0];
      const pages = await readPages(new Uint8Array(await f.file.arrayBuffer()), o.pages);
      const parts = pages.map((pg) => pg.lines.map((ln) => ln.cells.map((c) => c.text).join('  ')).join('\n'));
      return [{ name: `${base(f.name)}.txt`, blob: new Blob([parts.join('\n\n').trim()], { type: 'text/plain' }) }];
    } },
  { id: 'html-to-pdf', label: 'Picture PDF (HTML)', group: 'PDF', from: ['html'], ext: 'pdf', mode: 'each', options: [], keywords: ['print', 'web page'],
    note: 'Picture PDF: text is not selectable or searchable. Scripts do not run; remote images, fonts and links are not loaded.',
    run: async (files) => [{ name: `${base(files[0].name)}.pdf`, blob: await htmlToPdf(files[0].file) }] },
];
