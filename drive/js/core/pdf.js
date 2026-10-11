/* Slop Drive — core/pdf: the vendored PDF.js build (vendor/pdfjs), loaded on first use. Used for PDF thumbnails
 * (core/thumb-make.js) and the PDF pages in the viewer (ui/viewer.js). Nothing comes from a CDN. */
'use strict';
(function (DR) {
  let pdfjsP = null;
  DR.pdfjs = function () {
    if (!pdfjsP) pdfjsP = (async () => {
      const base = new URL('../vendor/pdfjs/', document.baseURI).href;
      const lib = await import(base + 'pdf.min.js');
      lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
      return { lib, base };
    })().catch((e) => { pdfjsP = null; throw e; });
    return pdfjsP;
  };
  DR.openPdf = async function (blob) {
    const { lib, base } = await DR.pdfjs();
    return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', isEvalSupported: false }).promise;
  };
  /** Page n as a canvas, scaled to width px wide. */
  DR.renderPdfPage = async function (doc, n, width) {
    const page = await doc.getPage(n), v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: width / v1.width });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    return c;
  };
})(window.DR);
