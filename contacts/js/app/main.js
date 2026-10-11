/* Slop Contacts: boot. Wires the chrome (file name, status line, shortcuts), starts the list and exposes
 * window.SlopContacts.ready for tests and the console. Load after every other app script. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const $ = (id) => document.getElementById(id);

  function status() {
    const st = S.file.dirty ? 'Unsaved changes' : S.file.driveId ? 'Saved to Slop Drive' : 'Not saved yet';
    $('saveState').textContent = `${st} · ${S.list.length} contact${S.list.length === 1 ? '' : 's'}`;
    $('saveState').classList.toggle('is-dirty', !!S.file.dirty);
    document.title = `${S.file.dirty ? '• ' : ''}${S.file.name} — Slop Contacts`;
  }
  function bindChrome() {
    const name = $('fileName');
    name.addEventListener('change', () => { S.file.name = name.value.trim() || 'Contacts'; S.file.dirty = true; S.emit('change'); });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
    S.on('change', () => { if (document.activeElement !== name) name.value = S.file.name; status(); });
    S.on('render', status);
    S.on('saved', status);
    S.on('open', status);
    $('ccLabel').textContent = S.cc ? `Country ${S.cc}` : 'No country code';
    S.on('change', () => { $('ccLabel').textContent = S.cc ? `Country ${S.cc}` : 'No country code'; });
  }

  function boot() {
    bindChrome();
    SC.commands.init();
    S.emit('render');
    SC.storage.launch().then(() => {
      S.ready = true;
      SC.ready = true;
      S.emit('render');
      status();
    });
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
})();
