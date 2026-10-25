/* Slop Font: "Trace a picture": a photo or scan of a letter drawn on paper (or any black-on-white or transparent PNG)
 * traced into the glyph on screen (core/trace.js), with the ink threshold to adjust and the result shown before it is
 * kept. A picture of a whole filled handwriting sheet goes to js/io/sheet-ui.js instead (the dialog offers it, and a
 * picture with the sheet's four corner squares is recognised). Classic script.
 *   FC.traceUi.pick()        choose a picture (shared intake, part 'fontcreator.trace')
 *   open(file)               the dialog            pixels(fileOrBlob, max) → Promise<ImageData-like>
 *   apply(img, { threshold, fit: cap | x | em, add }) → contour count (one undo step) */
(function (g) {
  'use strict';
  const S = () => g.FC.state, F = () => g.SlopFont;
  let partId = null;
  async function pixels(file, max = 700) {
    let bmp;
    try { bmp = await createImageBitmap(file); } catch (e) { throw new Error(`${file.name || 'The picture'} could not be read as a picture`); }
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * s)), h = Math.max(1, Math.round(bmp.height * s));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    return x.getImageData(0, 0, w, h);
  }
  function placeOf(img, fit) {
    const m = S().project().metrics;
    if (fit === 'em') return { mode: 'box', top: 0, bottom: img.height, ascender: m.ascender, descender: m.descender, left: 50 };
    return { mode: 'fit', height: fit === 'x' ? m.xHeight : m.capHeight, left: 50 };
  }
  function traced(img, o) { return F().trace.trace(img, { threshold: o.threshold == null || o.threshold === '' ? null : Number(o.threshold), place: placeOf(img, o.fit) }); }
  function apply(img, o = {}) {
    const r = traced(img, o);
    if (!r.contours.length) throw new Error('No ink found: try a higher threshold, or a picture with darker lines');
    S().edit('Trace a picture', 'glyph', (p, gl) => {
      gl.contours = o.add ? gl.contours.concat(r.contours) : r.contours;
      if (!o.add && r.advance) gl.advance = r.advance;
    });
    return r.contours.length;
  }
  function preview(svgHost, r) {
    const m = S().project().metrics, adv = Math.max(r.advance || m.upm * 0.6, 10);
    svgHost.innerHTML = r.contours.length ? g.FC.grid.svgOf({ contours: r.contours, advance: adv }, m) : '<p class="sui-p">No ink found at this threshold.</p>';
  }
  async function open(file) {
    const U = g.SlopUI, el = U.el;
    const img = await pixels(file, 1600);
    const bits = F().trace.binarize(img);
    if (F().sheet.findMarkers(bits.bits, img.width, img.height)) {
      if (await U.confirm('A handwriting sheet?', 'This picture has the four corner squares of a handwriting sheet. Read every box into the font?', 'Read the sheet')) return g.FC.sheetUi.read(img, file.name);
    }
    const small = await pixels(file, 700);
    const thr = el('input', { type: 'range', id: 'fc-trace-threshold', min: '20', max: '240', step: '1', 'aria-label': 'Ink threshold' });
    const fit = el('select', { class: 'sui-input', id: 'fc-trace-fit' });
    for (const [v, t] of [['cap', 'Fit to the cap height'], ['x', 'Fit to the x-height'], ['em', 'The picture is the em square (top: ascender, bottom: descender)']]) fit.append(el('option', { value: v }, t));
    if (S().view().unicode != null && /\p{Ll}/u.test(String.fromCodePoint(S().view().unicode))) fit.value = 'x';
    const add = el('input', { type: 'checkbox', id: 'fc-trace-add' }), out = el('div', { class: 'fc-trace-preview', id: 'fc-trace-preview' }), note = el('p', { class: 'sf-note' });
    let threshold = null;
    const redo = () => { try { const r = traced(small, { threshold, fit: fit.value }); thr.value = String(r.threshold); preview(out, r); note.textContent = `${r.loops} contour${r.loops === 1 ? '' : 's'} at threshold ${r.threshold}.`; } catch (e) { note.textContent = e.message; } };
    thr.addEventListener('input', () => { threshold = Number(thr.value); redo(); });
    fit.addEventListener('change', redo);
    const sheet = el('button', { type: 'button', class: 'sui-btn', id: 'fc-trace-as-sheet' }, 'Read it as a handwriting sheet instead');
    let dlg = null;
    sheet.addEventListener('click', () => { if (dlg) dlg.close(false); g.FC.sheetUi.read(img, file.name); });
    const body = el('div', { class: 'fc-dlg' }, el('p', { class: 'sui-p' }, `Trace ${file.name || 'the picture'} into ${S().view().name}. Dark ink on light paper works best.`),
      out, note, U.field('Ink threshold', thr), U.field('Place it', fit), el('label', { class: 'fc-check' }, add, ' Add to the glyph (keep what is drawn)'), sheet);
    dlg = U.dialog({ title: 'Trace a picture', body, cls: 'fc-dialog', buttons: [{ label: 'Cancel' }, { label: 'Trace', primary: true, act: () => {
      try { const n = apply(small, { threshold, fit: fit.value, add: add.checked }); U.toast(`Traced ${n} contour${n === 1 ? '' : 's'}`); } catch (e) { U.toast(e.message); return false; }
    } }] });
    redo();
    return dlg;
  }
  function pick() {
    if (!partId) partId = g.SlopIntake.part({ id: 'fontcreator.trace', accept: { types: ['image/*'], noun: 'a picture' }, process: async (f) => { await open(f); return f.name; } });
    return g.SlopIntake.pick({ to: partId, accept: 'image/*' });
  }
  g.FC.traceUi = { pick, open, apply, pixels, traced };
})(window);
