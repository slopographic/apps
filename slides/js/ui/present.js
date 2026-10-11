/* Slop Slides: Present mode. The show fills the screen (Fullscreen API where allowed) with the slide drawn by the same
   display list as the editor and the PDF. Right, Down, Page Down, Space and Enter advance; Left, Up, Page Up and
   Backspace go back; Home and End jump; a click advances (the left third goes back); B blacks the screen; Escape
   ends the show and returns to the slide you were on. Hidden slides are skipped. Editing commands are disabled while
   the show runs. Exposes window.SS.present. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, R = SS.canvasRender;
  var P = SS.present = { on: false, list: [], n: 0, black: false };
  var root = null, cv = null, flash = null, timer = 0;

  function visibleIdx() {
    var out = [];
    A.deck.slides.forEach(function (s, i) { if (!s.hidden) out.push(i); });
    return out;
  }
  P.start = function () {
    if (P.on || A.mode !== 'edit' || !A.deck) return;
    if (SS.textEdit.editing) SS.textEdit.commit();
    P.list = visibleIdx();
    if (!P.list.length) { SS.dom.toast('Every slide is hidden'); return; }
    var at = P.list.indexOf(A.idx);
    P.n = at >= 0 ? at : 0;
    P.on = true; P.black = false;
    A.mode = 'present';
    build();
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', render);
    try { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () {}); } catch (e) { /* not allowed here */ }
    A.emit('mode');
    render();
    show();
  };
  P.stop = function () {
    if (!P.on) return;
    P.on = false;
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', render);
    if (root) root.remove();
    root = null;
    try { if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(function () {}); } catch (e) { /* ignore */ }
    var idx = P.list[P.n];
    A.mode = 'edit';
    A.go(idx != null ? idx : A.idx);
    A.emit('mode');
  };
  P.step = function (d) {
    if (!P.on) return;
    P.n = Math.max(0, Math.min(P.list.length - 1, P.n + d));
    render();
    show();
  };
  P.current = function () { return P.list[P.n]; };
  function build() {
    root = document.createElement('div');
    root.className = 'present';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-label', 'Presentation');
    cv = document.createElement('canvas');
    flash = document.createElement('div');
    flash.className = 'present-count';
    root.append(cv, flash);
    root.addEventListener('click', function (e) {
      var third = e.clientX < window.innerWidth / 3;
      P.step(third ? -1 : 1);
    });
    document.body.append(root);
  }
  function render() {
    if (!P.on || !cv) return;
    var s = A.deck.slides[P.list[P.n]];
    if (!s) return;
    var W = window.innerWidth, H = window.innerHeight, d = A.deck;
    var w = Math.max(10, Math.min(W, H * d.size.w / d.size.h));
    var dpr = window.devicePixelRatio || 1;
    cv.style.width = w + 'px';
    cv.style.height = (w * d.size.h / d.size.w) + 'px';
    R.slideToCanvas(d, s, Math.round(w * dpr), { canvas: cv, dpr: 1, scene: { editor: false }, onImage: render });
    root.classList.toggle('black', P.black);
  }
  function show() {
    if (!flash) return;
    flash.textContent = (P.n + 1) + ' / ' + P.list.length;
    flash.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(function () { flash.classList.remove('show'); }, 1400);
  }
  function onKey(e) {
    if (!P.on) return;
    var k = e.key, next = ['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter'], prev = ['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace'];
    e.stopPropagation();
    if (k === 'Escape') { e.preventDefault(); P.stop(); return; }
    if (next.indexOf(k) >= 0) { e.preventDefault(); P.step(1); }
    else if (prev.indexOf(k) >= 0) { e.preventDefault(); P.step(-1); }
    else if (k === 'Home') { e.preventDefault(); P.n = 0; render(); show(); }
    else if (k === 'End') { e.preventDefault(); P.n = P.list.length - 1; render(); show(); }
    else if (k === 'b' || k === 'B' || k === '.') { e.preventDefault(); P.black = !P.black; render(); }
  }
})();
