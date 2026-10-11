/* PhotoSlop: multiple documents in tabs. The globals D / Hist / V always hold the active
 * document; switching tabs stashes them into the tab record and restores another. */
'use strict';

const DOCS = [];
let CUR = null, docSeq = 1;

function finishPendingWork() {
  if (TE.el) endTypeEdit();
  if (TRANSFORM.active) commitTransform();
  if (V.op) { const t = V.op.tool; V.op = null; if (t.cancel) t.cancel(); }
  for (const t of TOOLS) if (t.s && t.cancel) t.cancel();
  if (TOOL.polylasso) TOOL.polylasso.s = null;
  live = null;
}
function stashCurrent() {
  if (!CUR) return;
  CUR.state = {
    w: D.w, h: D.h, name: D.name, layers: D.layers, activeId: D.activeId, sel: D.sel, dirty: D.dirty, guides: D.guides,
    states: Hist.states, idx: Hist.idx, zoom: V.zoom, ox: V.ox, oy: V.oy, rot: V.rot,
  };
}
function restoreDoc(rec) {
  const s = rec.state;
  Object.assign(D, { w: s.w, h: s.h, name: s.name, layers: s.layers, activeId: s.activeId, sel: s.sel, dirty: s.dirty, guides: s.guides || [] });
  Hist.states = s.states; Hist.idx = s.idx;
  V.zoom = s.zoom; V.ox = s.ox; V.oy = s.oy; V.rot = s.rot || 0;
  UI.editMask = false; live = null;
  if (UI.tool === 'crop' && TOOL.crop.activate) TOOL.crop.activate();
  V.needComp = true;
  emit('history'); emit('doc'); emit('zoom'); emit('docname'); emit('tool');
  dirty(true);
}
/** Run setup() (which fills D, Hist and the view) as a brand-new tab after the current one. */
function openInNewTab(setup, id) {
  if (CUR) { flushAutosave(); finishPendingWork(); stashCurrent(); }
  const rec = { id: id || docSeq++, state: null };
  docSeq = Math.max(docSeq, rec.id + 1);
  const at = CUR ? DOCS.indexOf(CUR) + 1 : DOCS.length;
  DOCS.splice(at, 0, rec);
  CUR = rec;
  V.rot = 0; // a new tab opens unrotated (the angle is per tab)
  setup();
  stashCurrent();
  renderTabs();
  saveTabsIndex();
  return rec;
}
function openDocTab(w, hh, layers, name) { return openInNewTab(() => openDocument(w, hh, layers, name)); }
function newDocTab(w, hh, bg, name) { return openInNewTab(() => { newDocument(w, hh, bg, name); fitView(true); emit('docname'); scheduleAutosave(); }); }
function switchToDoc(rec) {
  if (!rec || rec === CUR) return;
  flushAutosave(); finishPendingWork(); stashCurrent();
  CUR = rec;
  restoreDoc(rec);
  renderTabs(); saveTabsIndex();
}
function docIsDirty(rec) { return rec === CUR ? D.dirty && Hist.idx > 0 : rec.state && rec.state.dirty && rec.state.idx > 0; }
function docName(rec) { return rec === CUR ? D.name : rec.state ? rec.state.name : 'Untitled'; }
async function closeDoc(rec = CUR) {
  if (!rec) return;
  if (docIsDirty(rec) && !(await confirmDlg('Close document?', `“${docName(rec)}” has changes you haven't saved as a file. It is still recoverable on this device until you close it. Close it anyway?`, 'Close'))) return;
  const i = DOCS.indexOf(rec);
  DOCS.splice(i, 1);
  idbDo('readwrite', (st) => st.delete('doc:' + rec.id)).catch(() => {});
  if (rec === CUR) {
    CUR = null;
    if (!DOCS.length) { newDocTab(1600, 1000, '#ffffff', 'Untitled'); return; }
    CUR = DOCS[Math.min(i, DOCS.length - 1)];
    finishPendingWork();
    restoreDoc(CUR);
  }
  renderTabs(); saveTabsIndex();
}
function cycleDoc(dir) { if (DOCS.length > 1) switchToDoc(DOCS[(DOCS.indexOf(CUR) + dir + DOCS.length) % DOCS.length]); }

