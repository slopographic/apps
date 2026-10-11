/* Slop 3D viewport input: orbit (drag), pan (Shift-drag or middle drag), zoom (wheel), click to select (Shift adds),
 * double-click to frame, gizmo arrows to move the selection along an axis (snapped), and the right-click menu.
 * Sets window.Slop3D.viewport: create({ canvas, stage, cam, gizmo, objects, menus }) → { redraw, frame, setView, pickAt }. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const M = S.model, A = S.actions, st = S.state, s = st.s;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

  /** Parameter t of the point on the line origin + t·dir nearest to the ray (ray: { o, d }), or null when parallel. */
  function closestParam(origin, dir, ray) {
    const w0 = sub(origin, ray.o);
    const a = dot(dir, dir), b = dot(dir, ray.d), c = dot(ray.d, ray.d), d = dot(dir, w0), e = dot(ray.d, w0);
    const den = a * c - b * b;
    return Math.abs(den) < 1e-9 ? null : (b * e - c * d) / den;
  }

  function create({ canvas, stage, cam, gizmo, objects, menus }) {
    const THREE = stage.THREE;
    let drag = null, hover = null;

    const ndcOf = (e) => {
      const r = canvas.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    /** A world ray through the pointer, as plain arrays. */
    function rayFrom(ndc) {
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, stage.camera);
      return { o: [rc.ray.origin.x, rc.ray.origin.y, rc.ray.origin.z], d: [rc.ray.direction.x, rc.ray.direction.y, rc.ray.direction.z] };
    }
    const pickAt = (e) => stage.pick(ndcOf(e), stage.camera, objects.pickables());

    /** Keeps the gizmo on the primary selection and at a constant on-screen size. */
    function refreshGizmo() {
      const id = st.primary();
      if (!id || !s.doc.nodes[id]) { gizmo.place([0, 0, 0], 1, false); return; }
      const W = M.worldMatrix(s.doc, id);
      gizmo.place([W[12], W[13], W[14]], cam.st.dist * 0.11, true);
    }
    /** Applies the camera, refreshes the gizmo and asks for a frame. */
    function redraw() {
      cam.apply();
      refreshGizmo();
      stage.request();
    }
    function frame(ids = s.sel) {
      const b = S.ops.bounds(s.doc, ids && ids.length ? ids : null);
      if (b) cam.frame(b);
      redraw();
    }
    function setView(name) { cam.setView(name); redraw(); }
    const toggle = (id) => { const cur = s.sel.slice(), i = cur.indexOf(id); if (i >= 0) cur.splice(i, 1); else cur.push(id); return cur; };

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 2) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointer: no capture */ }
      e.preventDefault();
      const ndc = ndcOf(e);
      const axis = e.button === 0 && !e.shiftKey && !e.altKey && s.sel.length ? gizmo.hit(ndc, stage.camera) : null;
      if (axis) {
        const id = st.primary(), W = M.worldMatrix(s.doc, id);
        const origin = [W[12], W[13], W[14]], dir = gizmo.dirOf(axis), r = rayFrom(ndc);
        const t0 = closestParam(origin, dir, r);
        if (t0 !== null) {
          drag = { mode: 'axis', origin, dir, t0, applied: 0, key: A.beginDrag(), x: e.clientX, y: e.clientY };
          gizmo.highlight(axis);
          canvas.style.cursor = 'grabbing';
          return;
        }
      }
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) drag = { mode: 'pan', x: e.clientX, y: e.clientY };
      else if (e.button === 0) drag = { mode: 'orbit', x: e.clientX, y: e.clientY, moved: 0 };
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!drag) {
        const a = s.sel.length ? gizmo.hit(ndcOf(e), stage.camera) : null;
        if (a !== hover) { hover = a; gizmo.highlight(a); stage.request(); }
        canvas.style.cursor = a ? 'move' : '';
        return;
      }
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      if (drag.mode === 'orbit') { drag.moved += Math.abs(dx) + Math.abs(dy); cam.orbit(dx, dy); redraw(); }
      else if (drag.mode === 'pan') { cam.pan(dx, dy); redraw(); }
      else if (drag.mode === 'axis') {
        const t = closestParam(drag.origin, drag.dir, rayFrom(ndcOf(e)));
        if (t === null) return;
        const amount = S.snap.snap(t - drag.t0, s.snapStep);
        const d = amount - drag.applied;
        if (Math.abs(d) > 1e-12) { drag.applied = amount; A.move(drag.dir.map((v) => v * d), drag.key); }
        refreshGizmo();
        stage.request();
      }
    });
    const endDrag = (e, click) => {
      if (!drag) return;
      const d = drag;
      drag = null;
      try { if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); } catch (err) { /* no capture to release */ }
      canvas.style.cursor = '';
      if (d.mode === 'axis') gizmo.highlight(null);
      if (click && d.mode === 'orbit' && d.moved < 5) {
        const hit = pickAt(e);
        if (hit) st.select(e.shiftKey ? toggle(hit.id) : [hit.id]);
        else if (!e.shiftKey) st.select([]);
      }
      redraw();
    };
    canvas.addEventListener('pointerup', (e) => endDrag(e, true));
    canvas.addEventListener('pointercancel', (e) => endDrag(e, false));
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      cam.zoom(e.deltaY * (e.deltaMode ? 33 : 1));
      redraw();
    }, { passive: false });
    canvas.addEventListener('dblclick', (e) => {
      const hit = pickAt(e);
      if (hit) { st.select([hit.id]); frame([hit.id]); }
    });
    if (window.SlopCtx) SlopCtx.bind(canvas, (target, ev) => {
      if (ev) {
        const hit = pickAt(ev);
        if (hit) { if (!s.sel.includes(hit.id)) st.select([hit.id]); return menus.objectItems(); }
        return menus.viewportItems();
      }
      return s.sel.length ? menus.objectItems() : menus.viewportItems();
    });
    st.on('doc', () => { refreshGizmo(); stage.request(); });
    st.on('sel', () => { refreshGizmo(); stage.request(); });
    return { redraw, frame, setView, pickAt, refreshGizmo };
  }

  S.viewport = { create, closestParam };
})();
