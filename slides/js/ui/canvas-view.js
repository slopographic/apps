/* Slop Slides: the editing canvas. The slide is drawn into a <canvas> sized to slide × zoom × devicePixelRatio;
   an SVG overlay on top carries selection handles and smart guides. Zoom: 'fit' or a factor (wheel+Ctrl, pinch). */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, D = SS.dom, R = SS.canvasRender;
  var V = SS.view = { k: 1 };

  V.init = function (stage) {
    V.stage = stage;
    V.board = D.h('div', { class: 'board', id: 'board' });
    V.canvas = D.h('canvas', { class: 'slide-canvas', 'aria-label': 'Slide canvas', role: 'img' });
    V.overlay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    V.overlay.setAttribute('class', 'overlay');
    V.board.append(V.canvas, V.overlay);
    stage.append(V.board);
    new ResizeObserver(function () { V.layout(); A.invalidate(A.cur); }).observe(stage);
    stage.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      V.setZoom(V.k * Math.exp(-e.deltaY * 0.0022), { x: e.clientX, y: e.clientY });
    }, { passive: false });
    A.on('render', function (p) { if (p.all || p.slides[A.cur]) V.draw(); });
    A.on('slide', function () { V.layout(); });
  };
  V.fitK = function () {
    var r = V.stage.getBoundingClientRect(), pad = A.isMobile() ? 16 : 56;
    return Math.max(0.05, Math.min((r.width - pad * 2) / A.deck.size.w, (r.height - pad * 2) / A.deck.size.h));
  };
  V.layout = function () {
    if (!A.deck) return;
    var k = A.zoom === 'fit' ? V.fitK() : A.zoom;
    V.k = k;
    var w = A.deck.size.w * k, h = A.deck.size.h * k, r = V.stage.getBoundingClientRect();
    V.board.style.width = w + 'px'; V.board.style.height = h + 'px';
    var mx = Math.max(24, (r.width - w) / 2), my = Math.max(24, (r.height - h) / 2);
    V.board.style.margin = my + 'px ' + mx + 'px';
    V.overlay.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    V.overlay.setAttribute('width', w); V.overlay.setAttribute('height', h);
    A.emit('zoom', k);
  };
  V.setZoom = function (z, at) {
    var before = at && V.toSlide(at.x, at.y);
    A.zoom = z === 'fit' ? 'fit' : Math.max(0.1, Math.min(8, z));
    V.layout(); V.draw();
    if (before && A.zoom !== 'fit') {
      var b = V.board.getBoundingClientRect();
      V.stage.scrollLeft += b.left + before.x * V.k - at.x;
      V.stage.scrollTop += b.top + before.y * V.k - at.y;
    }
  };
  V.zoomStep = function (dir) {
    var steps = [0.25, 0.33, 0.5, 0.67, 0.75, 1, 1.25, 1.5, 2, 3, 4], k = V.k;
    var next = dir > 0 ? steps.filter(function (s) { return s > k + 0.01; })[0] : steps.filter(function (s) { return s < k - 0.01; }).pop();
    V.setZoom(next || k);
  };
  /** Client (CSS px) → slide points. */
  V.toSlide = function (cx, cy) { var b = V.board.getBoundingClientRect(); return { x: (cx - b.left) / V.k, y: (cy - b.top) / V.k }; };
  V.toClient = function (x, y) { var b = V.board.getBoundingClientRect(); return { x: b.left + x * V.k, y: b.top + y * V.k }; };

  V.draw = function () {
    if (!A.deck) return;
    var k = V.k, dpr = Math.min(window.devicePixelRatio || 1, 2.5), w = A.deck.size.w, h = A.deck.size.h;
    var cw = Math.round(w * k * dpr), ch = Math.round(h * k * dpr);
    if (V.canvas.width !== cw || V.canvas.height !== ch) { V.canvas.width = cw; V.canvas.height = ch; }
    V.canvas.style.width = w * k + 'px'; V.canvas.style.height = h * k + 'px';
    var ctx = V.canvas.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cw, ch);
    ctx.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
    var hide = {};
    if (A.editing) hide[A.editing.id] = true;
    var scene = SS.scene.slide(A.deck, A.slide(), { editor: true, hide: hide, index: A.slideIndex() });
    R.draw(ctx, scene, { deck: A.deck, onImage: function () { A.invalidate('all'); } });
    V.scene = scene;
    A.emit('drawn');
  };
})();
