/* PhotoSlop: Slop Hub integration. Open files from Slop Drive, send the image to other
 * Slopographic apps, and open whatever another app sent here (?drive=<id>).
 * Works without the hub (offline file, old browsers): every entry point checks for it. */
'use strict';

// The offline single-file edition has no Slop Drive (it lives with the website), so the hub is off there.
const hub = () => (document.documentElement.dataset.offline ? null : window.SlopHub || null);
async function finishPending() {
  if (TE.el) await endTypeEdit();
  if (TRANSFORM.active) commitTransform();
}
async function docBlob(type) {
  await finishPending();
  if (type === 'image/vnd.adobe.photoshop') return new Blob([writePSD()], { type });
  return canvasToBlob(wmApplyExport(flattenCanvas(type === 'image/jpeg' ? '#fff' : null)), type, 0.92);
}
// Open from Slop Drive and ?drive=<id> are sources of the one intake (app/intake.js): a tab opened from a Drive file
// remembers its record (CUR.driveId), so Save writes back to that same file.
function openFromDrive(place) {
  return SlopIntake.fromDrive({ to: 'photoslop', mode: place ? 'add' : 'new', title: place ? 'Place from Slop Drive' : 'Open from Slop Drive' });
}
/** File ▸ Save (Ctrl+S): writes the layered PSD back to the linked Drive file, or asks for a folder the first time. */
async function saveDrive() {
  if (!hub()) return savePSD();
  const H = hub(), blob = await docBlob('image/vnd.adobe.photoshop'), name = safeName() + '.psd';
  if (!CUR.driveId) { const id = await H.saveToDrive(blob, name, { from: 'photoslop' }); if (!id) return; CUR.driveId = id; }
  else { if (!(await H.update(CUR.driveId, { blob, name, type: blob.type }))) await H.put(blob, { id: CUR.driveId, name, from: 'photoslop' }); toast('Saved ' + name + ' to Slop Drive'); }
  D.dirty = false; emit('docname');
}
async function saveToDrive() {
  if (!hub()) return;
  await hub().put(await docBlob('image/png'), { name: safeName() + '.png', from: 'photoslop' });
  toast('Saved a PNG to Slop Drive');
}
/** The "Send to" submenu: one row per app that opens PNGs, plus a PSD copy into Slop Drive. */
function sendToMenu() {
  if (!hub()) return [{ label: 'Slop Drive is not available here', act: () => {}, en: () => false }];
  const rows = hub().sendMenuItems(() => docBlob('image/png'), () => safeName() + '.png', 'image/png');
  return rows.concat(['-', { label: 'Save PNG to Slop Drive', act: () => saveToDrive() }]);
}
/** Called once at boot: announce ourselves and open a file another app sent here (through the intake). */
async function hubBoot() {
  if (hub()) hub().register('photoslop');
  const got = await SlopIntake.launch({ to: 'photoslop', mode: 'new' });
  return !!(got && got.added.length);
}
// Convert… in the header (shared/convert/provided.js): the open image, flattened, as PNG.
addEventListener('slop:convert-files', (e) => e.detail.provide(async () => (CUR ? [{ name: safeName() + '.png', blob: await docBlob('image/png') }] : null)));
