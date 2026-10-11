/* SlopLabel — ui/export: print jobs → scenes, file open/save, PDF/ZPL/EPL/TSPL/PNG/SVG output, ZPL import. */
'use strict';

/** Expand a job and build one scene per label (identical copies share a scene). */
function jobScenes(opts = {}, doc = App.doc) {
  const job = buildJob(doc, opts), memo = new Map(), scenes = [], keys = [];
  for (const l of job.labels) {
    if (!memo.has(l.serial)) { l.get.__print = true; memo.set(l.serial, buildScene(doc, l.get)); }
    scenes.push(memo.get(l.serial)); keys.push(l.serial);
  }
  const errors = [...new Set(scenes.flatMap((s) => sceneErrors(s)))];
  return { job, scenes, keys, errors };
}
const fileBase = () => safeName(App.doc.name, '').replace(/\s+/g, '-');
function downloadBytes(bytes, name, type) { SlopUI.download(new Blob([bytes], { type }), name); }

/* ---------------- outputs ---------------- */
async function pdfBytes(opts = {}) { const { scenes } = jobScenes(opts); await preloadImages(App.doc); return buildPDF(App.doc, scenes, { start: opts.start || 0, title: App.doc.name }); }
function zplText(opts = {}) { const { scenes, keys } = jobScenes(opts); return buildZPL(App.doc, scenes, { keys, text: opts.zplText || 'font', barcodes: opts.zplBarcodes || 'native' }); }
/** The label as currently previewed, as a PNG blob at `dpi` (defaults to max(printer dpi, 300)). */
async function labelPNGBlob(dpi, { mono = false, record = App.rec } = {}) {
  await preloadImages(App.doc);
  const get = previewResolver(App.doc, record, App.prompts); get.__print = true;
  const c = renderLabelCanvas(App.doc, buildScene(App.doc, get), dpi || Math.max(300, App.doc.dpi), { mono });
  return new Promise((res) => c.toBlob(res, 'image/png'));
}
async function exportPNG() { SlopUI.download(await labelPNGBlob(), fileBase() + '.png'); }
function exportSVG() {
  const get = previewGet(); get.__print = true;
  SlopUI.download(new Blob([labelSVG(App.doc, buildScene(App.doc, get))], { type: 'image/svg+xml' }), fileBase() + '.svg');
}
async function exportPDFQuick() { try { downloadBytes(await pdfBytes({ prompts: App.prompts }), fileBase() + '.pdf', 'application/pdf'); } catch (e) { SlopUI.alert('PDF export failed', e.message); } }
function exportZPLQuick() { try { downloadBytes(zplText({ prompts: App.prompts }), fileBase() + '.zpl', 'text/plain'); } catch (e) { SlopUI.alert('ZPL export failed', e.message); } }

/* ---------------- projects ---------------- */
/** File ▸ Save (Ctrl+S): to Slop Drive when available (see hub.js), otherwise the .sloplabel download. */
function saveProject() {
  if (hubAvailable()) return saveProjectToDrive();
  downloadProject();
}
function downloadProject() {
  SlopUI.download(projectBlob(App.doc), safeName(App.doc.name, '.sloplabel'));
  App.dirty = false;
  status('Saved ' + safeName(App.doc.name, '.sloplabel'), '', 2500);
}
const OPEN_ACCEPT = '.sloplabel,.json,.zpl,.prn,.txt,.csv,.tsv,.xlsx,image/*,.svg';
async function openFilesDialog() { const fs = await SlopUI.pickFiles({ accept: OPEN_ACCEPT, multiple: true }); if (fs.length) await openFiles(fs); }
/** Open whatever was chosen or dropped: projects, ZPL, images (placed) or data files (merged). */
async function openFiles(files) {
  for (const f of files) {
    const n = (f.name || '').toLowerCase();
    try {
      if (/\.sloplabel$/.test(n)) { if (await confirmDiscard()) { setDoc(parseProject(await f.text())); status('Opened ' + f.name, '', 2500); } }
      else if (/\.(zpl|prn)$/.test(n)) await importZPLText(await f.text(), f.name);
      else if (/^image\//.test(f.type) || /\.(png|jpe?g|gif|webp|svg|bmp)$/.test(n)) await insertImageFile(f);
      else if (/\.(csv|tsv|tab|xlsx)$/.test(n) || /csv|spreadsheet/.test(f.type)) await importDataDialog(f);
      else if (/\.(json|txt)$/.test(n)) {
        const t = await f.text();
        if (/"app"\s*:\s*"sloplabel"/.test(t.slice(0, 400))) { if (await confirmDiscard()) setDoc(parseProject(t)); }
        else if (/\^XA/.test(t)) await importZPLText(t, f.name);
        else await importDataDialog(f);
      } else SlopUI.toast('Unsupported file: ' + f.name);
    } catch (e) { SlopUI.alert('Could not open ' + f.name, e.message || String(e)); }
  }
}

/* ---------------- ZPL import ---------------- */
async function importZPLText(text, name) {
  if (!(await confirmDiscard())) return false;
  try {
    const d = await importZPL(text, { dpi: App.doc.dpi });
    if (name) d.name = name.replace(/\.[^.]+$/, '');
    setDoc(d, 'Import ZPL');
    await preloadImages(App.doc); refresh();
    SlopUI.toast(`Imported ${d.objects.length} objects${d.vars.length ? ` and ${d.vars.length} variables` : ''} from ZPL`);
    return true;
  } catch (e) { SlopUI.alert('Could not import ZPL', e.message || String(e)); return false; }
}
function importZPLDialog() {
  const ta = mk('textarea', { class: 'inp', rows: 12, placeholder: '^XA\n^FO50,50^A0N,40,40^FDHello^FS\n^XZ', style: 'width:100%;min-height:220px;font-family:var(--mono)' });
  const dpi = dSel([[152, '152 dpi'], [203, '203 dpi'], [300, '300 dpi'], [600, '600 dpi']], App.doc.dpi);
  SlopUI.dialog({ title: 'Import ZPL', cls: 'sui-wide', body: mk('div', { class: 'dlg-form' }, mk('p', { class: 'sui-p' }, 'Paste a ZPL II format (from ZebraDesigner, NiceLabel, an ERP or a printer dump). Fields with ^FN become prompts and ^SN becomes a counter.'), ta, dRow('Printer resolution', dpi)),
    buttons: [{ label: 'Open file…', act: async () => { const f = (await SlopUI.pickFiles({ accept: '.zpl,.prn,.txt' }))[0]; if (f) ta.value = await f.text(); return false; } }, { label: 'Cancel' },
      { label: 'Import', primary: true, act: async () => {
        if (!/\^XA/i.test(ta.value)) { SlopUI.toast('No ^XA … ^XZ format found'); return false; }
        const old = App.doc.dpi; App.doc.dpi = +dpi.value;
        const ok = await importZPLText(ta.value);
        if (!ok) App.doc.dpi = old;
      } }] });
}
/** Render ZPL as a picture (for checking exported or third-party ZPL). */
async function zplPreviewCanvas(text, dpi) {
  const d = await importZPL(text, { dpi });
  await preloadImages(d);
  return renderLabelCanvas(d, buildScene(d, makeResolver(d, {})), Math.min(dpi, 203));
}
