/* Slop Shop: files, clipboard, export, autosave, offline build, sample document. Everything stays on this device. */
'use strict';

/* ---------- clipboard ---------- */
const CLIP = { canvas: null, x: 0, y: 0 };
let pasteInPlace = false;
function copySel(merged) {
  if (!activeLayer()) return;
  const r = copySelectionPixels(merged);
  CLIP.canvas = r.canvas; CLIP.x = r.x; CLIP.y = r.y;
  toast(merged ? 'Copied merged' : 'Copied');
  try {
    if (navigator.clipboard && window.ClipboardItem) navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(r.canvas) })]).catch(() => {});
  } catch (e) { /* the internal clipboard still works */ }
}
function cutSel() {
  const L = activeLayer(); if (!L) return;
  if (L.locked) { toast('That layer is locked'); return; }
  copySel(false);
  if (D.sel) clearSelectionPixels('Cut');
  else { patchLayer(L.id, { canvas: mkCanvas(1, 1), x: 0, y: 0, text: null }); commit('Cut'); }
}
function pasteCanvas(c, x, y, name = 'Pasted Layer') {
  if (x == null) { x = Math.round((D.w - c.width) / 2); y = Math.round((D.h - c.height) / 2); }
  const L = newLayerRecord({ name: nextName(name.replace(/ \d+$/, '')), canvas: c, x, y });
  const i = layerIndex(D.activeId);
  D.layers.splice(i + 1, 0, L); D.activeId = L.id; D.sel = null;
  commit('Paste');
  selectTool('move');
}
function pasteInternal(inPlace) {
  if (!CLIP.canvas) { toast('Nothing to paste yet'); return; }
  pasteCanvas(copyCanvas(CLIP.canvas), inPlace ? CLIP.x : null, inPlace ? CLIP.y : null, 'Layer');
}
async function onPaste(e) {
  const fromCatcher = e.target && e.target.classList && e.target.classList.contains('paste-catcher');
  if ((!fromCatcher && isTyping(e.target)) || openDialogs) return;
  if (fromCatcher) e.target.blur();
  const cd = e.clipboardData, items = cd ? [...cd.items] : [];
  const img = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'));
  const file = img ? img.getAsFile() : cd && cd.files && [...cd.files].find((f) => f.type.startsWith('image/') || isPSD(f));
  e.preventDefault();
  if (file && isPSD(file)) { handleFiles([file], true); return; }
  if (!file && cd) {
    // Images copied from some web pages arrive only as HTML.
    const src = (cd.getData('text/html').match(/<img[^>]+src="([^"]+)"/) || [])[1];
    if (src && /^data:image\//.test(src)) { const im = await loadImage(src); const c = mkCanvas(im.naturalWidth, im.naturalHeight); cx(c).drawImage(im, 0, 0); pasteCanvas(c, null, null, 'Pasted Image'); return; }
  }
  if (file) {
    const c = await fileToCanvas(file);
    if (CLIP.canvas && c.width === CLIP.canvas.width && c.height === CLIP.canvas.height) { pasteInternal(pasteInPlace); return; }
    pasteCanvas(c, null, null, 'Pasted Image');
  } else pasteInternal(pasteInPlace);
}

/* ---------- opening ---------- */
async function fileToCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth || img.width || 1000, hh = img.naturalHeight || img.height || 1000;
    const c = mkCanvas(w, hh); cx(c).drawImage(img, 0, 0, w, hh);
    return c;
  } finally { URL.revokeObjectURL(url); }
}
const isPSD = (f) => /\.ps[db]$/i.test(f.name) || f.type === 'image/vnd.adobe.photoshop';
function openFilePicker(place) {
  const inp = $('#fileIn');
  inp.accept = 'image/*,.psd'; inp.multiple = !!place; inp.value = '';
  inp.onchange = () => { if (inp.files.length) handleFiles([...inp.files], place); };
  inp.click();
}
async function handleFiles(files, place) {
  document.body.classList.add('busy');
  try {
    for (const f of files) {
      const name = f.name.replace(/\.[^.]+$/, '');
      if (isPSD(f)) {
        const doc = await readPSD(await f.arrayBuffer());
        if (place) { const c = mkCanvas(doc.w, doc.h), g = cx(c); for (const L of doc.layers) { if (!L.visible) continue; g.globalAlpha = L.opacity; g.globalCompositeOperation = BLEND_OP[L.blend]; g.drawImage(L.canvas, L.x, L.y); } pasteCanvas(c, null, null, name); }
        else { if (!(await okToDiscard())) return; openDocument(doc.w, doc.h, doc.layers, name); toast(`Opened ${f.name}: ${doc.layers.length} layer${doc.layers.length === 1 ? '' : 's'}`); }
      } else if (f.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif|ico)$/i.test(f.name)) {
        const c = await fileToCanvas(f);
        if (place) pasteCanvas(c, null, null, name);
        else { if (!(await okToDiscard())) return; openDocument(c.width, c.height, [{ name: 'Background', canvas: c, x: 0, y: 0 }], name); toast(`Opened ${f.name}`); }
      } else toast(`Can't open ${f.name}`);
      place = true; // further files in the same drop become layers
    }
  } catch (e) { console.warn(e); alertDlg('Could not open that file', e.message || String(e)); }
  finally { document.body.classList.remove('busy'); }
}
async function okToDiscard() {
  if (!D.dirty || Hist.idx === 0) return true;
  return confirmDlg('Discard changes?', 'Opening a file replaces the current document. Your unsaved changes will be lost.', 'Discard and open');
}
function openDocument(w, hh, layers, name) {
  if (TE.el) endTypeEdit(true);
  if (TRANSFORM.active) cancelTransform();
  D.w = w; D.h = hh; D.name = name || 'Untitled'; D.sel = null; live = null; UI.editMask = false;
  D.layers = layers.map((l) => newLayerRecord(l));
  D.activeId = D.layers[D.layers.length - 1].id;
  histReset('Open');
  fitView(true);
  emit('docname');
  scheduleAutosave();
}
function onDrop(e) {
  e.preventDefault();
  document.body.classList.remove('dropping');
  const files = [...(e.dataTransfer.files || [])];
  if (!files.length) return;
  const fresh = Hist.idx === 0 && !D.dirty;
  handleFiles(files, !fresh);
}

