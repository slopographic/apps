/* Slop Press — Slop Hub: register, ?drive= launches, Open/Place from Slop Drive, Save to Drive, Send to. */
(function () {
  'use strict';
  var PR = window.PR, U = PR.util, S = PR.state;
  var HB = PR.hub = {};
  var ACCEPT = ['application/x-slop-press', 'application/zip', 'application/json', 'image/*', 'text/*', 'application/pdf', 'application/octet-stream'];
  HB.available = function () { return !!window.SlopHub; };
  HB.canSend = function () { return HB.available() && location.protocol !== 'file:'; };
  function recFile(rec) { return new File([rec.blob], rec.name || 'file', { type: rec.type || rec.blob.type || '' }); }
  // Only project files are linked: Save writes the .slpress back to that record. Images and text open as new documents.
  function isProject(rec) { return /\.(slpress|json)$/i.test(rec.name || '') || /slop-press|zip/.test(rec.type || ''); }
  HB.openRecord = function (rec) {
    if (!rec || !rec.blob) return Promise.resolve(false);
    return PR.io.openAny(recFile(rec)).then(function () { if (isProject(rec)) S.driveId = rec.id; return true; });
  };
  HB.openFromDrive = function () {
    if (!HB.available()) return U.toast('Slop Drive is unavailable');
    return window.SlopHub.pickFromDrive({ accept: ACCEPT, title: 'Open from Slop Drive' }).then(function (rec) { if (rec) return HB.openRecord(rec); });
  };
  HB.placeFromDrive = function () {
    if (!HB.available()) return U.toast('Slop Drive is unavailable');
    return window.SlopHub.pickFromDrive({ accept: ['image/*', 'text/*', 'application/pdf'], title: 'Place from Slop Drive' }).then(function (rec) { if (rec) return PR.place.files([recFile(rec)]); });
  };
  /** File ▸ Save to Slop Drive…: a new file in a folder of your choice, which Save then keeps writing to. */
  HB.saveToDrive = function () {
    return PR.io.projectBlob().then(function (b) {
      return window.SlopHub.saveToDrive(b, PR.io.baseName() + '.slpress', { from: 'press' }).then(function (id) { if (id) { S.driveId = id; S.dirty = false; PR.emit('commit', 'save'); } return id; });
    });
  };
  /** File ▸ Save: writes back to the linked Drive file (first time: asks for a folder); the .slpress download when Drive is off. */
  HB.save = function () {
    if (!HB.available()) return PR.io.save();
    return PR.io.projectBlob().then(function (b) {
      var name = PR.io.baseName() + '.slpress', H = window.SlopHub;
      if (!S.driveId) return H.saveToDrive(b, name, { from: 'press' }).then(function (id) { if (id) S.driveId = id; return id; });
      return H.update(S.driveId, { blob: b, name: name, type: b.type }).then(function (rec) {
        if (!rec) return H.put(b, { id: S.driveId, name: name, from: 'press' }).then(function (id) { return id; });
        U.toast('Saved ' + name + ' to Slop Drive'); return S.driveId;
      });
    }).then(function (id) { if (id) { S.dirty = false; PR.emit('commit', 'save'); } return id; });
  };
  HB.pdfBlob = function () { return PR.pdf.export({ pages: null, marks: false, bleed: false }).then(function (bytes) { return new Blob([bytes], { type: 'application/pdf' }); }); };
  HB.pngBlob = function () { return PR.raster.pageBlob(S.page, 150); };
  /** Items for File ▸ Send to: the PDF, then the current page as PNG, to every app that accepts them. */
  HB.sendItems = function () {
    if (!HB.available()) return [{ label: 'Slop Hub unavailable', disabled: true }];
    var name = function () { return PR.io.baseName(); };
    var pdf = window.SlopHub.sendMenuItems(HB.pdfBlob, function () { return name() + '.pdf'; }, 'application/pdf').map(function (it) { return { label: it.label.replace(/^Send to /, 'Send PDF to '), act: it.act }; });
    var png = window.SlopHub.sendMenuItems(HB.pngBlob, function () { return name() + '-p' + PR.pages.label(S.doc, S.page) + '.png'; }, 'image/png').map(function (it) { return { label: it.label.replace(/^Send to /, 'Send page PNG to '), act: it.act }; });
    var items = pdf.concat(pdf.length && png.length ? ['-'] : [], png, ['-', { label: 'Save to Slop Drive…', act: HB.saveToDrive }]);
    if (!HB.canSend()) items = items.map(function (it) { return it === '-' ? it : { label: it.label, disabled: true }; });
    return items;
  };
  HB.init = function () {
    if (!HB.available()) return Promise.resolve(null);
    try { window.SlopHub.register('press'); } catch (e) { /* bus unavailable */ }
    return window.SlopHub.consumeLaunch().then(function (rec) {
      if (!rec) return null;
      return HB.openRecord(rec).then(function () { U.toast('Opened “' + (rec.name || 'file') + '” from Slop Drive'); return rec; });
    }).catch(function () { return null; });
  };
})();
