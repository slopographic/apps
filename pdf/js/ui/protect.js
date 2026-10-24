/* Slop PDF — the Download PDF dialog with its "Protect with a password" section (File ▸ Protect with password…, the
   command palette, File ▸ Export as ▸ PDF with a password…, and "Keep the password" on a file that had one). The password
   is added after the document is built and checked (ui/exports.js A.download, shared/pdf-crypto: AES-256). The fields are
   emptied as soon as the download starts, and the password is never put in the status line, a toast, the console,
   storage or the session. A.protect(preset) -> Promise<bytes | null>; preset { on, print, copy, edit }. Classic script. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, A = SP.app, h = U.h;

  /** What a protected original allowed, as the dialog's checkboxes (shared/pdf-crypto inspect().permissions). */
  A.protectPreset = function (security) {
    var p = (security && security.permissions) || {};
    return { on: true, print: p.print !== false, copy: p.copy !== false, edit: p.modify !== false };
  };
  /** The first open file that had a password (its security, never the password), or null. */
  A.hadPassword = function () {
    var out = null;
    E.files.forEach(function (f) { if (!out && f.security && f.security.encrypted) out = f; });
    return out;
  };

  A.protect = function (preset) {
    if (!E.state.pages.length) return Promise.resolve(null);
    preset = Object.assign({ on: true, print: true, copy: true, edit: true }, preset || {});
    var C = SlopUI.check;
    var on = C('Protect with a password', preset.on), print = C('Allow printing', preset.print);
    var copy = C('Allow copying text and images', preset.copy), edit = C('Allow editing, comments and page changes', preset.edit);
    var pw = h('input', { class: 'sui-input', type: 'password', name: 'pw', autocomplete: 'new-password', 'aria-label': 'Password' });
    var pw2 = h('input', { class: 'sui-input', type: 'password', name: 'confirm', autocomplete: 'new-password', 'aria-label': 'Confirm password' });
    var err = h('p', { class: 'sui-p sp-err', role: 'alert', hidden: true });
    var fields = h('div', { class: 'pp-protect-fields' }, SlopUI.field('Password', pw), SlopUI.field('Confirm', pw2), print.el, copy.el, edit.el,
      h('p', { class: 'pp-note' }, 'AES-256. Anyone with the password can open the file; the permissions are kept by PDF readers that respect them. Slop PDF does not keep the password: if it is lost, the file cannot be opened.'));
    function sync() { fields.hidden = !on.input.checked; pw.disabled = pw2.disabled = !on.input.checked; }
    on.input.addEventListener('change', sync); sync();
    function forget() { pw.value = ''; pw2.value = ''; }
    var body = h('div', { class: 'pp-protect' },
      h('h3', null, 'Protect with a password'), on.el, fields, err,
      h('p', { class: 'sui-p' }, 'The PDF is made on this device; the password never leaves it.'));
    return new Promise(function (resolve) {
      var go = null;
      SlopUI.dialog({ title: 'Download PDF', cls: 'sui-narrow', body: body, buttons: [{ label: 'Cancel' }, { label: 'Download', primary: true, act: function () {
        if (on.input.checked) {
          var msg = !pw.value ? 'Type a password.' : pw.value !== pw2.value ? 'The two passwords are not the same. Type them again.' : '';
          if (msg) { err.textContent = msg; err.hidden = false; pw2.value = ''; (pw.value ? pw2 : pw).focus(); return false; }
          go = { protect: { pw: pw.value, print: print.input.checked, copy: copy.input.checked, edit: edit.input.checked } };
        } else go = {};
        forget();
      } }], onClose: function (ok) {
        forget();
        if (!ok || !go) { resolve(null); return; }
        var o = go; go = null;
        Promise.resolve(A.download(o)).then(resolve, function () { resolve(null); });
      } });
    });
  };
})();
