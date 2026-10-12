/* Keeps the homepage clear of the consent strip (shared/consent/banner.js). While the strip is on the page, its measured
 * height goes into --consent-h on <html>: body gets that much bottom padding, so nothing at the end of the page sits under
 * the strip, and html gets it as scroll-padding-bottom, so a control scrolled to (a jump link, keyboard focus) lands above
 * the strip. Both fall back to 0 when the strip is gone. The height is read from the element and kept current with a
 * ResizeObserver (a resize or a change of text can wrap the strip onto two lines). Classic script, homepage only. */
(function () {
  'use strict';
  var root = document.documentElement;
  var ID = 'slopc-banner';
  var watched = null;
  var ro = null;

  function setHeight(px) {
    try { root.style.setProperty('--consent-h', px + 'px'); } catch (e) { /* no style access: the page keeps its default */ }
  }
  function measure(el) {
    setHeight(Math.ceil(el.getBoundingClientRect().height));
  }
  /** Finds the strip (it can be added or removed at any time) and follows its size. */
  function sync() {
    var el = document.getElementById(ID);
    if (el === watched) { if (el) measure(el); return; }
    if (ro) { ro.disconnect(); ro = null; }
    watched = el;
    if (!el) { setHeight(0); return; }
    measure(el);
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(function () { measure(el); });
      ro.observe(el);
    }
  }

  if (typeof MutationObserver === 'function') new MutationObserver(sync).observe(document.body, { childList: true });
  if (typeof ResizeObserver !== 'function') window.addEventListener('resize', sync);
  sync();
})();
