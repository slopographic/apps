/* Slop Slides: the slide sorter strip (left; a bottom strip on phones). Thumbnails re-render when their slide
   changes; click / Shift-click / Cmd-click select; drag to reorder (several at once); sections group slides;
   hidden slides are dimmed; right-click for slide actions. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, D = SS.dom, M = SS.model, R = SS.canvasRender;
  var S = SS.sorter = { items: {} };

  S.init = function (host) {
    S.host = host;
    S.list = D.h('div', { class: 'sorter-list', role: 'listbox', 'aria-label': 'Slides', 'aria-multiselectable': 'true', tabindex: '0' });
    host.append(S.list);
    A.on('deck', S.rebuild);
    A.on('slide', S.mark);
    A.on('render', function (p) {
      if (p.all) Object.keys(S.items).forEach(function (id) { S.items[id].dirty = true; });
      else Object.keys(p.slides).forEach(function (id) { if (S.items[id]) S.items[id].dirty = true; });
      S.paint();
    });
    S.list.addEventListener('keydown', key);
    SS.sorterDrag.init(S);
  };
  S.rebuild = function () {
    var deck = A.deck; if (!deck) return;
    S.list.innerHTML = ''; S.items = {};
    var n = 0;
    M.sections(deck).forEach(function (sec) {
      if (sec.name) {
        var head = D.h('div', { class: 'sec-head', 'data-slide': sec.slides[0].id },
          D.h('span', { class: 'sec-name', text: sec.name }), D.h('span', { class: 'sec-count', text: sec.slides.length + (sec.slides.length === 1 ? ' slide' : ' slides') }));
        head.addEventListener('dblclick', function () { S.renameSection(sec.slides[0].id); });
        head.addEventListener('contextmenu', function (e) { e.preventDefault(); SS.menus.sectionMenu(sec.slides[0].id, e.clientX, e.clientY); });
        S.list.append(head);
      }
      sec.slides.forEach(function (s) {
        n++;
        var cv = D.h('canvas', { class: 'thumb-cv' });
        var badges = D.h('span', { class: 'th-badges' });
        var it = D.h('div', { class: 'thumb' + (s.hidden ? ' is-hidden' : ''), role: 'option', 'data-id': s.id, title: 'Slide ' + n },
          D.h('span', { class: 'th-num', text: String(n) }), D.h('div', { class: 'th-frame' }, cv, badges));
        if (s.hidden) badges.insertAdjacentHTML('beforeend', '<i class="bd" title="Hidden">' + D.icon('eyeOff') + '</i>');
        if (s.transition && s.transition.type && s.transition.type !== 'none') badges.insertAdjacentHTML('beforeend', '<i class="bd' + (s.transition.type === 'magic' ? ' bd-magic' : '') + '" title="Transition: ' + s.transition.type + '">' + D.icon(s.transition.type === 'magic' ? 'sparkle' : 'animate') + '</i>');
        it.addEventListener('click', function (e) { click(s.id, e); });
        it.addEventListener('dblclick', function () { if (SS.play && A.isMobile()) SS.play.start(M.index(A.deck, s.id)); });
        it.addEventListener('contextmenu', function (e) { e.preventDefault(); if (A.selSlides.indexOf(s.id) < 0) { A.goto(s.id); } SS.menus.slideMenu(e.clientX, e.clientY); });
        S.list.append(it);
        S.items[s.id] = { el: it, cv: cv, dirty: true };
      });
    });
    var add = D.h('button', { type: 'button', class: 'th-add', title: 'New slide', 'aria-label': 'New slide', html: D.icon('plus') });
    add.addEventListener('click', function () { A.addSlide(); });
    S.list.append(add);
    S.mark(); S.paint();
  };
  S.mark = function () {
    Object.keys(S.items).forEach(function (id) {
      var it = S.items[id];
      it.el.classList.toggle('current', id === A.cur);
      it.el.classList.toggle('selected', A.selSlides.indexOf(id) >= 0);
      it.el.setAttribute('aria-selected', A.selSlides.indexOf(id) >= 0 ? 'true' : 'false');
    });
    var cur = S.items[A.cur];
    if (cur && cur.el.scrollIntoView && !S.noScroll) cur.el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  var painting = 0;
  /** Paints dirty thumbnails, the current one first, a few per frame. */
  S.paint = function () {
    if (painting) return;
    painting = requestAnimationFrame(function step() {
      painting = 0;
      var ids = Object.keys(S.items).filter(function (id) { return S.items[id].dirty; });
      ids.sort(function (a, b) { return (b === A.cur) - (a === A.cur); });
      var t0 = performance.now();
      for (var i = 0; i < ids.length; i++) {
        var it = S.items[ids[i]], slide = M.slide(A.deck, ids[i]); if (!slide) continue;
        var w = it.cv.parentNode.clientWidth || 160;
        R.slideToCanvas(A.deck, slide, w, { canvas: it.cv, dpr: Math.min(2, window.devicePixelRatio || 1), onImage: function () { Object.keys(S.items).forEach(function (k) { S.items[k].dirty = true; }); S.paint(); } });
        it.cv.style.width = w + 'px';
        it.dirty = false;
        if (performance.now() - t0 > 12) { painting = requestAnimationFrame(step); return; }
      }
    });
  };

  function click(id, e) {
    var ids = A.deck.slides.map(function (s) { return s.id; });
    if (e.shiftKey) {
      var a = ids.indexOf(A.cur), b = ids.indexOf(id);
      A.selSlides = ids.slice(Math.min(a, b), Math.max(a, b) + 1);
      S.noScroll = true; A.goto(id, { keepSorter: true }); S.noScroll = false;
    } else if (e.metaKey || e.ctrlKey) {
      var sel = A.selSlides.slice(), i = sel.indexOf(id);
      if (i >= 0 && sel.length > 1) sel.splice(i, 1); else if (i < 0) sel.push(id);
      A.selSlides = sel; A.goto(sel.indexOf(id) >= 0 ? id : sel[sel.length - 1], { keepSorter: true });
    } else A.goto(id);
    S.list.focus({ preventScroll: true });
  }
  function key(e) {
    var i = A.slideIndex(), n = A.deck.slides.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); if (e.altKey) S.shift(1); else if (i < n - 1) A.goto(A.deck.slides[i + 1].id); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); if (e.altKey) S.shift(-1); else if (i > 0) A.goto(A.deck.slides[i - 1].id); }
    else if (e.key === 'Home') { e.preventDefault(); A.goto(A.deck.slides[0].id); }
    else if (e.key === 'End') { e.preventDefault(); A.goto(A.deck.slides[n - 1].id); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && !e.metaKey) { e.preventDefault(); e.stopPropagation(); A.deleteSlides(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); A.addSlide(); }
  }
  /** Moves the selected slides one place up (-1) or down (+1). */
  S.shift = function (dir) {
    var ids = A.selSlides.slice(), idx = ids.map(function (id) { return M.index(A.deck, id); }).sort(function (a, b) { return a - b; });
    var to = dir < 0 ? idx[0] - 1 : idx[idx.length - 1] + 2;
    if (to < 0 || to > A.deck.slides.length) return;
    A.moveSlides(ids, to); A.goto(A.cur, { keepSorter: true });
  };
  S.renameSection = function (id) {
    var s = M.slide(A.deck, id);
    window.SlopUI.prompt('Rename section', 'Name', s.section || '').then(function (v) { if (v == null) return; A.change('Rename section', function () { s.section = v.trim() || null; }); A.emit('deck'); });
  };
  S.addSection = function (id) {
    var s = M.slide(A.deck, id || A.cur);
    window.SlopUI.prompt('New section', 'Name', 'Section').then(function (v) { if (v == null || !v.trim()) return; A.change('Add section', function () { s.section = v.trim(); }); A.emit('deck'); });
  };
  S.removeSection = function (id) { var s = M.slide(A.deck, id); A.change('Remove section', function () { s.section = null; }); A.emit('deck'); };
})();
