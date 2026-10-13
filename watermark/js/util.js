/* Slop Watermark: the one DOM lookup the page's scripts share. Classic script. Exposes window.WMUtil. */
(function () {
  'use strict';
  window.WMUtil = { $: (id) => document.getElementById(id) };
})();
