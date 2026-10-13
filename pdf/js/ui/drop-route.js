/* Slop PDF — what a dropped file can become. PDFs and the images the app opens (PNG, JPEG, WebP, GIF, BMP) are opened as
   pages. SVG can be converted to PDF by the Convert dialog (shared/convert, Images to PDF). Every other type is refused,
   and the drop says so with the names of the files, so nothing fails silently. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, A = SP.app, h = U.h;
  var R = SP.dropRoute = {};
  var OPENS = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'];
  var CONVERTS = ['svg'];
  var OPEN_TYPE = /^application\/pdf$|^image\/(png|jpe?g|webp|gif|bmp)$/;
  var NOT_HERE = 'Office files (XLSX, DOCX, ODT, ODS, PPTX) and text files (CSV, TXT, MD, HTML, JSON) cannot be converted to PDF here.';

  /** 'open', 'convert' or 'refused', from the extension and the browser's type. */
  R.kind = function (file) {
    var ext = String(file.name || '').toLowerCase().split('.').pop(), type = String(file.type || '').toLowerCase();
    if (OPENS.indexOf(ext) >= 0 || OPEN_TYPE.test(type)) return 'open';
    if (CONVERTS.indexOf(ext) >= 0 || type === 'image/svg+xml') return 'convert';
    return 'refused';
  };
  /** Splits the dropped files into { open, convert, refused }, keeping the order of each list. */
  R.split = function (files) {
    var out = { open: [], convert: [], refused: [] };
    Array.prototype.forEach.call(files, function (f) { out[R.kind(f)].push(f); });
    return out;
  };
  function names(list) { return list.map(function (f) { return '“' + f.name + '”'; }).join(', '); }

  /** Tells the person what was not added, and offers Convert to PDF for the files it can convert. */
  R.notice = function (r) {
    if (!r.convert.length && !r.refused.length) return;
    var body = h('div', null);
    if (r.convert.length) body.appendChild(h('p', { class: 'sui-p' }, 'Can be converted to PDF: ' + names(r.convert) + '. The conversion runs on this device.'));
    if (r.refused.length) {
      body.appendChild(h('p', { class: 'sui-p' }, 'Not supported, not added: ' + names(r.refused) + '.'));
      body.appendChild(h('p', { class: 'sui-p' }, 'Slop PDF opens PDF, PNG, JPEG, WebP, GIF and BMP files, and converts SVG to PDF. ' + NOT_HERE));
    }
    A.status('Not added: ' + r.refused.length + ' file' + (r.refused.length === 1 ? '' : 's') + ' not supported' + (r.convert.length ? '; ' + r.convert.length + ' can be converted to PDF' : ''), 'err');
    var buttons = r.convert.length ? [{ label: 'Close' }, { label: 'Convert to PDF', primary: true }] : [{ label: 'OK', primary: true }];
    SlopUI.dialog({
      title: r.convert.length ? 'Convert to PDF?' : 'File not supported', body: body, cls: 'sui-narrow', buttons: buttons,
      onClose: function (ok) { if (ok && r.convert.length) A.convertFiles(r.convert); },
    });
  };
})();