/* ---------- saving & export ---------- */
const safeName = () => (D.name || 'Untitled').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Untitled';
async function savePSD() {
  if (TE.el) await endTypeEdit();
  if (TRANSFORM.active) commitTransform();
  document.body.classList.add('busy');
  await new Promise((r) => setTimeout(r, 30));
  try {
    const bytes = writePSD();
    download(new Blob([bytes], { type: 'image/vnd.adobe.photoshop' }), safeName() + '.psd');
    D.dirty = false; emit('docname');
    toast(`Saved ${safeName()}.psd (${(bytes.length / 1048576).toFixed(1)} MB)`);
  } catch (e) { console.warn(e); alertDlg('Could not save the PSD', e.message); }
  document.body.classList.remove('busy');
}
async function renderExport(fmt, scale, bg) {
  let c = flattenCanvas(fmt === 'image/png' && !bg ? null : bg || '#ffffff');
  if (scale !== 1) c = resampleCanvas(c, Math.max(1, Math.round(D.w * scale)), Math.max(1, Math.round(D.h * scale)));
  return c;
}
async function quickExport() { const c = await renderExport('image/png', 1, null); download(await canvasToBlob(c, 'image/png'), safeName() + '.png'); toast('Exported PNG'); }
function dlgExport() {
  const fmt = h('select', null, [['image/png', 'PNG'], ['image/jpeg', 'JPEG'], ['image/webp', 'WebP']].map(([v, l]) => h('option', { value: v }, l)));
  const q = h('input', { type: 'range', min: 1, max: 100, value: 85 }), qn = h('span', { class: 'fp-u' }, '85');
  const scale = h('select', null, [[0.25, '25%'], [0.5, '50%'], [1, '100%'], [2, '200%'], [3, '300%']].map(([v, l]) => h('option', { value: v, selected: v === 1 }, l)));
  const transparent = h('input', { type: 'checkbox', checked: true });
  const info = h('p', { class: 'dlg-p mono' }, '…');
  const qRow = field('Quality', q, qn), tRow = h('label', { class: 'field opt-check' }, transparent, h('span', null, 'Transparent background'));
  let tok = 0;
  const update = async () => {
    const my = ++tok, f = fmt.value;
    qRow.style.display = f === 'image/png' ? 'none' : ''; tRow.style.display = f === 'image/png' ? '' : 'none'; qn.textContent = q.value;
    const c = await renderExport(f, +scale.value, f === 'image/png' && transparent.checked ? null : '#ffffff');
    const b = await canvasToBlob(c, f, +q.value / 100);
    if (my === tok) info.textContent = `${c.width} × ${c.height} px · ${b ? (b.size / 1024 < 1024 ? Math.round(b.size / 1024) + ' KB' : (b.size / 1048576).toFixed(2) + ' MB') : '?'}`;
  };
  [fmt, q, scale, transparent].forEach((el) => el.addEventListener('input', update));
  dialog({ title: 'Export As', body: h('div', { class: 'form' }, field('Format', fmt), qRow, field('Size', scale), tRow, info),
    buttons: [{ label: 'Cancel' }, { label: 'Export', primary: true, act: async () => {
      const f = fmt.value, c = await renderExport(f, +scale.value, f === 'image/png' && transparent.checked ? null : '#ffffff');
      const b = await canvasToBlob(c, f, +q.value / 100);
      if (!b) { toast('This browser cannot encode that format'); return false; }
      download(b, safeName() + { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[f]);
    } }] });
  update();
}
/* Store-only ZIP (PNGs are already compressed). */
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function zipStore(files) {
  const enc = new TextEncoder(), parts = [], central = []; let off = 0;
  for (const { name, data } of files) {
    const nb = enc.encode(name), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true);
    parts.push(new Uint8Array(lh.buffer), nb, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
    central.push(new Uint8Array(ch.buffer), nb);
    off += 30 + nb.length + data.length;
  }
  const csize = central.reduce((a, b) => a + b.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csize, true); end.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
}
async function exportLayers() {
  document.body.classList.add('busy');
  const files = [], used = new Set();
  for (let i = 0; i < D.layers.length; i++) {
    const L = D.layers[i], b = bakedLayer(L), c = mkCanvas(D.w, D.h); cx(c).drawImage(b.canvas, b.x, b.y);
    let n = `${String(i + 1).padStart(2, '0')} ${L.name}`.replace(/[\\/:*?"<>|]+/g, '-'); while (used.has(n)) n += '_'; used.add(n);
    files.push({ name: n + '.png', data: new Uint8Array(await (await canvasToBlob(c)).arrayBuffer()) });
  }
  download(zipStore(files), safeName() + ' layers.zip');
  document.body.classList.remove('busy');
  toast(`Exported ${files.length} layers`);
}

/* ---------- autosave (IndexedDB, this browser only) ---------- */
function idb() {
  return new Promise((res, rej) => {
    if (!window.indexedDB) { rej(new Error('no indexedDB')); return; }
    const r = indexedDB.open('slopshop', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function idbDo(mode, fn) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('kv', mode), st = tx.objectStore('kv'), r = fn(st); tx.oncomplete = () => res(r && r.result); tx.onerror = () => rej(tx.error); }); }
let autosaveTimer = 0, autosaving = false;
function scheduleAutosave() { clearTimeout(autosaveTimer); autosaveTimer = setTimeout(autosave, 1500); }
async function autosave() {
  if (live || V.op || autosaving) { scheduleAutosave(); return; }
  autosaving = true;
  try {
    const layers = [];
    for (const L of D.layers) {
      layers.push({ name: L.name, x: L.x, y: L.y, visible: L.visible, opacity: L.opacity, blend: L.blend, locked: L.locked, text: L.text,
        png: await canvasToBlob(L.canvas), mask: L.mask && { png: await canvasToBlob(L.mask.canvas), x: L.mask.x, y: L.mask.y, def: L.mask.def, enabled: L.mask.enabled } });
    }
    await idbDo('readwrite', (st) => st.put({ v: 1, w: D.w, h: D.h, name: D.name, active: layerIndex(D.activeId), layers, time: Date.now() }, 'doc'));
    const s = $('#sbSaved'); if (s) { s.textContent = 'Saved on this device'; s.title = 'Recovered automatically if you close the tab. Never uploaded.'; }
  } catch (e) { const s = $('#sbSaved'); if (s) s.textContent = 'Recovery off'; }
  autosaving = false;
}
async function blobToCanvasExact(b) { const u = URL.createObjectURL(b); try { const i = await loadImage(u); const c = mkCanvas(i.width, i.height); cx(c).drawImage(i, 0, 0); return c; } finally { URL.revokeObjectURL(u); } }
async function loadAutosave() {
  try {
    const d = await idbDo('readonly', (st) => st.get('doc'));
    if (!d || !d.layers || !d.layers.length) return false;
    const layers = [];
    for (const l of d.layers) {
      const canvas = await blobToCanvasExact(l.png);
      let mask = null;
      if (l.mask) mask = { canvas: await blobToCanvasExact(l.mask.png), x: l.mask.x, y: l.mask.y, def: l.mask.def, enabled: l.mask.enabled };
      layers.push({ name: l.name, canvas, x: l.x, y: l.y, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked, text: l.text, mask });
    }
    openDocument(d.w, d.h, layers, d.name);
    if (d.active >= 0 && D.layers[d.active]) { D.activeId = D.layers[d.active].id; emit('doc'); }
    toast('Recovered your last session (saved only on this device)', 3200);
    return true;
  } catch (e) { return false; }
}
async function clearAutosave() { try { await idbDo('readwrite', (st) => st.delete('doc')); toast('Recovery data cleared'); } catch (e) { toast('Nothing to clear'); } }

/* ---------- offline single-file build ---------- */
async function appSources() {
  const emb = document.getElementById('app-src');
  if (emb) return JSON.parse(emb.textContent);
  const get = async (u) => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.text(); };
  const files = { 'index.html': await get('index.html') };
  const refs = [...files['index.html'].matchAll(/<link rel="stylesheet" href="([^"]+)">|<script src="([^"]+)"><\/script>/g)].map((m) => m[1] || m[2]).filter((u) => !/^(https?:)?\/\//.test(u));
  for (const u of refs) files[u] = await get(u);
  try { files['favicon'] = await get('../favicon.svg'); } catch (e) { /* optional */ }
  return files;
}
function buildOfflineHTML(files) {
  const esc = (s) => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');
  let html = files['index.html'];
  html = html.replace(/\s*<link rel="preconnect"[^>]*>/g, '').replace(/\s*<link href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '');
  // Function replacers throughout: a replacement *string* would treat "$$" and "$&" in the code as patterns.
  if (files.favicon) html = html.replace(/<link rel="icon" href="[^"]*"[^>]*>/, () => `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(files.favicon)}" type="image/svg+xml">`);
  html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (m, href) => (files[href] != null ? `<style>\n${files[href].replace(/<\/style/gi, '<\\/style')}\n</style>` : m));
  html = html.replace(/<script src="([^"]+)"><\/script>/g, (m, src) => (files[src] != null ? `<script>\n${esc(files[src])}\n</script>` : m));
  html = html.replace('<html lang="en"', () => '<html lang="en" data-offline="1"');
  const json = JSON.stringify(files).replace(/</g, '\\u003c');
  html = html.replace(/<\/body>\s*<\/html>\s*$/, () => `<script type="application/json" id="app-src">${json}</script>\n</body>\n</html>\n`);
  return html;
}
async function downloadOfflineApp() {
  try {
    const html = buildOfflineHTML(await appSources());
    download(new Blob([html], { type: 'text/html' }), 'slop-shop.html');
    dialog({ title: 'Slop Shop, offline edition', body: h('div', { class: 'about' },
      h('p', null, 'Your download is a single file, slop-shop.html (' + Math.round(html.length / 1024) + ' KB). It contains the whole app.'),
      h('p', null, 'Open it from your Downloads folder, a USB stick, or anywhere else. It works with no internet connection, and nothing you edit ever leaves your computer.'),
      h('p', { class: 'dlg-p' }, 'Offline, the brand fonts fall back to your system fonts. Everything else is identical.')),
    buttons: [{ label: 'Nice', primary: true }] });
  } catch (e) { console.warn(e); alertDlg('Could not build the offline file', e.message); }
}

/* ---------- welcome document ---------- */
async function sampleDocument() {
  const w = 1600, hh = 1000;
  D.w = w; D.h = hh;
  const bg = mkCanvas(w, hh), bgc = cx(bg);
  let gr = bgc.createRadialGradient(w * 0.5, hh * 0.62, 40, w * 0.5, hh * 0.6, w * 0.75);
  gr.addColorStop(0, '#24420a'); gr.addColorStop(0.55, '#0f1a06'); gr.addColorStop(1, '#060805');
  bgc.fillStyle = gr; bgc.fillRect(0, 0, w, hh);
  // Goo puddle + blob
  const goo = mkCanvas(w, hh), g = cx(goo);
  g.fillStyle = '#7fbf00'; g.beginPath(); g.ellipse(800, 860, 520, 70, 0, 0, Math.PI * 2); g.fill();
  gr = g.createLinearGradient(0, 470, 0, 880); gr.addColorStop(0, '#e6ff8c'); gr.addColorStop(0.45, '#a6e400'); gr.addColorStop(1, '#4d8f00');
  g.fillStyle = gr; g.beginPath();
  g.moveTo(560, 860); g.bezierCurveTo(540, 650, 640, 470, 800, 470); g.bezierCurveTo(960, 470, 1060, 650, 1040, 860); g.closePath(); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(700, 560, 46, 26, -0.6, 0, Math.PI * 2); g.fill();
  // face
  const face = mkCanvas(w, hh), f = cx(face);
  for (const sx of [-1, 1]) {
    f.fillStyle = '#0b1300'; f.beginPath(); f.ellipse(800 + sx * 80, 650, 34, 42, 0, 0, Math.PI * 2); f.fill();
    f.fillStyle = '#fff'; f.beginPath(); f.arc(800 + sx * 80 - 10, 636, 11, 0, Math.PI * 2); f.fill(); f.beginPath(); f.arc(800 + sx * 80 + 12, 664, 5, 0, Math.PI * 2); f.fill();
    f.fillStyle = 'rgba(255,111,142,.55)'; f.beginPath(); f.ellipse(800 + sx * 150, 718, 34, 18, 0, 0, Math.PI * 2); f.fill();
  }
  f.strokeStyle = '#0b1300'; f.lineWidth = 9; f.lineCap = 'round'; f.beginPath(); f.arc(800, 712, 34, 0.2, Math.PI - 0.2); f.stroke();
  // glow
  const glow = mkCanvas(w, hh), gg = cx(glow);
  gr = gg.createRadialGradient(800, 680, 10, 800, 680, 520); gr.addColorStop(0, 'rgba(212,255,58,.55)'); gr.addColorStop(1, 'rgba(212,255,58,0)');
  gg.fillStyle = gr; gg.fillRect(0, 0, w, hh);
  try { await Promise.all([document.fonts.load('700 200px "Archivo"'), document.fonts.load('400 40px "Inter Tight"')]); } catch (e) { /* offline */ }
  const title = { str: 'Slop Shop', x: 800, y: 120, color: '#f1ede4', font: 'Archivo', size: 210, bold: true, italic: false, align: 'center' };
  const tr = renderTextCanvas(title); title.x -= (tr.canvas.width - Math.ceil(210 * 0.35) * 2) / 2; const t1 = renderTextCanvas(title);
  const sub = { str: 'Layers · masks · filters · real PSD files · 100% in your browser', x: 800, y: 360, color: '#d4ff3a', font: 'Inter Tight', size: 36, bold: false, italic: false, align: 'center' };
  const sr = renderTextCanvas(sub); sub.x -= (sr.canvas.width - Math.ceil(36 * 0.35) * 2) / 2; const t2 = renderTextCanvas(sub);
  openDocument(w, hh, [
    { name: 'Background', canvas: bg },
    { name: 'Glow', canvas: glow, blend: 'screen', opacity: 0.8 },
    { name: 'Sloppo', canvas: goo },
    { name: 'Face', canvas: face },
    { name: sub.str.slice(0, 32), canvas: t2.canvas, x: t2.x, y: t2.y, text: sub },
    { name: 'Slop Shop', canvas: t1.canvas, x: t1.x, y: t1.y, text: title },
  ], 'Welcome to Slop Shop');
  D.dirty = false;
}
