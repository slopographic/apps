/* Slop Upscale: getting the result out. Download the picture or video, save it to Slop Drive, or open a file from Drive
 * (the Drive picker, or a launch from Drive). The controller (app/main.js) shares its state and helpers as SlopUpscale.app.
 * Classic script. */
(function (g) {
  'use strict';
  const U = g.SlopUpscale, IO = U.io, D = U.drive;
  const S = () => U.app.S, toast = (m) => U.app.toast(m), setStatus = (m, f) => U.app.setStatus(m, f);

async function resultBlob() {
  const it = S().item;
  if (!it || !it.out) return null;
  if (it.kind === 'video') return it.outBlob;
  return IO.encode(it.out.canvas, S().format, S().quality);
}
function resultName() {
  const it = S().item;
  return it.kind === 'video' ? it.outName : IO.outName(it.name, S().scale, S().format);
}
async function download() {
  try {
    const blob = await resultBlob();
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = resultName();
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (e) { setStatus(e.message); }
}
async function saveDrive() {
  if (!D.available()) { toast('Slop Drive is not available on this page'); return; }
  try {
    const blob = await resultBlob();
    if (!blob) return;
    const id = await D.save(blob, resultName(), { source: S().item.name, scale: S().scale });
    S().item.drive = id;
    toast('Saved to the Slop Upscale folder in Slop Drive');
  } catch (e) { setStatus('Could not save to Slop Drive: ' + e.message); }
}
async function openDrive() {
  if (!D.available()) { toast('Slop Drive is not available on this page'); return; }
  const rec = await D.pick();
  if (rec) await openRecord(rec);
}
async function openRecord(rec) {
  if (!rec || !rec.blob) return;
  await U.app.open(new File([rec.blob], rec.name || 'Drive file', { type: rec.blob.type || '' }), { drive: rec.id });
}

  U.output = { resultBlob, resultName, download, saveDrive, openDrive, openRecord };
})(typeof window !== 'undefined' ? window : globalThis);
