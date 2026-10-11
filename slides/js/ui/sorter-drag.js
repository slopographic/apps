/* Slop Slides: drag to reorder slides in the sorter (pointer events, works with touch after a short hold).
   A drop line shows where the slides land; the list auto-scrolls near its edges. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, M = SS.model, D = SS.dom;
  var G = SS.sorterDrag = {};
  G.init = function (S) {
    var drag = null, line = D.h('div', { class: 'drop-line', hidden: true });
    S.list.append(line);
    S.list.addEventListener('pointerdown', function (e) {
      var th = e.target.closest('.thumb'); if (!th || e.button !== 0 || A.readOnly) return;
      drag = { id: th.dataset.id, x: e.clientX, y: e.clientY, on: false, pid: e.pointerId, t: Date.now(), touch: e.pointerType === 'touch' };
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.pid) return;
      var dist = Math.hypot(e.clientX - drag.x, e.clientY - drag.y);
      if (!drag.on) {
        if (dist < 6) return;
        if (drag.touch && Date.now() - drag.t < 350) { drag = null; return; } // a swipe scrolls the strip
        drag.on = true;
        if (!line.isConnected) S.list.append(line);
        if (A.selSlides.indexOf(drag.id) < 0) A.goto(drag.id);
        drag.ids = A.deck.slides.filter(function (s) { return A.selSlides.indexOf(s.id) >= 0; }).map(function (s) { return s.id; });
        drag.ghost = D.h('div', { class: 'drag-ghost', text: drag.ids.length > 1 ? drag.ids.length + ' slides' : 'Slide ' + (M.index(A.deck, drag.id) + 1) });
        document.body.append(drag.ghost);
        S.list.classList.add('dragging');
      }
      e.preventDefault();
      drag.ghost.style.transform = 'translate(' + (e.clientX + 12) + 'px,' + (e.clientY + 8) + 'px)';
      var horiz = getComputedStyle(S.list).flexDirection === 'row';
      var thumbs = D.$$('.thumb', S.list), to = thumbs.length, ref = null;
      for (var i = 0; i < thumbs.length; i++) {
        var r = thumbs[i].getBoundingClientRect();
        if (horiz ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2) { to = i; ref = r; break; }
      }
      var last = thumbs[thumbs.length - 1].getBoundingClientRect(), lr = S.list.getBoundingClientRect();
      ref = ref || last;
      line.hidden = false;
      if (horiz) { line.style.cssText = 'left:' + ((to === thumbs.length ? last.right + 3 : ref.left - 4) - lr.left + S.list.scrollLeft) + 'px;top:' + (ref.top - lr.top + S.list.scrollTop) + 'px;height:' + ref.height + 'px;width:3px'; }
      else line.style.cssText = 'top:' + ((to === thumbs.length ? last.bottom + 2 : ref.top - 5) - lr.top + S.list.scrollTop) + 'px;left:12px;right:12px;height:3px';
      drag.to = to;
      // auto-scroll near the edges
      var edge = 40;
      if (horiz) { if (e.clientX < lr.left + edge) S.list.scrollLeft -= 12; else if (e.clientX > lr.right - edge) S.list.scrollLeft += 12; }
      else if (e.clientY < lr.top + edge) S.list.scrollTop -= 12; else if (e.clientY > lr.bottom - edge) S.list.scrollTop += 12;
    }, { passive: false });
    function end(e) {
      if (!drag || e.pointerId !== drag.pid) return;
      var d = drag; drag = null;
      line.hidden = true; S.list.classList.remove('dragging');
      if (!d.on) return;
      d.ghost.remove();
      var before = A.deck.slides.map(function (s) { return s.id; }).join();
      var copy = A.deck.slides.slice(); M.moveSlides({ slides: copy }, d.ids, d.to);
      if (copy.map(function (s) { return s.id; }).join() === before) return;
      A.moveSlides(d.ids, d.to);
      A.goto(d.id, { keepSorter: true });
      A.selSlides = d.ids; S.mark();
    }
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
})();
