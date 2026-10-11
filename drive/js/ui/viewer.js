/* Slop Drive — ui/viewer: Drive's side of SlopPreview. Images and PDFs are shown by the shared viewer (zoom, pan,
 * open in a new tab, download, share) in Quick look, the details panel and the columns alike. This file only gives the
 * viewer the file's blob URL and its PDF pages, rendered with the PDF.js path in core/thumbs.js. Classic script. */
'use strict';
(function (DR) {
  /** The width of a Quick look page at 100%: the window, at most 900 px. */
  const pageWidth = () => Math.min(900, innerWidth - 80);
  /** A viewer for a file (image or PDF). big: Quick look (every page, up to 20); otherwise the first page only.
   * sink: the array that keeps the object URL (the caller frees it). */
  DR.viewerFor = function (r, big, sink) {
    const kind = DR.kindOf(r), blobUrl = URL.createObjectURL(r.blob);
    sink.push(blobUrl);
    const o = { title: r.name, blobUrl, kind, chrome: false };
    if (kind === 'pdf') o.renderPages = () => pdfPages(r.blob, big);
    return window.SlopPreview.create(o);
  };
  /** The pages as canvases, each sized in CSS px (at 100%) and rendered at up to 2× for sharpness. */
  async function pdfPages(blob, big) {
    const doc = await DR.openPdf(blob);
    try {
      const n = big ? Math.min(doc.numPages, 20) : 1, base = big ? pageWidth() : 560, ratio = Math.min(2, devicePixelRatio || 1);
      const pages = [];
      for (let i = 1; i <= n; i++) {
        const c = await DR.renderPdfPage(doc, i, base * ratio);
        c.style.width = base + 'px';
        c.style.height = (base * c.height / c.width) + 'px';
        pages.push(c);
      }
      const note = doc.numPages > n ? `Showing ${n} of ${doc.numPages} pages.${big ? ' Open it in Slop PDF for the rest.' : ''}` : '';
      return { pages, note };
    } finally { doc.destroy(); }
  }
})(window.DR);
