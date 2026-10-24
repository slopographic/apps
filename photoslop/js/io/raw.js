/* PhotoSlop: camera RAW files (CR2, CR3, NEF, ARW, DNG, RAF, ORF, RW2, PEF, SRW and the rest SlopRaw knows, shared/raw/).
 * Opening one shows the Develop dialog: the camera's embedded preview at once, then a half-size develop from the LibRaw
 * engine (downloaded once, after the shared first-use notice) that follows the White balance, Exposure and Highlights
 * controls. Open develops the full-size picture (8-bit sRGB, the camera's orientation applied) as one Background layer.
 * "Use embedded preview" opens the camera's JPEG without the engine. Cancel opens nothing (err.code 'cancelled').
 * Reached from readAnyFile (io/formats.js): File ▸ Open, drop, and Slop Drive files stored with an image/* type. */
'use strict';

function rawCancelled() { const e = new Error('Opening was cancelled'); e.code = 'cancelled'; return e; }
const RAW_WB = [['camera', 'As shot'], ['auto', 'Auto'], ['daylight', 'Daylight']];
const RAW_HL = [['clip', 'Clip'], ['blend', 'Blend'], ['rebuild', 'Rebuild']];

/** "Canon EOS R5 · ISO 400 · 1/250 s · f/2.8 · 50 mm" from the camera settings. */
function rawMetaLine(m) {
  const sh = m.shutter ? (m.shutter >= 1 ? `${+m.shutter.toFixed(1)} s` : `1/${Math.round(1 / m.shutter)} s`) : '';
  const cam = m.model && m.make && !m.model.toLowerCase().startsWith(m.make.toLowerCase().split(' ')[0]) ? `${m.make} ${m.model}` : m.model || m.make;
  return [cam, m.iso ? `ISO ${m.iso}` : '', sh, m.aperture ? `f/${+m.aperture.toFixed(1)}` : '', m.focal ? `${Math.round(m.focal)} mm` : ''].filter(Boolean).join(' · ');
}

/** Draws a canvas into the dialog's preview canvas, fitted. */
function rawShow(view, src) {
  const k = Math.min(1, 640 / Math.max(src.width, src.height));
  view.width = Math.max(1, Math.round(src.width * k)); view.height = Math.max(1, Math.round(src.height * k));
  const g = view.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, view.width, view.height);
}

/** Opens a RAW file through the Develop dialog. Resolves with a document { w, h, layers }. */
async function readRawFile(f) {
  const bytes = new Uint8Array(await f.arrayBuffer());
  const kind = SlopRaw.sniff(bytes, f.name), meta = SlopRaw.meta(bytes);
  const embedded = await SlopRaw.previewCanvas(bytes).catch(() => null);
  const opts = { wb: 'camera', exposure: 0, highlights: 'clip' };
  const view = h('canvas', { class: 'raw-view', 'aria-label': 'Develop preview' });
  const status = h('p', { class: 'dlg-p raw-status', role: 'status' }, embedded ? 'Camera preview. Developing…' : 'Developing…');
  const wb = h('select', { 'aria-label': 'White balance' }, RAW_WB.map(([v, l]) => h('option', { value: v }, l)));
  const ev = h('input', { type: 'range', min: -3, max: 3, step: 0.1, value: 0, 'aria-label': 'Exposure' }), evn = h('span', { class: 'fp-u' }, '0.0 EV');
  const hl = h('select', { 'aria-label': 'Highlights' }, RAW_HL.map(([v, l]) => h('option', { value: v }, l)));
  if (embedded) rawShow(view, embedded.canvas);
  let tok = 0, timer = 0, engineOk = null, closed = false;
  const develop = async () => {
    const my = ++tok;
    status.textContent = 'Developing…';
    try {
      const r = await SlopRaw.decode(bytes, { ...opts, half: true });
      engineOk = true;
      if (my !== tok || closed) return;
      rawShow(view, SlopRaw.toCanvas(r));
      status.textContent = `Preview at half size. Open develops ${r.width * 2} × ${r.height * 2} px.`;
    } catch (e) {
      engineOk = false;
      if (my !== tok || closed) return;
      status.textContent = e.code === 'declined' ? 'The RAW engine was not downloaded. You can open the camera\'s embedded preview.' : `The RAW engine could not develop this file: ${e.message}`;
    }
  };
  const later = () => { clearTimeout(timer); timer = setTimeout(develop, 250); };
  wb.addEventListener('change', () => { opts.wb = wb.value; later(); });
  hl.addEventListener('change', () => { opts.highlights = hl.value; later(); });
  ev.addEventListener('input', () => { opts.exposure = +ev.value; evn.textContent = `${opts.exposure >= 0 ? '+' : ''}${opts.exposure.toFixed(1)} EV`; later(); });
  const body = h('div', { class: 'form raw-dev' },
    h('div', { class: 'raw-pane' }, view),
    h('div', { class: 'raw-side' },
      h('p', { class: 'dlg-p mono' }, [kind ? kind.label : 'Camera RAW', rawMetaLine(meta)].filter(Boolean).join(' · ')),
      field('White balance', wb), field('Exposure', ev, evn), field('Highlights', hl), status));
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn) => { done = true; closed = true; clearTimeout(timer); fn(); };
    const asDoc = (c) => ({ w: c.width, h: c.height, layers: [{ name: 'Background', canvas: c }] });
    const buttons = [{ label: 'Cancel' }];
    if (embedded) buttons.push({ label: 'Use embedded preview', act: () => { finish(() => resolve(asDoc(embedded.canvas))); return true; } });
    buttons.push({ label: 'Open', primary: true, act: async () => {
      if (engineOk === false && !embedded) return false;
      status.textContent = 'Developing the full-size picture…';
      try {
        const r = await SlopRaw.decode(bytes, { ...opts, half: false }, (t) => { status.textContent = t; });
        finish(() => resolve(asDoc(SlopRaw.toCanvas(r))));
      } catch (e) {
        if (!embedded) { status.textContent = `Could not develop: ${e.message}`; return false; }
        toast('Opened the camera\'s embedded preview: the RAW engine is not available.', 4200);
        finish(() => resolve(asDoc(embedded.canvas)));
      }
    } });
    dialog({ title: `Develop ${f.name || 'RAW photo'}`, body, cls: 'dlg-raw', buttons, onClose: () => { if (!done) finish(() => reject(rawCancelled())); } });
    develop();
  });
}
