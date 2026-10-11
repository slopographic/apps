// Slop Effects render dialog: the format (PNG sequence zip, or WebM or MP4 where the browser can record it), the range
// (the whole composition or the play range) and a progress bar. The render draws the document it had when it started, so
// later edits do not change a render in progress. The file downloads when it is done. Classic script:
// window.SlopEffects.renderDialog.
(function (g) {
  'use strict';
  const ns = (g.SlopEffects = g.SlopEffects || {});
  const { h } = ns.dom;

  /** Opens the render dialog. toast(msg) shows a message. */
  function open(S, toast) {
    const formats = ns.render.formats();
    const format = h('select', { class: 'sui-input', 'aria-label': 'Format' }, formats.map((f) => h('option', { value: f.id }, f.label)));
    const range = h('select', { class: 'sui-input', 'aria-label': 'Range' },
      h('option', { value: 'all' }, `Whole composition (${S.doc.comp.duration.toFixed(2)} s)`),
      h('option', { value: 'range', disabled: S.range ? null : true }, S.range ? `Play range (${S.range.in.toFixed(2)}–${S.range.out.toFixed(2)} s)` : 'Play range (set In and Out first)'));
    const bar = h('progress', { max: 1, value: 0, style: 'width:100%', 'aria-label': 'Render progress' });
    const status = h('p', { class: 'fx-empty', style: 'padding:0;text-align:left', role: 'status' }, `${S.doc.comp.width}×${S.doc.comp.height} at ${S.doc.comp.fps} fps.`);
    const note = h('p', { class: 'fx-empty', style: 'padding:0;text-align:left' }, 'PNG frames keep transparency when the background is transparent. Video is recorded in real time.');
    let busy = false, cancel = false, box = null;
    const doc = S.doc; // the render uses this document, so later edits do not change it
    const safe = String(doc.name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Untitled';

    /** Renders and downloads. */
    async function run() {
      busy = true; cancel = false;
      const fmt = format.value;
      const r = range.value === 'range' && S.range ? { in: S.range.in, out: S.range.out } : null;
      const opts = { media: ns.media, range: r, onProgress: (f) => { bar.value = f; status.textContent = `Rendering ${Math.round(f * 100)}%`; }, cancel: () => cancel };
      const t0 = performance.now();
      try {
        status.textContent = 'Rendering…';
        const blob = fmt === 'png' ? await ns.render.renderPng(doc, opts) : await ns.render.renderVideo(doc, { ...opts, format: fmt });
        const name = fmt === 'png' ? `${safe}-frames.zip` : `${safe}.${fmt}`;
        ns.render.download(blob, name);
        status.textContent = `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s: ${name} (${(blob.size / 1048576).toFixed(2)} MB)`;
        bar.value = 1;
        toast('Render downloaded');
      } catch (e) {
        status.textContent = e.message === 'cancelled' ? 'Cancelled' : `Render failed: ${e.message}`;
      } finally {
        busy = false;
      }
      return false;
    }

    box = g.SlopUI.dialog({
      title: 'Render', body: h('div', { class: 'fx-group' },
        h('div', { class: 'fx-row' }, h('label', null, 'Format'), format, h('span')),
        h('div', { class: 'fx-row' }, h('label', null, 'Range'), range, h('span')),
        bar, status, note),
      buttons: [
        { label: 'Close', act: () => { if (busy) { cancel = true; return false; } } },
        { label: 'Render', primary: true, act: () => { if (busy) return false; run(); return false; } },
      ],
      onClose: () => { cancel = true; },
    });
    return box;
  }

  ns.renderDialog = { open };
})(typeof window !== 'undefined' ? window : globalThis);
