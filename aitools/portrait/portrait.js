/* Portrait blur page: the person is found by the MODNet model that Slop Isolate uses (shared/cutout, run in its
 * worker). The mask is computed once per picture; the strength slider only re-composites, so it moves instantly.
 * Background = the picture blurred; foreground = the picture through the mask. */
(function () {
  'use strict';
  const T = window.SlopAITools, $ = (id) => document.getElementById(id);
  let picture = null, mask = null, maskW = 0, maskH = 0, fileName = 'portrait';

  /** A canvas of the picture at full size. */
  function canvasOf(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  /** The mask as a canvas (white = person) at the picture's size. */
  function maskCanvas(w, h) {
    const m = canvasOf(maskW, maskH);
    m.getContext('2d').putImageData(window.SlopCutout.maskToImageData(mask, maskW, maskH), 0, 0);
    const c = canvasOf(w, h), g = c.getContext('2d');
    g.imageSmoothingQuality = 'high'; g.drawImage(m, 0, 0, w, h);
    return c;
  }
  /** Blurred copy of the picture. Uses the canvas blur filter, or a down-and-up scale where the filter is missing. */
  function blurred(w, h, px) {
    const c = canvasOf(w, h), g = c.getContext('2d');
    if ('filter' in g) { g.filter = `blur(${px}px)`; g.drawImage(picture.bitmap, 0, 0, w, h); g.filter = 'none'; return c; }
    const k = Math.max(1, Math.round(px / 2)), small = canvasOf(Math.max(1, Math.round(w / k)), Math.max(1, Math.round(h / k)));
    small.getContext('2d').drawImage(picture.bitmap, 0, 0, small.width, small.height);
    g.imageSmoothingQuality = 'high'; g.drawImage(small, 0, 0, w, h);
    return c;
  }
  /** Composites the result for the current strength and paints it on the preview. */
  function render() {
    if (!picture || !mask) return;
    const w = picture.w, h = picture.h, s = +$('strength').value;
    $('sv').textContent = String(s);
    const px = Math.round((s / 100) * 0.04 * Math.min(w, h));
    const out = blurred(w, h, px), fg = canvasOf(w, h), fgc = fg.getContext('2d');
    fgc.drawImage(picture.bitmap, 0, 0, w, h);
    fgc.globalCompositeOperation = 'destination-in';
    fgc.drawImage(maskCanvas(w, h), 0, 0);
    out.getContext('2d').drawImage(fg, 0, 0);
    const view = $('view'), vw = Math.min(w, 1200), vh = Math.round((h * vw) / w);
    view.width = vw; view.height = vh;
    view.getContext('2d').drawImage(out, 0, 0, vw, vh);
    view._full = out;
  }
  async function segment() {
    $('msg').textContent = 'Finding the person…';
    try {
      const r = await window.SlopCutout.removeBackground(picture.file, { model: 'portrait', keep: false, onProgress: (p) => { if (p && p.phase) $('msg').textContent = p.phase === 'model' ? 'Loading the portrait model…' : p.phase === 'infer' ? 'Finding the person…' : 'Working…'; } });
      mask = r.mask; maskW = r.width; maskH = r.height;
      $('strength').disabled = false; $('dl').disabled = false;
      $('msg').textContent = 'Drag the strength to set how far the background blurs.';
      render();
    } catch (e) { $('msg').textContent = 'Could not blur the background: ' + e.message; }
  }
  async function pick(f) {
    if (!f || !/^image\//.test(f.type)) { $('msg').textContent = 'Choose an image file.'; return; }
    try {
      const img = await T.image(f);
      picture = { file: f, bitmap: img.bitmap, w: img.w, h: img.h };
      fileName = f.name.replace(/\.[^.]+$/, '') || 'portrait';
      mask = null;
      $('ui').hidden = false;
      await segment();
    } catch (e) { $('msg').textContent = 'That picture could not be read.'; }
  }
  $('file').addEventListener('change', (e) => pick(e.target.files[0]));
  $('drop').addEventListener('dragover', (e) => e.preventDefault());
  $('drop').addEventListener('drop', (e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); });
  $('strength').addEventListener('input', render);
  $('dl').addEventListener('click', () => { const v = $('view')._full; if (v) v.toBlob((b) => T.download(fileName + '-blur.png', b, 'image/png')); });
  T.gate('portrait', () => { $('ui').hidden = false; });
})();
