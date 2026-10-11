/* Slop Paint Classic: Slop Drive integration. Open from Slop Drive, Save writes the PNG back to the
 * linked Drive file (the first save asks for a folder), and ?drive=<id> opens a file another app sent.
 * Loaded after paint.js; overrides ACTIONS.save and adds ACTIONS.openDrive. Without the hub, nothing changes. */
(function () {
  'use strict';
  const H = window.SlopHub;
  if (!H || !window.slopPaint || !window.slopPaint.drive) return;
  const P = window.slopPaint.drive, { ACTIONS, main, S, openBlob, confirmSave, finishPending, cancelOp, status, updateTitle } = P;
  let driveId = null; // the Slop Drive record this picture was opened from or saved to
  const baseOf = (n) => (String(n || 'untitled').replace(/\.[^.]+$/, '') || 'untitled').slice(0, 60);

  async function openRecord(rec) {
    if (!rec || !rec.blob) return;
    driveId = null;
    await openBlob(rec.blob, rec.name || 'untitled');
    if (S.fileName === baseOf(rec.name)) driveId = rec.id;
  }
  ACTIONS.openDrive = async function () {
    if (P.opActive()) cancelOp();
    finishPending();
    if (!(await confirmSave())) return;
    const rec = await H.pickFromDrive({ accept: ['image/*'], title: 'Open from Slop Drive' });
    if (rec) await openRecord(rec);
  };
  ACTIONS.save = async function () {
    if (P.opActive()) cancelOp();
    finishPending();
    const blob = await new Promise((res) => main.toBlob(res, 'image/png'));
    if (!blob) return;
    const name = S.fileName.replace(/\.png$/i, '') + '.png';
    if (!driveId) { const id = await H.saveToDrive(blob, name, { from: 'paint-classic' }); if (!id) return; driveId = id; }
    else if (!(await H.update(driveId, { blob, name, type: blob.type }))) await H.put(blob, { id: driveId, name, from: 'paint-classic' });
    S.dirty = false; updateTitle(); status(`Saved ${name} to Slop Drive.`);
  };

  try { H.register('paint-classic'); } catch (e) { /* bus unavailable */ }
  H.consumeLaunch().then((rec) => openRecord(rec)).catch((e) => console.warn('Slop Paint: could not open the Drive file', e));
})();
