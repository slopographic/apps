/* Two PDF conversions the catalog takes from the shared PDF code (shared/convert): PDF to text (the text layer of each
 * page in reading order, pdf-layout.js) and HTML to a picture PDF (html-pdf.js). They were the Convert dialog's own; the
 * catalog is now the one list, so File convert offers them too. */
import { readPages } from '../../../shared/convert/pdf-layout.js';
import { htmlToPdf } from '../../../shared/convert/html-pdf.js';
import { stemOf as base } from '../io/files.js';
import { tr } from './i18n.js';

const PAGES = { key: 'pages', type: 'text', get label() { return tr('convert.pdf.pages', 'Pages'); }, get placeholder() { return tr('convert.pdf.all_pages_or_e_g_1', 'All pages, or e.g. 1-3, 7'); }, get hint() { return tr('convert.pdf.blank_for_every_page_scanned_pages', 'Blank for every page. Scanned pages have no text unless they were OCR’d.'); } };

export const PDF_EXTRA = [
  { id: 'pdf-to-text', get label() { return tr('convert.pdf.pdf_to_text', 'PDF to text'); }, group: 'PDF', from: ['pdf'], ext: 'txt', mode: 'each', options: [PAGES], keywords: ['txt', 'words', 'extract'],
    run: async (files, o) => {
      const f = files[0];
      const pages = await readPages(new Uint8Array(await f.file.arrayBuffer()), o.pages);
      const parts = pages.map((pg) => pg.lines.map((ln) => ln.cells.map((c) => c.text).join('  ')).join('\n'));
      return [{ name: `${base(f.name)}.txt`, blob: new Blob([parts.join('\n\n').trim()], { type: 'text/plain' }) }];
    } },
  { id: 'html-to-pdf', get label() { return tr('convert.pdf.picture_pdf_html', 'Picture PDF (HTML)'); }, group: 'PDF', from: ['html'], ext: 'pdf', mode: 'each', options: [], keywords: ['print', 'web page'], // i18n-ignore: group is an id (groupLabel)
    get note() { return tr('convert.pdf.picture_pdf_text_is_not_selectable', 'Picture PDF: text is not selectable or searchable. Scripts do not run; remote images, fonts and links are not loaded.'); },
    run: async (files) => [{ name: `${base(files[0].name)}.pdf`, blob: await htmlToPdf(files[0].file) }] },
];
