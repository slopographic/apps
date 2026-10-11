/* Slop Tables test helpers: boot the real app in an iframe (same origin, so Slop Drive and the draft
   store are the real ones), drive it through window.SlopTables and read results back. Exposes window.TB. */
(function () {
  'use strict';
  const { waitFor } = SlopTest;
  const TB = window.TB = {};

  /** Forget the autosave draft so a plain start is blank (unless keepDrafts). */
  TB.clearDrafts = () => new Promise((res) => {
    const r = indexedDB.deleteDatabase('slop-tables-drafts');
    r.onsuccess = r.onerror = r.onblocked = () => res();
  });

  /** Loads tables/index.html (plus an optional query) into the iframe and waits for launch to finish. */
  TB.boot = async function (query = '', frameId = 'app', { keepDrafts = false } = {}) {
    const fr = document.getElementById(frameId);
    fr.src = 'about:blank';
    await SlopTest.sleep(60);
    if (!keepDrafts) await TB.clearDrafts();
    fr.src = '../../tables/index.html' + query;
    await waitFor(() => fr.contentWindow && fr.contentWindow.SlopTables && fr.contentWindow.SlopTables.ready, { timeout: 30000 });
    const win = fr.contentWindow;
    if (frameId === 'app') Object.assign(TB, { win, T: win.SlopTables, hub: win.SlopHub, doc: win.document });
    return win;
  };
  TB.frame = (id = 'app') => document.getElementById(id).contentWindow;

  /** Dispatch a key the way the browser does, on the element (default: the grid). */
  TB.key = function (key, { on = null, ctrl = false, shift = false } = {}) {
    const doc = TB.doc, el = on || doc.getElementById('grid');
    el.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: ctrl, shiftKey: shift, bubbles: true, cancelable: true }));
  };

  /** A hub record for the current app: the Drive record by id. */
  TB.drive = (id) => TB.hub.get(id);
  TB.wait = (ms) => SlopTest.sleep(ms);
})();
