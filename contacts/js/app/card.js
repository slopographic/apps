/* Slop Contacts: the card column (the right-hand column on a wide screen; a full page with a back button on a
 * narrow one). Chooses the view for the state: the empty card, the selection count, the read card (card-read.js),
 * or the form (card-edit.js). The read card is drawn again only when the contact or the view changes, so typing
 * in it is not lost to an unrelated redraw. Adds SlopContacts.card. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const D = window.SlopData;
  let key = '', json = '';

  function empty(text) {
    const body = document.getElementById('cardBody');
    body.innerHTML = `<div class="card-empty"><p class="card-empty-h">${text}</p></div>`;
    key = ''; json = '';
  }

  /** Draws the card for the current state. */
  function render() {
    document.body.classList.toggle('card-open', !!S.open || S.mode === 'new');
    if (S.mode === 'new') {
      if (key !== 'new') { key = 'new'; SC.cardEdit.render(null); }
      return;
    }
    const c = S.open ? S.byId(S.open) : null;
    if (!c) {
      key = ''; json = '';
      if (S.sel.size > 1) empty(`${S.sel.size} contacts selected`);
      else empty(S.list.length ? 'No contact selected' : 'No contacts yet');
      return;
    }
    if (S.mode === 'edit') {
      if (key !== `edit:${c.id}`) { key = `edit:${c.id}`; SC.cardEdit.render(c); }
      return;
    }
    const j = JSON.stringify(c);
    if (key === `view:${c.id}` && j === json) return;
    key = `view:${c.id}`; json = j;
    SC.cardRead.render(c);
  }

  function mount() {
    S.on('render', render);
    S.on('change', render);
    D.store.subscribe(() => { if (!SC.records.pending()) SC.cardRead.refreshHistory(); });
  }

  SC.card = { mount, render };
})();
