/* Slop Contacts: boot. Mounts the columns, reads the customers from SlopData, and opens a .scontacts file that was
 * handed over from Slop Drive (?drive=). Load after every other app script. Sets SlopContacts.ready for tests. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const $ = (id) => document.getElementById(id);

  async function launch() {
    const h = window.SlopHub || null;
    if (h) { try { h.register('contacts'); } catch (e) { /* hub without register */ } }
    let rec = null;
    try { rec = h ? await h.consumeLaunch() : null; } catch (e) { rec = null; }
    if (rec && rec.blob) {
      await SC.io.importFiles([{ name: rec.name || 'contacts.scontacts', text: () => rec.blob.text() }]);
    }
  }

  async function boot() {
    const storage = window.SlopData && (await window.SlopData.store.ready());
    if (storage && !storage.ok) {
      $('empty').hidden = false;
      $('empty').textContent = `Storage is not available here: ${storage.message}. Nothing can be saved in this window.`;
      return;
    }
    SC.list.mount();
    SC.select.mount();
    SC.groups.mount();
    SC.card.mount();
    SC.keys.mount();
    SC.commands.init();
    $('btnNew').addEventListener('click', () => SC.newContact.open());
    $('btnGroups').setAttribute('aria-expanded', 'false');
    const ok = await SC.records.init();
    if (ok) { await launch(); await SC.viewState.restore(); } // js/app/view-state.js: the group, search, open card and selection
    S.ready = true;
    SC.ready = true;
    S.emit('render');
  }

  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot); else boot();
})();
