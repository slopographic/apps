/* Slop PDF — organizer thumbnail zoom: S/M/L presets plus a continuous slider (80 px up to one page
   per row), Ctrl/⌘ + wheel and two-finger pinch on the grid. Rasters re-render per resolution bucket
   once zooming settles (see grid.js and E.thumbURL). */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, O = SP.organizer, S = O._, h = U.h;
  O.PRESETS = [[128, 'S'], [168, 'M'], [228, 'L']];

  /** Zooms keeping the thumbnail under (clientX, clientY) in place (or the top of the view). */
  O.zoomTo = function (px, cx, cy) {
    var sc = S.scroller; if (!sc) { O.setSize(px); return; }
    var r = sc.getBoundingClientRect(), y = cy == null ? 0 : cy - r.top;
    var anchor = (sc.scrollTop + y) / Math.max(1, sc.scrollHeight);
    O.setSize(px);
    sc.scrollTop = anchor * sc.scrollHeight - y;
  };
  O.zoomBy = function (k, cx, cy) { O.zoomTo(O.getSize() * k, cx, cy); };

  /** The toolbar control: preset buttons + range slider, kept in sync with every size change. */
  O.sizeControl = function () {
    var wrap = h('div', { class: 'tz', role: 'group', 'aria-label': 'Thumbnail size' });
    var seg = h('div', { class: 'seg seg-sm', role: 'radiogroup', 'aria-label': 'Thumbnail size presets' });
    O.PRESETS.forEach(function (s) {
      var b = h('button', { type: 'button', class: 'seg-b', role: 'radio', 'data-size': s[0], title: 'Thumbnail size ' + s[1], 'aria-label': 'Thumbnail size ' + s[1] }, s[1]);
      b.addEventListener('click', function () { O.zoomTo(s[0]); });
      seg.appendChild(b);
    });
    var range = h('input', { type: 'range', class: 'tz-range', min: O.MIN, max: 1200, step: 1, value: O.getSize(), 'aria-label': 'Thumbnail size', title: 'Thumbnail size (Ctrl + wheel or pinch on the pages)' });
    range.addEventListener('pointerdown', syncMax);
    range.addEventListener('focus', syncMax);
    range.addEventListener('input', function () { O.zoomTo(+range.value); });
    var full = h('button', { type: 'button', class: 'tb tz-full', title: 'One page per row', 'aria-label': 'One page per row', html: U.icon('fit') });
    full.addEventListener('click', function () { O.zoomTo(O.maxSize()); });
    function syncMax() { range.max = O.maxSize(); }
    function sync(px) {
      syncMax(); if (+range.value !== px) range.value = px;
      range.style.setProperty('--p', ((px - O.MIN) / Math.max(1, range.max - O.MIN) * 100) + '%');
      U.$$('.seg-b', seg).forEach(function (b) { var on = +b.dataset.size === px; b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
    }
    O.onSize(sync);
    requestAnimationFrame(function () { sync(O.getSize()); });
    wrap.append(seg, range, full);
    return wrap;
  };

  /** Ctrl/⌘ + wheel and pinch on the grid scroller. */
  O.initZoom = function () {
    var sc = S.scroller, pinch = null;
    sc.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      O.zoomBy(Math.exp(-U.clamp(e.deltaY, -60, 60) * 0.006), e.clientX, e.clientY);
    }, { passive: false });
    function dist(t) { return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY) || 1; }
    sc.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 2) return;
      if (S.cancelPress) S.cancelPress();
      pinch = { d0: dist(e.touches), s0: O.getSize() };
    }, { passive: true });
    sc.addEventListener('touchmove', function (e) {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      var t = e.touches;
      O.zoomTo(pinch.s0 * dist(t) / pinch.d0, (t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2);
    }, { passive: false });
    sc.addEventListener('touchend', function (e) { if (e.touches.length < 2) pinch = null; });
    sc.addEventListener('touchcancel', function () { pinch = null; });
    // a narrower window can make the current size wider than a row: clamp it
    new ResizeObserver(U.debounce(function () { if (sc.clientWidth > 0 && O.getSize() > O.maxSize()) O.setSize(O.maxSize()); }, 150)).observe(sc);
  };
})();
