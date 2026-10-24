/* QR SLOP: the page. Wires the header, the tabs, the panels, the preview and the exports to the state in state.js.
 * Exposes window.QRApp, which the batch view, the commands and the tests use. Classic script. */
(function () {
  'use strict';
  if (window.QRApp) return;
  const $ = (id) => document.getElementById(id);
  const toast = (m) => window.SlopUI.toast(m);
  const Q = () => window.QRState;
  const S = () => window.QRState.S;
  const TABS = ['templates', 'content', 'design', 'logo', 'raw', 'batch'];
  const NAMES = { templates: 'Templates', content: 'Content', design: 'Design', logo: 'Logo', raw: 'Raw text', batch: 'Batch' };

  let last = null;      // { text, svg } for the code on screen, or null
  let touched = false;  // after the first edit, errors show; before it the form only says what to do
  let dirty = false;    // changed since the last save or open
  let tab = 'content', tabs = null;
  let barKey = '';
  let bar = null;

  const opts = () => Q().renderOpts();
  const px = () => opts().size;
  const base = () => window.QRSave.baseName(S());

  /** The header's actions and the ⋯ menu. They follow whether there is a code to act on. */
  function actions() {
    const has = !!last;
    return [
      { id: 'save', label: 'Save to Drive', icon: 'save', primary: true, disabled: !has, onClick: saveDrive },
      { id: 'open', label: 'Open from Drive', icon: 'open', onClick: openDrive },
      { id: 'buffer', label: 'Copy to buffer', icon: 'copy', disabled: !has, onClick: toBuffer },
    ];
  }
  function menu() {
    const has = !!last;
    return [
      { id: 'dl-svg', label: 'Download SVG', icon: 'download', disabled: !has, onClick: downloadSvg },
      { id: 'dl-png', label: 'Download PNG', icon: 'download', disabled: !has, onClick: downloadPng },
      { id: 'dl-pdf', label: 'Download print page (PDF)', icon: 'print', disabled: !has, onClick: downloadPdf },
      { separator: true },
      { id: 'cmd', label: 'Commands', onClick: () => { if (window.SlopCmd && SlopCmd.open) SlopCmd.open(); } },
    ];
  }
  function syncBar() {
    if (!bar) return;
    bar.setDirty(dirty);
    const key = (last ? '1' : '0');
    if (key === barKey) return;
    barKey = key;
    bar.setActions(actions());
    bar.setMenu(menu());
  }

  function meta(text) {
    const logo = S().logo.href ? ' · logo ' + Math.round(opts().logo.frac * 100) + '%' : '';
    return px() + ' px · error correction ' + opts().ec + ' · ' + window.QRPayload.byteLength(text) + ' bytes' + logo;
  }

  /** Redraws the preview, the message, the buttons and the header from the state. Cheap enough to run on every key. */
  function refresh() {
    const r = Q().encodedText();
    let err = r.ok || !touched ? '' : r.error;
    let svg = null;
    last = null;
    if (r.ok) {
      try { svg = window.QRExport.svgFor(r.text, opts()); last = { text: r.text, svg }; }
      catch (e) { err = e.message; }
    }
    window.QRPreview.show(svg);
    if (svg) window.QRPreview.prepare(svg, px());
    $('qr-off').hidden = !!svg || !!err;
    $('qr-err').textContent = err;
    $('qr-meta').textContent = svg ? meta(r.text) : '';
    for (const id of ['qr-dl-svg', 'qr-dl-png', 'qr-dl-pdf', 'qr-copy']) $(id).disabled = !last;
    syncBar();
    return last;
  }
  /** An edit: the form, raw text, design or logo changed. */
  function edit() { touched = true; dirty = true; refresh(); }

  /* ---------- tabs and panels ---------- */
  function setTab(t) {
    if (!TABS.includes(t)) return;
    tab = t;
    tabs.show(t);   // SlopTabs (shared/ui/tabs.js): the panel, the selected tab and the arrow keys
    drawTab(t);
  }
  function drawTab(t = tab) {
    if (t === 'content') drawContent();
    else if (t === 'design') window.QRPanelDesign.drawDesign($('qr-design'), S().style, designChange);
    else if (t === 'logo') window.QRPanelDesign.drawLogo($('qr-logo'), S().logo, logoActs);
    else if (t === 'raw') drawRaw();
    else if (t === 'batch' && window.QRBatch) window.QRBatch.refresh();
  }
  function drawContent() {
    $('qr-name').value = S().label;
    window.QRPanelContent.drawKinds($('qr-kinds'), S().kind, (k) => { Q().setKind(k); drawContent(); edit(); });
    window.QRPanelContent.drawForm($('qr-form'), S().kind, Q().vals(), (k, v) => { Q().setValue(k, v); edit(); });
  }
  function drawRaw() {
    const r = Q().encodedText();
    const typed = S().raw !== null;
    if (!typed) $('qr-raw').value = r.ok ? r.text : '';
    $('qr-raw-note').textContent = typed
      ? 'Encoding this text exactly as typed. Edits here fill the form when the kind allows it.'
      : 'Showing the text built from the form. Edit it here to encode exactly this text.';
    $('qr-raw-reset').disabled = !typed;
  }
  function designChange(k, v) { S().style[k] = v; edit(); }
  const logoActs = {
    async file(f) {
      try { S().logo.href = await window.QRLogo.fromFile(f); S().logo.name = f.name; S().logo.mark = ''; logoDone(); }
      catch (e) { toast(e.message); }
    },
    async mark(id) {
      try { S().logo.href = await window.QRLogo.fromMark(id); S().logo.mark = id; S().logo.name = ''; logoDone(); }
      catch (e) { toast(e.message); }
    },
    remove() { S().logo.href = null; S().logo.name = ''; S().logo.mark = ''; logoDone(); },
    width(f) { S().logo.frac = window.QRRender.clampLogo(f); edit(); },
  };
  function logoDone() { edit(); drawTab('logo'); }

  function applyTemplate(id) {
    const t = window.QRTemplates.get(id);
    if (!t || !Q().applyTemplate(id)) return;
    Q().setLabel(t.name);
    touched = true; dirty = true;
    setTab('content');
    refresh();
    toast('Filled in “' + t.name + '”. Change the details, then download.');
  }

  /* ---------- exports ---------- */
  function downloadSvg() { if (last) window.SlopUI.download(new Blob([last.svg], { type: 'image/svg+xml' }), base() + '.svg'); }
  async function downloadPng() {
    if (!last) return;
    try { window.SlopUI.download(await window.QRPreview.pngFor(last.svg, px()), base() + '.png'); }
    catch (e) { toast(e.message); }
  }
  async function downloadPdf() {
    if (!last) return;
    try {
      const png = await window.QRPreview.pngFor(last.svg, px());
      const pdf = await window.QRExport.toPdf(png, { title: S().label || 'QR code', line: last.text });
      window.SlopUI.download(pdf, base() + '-print.pdf');
    } catch (e) { toast('Could not make the PDF: ' + e.message); }
  }
  async function copyText() {
    if (!last) return;
    try { await navigator.clipboard.writeText(last.text); toast('Copied the encoded text.'); }
    catch (e) { toast('Could not copy. Select the text in the Raw tab and copy it.'); }
  }

  /* ---------- Slop Drive and the buffer ---------- */
  async function saveDrive() {
    if (!last) return;
    try {
      const folder = await window.QRSave.chooseFolder();
      if (folder === undefined) return;
      const png = await window.QRPreview.pngFor(last.svg, px());
      const name = base();
      await window.QRSave.saveTo(folder, png, Q().snapshot(), name);
      dirty = false; syncBar();
      toast('Saved to Slop Drive as ' + name + '.png');
    } catch (e) { toast('Could not save to Slop Drive: ' + e.message); }
  }
  async function openDrive() {
    try {
      const r = await window.QRSave.openPicked();
      if (!r) return;
      if (!r.snapshot || !Q().restore(r.snapshot)) { toast('That file has no QR settings. Pick a PNG saved by QR SLOP, or its .qr.json record.'); return; }
      touched = true; dirty = false;
      redrawAll();
      toast('Opened ' + r.name + ' with its settings.');
    } catch (e) { toast('Could not open from Slop Drive: ' + e.message); }
  }
  function redrawAll() {
    $('qr-name').value = S().label;
    drawTab(tab);
    refresh();
  }
  async function toBuffer() {
    if (!last) return;
    try {
      await window.QRSave.toBuffer(await window.QRPreview.pngFor(last.svg, px()));
      toast('Copied to the buffer. Paste or drop it into another app.');
    } catch (e) { toast('Could not copy to the buffer: ' + e.message); }
  }

  /** Batch cards: the same options, one code per text. */
  function svgFor(text) { return window.QRExport.svgFor(text, opts()); }
  function saveSvg(svg, name) { window.SlopUI.download(new Blob([svg], { type: 'image/svg+xml' }), 'qr-' + name + '.svg'); }
  async function savePng(svg, name) {
    try { window.SlopUI.download(await window.QRExport.toPng(svg, px()), 'qr-' + name + '.png'); }
    catch (e) { toast(e.message); }
  }

  function init() {
    bar = window.SlopAppBar.mount($('qr-bar'), {
      home: '../', title: 'QR SLOP', subtitle: 'Codes with logos, templates and a live preview. Nothing is uploaded.', actions: [], menu: [],
    });
    window.QRPreview.init();
    window.QRPanelContent.drawTemplates($('qr-templates'), applyTemplate);
    for (const k of TABS) $('qr-tab-' + k).textContent = NAMES[k];
    tabs = window.SlopTabs.mount($('qr-tabs'), { select: setTab, panel: (k) => $('qr-panel-' + k) });
    $('qr-name').addEventListener('input', () => { Q().setLabel($('qr-name').value); dirty = true; syncBar(); });
    $('qr-raw').addEventListener('input', () => { Q().setRaw($('qr-raw').value); edit(); drawRaw(); });
    $('qr-raw-reset').addEventListener('click', () => { Q().clearRaw(); drawRaw(); edit(); });
    $('qr-dl-svg').addEventListener('click', downloadSvg);
    $('qr-dl-png').addEventListener('click', downloadPng);
    $('qr-dl-pdf').addEventListener('click', downloadPdf);
    $('qr-copy').addEventListener('click', copyText);
    setTab(tab);
    refresh();
  }

  window.QRApp = {
    init, refresh, edit, setTab, tab: () => tab, last: () => last, state: S, svgFor, saveSvg, savePng,
    downloadSvg, downloadPng, downloadPdf, copyText, toBuffer, saveDrive, openDrive, applyTemplate, redrawAll,
  };
})();
