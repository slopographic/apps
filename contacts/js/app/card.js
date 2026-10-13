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
    document.body.classList.toggle('card-open', !!S.open);
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

  /** The View / Edit switch on the card (shown in both modes). The chosen mode is remembered per device (state.js). */
  function modeSwitch(mode) {
    const t = document.createElement('template');
    const b = (m, label) => `<button type="button" class="mode-btn${mode === m ? ' on' : ''}" data-act="${m}" aria-pressed="${mode === m}">${label}</button>`;
    t.innerHTML = `<div class="mode-switch" role="group" aria-label="Card mode">${b('view', 'View')}${b('edit', 'Edit')}</div>`;
    return t.content.firstElementChild;
  }

  /** The switch: View leaves edit mode (asks first when there are unsaved changes); Edit opens the form. */
  function onSwitch(e) {
    const b = e.target.closest && e.target.closest('.mode-switch [data-act]');
    if (!b || !S.open) return;
    if (b.dataset.act === 'edit') { S.mode = 'edit'; S.emit('render'); }
    else if (S.mode === 'edit') SC.cardEdit.cancel();
  }

  function mount() {
    S.on('render', render);
    S.on('change', render);
    document.getElementById('cardBody').addEventListener('click', onSwitch);
    D.store.subscribe(() => { if (!SC.records.pending()) SC.cardRead.refreshHistory(); });
  }

  SC.card = { mount, render, modeSwitch };
})();
