/* The business suite's shared string tables (shared/biz, shared/docs, shared/data): the words every record app shares.
 * Same shape as an app's i18n/index.js (shared/i18n/APPS-HOWTO.md); each business app page loads it before its own. */
window.SlopI18n && window.SlopI18n.source({
  ns: 'biz',
  base: ((document.currentScript || {}).src || '').replace(/[^/]*$/, ''),
  parts: ['biz'],
  langs: ['en', 'sv'],
});
