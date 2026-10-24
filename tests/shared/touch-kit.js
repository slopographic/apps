/* Touch input for the test pages of the touch runs (tests/run.mjs --touch; pages marked <meta name="slop-test-touch">).
 * Fingers go through the runner's bridge (window.__slopInput, tests/touch.mjs) as real touches where the engine can
 * (a tap in every engine; any gesture in Chromium, by CDP), else as touch pointer events sent in the page, the way the
 * browser would send them (implicitly captured to the element first touched, a click after a tap).
 *   TouchKit.tap(t) · doubleTap(t) · longPress(t, ms) · drag(t, dx, dy, steps) · pinch(t, scale, steps) · pan2(t, dx, dy)
 * t is an element (its centre), { el, x, y } (x, y from the element's top left) or { x, y } in the test page. Elements in
 * a same-origin iframe are found through their frame. Each resolves once the gesture is over.
 * TouchKit.real: true when the gestures beyond a tap are real touches (Chromium). Covers: shared/input/touch.js */
(function () {
  'use strict';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const info = () => window.__SLOPTEST_TOUCH__ || { engine: 'none', multi: false };
  const bridge = (op) => (typeof window.__slopInput === 'function' ? window.__slopInput(op) : Promise.resolve(false));
  let nextId = 100;

  /** A target as { x, y } in the top page plus where it is in its own frame ({ win, lx, ly }). */
  function where(t) {
    let el = t && t.nodeType === 1 ? t : t && t.el, lx, ly;
    if (el) {
      const r = el.getBoundingClientRect();
      lx = r.left + (t.el ? t.x : r.width / 2); ly = r.top + (t.el ? t.y : r.height / 2);
    } else { lx = t.x; ly = t.y; }
    const win = el ? el.ownerDocument.defaultView : window;
    let x = lx, y = ly, w = win;
    while (w !== window && w.frameElement) {
      const fr = w.frameElement.getBoundingClientRect(), cs = w.frameElement.ownerDocument.defaultView.getComputedStyle(w.frameElement);
      x += fr.left + parseFloat(cs.borderLeftWidth || 0); y += fr.top + parseFloat(cs.borderTopWidth || 0);
      w = w.parent;
    }
    return { x, y, win, lx, ly };
  }
  /** The frame window and its coordinates for a top-page point (into same-origin iframes). */
  function local(x, y) {
    let win = window, lx = x, ly = y;
    for (;;) {
      const el = win.document.elementFromPoint(lx, ly);
      if (!el || el.tagName !== 'IFRAME' || !el.contentWindow) return { win, el, lx, ly };
      const r = el.getBoundingClientRect();
      win = el.contentWindow; lx -= r.left; ly -= r.top;
    }
  }

  /** A synthetic finger: pointer events sent to what it first touched (as touch pointers are captured). */
  function finger(x, y, kind = 'touch', pressure = 0.5) {
    const id = nextId++, start = local(x, y), target = start.el || start.win.document.body;
    const ox = x - start.lx, oy = y - start.ly; // the frame's offset in the top page
    const send = (type, px, py, extra) => {
      const W = start.win;
      target.dispatchEvent(new W.PointerEvent(type, { bubbles: true, cancelable: type !== 'pointercancel', composed: true, view: W,
        pointerId: id, pointerType: kind, isPrimary: true, clientX: px - ox, clientY: py - oy, screenX: px, screenY: py,
        button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
        pressure: type === 'pointerup' ? 0 : pressure, width: 8, height: 8, ...extra }));
    };
    send('pointerdown', x, y);
    return {
      move(px, py) { send('pointermove', px, py); },
      up(px, py, click) {
        send('pointerup', px, py);
        if (click) target.dispatchEvent(new start.win.MouseEvent('click', { bubbles: true, cancelable: true, view: start.win, clientX: px - ox, clientY: py - oy, detail: 1 }));
      },
      cancel() { send('pointercancel', x, y); },
    };
  }

  /** Real fingers by CDP: down/move/up of a set of { id, x, y } points. */
  const cdp = (type, points, rest) => bridge({ op: 'touch', type, points, rest });

  async function tap(t) {
    const p = where(t);
    if (await bridge({ op: 'tap', x: p.x, y: p.y })) return sleep(30);
    const f = finger(p.x, p.y);
    await sleep(40);
    f.up(p.x, p.y, true);
    return sleep(30);
  }
  async function doubleTap(t) { await tap(t); await sleep(90); await tap(t); return sleep(420); }

  async function longPress(t, ms = 700) {
    const p = where(t);
    if (info().multi) { await cdp('start', [{ id: 1, x: p.x, y: p.y }]); await sleep(ms); await cdp('end', []); return sleep(60); }
    const f = finger(p.x, p.y);
    await sleep(ms);
    f.up(p.x, p.y, false);
    return sleep(60);
  }

  async function drag(t, dx, dy, steps = 8, opts = {}) {
    const p = where(t);
    if (info().multi && !opts.kind) {
      await cdp('start', [{ id: 1, x: p.x, y: p.y }]);
      for (let i = 1; i <= steps; i++) { await sleep(16); await cdp('move', [{ id: 1, x: p.x + (dx * i) / steps, y: p.y + (dy * i) / steps }]); }
      await cdp('end', []);
      return sleep(60);
    }
    const f = finger(p.x, p.y, opts.kind || 'touch', opts.pressure);
    for (let i = 1; i <= steps; i++) { await sleep(16); f.move(p.x + (dx * i) / steps, p.y + (dy * i) / steps); }
    f.up(p.x + dx, p.y + dy, false);
    return sleep(60);
  }

  /** Two fingers about the target's centre, spread from 80 px apart to 80·scale, and moved (dx, dy) together. */
  async function pinch(t, scale = 2, steps = 8, dx = 0, dy = 0) {
    const p = where(t), d0 = 40, d1 = 40 * scale;
    const at = (k) => { const d = d0 + (d1 - d0) * k; return [{ id: 1, x: p.x - d + dx * k, y: p.y + dy * k }, { id: 2, x: p.x + d + dx * k, y: p.y + dy * k }]; };
    if (info().multi) {
      await cdp('start', [at(0)[0]]); await sleep(16); await cdp('start', at(0));
      for (let i = 1; i <= steps; i++) { await sleep(16); await cdp('move', at(i / steps)); }
      await cdp('end', [], [at(1)[0]]); await sleep(16); await cdp('end', []);
      return sleep(80);
    }
    const [a, b] = at(0), fa = finger(a.x, a.y);
    await sleep(16);
    const fb = finger(b.x, b.y);
    for (let i = 1; i <= steps; i++) { await sleep(16); const [pa, pb] = at(i / steps); fa.move(pa.x, pa.y); fb.move(pb.x, pb.y); }
    const [ea, eb] = at(1);
    fb.up(eb.x, eb.y); fa.up(ea.x, ea.y);
    return sleep(80);
  }
  const pan2 = (t, dx, dy, steps = 8) => pinch(t, 1, steps, dx, dy);

  window.TouchKit = { tap, doubleTap, longPress, drag, pinch, pan2, finger, where, get real() { return !!info().multi; }, get engine() { return info().engine; } };
})();
