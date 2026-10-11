/* QR SLOP: app state and the single-code view. Holds the kind of code, its values for each kind, and the output options.
 * Draws the preview, downloads SVG and PNG, and copies the encoded text. Classic script; exposes window.QRApp. */
(function () {
  'use strict';
  if (window.QRApp) return;
  const $ = (id) => document.getElementById(id);
  const E = (tag, attrs, ...kids) => window.SlopUI.el(tag, attrs, ...kids);
  const toast = (m) => window.SlopUI.toast(m);
  const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');

  const S = {
    type: 'text', values: {}, mode: 'single',
    opts: { size: 512, ec: 'M', fg: '#000000', bg: '#ffffff', transparent: false },
  };
  let last = null; // { text, svg } for the code on screen, or null when the form is not complete

  const vals = () => (S.values[S.type] = S.values[S.type] || {});
  const current = () => window.QRPayload.build(S.type, vals());
  /** SVG markup for one text at the current output options. Throws when the text does not fit. */
  const svgFor = (text) => window.QRRender.qrSvg(window.QRRender.encode(text, S.opts.ec), S.opts);

  function placeholder() {
    return E('p', { class: 'qr-off' }, 'Fill in the form to see the code.');
  }

  /** Redraws the preview, the encoded text, the message and the buttons from the current form and options. */
  function refresh() {
    const r = current();
    $('qr-payload').textContent = r.ok ? r.text : '';
    $('qr-err').textContent = r.ok ? '' : r.error;
    const pv = $('qr-preview');
    last = null;
    if (r.ok) {
      try {
        last = { text: r.text, svg: svgFor(r.text) };
        pv.innerHTML = last.svg;
        $('qr-err').textContent = '';
      } catch (e) { pv.replaceChildren(); $('qr-err').textContent = e.message; }
    } else pv.replaceChildren(placeholder());
    for (const id of ['qr-svg', 'qr-png', 'qr-copy']) $(id).disabled = !last;
  }

  /** An output option changed: the single code and the batch cards are both drawn again. */
  function optionsChanged() {
    refresh();
    if (window.QRBatch) window.QRBatch.refresh();
  }

  /** Downloads an SVG markup string as a file. */
  function saveSvg(svg, base) {
    window.SlopUI.download(new Blob([svg], { type: 'image/svg+xml' }), 'qr-' + base + '.svg');
  }
  /** Downloads an SVG markup string as a PNG at the chosen size; a transparent code stays transparent. */
  async function savePng(svg, base) {
    try {
      const blob = await window.QRRender.svgToPng(svg, S.opts.size);
      window.SlopUI.download(blob, 'qr-' + base + '.png');
    } catch (e) { toast(e.message); }
  }

  const fileBase = () => S.type + '-' + stamp();
  function downloadSvg() { if (last) saveSvg(last.svg, fileBase()); }
  function downloadPng() { if (last) savePng(last.svg, fileBase()); }
  async function copyText() {
    if (!last) return;
    try { await navigator.clipboard.writeText(last.text); toast('Copied the encoded text.'); }
    catch (e) { toast('Could not copy. Select the text above and copy it.'); }
  }

  function setType(t) {
    if (!window.QRPayload.TYPES.includes(t)) return;
    S.type = t;
    const sel = $('qr-type');
    if (sel) sel.value = t;
    drawForm();
    refresh();
  }
  function drawForm() {
    window.QRForms.draw($('qr-form'), S.type, vals(), (k, v) => { vals()[k] = v; refresh(); });
  }

  /** Output options: size, error correction, colours and a transparent background. */
  function drawOptions() {
    const host = $('qr-opts');
    const o = S.opts;
    const size = window.SlopUI.number(o.size, 16, 4096, 1);
    size.id = 'qr-size';
    const ec = window.SlopUI.select([['L', 'L (7%)'], ['M', 'M (15%)'], ['Q', 'Q (25%)'], ['H', 'H (30%)']], o.ec);
    const fg = E('input', { type: 'color', value: o.fg, 'aria-label': 'Code colour' });
    const bg = E('input', { type: 'color', value: o.bg, 'aria-label': 'Background colour' });
    const tr = window.SlopUI.check('Transparent background', o.transparent);
    const sync = () => { bg.disabled = o.transparent; };
    size.addEventListener('input', () => { o.size = window.QRRender.clampSize(size.value); optionsChanged(); });
    ec.addEventListener('change', () => { o.ec = ec.value; optionsChanged(); });
    fg.addEventListener('input', () => { o.fg = fg.value; optionsChanged(); });
    bg.addEventListener('input', () => { o.bg = bg.value; optionsChanged(); });
    tr.input.addEventListener('change', () => { o.transparent = tr.input.checked; sync(); optionsChanged(); });
    sync();
    host.replaceChildren(
      window.SlopUI.field('Size (px)', size),
      window.SlopUI.field('Error correction', ec),
      window.SlopUI.field('Code colour', fg),
      window.SlopUI.field('Background colour', bg),
      tr.el,
    );
  }

  /** Switches between the single code and the batch grid. */
  function setMode(m) {
    S.mode = m === 'batch' ? 'batch' : 'single';
    $('qr-single').hidden = S.mode !== 'single';
    $('qr-batch').hidden = S.mode !== 'batch';
    $('qr-mode-single').setAttribute('aria-pressed', String(S.mode === 'single'));
    $('qr-mode-batch').setAttribute('aria-pressed', String(S.mode === 'batch'));
    if (S.mode === 'batch' && window.QRBatch) window.QRBatch.refresh();
  }

  function init() {
    const sel = window.SlopUI.select(window.QRPayload.TYPES.map((t) => [t, window.QRPayload.LABELS[t]]), S.type);
    sel.id = 'qr-type';
    sel.addEventListener('change', () => setType(sel.value));
    $('qr-typehost').replaceChildren(window.SlopUI.field('Kind of code', sel));
    drawOptions();
    drawForm();
    $('qr-svg').addEventListener('click', downloadSvg);
    $('qr-png').addEventListener('click', downloadPng);
    $('qr-copy').addEventListener('click', copyText);
    $('qr-mode-single').addEventListener('click', () => setMode('single'));
    $('qr-mode-batch').addEventListener('click', () => setMode('batch'));
    refresh();
  }

  window.QRApp = {
    S, init, refresh, setType, setMode, svgFor, saveSvg, savePng, downloadSvg, downloadPng, copyText,
    current, last: () => last,
  };
})();
