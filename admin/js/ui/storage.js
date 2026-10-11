// The Storage tab: how much space this site uses, and whether the browser has promised to keep it. The message is
// the one shared/pwa.js gives for that answer.
(function (g) {
  'use strict';
  const NS = (g.SlopAdmin = g.SlopAdmin || {});
  const $ = (id) => document.getElementById(id);

  async function render() {
    const s = await NS.storage.status();
    $('sUsage').textContent = s.usage === null ? 'The browser does not report space use here.'
      : `${NS.util.bytes(s.usage)} used of ${NS.util.bytes(s.quota)} available to this site.`;
    $('sPersist').textContent = s.message;
    $('sState').textContent = s.persisted === null ? '' : s.persisted ? 'Kept: the browser has agreed to keep this site’s data.' : 'Not guaranteed: the browser may clear it when space runs low.';
    $('sAsk').hidden = s.persisted === true;
  }

  async function ask() {
    $('sMsg').textContent = '';
    await NS.storage.ask();
    await render();
  }

  NS.views = NS.views || {};
  NS.views.storage = { mount: () => $('sAsk').addEventListener('click', ask), render };
})(typeof window !== 'undefined' ? window : globalThis);
