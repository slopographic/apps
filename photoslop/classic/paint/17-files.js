/* Slop Paint, part 17: files: open, save PNG, clear image.
 * Split from the old paint.js (one IIFE). Loaded in order by index.html; state and helpers are shared through window.SlopPaint (P). */
(() => {
'use strict';
const P = window.SlopPaint;
const { $, S, cancelOp, finishPending, h, isTyping, loadBlobImage, main, mctx, pasteBlob, pasteCanvas, pushUndo, setCanvasSize, status, updateTitle, win } = P;

/* =====================================================================
 * Files
 * ===================================================================== */
const fileInput = $('#fileInput');
fileInput.addEventListener('change', () => {
  const f = fileInput.files && fileInput.files[0];
  fileInput.value = '';
  if (!f) return;
  if (P.st.fileMode === 'paste') pasteBlob(f); else openBlob(f, f.name);
});
async function openBlob(blob, name = 'untitled') {
  let img;
  try { img = await loadBlobImage(blob); }
  catch (_) { P.msgBox(`Slop Paint cannot read this file.\nThis is not a valid bitmap file, or its format is not currently supported.\n(Not enough slop.)`, ['OK'], 'warn'); return; }
  if (P.st.op) cancelOp();
  finishPending();
  let w = img.naturalWidth, hh = img.naturalHeight;
  const k = Math.min(1, 4096 / Math.max(w, hh));
  w = Math.max(1, Math.round(w * k)); hh = Math.max(1, Math.round(hh * k));
  pushUndo();
  setCanvasSize(w, hh, false, '#ffffff');
  mctx.imageSmoothingEnabled = k < 1;
  mctx.drawImage(img, 0, 0, w, hh);
  mctx.imageSmoothingEnabled = false;
  S.fileName = (name.replace(/\.[^.]+$/, '') || 'untitled').slice(0, 60);
  updateTitle(); S.dirty = false;
  status(`Opened ${name} (${w}x${hh}). Ready to be slopped.`);
}
function savePNG(name = S.fileName) {
  if (P.st.op) cancelOp();
  finishPending();
  return new Promise(res => {
    main.toBlob(b => {
      if (!b) { res(false); return; }
      const a = h('a', { href: URL.createObjectURL(b), download: name.replace(/\.png$/i, '') + '.png' });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      S.dirty = false; S.fileName = name.replace(/\.png$/i, ''); updateTitle();
      status(`Saved ${S.fileName}.png. Your masterpiece is safe.`);
      res(true);
    }, 'image/png');
  });
}
async function confirmSave() {
  if (!S.dirty) return true;
  const r = await P.msgBox(`Save changes to ${S.fileName}?`, ['Yes', 'No', 'Cancel'], 'warn');
  if (r === 'Yes') { await savePNG(); return true; }
  return r === 'No';
}
// drag & drop an image onto the app
['dragenter', 'dragover'].forEach(t => win.addEventListener(t, e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }));
win.addEventListener('drop', e => {
  const f = e.dataTransfer && [...e.dataTransfer.files].find(x => x.type.startsWith('image/'));
  if (!f) return;
  e.preventDefault();
  openBlob(f, f.name);
});
document.addEventListener('paste', e => {
  if (document.querySelector('.modal-back') || isTyping(e.target)) return;
  e.preventDefault();
  if (P.st.clipInternalNewer && P.st.clip) { pasteCanvas(P.st.clip); return; }
  const cd = e.clipboardData;
  const f = cd && ([...cd.files].find(x => x.type.startsWith('image/')) || [...cd.items].filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).find(Boolean));
  if (f) { pasteBlob(f); return; }
  if (P.st.clip) pasteCanvas(P.st.clip);
  else status('The clipboard has no picture in it.');
});
window.addEventListener('blur', () => { P.st.clipInternalNewer = false; });

Object.assign(P, { confirmSave, fileInput, openBlob, savePNG });
})();
