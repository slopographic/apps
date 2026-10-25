/* Denoise page: a photo in, a filtered copy out. The filters run on this page with no model, on a copy reduced to
 * 2048 px on its long side. The before and after slider clips the filtered canvas over the original. */
(function () {
  'use strict';
  const T = window.SlopAITools, F = window.SlopAIFilters, $ = (id) => document.getElementById(id);
  const MAX = 2048;
  let src = null, outCanvas = null;

  /** Draws the image at most MAX px on its long side; returns the RGBA data and size. */
  function load(bitmap) {
    const k = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height)), w = Math.round(bitmap.width * k), h = Math.round(bitmap.height * k);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bitmap, 0, 0, w, h);
    return { w, h, rgba: g.getImageData(0, 0, w, h).data };
  }
  function paint(canvas, rgba, w, h) {
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba), w, h), 0, 0);
  }
  function apply() {
    if (!src) return;
    $('run').disabled = true; $('msg').textContent = 'Filtering…';
    // Yield once so the message shows before the loop starts.
    setTimeout(() => {
      const t0 = performance.now();
      const rgba = F.denoise(src.rgba, src.w, src.h, { mode: $('mode').value, strength: +$('strength').value });
      paint($('after'), rgba, src.w, src.h);
      outCanvas = $('after');
      $('msg').textContent = `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s. Drag the slider to compare.`;
      $('compare').hidden = false; $('dl').disabled = false; $('run').disabled = false;
    }, 30);
  }
  function pick(f) {
    if (!f || !/^image\//.test(f.type)) { $('msg').textContent = 'Choose an image file.'; return; }
    createImageBitmap(f).then((bmp) => {
      src = load(bmp);
      paint($('before'), src.rgba, src.w, src.h);
      paint($('after'), src.rgba, src.w, src.h);
      $('run').disabled = false; $('msg').textContent = `${f.name}: ${src.w} × ${src.h} px. Press Apply.`;
      $('compare').hidden = false; $('dl').disabled = true;
      applySplit();
    }).catch(() => { $('msg').textContent = 'That picture could not be read.'; });
  }
  function applySplit() { $('after').style.clipPath = `inset(0 ${100 - +$('split').value}% 0 0)`; }
  // the one way in (aitools/intake.js): a drop on the box, choose a file, a paste, a launch
  const intake = T.intake('ai-denoise', { accept: { types: ['image/*'], exts: ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.avif'], noun: 'an image' }, read: (f) => pick(f) });
  $('strength').addEventListener('input', (e) => { $('sv').textContent = e.target.value; });
  $('run').addEventListener('click', apply);
  $('split').addEventListener('input', applySplit);
  $('dl').addEventListener('click', () => { if (outCanvas) outCanvas.toBlob((b) => T.download('denoised.png', b, 'image/png')); });
  T.gate('denoise', () => { $('ui').hidden = false; intake.launch(); });
})();
