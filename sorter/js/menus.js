/* Slop Photo Sorter: the words the shared parts draw once, marked so they follow a language change (shared/i18n).
 * The menu bar's own menu (Sort: the shared tables name only File, Edit, View, Help...) and the drop zone's label, hint,
 * steps, picture text and sample button (SlopSorter.markDrop, called by js/app.js after SlopDrop.attach). Classic
 * script, right after SlopMenuBar.mount. */
(function (g) {
  'use strict';
  const NS = (g.SlopSorter = g.SlopSorter || {}), I = g.SlopI18n;
  const mark = (el, key) => { if (el && I) { el.dataset.i18n = key; el.textContent = I.t(key); } };
  for (const b of document.querySelectorAll('.smb-menu-b')) if (b.textContent === 'Sort') mark(b, 'sorter.app.menu_sort');
  /** Marks a SlopDrop zone's own words with keys <prefix>.label, .hint, .step1..., .alt, .sample (shared/drop/panel.js). */
  NS.markDrop = function (zone, prefix) {
    if (!zone || !I) return;
    mark(zone.querySelector('.sd-msg'), prefix + '.label');
    mark(zone.querySelector('.sd-msg + p'), prefix + '.hint');
    zone.querySelectorAll('.sd-steps li').forEach((li, i) => mark(li, prefix + '.step' + (i + 1)));
    mark(zone.querySelector('.sd-sample'), prefix + '.sample');
    const img = zone.querySelector('.sd-pic img');
    if (img) img.dataset.i18nAttr = 'alt:' + prefix + '.alt';
  };
})(typeof window !== 'undefined' ? window : globalThis);
