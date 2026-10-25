/* Slop HTML to PDF: the page. Opens one HTML file or pasted text, shows it on a paper-sized preview (an isolated
 * frame with the header), and prints through SlopPrint, or the built-in path when SlopPrint is missing.
 * Classic script. Nothing is uploaded: the file is read in this browser. */
(function () {
  'use strict';
  const H = window.H2P, S = H.sheet, SRC = H.source;
  const $ = (id) => document.getElementById(id);
  const PASTED = 'Pasted HTML';
  const st = { name: PASTED, html: '', images: new Map(), dims: [210, 297] };
  const px = (mm) => (mm * 96) / 25.4;

  /** The options from the page, plus the header's file name, date and QR code. */
  function options() {
    const mode = $('h2p-qr-mode').value, typed = $('h2p-qr-text').value.trim();
    return {
      paper: $('h2p-paper').value, orientation: $('h2p-orient').value, margin: $('h2p-margin').value,
      scale: $('h2p-scale').value, background: $('h2p-bg').checked, header: $('h2p-header').checked,
      fileName: st.name, date: S.isoDate(new Date()),
      url: mode === 'url' ? typed : '',
      qrSvg: H.qr.svg(mode !== 'file' && typed ? typed : st.name),
    };
  }
  const hasSource = () => st.html.trim() !== '';
  const cleaned = () => SRC.prepare(st.html, st.images);
  const status = (msg) => { $('h2p-status').textContent = msg; };

  /** Scales the paper to the stage width. The frame keeps its paper size inside, so the page lays out as printed. */
  function fit() {
    const box = $('h2p-paper-box'), frame = $('h2p-paper-frame');
    if (!box.clientWidth) return;
    const [w, h] = st.dims, k = Math.min(1.5, box.clientWidth / px(w));
    Object.assign(frame.style, { width: px(w) + 'px', height: px(h) + 'px', transform: `scale(${k})` });
    box.style.height = px(h) * k + 'px';
  }

  function render() {
    const has = hasSource(), mode = $('h2p-qr-mode').value;
    $('h2p-empty').hidden = has;
    $('h2p-paper-box').hidden = !has;
    $('h2p-print').disabled = !has;
    $('h2p-qr-text').disabled = mode === 'file';
    $('h2p-qr-label').textContent = mode === 'url' ? 'URL' : 'Custom text';
    if (!has) return;
    const o = options();
    st.dims = S.sizeMm(o);
    $('h2p-paper-frame').srcdoc = S.previewDoc(o, cleaned());
    fit();
  }

  function setSource(name, text) {
    st.name = name;
    st.html = String(text || '');
    render();
    status(hasSource() ? `${name} is ready. Remote images and fonts do not load.` : 'That is empty. Choose another file or paste HTML.');
  }

  async function openFile(file) {
    if (!file) return;
    if (!/\.html?$/i.test(file.name) && file.type !== 'text/html') { status('Choose an .html or .htm file.'); return; }
    try { setSource(file.name, await file.text()); } catch (e) { status('Could not read that file.'); }
  }

  function attachImages(files) {
    for (const url of st.images.values()) URL.revokeObjectURL(url);
    st.images = new Map();
    for (const f of files) if (/^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.name)) st.images.set(f.name, URL.createObjectURL(f));
    const names = [...st.images.keys()];
    $('h2p-image-list').textContent = names.length ? 'Attached: ' + names.join(', ') : 'No local images attached.';
    render();
  }

  function print() {
    if (!hasSource()) return;
    const o = options(), src = cleaned();
    const used = H.printPath.print({
      title: o.fileName, paper: o.paper, orientation: o.orientation,
      html: S.printHtml(o, src), fullDocument: () => S.printDocument(o, src, o.fileName),
    });
    status(used ? `Print dialog opened (${used}). Choose Save as PDF there to keep a PDF.` : 'The print dialog did not open.');
  }

  /* Ctrl+P (Cmd+P) on this page prints this document through SlopPrint. */
  if (window.SlopPrint && typeof window.SlopPrint.register === 'function') {
    window.SlopPrint.register('html2pdf', () => {
      if (!hasSource()) return null;
      const o = options(), src = cleaned();
      return { title: o.fileName, html: S.printHtml(o, src), paper: o.paper, orientation: o.orientation };
    });
  }

  for (const id of ['h2p-paper', 'h2p-orient', 'h2p-margin', 'h2p-scale', 'h2p-bg', 'h2p-header', 'h2p-qr-mode']) $(id).addEventListener('change', render);
  $('h2p-qr-text').addEventListener('input', render);
  const stage = $('h2p-stage');
  // The one way in (shared/intake, spec 'html2pdf'): Open, a drop anywhere on the page, a paste of an .html file,
  // ?drive=<id> (another app's Open in) and a PWA launch reach openFile; the local images are a part of their own.
  const SI = window.SlopIntake;
  SI.register({ id: 'html2pdf', limit: 1, accept: { types: ['text/html'], exts: ['.html', '.htm'], noun: 'an HTML file' }, process: async (f) => { stage.classList.remove('h2p-over'); await openFile(f); return f.name; } });
  SI.register({ id: 'html2pdf.images', main: false, paste: false, toast: false, accept: { types: ['image/*'], exts: ['.svg'], noun: 'a picture' }, processAll: (files) => { attachImages(files); return files.map((f) => f.name); } });
  const pickHtml = () => SI.pick({ to: 'html2pdf', multiple: false, accept: '.html,.htm,text/html' });
  $('h2p-open').addEventListener('click', pickHtml);
  $('h2p-open-empty').addEventListener('click', pickHtml);
  $('h2p-use-paste').addEventListener('click', () => {
    const text = $('h2p-paste').value;
    if (text.trim()) setSource(PASTED, text); else status('Paste some HTML first.');
  });
  $('h2p-images').addEventListener('click', () => SI.pick({ to: 'html2pdf.images', accept: 'image/*' }));
  $('h2p-print').addEventListener('click', print);

  /* Drops anywhere on the page open the file (the intake's drop target). The preview frame ignores pointer input, so the
     drop reaches the page. */
  SI.dropTarget(document.body, { to: 'html2pdf' });
  addEventListener('dragenter', () => stage.classList.add('h2p-over'));
  addEventListener('dragleave', (e) => { if (!e.relatedTarget) stage.classList.remove('h2p-over'); });
  if (window.SlopHub) { try { SlopHub.register('html2pdf'); } catch (e) { /* bus unavailable */ } }
  SI.launch({ to: 'html2pdf' });
  addEventListener('resize', fit);

  render();
  status('Open an HTML file, drop one here, or paste HTML. Nothing is uploaded.');

  /* The page's actions for the commands: Ctrl+K and the assistant (ai-commands.js, loaded by SlopCmd.prepare()). */
  H.app = { st, setSource, attachImages, options, cleaned, hasSource, render, status: () => $('h2p-status').textContent };
  if (window.SlopCmd) {
    const C = window.SlopCmd;
    C.init({ app: 'html2pdf' });
    C.register([{ id: 'h2p.open', title: 'Open an HTML file…', group: 'File', keys: [], run: () => $('h2p-open').click() },
      { id: 'h2p.print', title: 'Print or save as PDF…', group: 'File', keys: [], when: hasSource, run: print }]);
    if (C.provide) C.provide({ prepare: () => import(new URL('js/ai-commands.js', location.href).href) });
  }
})();
