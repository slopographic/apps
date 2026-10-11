/* Slop Drive — core/thumbs: thumbnails for images, SVG, PDF (first page via vendor pdf.js) and video,
 * made off the main path with a small queue and cached as object URLs. Also remembers dimensions. */
'use strict';
(function (DR) {
  const cache = new Map(), info = new Map(), SIZE = 320;
  let running = 0;
  const queue = [];
  const pump = () => { while (running < 3 && queue.length) { const job = queue.shift(); running++; job().finally(() => { running--; pump(); }); } };
  const enqueue = (fn) => new Promise((res) => { queue.push(() => fn().then(res, () => res(null))); pump(); });
  const keyOf = (r) => r.id + ':' + (r.modified || r.time);

  function canvasUrl(src, w, h) {
    const s = Math.min(1, SIZE / Math.max(w, h)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s)); c.height = Math.max(1, Math.round(h * s));
    c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
    return new Promise((res) => c.toBlob((b) => res(b ? URL.createObjectURL(b) : null), 'image/webp', 0.82));
  }
  async function imageThumb(r) {
    if (DR.isSvg(r)) {
      const url = URL.createObjectURL(r.blob);
      const img = new Image(); img.src = url;
      try { await img.decode(); info.set(r.id, { w: img.naturalWidth, h: img.naturalHeight }); } catch (e) { /* still show it */ }
      return url;
    }
    const bmp = await createImageBitmap(r.blob);
    info.set(r.id, { w: bmp.width, h: bmp.height });
    const url = await canvasUrl(bmp, bmp.width, bmp.height);
    bmp.close();
    return url;
  }
  let pdfjsP = null;
  DR.pdfjs = function () {
    if (!pdfjsP) pdfjsP = (async () => {
      const base = new URL('../vendor/pdfjs/', document.baseURI).href;
      const lib = await import(base + 'pdf.min.js');
      lib.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.min.js';
      lib.__base = base;
      return lib;
    })().catch((e) => { pdfjsP = null; throw e; });
    return pdfjsP;
  };
  DR.openPdf = async function (blob) {
    const lib = await DR.pdfjs(), base = lib.__base;
    return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), cMapUrl: base + 'cmaps/', cMapPacked: true, standardFontDataUrl: base + 'standard_fonts/', isEvalSupported: false }).promise;
  };
  DR.renderPdfPage = async function (doc, n, width) {
    const page = await doc.getPage(n), v1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: width / v1.width });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    return c;
  };
  async function pdfThumb(r) {
    const doc = await DR.openPdf(r.blob);
    try {
      const c = await DR.renderPdfPage(doc, 1, SIZE);
      const p1 = (await doc.getPage(1)).getViewport({ scale: 1 });
      info.set(r.id, { pages: doc.numPages, w: Math.round(p1.width), h: Math.round(p1.height), unit: 'pt' });
      return canvasUrl(c, c.width, c.height);
    } finally { doc.destroy(); }
  }
  function videoThumb(r) {
    return new Promise((res, rej) => {
      const v = document.createElement('video'), url = URL.createObjectURL(r.blob);
      const end = (x) => { URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); x instanceof Error ? rej(x) : res(x); };
      v.muted = true; v.preload = 'metadata'; v.playsInline = true;
      v.onloadedmetadata = () => { info.set(r.id, { w: v.videoWidth, h: v.videoHeight, duration: v.duration }); v.currentTime = Math.min(1, (v.duration || 2) / 3); };
      v.onseeked = () => canvasUrl(v, v.videoWidth || 320, v.videoHeight || 180).then(end, end);
      v.onerror = () => end(new Error('video'));
      setTimeout(() => end(new Error('timeout')), 8000);
      v.src = url;
    });
  }
  /** Promise of a thumbnail URL (or null). */
  DR.thumb = function (r) {
    if (!r || r.isFolder || !r.blob) return Promise.resolve(null);
    const k = keyOf(r);
    if (cache.has(k)) return cache.get(k);
    const kind = DR.kindOf(r);
    let p = null;
    if (kind === 'image') p = enqueue(() => imageThumb(r));
    else if (kind === 'pdf' && r.size < 60 * 1048576) p = enqueue(() => pdfThumb(r));
    else if (kind === 'video') p = enqueue(() => videoThumb(r));
    else p = Promise.resolve(null);
    cache.set(k, p);
    return p;
  };
  DR.thumbNow = (r) => cache.get(keyOf(r));
  /** Dimensions etc. (after the thumbnail was made). */
  DR.mediaInfo = (r) => info.get(r.id) || null;
  /** Fill an element with the thumbnail when ready. */
  DR.fillThumb = function (box, r) {
    DR.thumb(r).then((url) => {
      if (!url || !box.isConnected && box.dataset.wait !== '1') return;
      const img = DR.el('img', { src: url, alt: '', draggable: 'false', decoding: 'async' });
      box.replaceChildren(img); box.classList.add('has-img');
    });
  };
})(window.DR);
