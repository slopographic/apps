/* Slop PDF — File ▸ Versions. The original of a document is its Slop Drive file (io/drive-docs.js); the edited copy and the
   change list (io/doc-changes.js) sit beside it. Open the original, open the edited copy, open the original with the saved
   changes replayed on it, revert the open document to the original (the saved copy stays in Slop Drive) and download the
   change list. Each opens in a new tab, without the device's saved-edits prompt. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, A = SP.app, S = A._, D = SP.driveDocs;

  /** The File ▸ Versions submenu. Every item needs the open document to be linked to Slop Drive. */
  A.versionItems = function () {
    var linked = !!A.driveId && D.linked(), has = E.state.pages.length > 0;
    return [
      { label: 'Open the original', act: function () { A.openVersion('original'); }, disabled: !linked },
      { label: 'Open the edited copy', act: function () { A.openVersion('edited'); }, disabled: !linked },
      { label: 'Open the original with the saved changes', act: function () { A.openVersion('replay'); }, disabled: !linked },
      '-',
      { label: 'Revert to the original…', act: function () { A.revertToOriginal(); }, disabled: !linked || !has },
      { label: 'Download the change list (JSON)', act: function () { A.downloadChanges(); }, disabled: !linked },
    ];
  };

  /** The document's versions in Slop Drive, or null (with a message) when there is none yet. */
  async function versions() {
    var v = null;
    try { v = await D.versions(A.driveId); } catch (e) { v = null; }
    if (!v) SlopUI.toast('This document is not in Slop Drive yet. Save it first.');
    return v;
  }
  /** A PDF File for a Drive record, named as the record is. */
  function fileOf(rec) { return new File([rec.blob], rec.name || 'document.pdf', { type: 'application/pdf' }); }
  /** Opens the original, the edited copy or the original with the change list replayed, in a new tab. */
  A.openVersion = async function (kind) {
    var v = await versions(); if (!v) return;
    var rec = kind === 'edited' ? v.edited : v.original, changes = null;
    if (kind === 'edited' && !rec) { SlopUI.toast('No edited copy has been saved yet.'); return; }
    if (kind === 'replay') {
      if (!v.changes) { SlopUI.toast('No change list has been saved yet.'); return; }
      changes = SP.docChanges.parse(await v.changes.blob.text());
      if (!changes) { SlopUI.toast('The change list could not be read.'); return; }
    }
    A.newTab();
    await A.addFiles([fileOf(rec)], { drive: { link: v.original.id, log: false } });
    if (changes) {
      var n = SP.docChanges.replayOn(Array.from(E.files.values())[0], changes);
      SlopUI.toast(n ? 'Replayed ' + n + ' saved edit' + (n === 1 ? '' : 's') + ' on the original' : 'The change list has nothing to replay for this file');
    }
  };
  /** Back to the original in this tab. The edits in the tab are dropped; the saved edited copy stays in Slop Drive. */
  A.revertToOriginal = async function () {
    var v = await versions(); if (!v) return;
    var ok = await SlopUI.confirm('Revert to the original', 'Go back to the original file? The edits in this tab are dropped. The edited copy saved in Slop Drive stays there.', 'Revert', { danger: true });
    if (!ok) return;
    A.showGrid(true);
    E.closeAll();
    if (v.original.meta && v.original.meta.sha256) await SP.editLog.discard(v.original.meta.sha256);
    S.fileNameTouched = false;
    await A.addFiles([fileOf(v.original)], { drive: { link: v.original.id, log: false } });
    SlopUI.toast('Reverted to the original');
  };
  /** Downloads the saved change list as JSON. */
  A.downloadChanges = async function () {
    var v = await versions(); if (!v) return;
    if (!v.changes) { SlopUI.toast('No change list has been saved yet. Save first.'); return; }
    U.download(await v.changes.blob.text(), U.baseName(v.original.name) + '.changes.json', 'application/json');
  };
})();