/* ---------- tab strip ---------- */
let dragTab = null;
function renderTabs() {
  const bar = $('#tabs'); if (!bar) return;
  bar.textContent = '';
  for (const rec of DOCS) {
    const s = rec === CUR ? D : rec.state || {};
    const active = rec === CUR;
    const tab = h('div', { class: 'doctab' + (active ? ' active' : ''), role: 'tab', 'aria-selected': String(active), tabindex: active ? '0' : '-1', title: `${docName(rec)} — ${s.w} × ${s.h} px`, draggable: 'true' },
      h('span', { class: 'doctab-name' }, docName(rec)),
      docIsDirty(rec) ? h('i', { class: 'doctab-dot', 'aria-label': 'unsaved changes' }) : null);
    const x = h('button', { type: 'button', class: 'doctab-x', 'aria-label': `Close ${docName(rec)}`, title: 'Close (Alt+Ctrl+W)' }, '×');
    x.addEventListener('click', (e) => { e.stopPropagation(); closeDoc(rec); });
    tab.append(x);
    ctxTarget(tab, 'tab', () => tabItems(rec));
    tab.addEventListener('pointerdown', (e) => { if (e.button === 0 && !e.target.closest('.doctab-x')) switchToDoc(rec); });
    tab.addEventListener('auxclick', (e) => { if (e.button === 1) { e.preventDefault(); closeDoc(rec); } });
    tab.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') cycleDoc(1); if (e.key === 'ArrowLeft') cycleDoc(-1); });
    tab.addEventListener('dragstart', (e) => { dragTab = rec; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('application/x-slop-tab', String(rec.id)); });
    tab.addEventListener('dragend', () => { dragTab = null; });
    tab.addEventListener('dragover', (e) => { if (!dragTab) return; e.preventDefault(); e.stopPropagation(); });
    tab.addEventListener('drop', (e) => {
      if (!dragTab) return;
      e.preventDefault(); e.stopPropagation();
      const from = DOCS.indexOf(dragTab), r = tab.getBoundingClientRect();
      let to = DOCS.indexOf(rec) + (e.clientX > r.left + r.width / 2 ? 1 : 0);
      DOCS.splice(from, 1); if (from < to) to--;
      DOCS.splice(to, 0, dragTab); dragTab = null;
      renderTabs(); saveTabsIndex();
    });
    bar.append(tab);
  }
  const plus = h('button', { type: 'button', class: 'doctab-new', title: 'New document', 'aria-label': 'New document' }, '+');
  plus.addEventListener('click', () => dlgNew());
  const open = h('button', { type: 'button', class: 'doctab-open', title: 'Open files (or drop them here)' }, 'Open…');
  open.addEventListener('click', () => openFilePicker(false));
  bar.append(plus, open);
  const act = bar.querySelector('.doctab.active'); if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
listeners.add((w) => { if (w === 'docname' || w === 'history') renderTabs(); });
function windowMenuItems() {
  return [
    { label: 'Next Document', key: 'Ctrl+Tab', act: () => cycleDoc(1), en: () => DOCS.length > 1 },
    { label: 'Previous Document', key: 'Shift+Ctrl+Tab', act: () => cycleDoc(-1), en: () => DOCS.length > 1 },
    '-',
    { label: 'Guides', check: () => !!SlopGuides.panel, act: () => openGuidesPanel() },
    '-',
    { label: 'Foreground Colour…', act: () => editSwatch('fg') },
    { label: 'Background Colour…', act: () => editSwatch('bg') },
    '-',
    ...DOCS.map((rec, i) => ({ label: `${i + 1}  ${docName(rec)}`, check: () => rec === CUR, act: () => switchToDoc(rec), key: i < 9 ? `Alt+${i + 1}` : undefined })),
  ];
}

/* ---------- drag & drop: open as tabs, or place as layers ---------- */
function dropZoneOf(e) { const z = e.target && e.target.closest && e.target.closest('.dz'); return z ? z.dataset.zone : 'open'; }
let hotZone = 'open'; // the zone under the pointer at the last dragover (the drop reads it: the zone class is gone by then)
function onDragOver(e) {
  if (dragTab) return;
  const types = e.dataTransfer ? [...e.dataTransfer.types] : [];
  if (!types.includes('Files') && !types.includes('text/uri-list')) return;
  e.preventDefault();
  document.body.classList.add('dropping');
  const place = $('.dz-place .dz-doc'); if (place) place.textContent = D.name || 'this document';
  hotZone = dropZoneOf(e);
  $$('.dz').forEach((z) => z.classList.toggle('hot', z.dataset.zone === hotZone));
}
/* Files: SlopDrop (shared/drop) takes them anywhere on the page, a strip at the foot of the viewport shows progress. */
function bindFileDrop() {
  const strip = $('#psDrop');
  window.SlopDrop.attach(strip, {
    accept: { types: ['image/*'], exts: ['.psd', '.psb', '.ora', '.kra', '.tif', '.tiff', '.svg', '.avif', '.bmp', '.gif'], noun: 'a picture or a document' },
    compact: true, overlay: false,
    targets: [document.body],
    process: async (file) => {
      const failed = await handleFiles([file], hotZone === 'place');
      if (failed.length) throw new Error(failed[0]);
      return file.name;
    },
  });
  strip.addEventListener('pointerdown', (e) => e.stopPropagation());
}
async function onDropFiles(e) {
  if (dragTab) return;
  e.preventDefault();
  document.body.classList.remove('dropping');
  const place = dropZoneOf(e) === 'place';
  const files = [...(e.dataTransfer.files || [])];
  if (files.length) return; // files go through SlopDrop (bindFileDrop)
  // An image dragged straight from another web page.
  const url = (e.dataTransfer.getData('text/uri-list') || '').split('\n').find((l) => l && !l.startsWith('#'));
  if (!url) return;
  try {
    const r = await fetch(url, { mode: 'cors' });
    const blob = await r.blob();
    const name = decodeURIComponent(url.split('/').pop().split('?')[0] || 'image');
    handleFiles([new File([blob], name, { type: blob.type })], place);
  } catch (err) { toast("That site won't share the image directly. Save it, then drop the file here.", 4200); }
}
