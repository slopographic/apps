/* PhotoSlop: boot. */
'use strict';

let samplerCtx = null;
const sampler = () => samplerCtx || (samplerCtx = mkCanvas(1, 1).getContext('2d', { willReadFrequently: true }));
function buildStatus() {
  const sb = $('#status');
  const zoom = h('input', { class: 'sb-zoom', type: 'text', 'aria-label': 'Zoom percent', spellcheck: 'false' });
  const size = h('span', { class: 'sb-size' }), pos = h('span', { class: 'sb-pos' }), col = h('span', { class: 'sb-col' }), chip = h('i', { class: 'sb-chip' });
  const rot = h('span', { class: 'sb-rot', title: 'View rotation (not saved in the file)' });
  const saved = h('span', { id: 'sbSaved', class: 'sb-saved' }, 'Local only');
  sb.append(zoom, size, pos, h('span', { class: 'sb-colwrap' }, chip, col), rot, h('span', { class: 'sb-fill' }), saved);
  const fmtZ = () => (V.zoom * 100 < 10 ? (V.zoom * 100).toFixed(1) : Math.round(V.zoom * 100)) + '%';
  zoom.addEventListener('change', () => { const v = parseFloat(zoom.value); if (v > 0) setZoom(v / 100); zoom.blur(); });
  zoom.addEventListener('keydown', (e) => { if (e.key === 'Enter') zoom.dispatchEvent(new Event('change')); e.stopPropagation(); });
  const sync = () => {
    if (document.activeElement !== zoom) zoom.value = fmtZ();
    size.textContent = `${D.w} × ${D.h} px · ${D.layers.length} layer${D.layers.length === 1 ? '' : 's'}`;
    rot.textContent = V.rot ? `∠ ${Math.round(V.rot)}°` : '';
  };
  let colT = 0;
  listeners.add((w) => {
    if (w === 'zoom' || w === 'doc') sync();
    if (w === 'cursor' && V.cursor) {
      const x = Math.floor(V.cursor.x), y = Math.floor(V.cursor.y), inside = x >= 0 && y >= 0 && x < D.w && y < D.h;
      pos.textContent = inside ? `X ${x}  Y ${y}` : '';
      const now = performance.now();
      if (inside && V.comp && now - colT > 60) {
        colT = now;
        // Sample through a 1×1 canvas: reading pixels straight off the composite would make
        // the browser move that big canvas off the GPU, and every brush frame would crawl.
        const sg = sampler(); sg.clearRect(0, 0, 1, 1); sg.drawImage(V.comp, x, y, 1, 1, 0, 0, 1, 1);
        const d = sg.getImageData(0, 0, 1, 1).data;
        col.textContent = d[3] ? `${rgbToHex(d[0], d[1], d[2])}${d[3] < 255 ? ' · ' + Math.round((d[3] / 255) * 100) + '%' : ''}` : 'transparent';
        chip.style.background = d[3] ? `rgba(${d[0]},${d[1]},${d[2]},${d[3] / 255})` : 'transparent';
      } else if (!inside) { col.textContent = ''; chip.style.background = 'transparent'; }
    }
    if (w === 'docname' || w === 'history') {
      const t = $('#docTitle'); if (t) t.textContent = (D.name || 'Untitled') + (D.dirty ? ' •' : '');
      document.title = `${D.name || 'Untitled'}${D.dirty ? ' •' : ''} — PhotoSlop`;
    }
  });
  sync();
}

function wireMobile() {
  const toggle = $('#panelToggle');
  toggle.addEventListener('click', () => { const open = document.body.classList.toggle('panels-open'); toggle.setAttribute('aria-expanded', String(open)); });
  $('#viewport').addEventListener('pointerdown', () => { if (document.body.classList.contains('panels-open') && innerWidth < 900) { document.body.classList.remove('panels-open'); toggle.setAttribute('aria-expanded', 'false'); } });
}

let domLoaded = false; // set by a listener registered while this script parses, so it runs before any other DOMContentLoaded handler
document.addEventListener('DOMContentLoaded', () => { domLoaded = true; }, { once: true });

async function boot() {
  if (!window.SlopTheme) setTheme(store.get('theme', 'pro')); // the shared script has already painted the choice
  initView();
  initBoxTool();
  initGuideInput();
  buildMenubar();
  buildToolbox();
  buildPanels();
  buildStatus();
  wireMobile();
  $('#viewport').before(buildViewBar()); // the viewport toolbar (view rotation), above the canvas
  $('#themeToggle').addEventListener('click', () => setTheme(theme() === 'pro' ? 'light' : theme() === 'light' ? 'paint' : 'pro'));
  $('#exportBtn').addEventListener('click', () => dlgExport());
  $('#newBtn').addEventListener('click', () => dlgNew());
  selectTool(TOOL[store.get('tool', 'brush')] ? store.get('tool', 'brush') : 'brush');
  wireCommands();
  $('#cmdBtn').addEventListener('click', () => openCommandPalette());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('keydown', (e) => { pasteInPlace = e.shiftKey; }, true);
  window.addEventListener('blur', () => { V.space = false; V.el.classList.remove('space'); });
  // Pasted images and PSD files go through the shared intake (add to the open document, or open as new). It is attached
  // before onPaste, so a paste it takes is marked prevented and onPaste returns. Our own buffer copies stay with onPaste.
  SlopIntake.attach({
    accept: (f) => (f.type.startsWith('image/') || isPSD(f)) && !SlopBuffer.isSystemCopyOf(f),
    hasOpen: () => D.layers.length > 0,
    openName: () => D.name || 'the open document',
    onAdd: (files) => handleFiles(files, true),
    onNew: (files) => handleFiles(files, false),
  });
  document.addEventListener('paste', onPaste);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('drop', onDropFiles);
  bindBufferDrop();
  bindFileDrop();
  window.addEventListener('beforeunload', (e) => { flushAutosave(); if (DOCS.some(docIsDirty)) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && D.dirty) autosave(); });
  listeners.add((w) => { if (w === 'history' && Hist.idx > 0) scheduleAutosave(); });
  await loadBrushPacks();
  const restored = await loadAutosave();
  const launched = await hubBoot().catch((e) => { console.warn(e); return false; });
  if (!restored && !launched) newBlankTab();
  await restoreView(restored && !launched);
  emit('docname');
  // 'ready' promises the page is fully set up. The boot awaits above can finish while the page is still parsing,
  // before DOMContentLoaded handlers run (the Tour button is mounted there), so wait for them first.
  // A timer tick runs after DOMContentLoaded and all its handlers (the Tour button mounts in one of them).
  await new Promise((r) => (domLoaded ? setTimeout(r, 0) : document.addEventListener('DOMContentLoaded', () => setTimeout(r, 0), { once: true })));
  document.body.classList.add('ready');
  if (!store.get('welcomed', false)) { store.set('welcomed', true); setTimeout(() => toast('Welcome to PhotoSlop. Everything stays on your device.', 3600), 400); }
}
boot();
