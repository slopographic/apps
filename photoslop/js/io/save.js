/* PhotoSLOP files: autosave, offline build and the sample document */
'use strict';

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
let autosaveTimer = 0;
const pngCache = new WeakMap(); // canvases are immutable once in a document, so their PNGs can be reused
async function pngOf(c) { let p = pngCache.get(c); if (!p) { p = canvasToBlob(c); pngCache.set(c, p); } return p; }
// Encoding PNGs reads pixels back from the GPU, so wait for a pause and for idle time.
function scheduleAutosave() { clearTimeout(autosaveTimer); autosaveTimer = setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(() => autosave(), { timeout: 4000 }) : autosave()), 2500); }
function flushAutosave() { if (autosaveTimer) { clearTimeout(autosaveTimer); autosaveTimer = 0; autosave(); } }
function saveTabsIndex() { if (!CUR) return; idbDo('readwrite', (st) => st.put({ ids: DOCS.map((d) => d.id), active: CUR.id }, 'tabs')).catch(() => {}); }
async function autosave() {
  autosaveTimer = 0;
  if (!CUR) return;
  if (live || V.op) { scheduleAutosave(); return; }
  // Capture synchronously: the user may switch tabs while PNGs encode.
  const snap = { id: CUR.id, w: D.w, h: D.h, name: D.name, active: layerIndex(D.activeId), layers: D.layers.slice() };
  try {
    const layers = [];
    for (const L of snap.layers) {
      layers.push({ name: L.name, x: L.x, y: L.y, visible: L.visible, opacity: L.opacity, blend: L.blend, locked: L.locked, text: L.text,
        png: await pngOf(L.canvas), mask: L.mask && { png: await pngOf(L.mask.canvas), x: L.mask.x, y: L.mask.y, def: L.mask.def, enabled: L.mask.enabled } });
    }
    if (!DOCS.some((d) => d.id === snap.id)) return; // closed meanwhile
    await idbDo('readwrite', (st) => st.put({ v: 2, w: snap.w, h: snap.h, name: snap.name, active: snap.active, layers, time: Date.now() }, 'doc:' + snap.id));
    saveTabsIndex();
    const s = $('#sbSaved'); if (s) { s.textContent = 'Saved on this device'; s.title = 'Recovered automatically if you close the tab. Never uploaded.'; }
  } catch (e) { const s = $('#sbSaved'); if (s) s.textContent = 'Recovery off'; }
}
async function blobToCanvasExact(b) { const u = URL.createObjectURL(b); try { const i = await loadImage(u); const c = mkCanvas(i.width, i.height); cx(c).drawImage(i, 0, 0); return c; } finally { URL.revokeObjectURL(u); } }
async function docFromSaved(d) {
  const layers = [];
  for (const l of d.layers) {
    const canvas = await blobToCanvasExact(l.png);
    let mask = null;
    if (l.mask) mask = { canvas: await blobToCanvasExact(l.mask.png), x: l.mask.x, y: l.mask.y, def: l.mask.def, enabled: l.mask.enabled };
    layers.push({ name: l.name, canvas, x: l.x, y: l.y, visible: l.visible, opacity: l.opacity, blend: l.blend, locked: l.locked, text: l.text, mask });
  }
  return layers;
}
async function loadAutosave() {
  try {
    const idx = await idbDo('readonly', (st) => st.get('tabs'));
    const saved = [];
    if (idx && idx.ids) for (const id of idx.ids) { const d = await idbDo('readonly', (st) => st.get('doc:' + id)); if (d && d.layers && d.layers.length) saved.push([id, d]); }
    else { const d = await idbDo('readonly', (st) => st.get('doc')); if (d && d.layers && d.layers.length) saved.push([1, d]); }
    if (!saved.length) return false;
    let activeRec = null;
    for (const [id, d] of saved) {
      const layers = await docFromSaved(d);
      const rec = openInNewTab(() => { openDocument(d.w, d.h, layers, d.name); if (d.active >= 0 && D.layers[d.active]) D.activeId = D.layers[d.active].id; }, id);
      if (idx && idx.active === id) activeRec = rec;
    }
    if (activeRec) switchToDoc(activeRec);
    toast(saved.length > 1 ? `Recovered ${saved.length} documents (saved only on this device)` : 'Recovered your last session (saved only on this device)', 3200);
    return true;
  } catch (e) { return false; }
}
async function clearAutosave() {
  try { await idbDo('readwrite', (st) => st.clear()); toast('Recovery data cleared'); } catch (e) { toast('Nothing to clear'); }
}

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
  // Web fonts stay online-only (the woff2 set is ~0.8 MB): offline, the fallback font stack is used.
  html = html.replace(/\s*<link rel="preconnect"[^>]*>/g, '').replace(/\s*<link\b[^>]*data-offline="strip"[^>]*>/g, '');
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
    download(new Blob([html], { type: 'text/html' }), 'photoslop.html');
    dialog({ title: 'PhotoSLOP, offline edition', body: h('div', { class: 'about' },
      h('p', null, 'Your download is a single file, photoslop.html (' + Math.round(html.length / 1024) + ' KB). It contains the whole app.'),
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
  const title = { str: 'PhotoSLOP', x: 800, y: 120, color: '#f1ede4', font: 'Archivo', size: 210, bold: true, italic: false, align: 'center' };
  const tr = renderTextCanvas(title); title.x -= (tr.canvas.width - Math.ceil(210 * 0.35) * 2) / 2; const t1 = renderTextCanvas(title);
  const sub = { str: 'Layers · masks · filters · real PSD files · 100% in your browser', x: 800, y: 360, color: '#d4ff3a', font: 'Inter Tight', size: 36, bold: false, italic: false, align: 'center' };
  const sr = renderTextCanvas(sub); sub.x -= (sr.canvas.width - Math.ceil(36 * 0.35) * 2) / 2; const t2 = renderTextCanvas(sub);
  openDocument(w, hh, [
    { name: 'Background', canvas: bg },
    { name: 'Glow', canvas: glow, blend: 'screen', opacity: 0.8 },
    { name: 'Sloppo', canvas: goo },
    { name: 'Face', canvas: face },
    { name: sub.str.slice(0, 32), canvas: t2.canvas, x: t2.x, y: t2.y, text: sub },
    { name: 'PhotoSLOP', canvas: t1.canvas, x: t1.x, y: t1.y, text: title },
  ], 'Welcome to PhotoSLOP');
  D.dirty = false;
}
