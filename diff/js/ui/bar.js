/* Slop Compare: the header (SlopAppBar), mounted by a classic script before shell/shell.js, so the shell finds the header
 * and adds its buttons (Theme, Apps, the bell) and brand/brand.js draws the app's icon in the home link. The page's module
 * (main.js) runs later and fills the bar's actions through window.SlopCompareBar. */
(function () {
  'use strict';
  window.SlopCompareBar = window.SlopAppBar.mount(document.getElementById('df-bar'), {
    home: '../', title: 'Slop Compare', subtitle: 'Compare two texts, files, PDFs or pictures and see every change. Nothing is uploaded.', actions: [], menu: [],
  });
})();
