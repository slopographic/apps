/* QR SLOP: rendering. Encodes text with the vendored bwip-js (window.bwipjs.raw, the call SlopLabel makes), and draws the
 * module grid as one SVG path. A transparent background leaves out the background shape, so the code has no fill at all.
 * Classic script; exposes window.QRRender. qrSvg() and modulePath() are pure, so the node tests can call them. */
(function (g) {
  'use strict';
  if (g.QRRender) return;

  /** The quiet zone, in modules, on every side. QR readers need it. */
  const QUIET = 4;
  const LEVELS = ['L', 'M', 'Q', 'H'];
  const HEX = /^#[0-9a-f]{6}$/i;

  /** Pixel size for the output: whole pixels from 16 to 4096. */
  const clampSize = (v) => Math.max(16, Math.min(4096, Math.round(+v || 512)));

  /** Encodes text. Returns { cols, rows, pixs }, pixs row-major with a truthy value for each dark module. Throws on failure. */
  function encode(text, level) {
    if (!g.bwipjs) throw new Error('The QR encoder did not load.');
    const eclevel = LEVELS.includes(level) ? level : 'M';
    let r;
    try { r = g.bwipjs.raw({ bcid: 'qrcode', text: String(text), eclevel })[0]; } catch (e) {
      throw new Error('This text does not fit in one QR code at level ' + eclevel + '. Use a lower error correction level or shorter text.');
    }
    return { cols: r.pixx, rows: r.pixy, pixs: r.pixs };
  }

  /** Path data for the dark modules: one horizontal run per "M x y h w v1 h-w z", in module units with the quiet zone added. */
  function modulePath(m) {
    let d = '';
    for (let r = 0; r < m.rows; r++) {
      let c = 0;
      while (c < m.cols) {
        if (!m.pixs[r * m.cols + c]) { c++; continue; }
        let e = c;
        while (e + 1 < m.cols && m.pixs[r * m.cols + e + 1]) e++;
        const w = e - c + 1;
        d += 'M' + (c + QUIET) + ' ' + (r + QUIET) + 'h' + w + 'v1h-' + w + 'z';
        c = e + 1;
      }
    }
    return d;
  }

  const colour = (v, dflt) => (HEX.test(String(v || '')) ? String(v).toLowerCase() : dflt);

  /** SVG markup for a matrix. o: { size (px), fg, bg (hex), transparent (bool) }. Colours are checked, so no text reaches the markup. */
  function qrSvg(m, o = {}) {
    const side = m.cols + 2 * QUIET;
    const size = clampSize(o.size);
    const bg = o.transparent ? '' : '<rect width="' + side + '" height="' + side + '" fill="' + colour(o.bg, '#ffffff') + '"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 ' + side + ' ' + side +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code">' + bg +
      '<path fill="' + colour(o.fg, '#000000') + '" d="' + modulePath(m) + '"/></svg>';
  }

  /** PNG blob drawn from the SVG text at size px. The canvas starts clear, so a transparent code gives a transparent PNG. */
  function svgToPng(svgText, size) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
      const img = new Image();
      img.onload = () => {
        const px = clampSize(size);
        const cv = document.createElement('canvas');
        cv.width = px; cv.height = px;
        const cx = cv.getContext('2d');
        cx.clearRect(0, 0, px, px);
        cx.drawImage(img, 0, 0, px, px);
        URL.revokeObjectURL(url);
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error('The PNG could not be made.'))), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('The picture could not be drawn.')); };
      img.src = url;
    });
  }

  g.QRRender = Object.freeze({ QUIET, LEVELS, clampSize, encode, modulePath, qrSvg, svgToPng });
})(typeof window !== 'undefined' ? window : globalThis);
