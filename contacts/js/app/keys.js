/* Slop Contacts keyboard: Cmd+N new contact, Cmd+F search, Cmd+A select all shown, Delete or Backspace asks before
 * deleting the selection (or the open contact), Escape clears the selection, then closes the card or the groups sheet.
 * Arrow keys, Enter and Space work in the list (select.js). Nothing fires while a field or a dialog has the focus.
 * Adds SlopContacts.keys. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const $ = (id) => document.getElementById(id);

  function typing() {
    const a = document.activeElement;
    return !!(a && a.closest && a.closest('input, textarea, select, [contenteditable="true"]'));
  }

  function onKey(e) {
    if (UI.openDialogs) return;
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (mod && k === 'n') { e.preventDefault(); SC.newContact.open(); return; }
    if (mod && k === 'f') { e.preventDefault(); $('search').focus(); return; }
    if (typing()) return;
    if (mod && k === 'a' && document.getElementById('rows').contains(document.activeElement)) { e.preventDefault(); SC.commands.run('contacts.selectAll'); return; }
    if (k === 'Delete' || k === 'Backspace') {
      if (!S.sel.size && !(S.open && S.byId(S.open))) return;
      e.preventDefault();
      SC.select.remove(S.sel.size ? new Set(S.sel) : new Set([S.open]));
      return;
    }
    if (k === 'Escape') {
      if (S.sel.size) { S.setSel([]); return; }
      if (document.body.classList.contains('groups-open')) { SC.groups.sheet(false); return; }
      if (S.mode === 'view' && S.open) { S.open = null; S.emit('render'); }
    }
  }

  function mount() { document.addEventListener('keydown', onKey); }

  SC.keys = { mount };
})();
