/* Slop Contacts: the place in the page URL. When window.SlopUrlState exists (shared/urlstate), the selected group (group),
 * the filters (f, JSON) and the view (view) are kept in the URL, so a link restores them and back and forward move
 * through them. Without it they stay in memory only. The URL is written only after the saved place has been applied at
 * boot (apply), so the session's place is not overwritten by an empty URL. Adds SlopContacts.urlPlace. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const U = window.SlopUrlState || null;
  const GROUP_OK = /^(recent|cat:.+|stage:(lead|contacted|customer|lost))$/;
  let ready = false;

  /** The place in the URL, or null when the URL names none (so the saved session place stays). */
  function peek() {
    if (!U) return null;
    const g = U.get('group', null), f = U.get('f', null), v = U.get('view', null);
    if (g === null && f === null && v === null) return null;
    return { group: g === null ? '' : g, f: f === null ? '' : f, view: v === null ? '' : v };
  }
  /** Applies a place (null leaves the state alone), then writes the place to the URL. */
  function apply(p) {
    if (p) {
      S.group = GROUP_OK.test(p.group) ? p.group : null;
      S.filters = SC.filters.fromParam(p.f);
      S.view = p.view === 'table' ? 'table' : 'cards';
    }
    ready = true;
    S.emit('render');
  }
  /** Writes the place. The URL changes only when a value does (SlopUrlState.set compares). */
  function write() {
    if (!ready || !U) return;
    U.set({ group: S.group || null, f: SC.filters.toParam(S.filters) || null, view: S.view === 'table' ? 'table' : null }, { replace: true });
  }
  /** Back and forward: the place of the URL that is shown. */
  function mount() {
    S.on('render', write);
    if (U) U.onChange(() => { const p = peek() || { group: '', f: '', view: '' }; apply(p); });
  }

  SC.urlPlace = { mount, peek, apply };
})();
