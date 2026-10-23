// The Data view: full backup and restore (SlopBiz.backup, shared/biz/backup.js).
(function (g) {
  'use strict';
  const NS = (g.SlopQuotes = g.SlopQuotes || {});
  NS.dataActions = { backup: () => g.SlopBiz.backup.backup(), restore: (f) => g.SlopBiz.backup.restore(f) };
  NS.views = NS.views || {};
  NS.views.data = { mount: () => g.SlopBiz.backup.mount(), refresh: () => {}, onShow: () => {} };
})(typeof window !== 'undefined' ? window : globalThis);
