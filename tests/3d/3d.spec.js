/* Slop 3D browser tests. Each test opens 3d/index.html in a fresh same-origin iframe and drives the app through its
 * real DOM and commands. The page's own window.SlopHub (Slop Drive) stores the files. Without WebGL (a headless
 * browser with no SwiftShader) the viewport tests pass as skipped; the file tests still run. */
(function () {
  'use strict';
  const { describe, it, expect, waitFor, sleep } = window.SlopTest;
  const stage = document.getElementById('stage');
  const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  let frame = null;

  /** Opens the app in a fresh iframe and resolves with its window once the page reports ready. */
  async function openApp(query = '') {
    if (frame) frame.remove();
    frame = document.createElement('iframe');
    frame.src = '../../3d/index.html' + query;
    stage.append(frame);
    await waitFor(() => { const d = frame.contentDocument; return d && d.body && d.body.dataset.ready === '1' && frame.contentWindow.Slop3D; }, { timeout: 45000, step: 100 });
    return frame.contentWindow;
  }
  const app = () => frame.contentWindow;
  const doc = () => frame.contentDocument;
  const rows = () => [...doc().querySelectorAll('.outl-row')];
  const rowNamed = (name) => rows().find((r) => r.querySelector('.outl-name').textContent === name);
  const cmd = (id) => app().SlopCmd.run(id);
  const primary = () => app().Slop3D.state.primary();
  const docNow = () => app().Slop3D.state.s.doc;
  const meshNode = () => Object.values(docNow().nodes).find((n) => n.type === 'mesh');
  const skipIfNoGL = (fn) => async () => { if (hasGL) await fn(); };

  describe('Slop 3D files (no WebGL needed)', () => {
    it('opens a .s3d record from Slop Drive with ?drive= and names the scene after it', async () => {
      await openApp();
      const scene = docNow();
      const id = await SlopHub.put(new Blob([JSON.stringify(scene)], { type: 'application/x-slop-3d' }), { name: 'drive-test.s3d', from: 'test' });
      try {
        await openApp('?drive=' + encodeURIComponent(id));
        expect(app().Slop3D.state.s.file.driveId).toBe(id);
        expect(app().Slop3D.state.s.file.name).toBe('drive-test');
      } finally { await SlopHub.remove(id); }
    }, { timeout: 60000 });

    it('refuses a broken .s3d record without crashing', async () => {
      const id = await SlopHub.put(new Blob(['{"format":"slop-3d","version":1,"nodes":"oops"}'], { type: 'application/x-slop-3d' }), { name: 'broken.s3d', from: 'test' });
      try {
        await openApp('?drive=' + encodeURIComponent(id));
        expect(app().Slop3D.state.s.file.driveId).toBe(null);
        expect(app().Slop3D.state.s.doc.format).toBe('slop-3d');
      } finally { await SlopHub.remove(id); }
    }, { timeout: 60000 });
  });

  describe('Slop 3D viewport and editing (WebGL)', () => {
    it('boots with WebGL (or skips when this browser has none)', skipIfNoGL(async () => {
      await openApp();
      expect(app().Slop3D.app).toBeTruthy();
      expect(app().Slop3D.app.stage).toBeTruthy();
    }));

    it('adds a cube and lists it in the outliner', skipIfNoGL(async () => {
      await openApp();
      cmd('3d.add.cube');
      await waitFor(() => rowNamed('Cube'), { timeout: 5000 });
      expect(primary()).toBeTruthy();
      expect(meshNode().geom.kind).toBe('cube');
    }, { timeout: 60000 }));

    it('the Position X field moves the cube, and undo and redo follow', skipIfNoGL(async () => {
      await openApp();
      cmd('3d.add.cube');
      await waitFor(() => rowNamed('Cube'));
      const input = doc().querySelector('input[aria-label="Position X"]');
      expect(input).toBeTruthy();
      input.value = '2.5';
      input.dispatchEvent(new Event('change', { bubbles: true }));
      expect(meshNode().transform.p[0]).toBe(2.5);
      cmd('3d.edit.undo');
      expect(meshNode().transform.p[0]).toBe(0);
      cmd('3d.edit.redo');
      expect(meshNode().transform.p[0]).toBe(2.5);
    }, { timeout: 60000 }));

    it('exports a .s3d and reopens it from Slop Drive', skipIfNoGL(async () => {
      await openApp();
      cmd('3d.add.sphere');
      await waitFor(() => rowNamed('Sphere'));
      const count = Object.keys(docNow().nodes).length;
      const saved = await SlopHub.put(app().Slop3D.files.sceneBlob(), { name: 'roundtrip.s3d', from: '3d' });
      try {
        await openApp('?drive=' + encodeURIComponent(saved));
        await waitFor(() => rowNamed('Sphere'), { timeout: 15000 });
        expect(Object.keys(docNow().nodes).length).toBe(count);
      } finally { await SlopHub.remove(saved); }
    }, { timeout: 60000 }));

    it('renders the cube into the picture, not a blank frame', skipIfNoGL(async () => {
      const w = await openApp();
      cmd('3d.add.cube');
      await waitFor(() => rowNamed('Cube'));
      const blob = await w.Slop3D.app.stage.capture(1);
      const bmp = await createImageBitmap(blob);
      const c = doc().createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(bmp, 0, 0);
      const mid = ctx.getImageData(Math.floor(bmp.width / 2), Math.floor(bmp.height / 2), 1, 1).data;
      const corner = ctx.getImageData(4, 4, 1, 1).data;
      expect(Math.abs(mid[0] - corner[0]) + Math.abs(mid[1] - corner[1]) + Math.abs(mid[2] - corner[2])).toBeGreaterThan(20);
      expect(bmp.width).toBeGreaterThan(100);
    }, { timeout: 60000 }));

    it('drags the X arrow of the gizmo, snapped to the grid step, and undo takes it back', skipIfNoGL(async () => {
      const w = await openApp();
      cmd('3d.add.cube');
      await waitFor(() => rowNamed('Cube'));
      const snap = doc().getElementById('snap');
      snap.value = '0.5';
      snap.dispatchEvent(new Event('change', { bubbles: true }));
      const { THREE, stage: st3, cam } = w.Slop3D.app;
      cam.apply();
      st3.request();
      await sleep(120);
      const canvas = doc().getElementById('view');
      const r = canvas.getBoundingClientRect();
      const toScreen = (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(st3.camera); return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]; };
      const size = cam.st.dist * 0.11;
      const [sx, sy] = toScreen(0.5 * size, 0, 0);
      const ev = (type, dx) => new w.PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: sx + dx, clientY: sy });
      canvas.dispatchEvent(ev('pointerdown', 0));
      for (const dx of [20, 45, 70]) canvas.dispatchEvent(ev('pointermove', dx));
      canvas.dispatchEvent(ev('pointerup', 70));
      const x = meshNode().transform.p[0];
      expect(x).toBeGreaterThan(0.4);
      expect(Math.abs(x / 0.5 - Math.round(x / 0.5))).toBeLessThan(1e-9);
      cmd('3d.edit.undo');
      expect(meshNode().transform.p[0]).toBe(0);
    }, { timeout: 60000 }));

    it('right-click on an object opens its menu and selects it', skipIfNoGL(async () => {
      const w = await openApp();
      cmd('3d.add.cube');
      await waitFor(() => rowNamed('Cube'));
      const canvas = doc().getElementById('view');
      const r = canvas.getBoundingClientRect();
      const { THREE, stage: st3, cam } = w.Slop3D.app;
      cam.apply();
      const p = new THREE.Vector3(0, 0, 0).project(st3.camera);
      const x = r.left + ((p.x + 1) / 2) * r.width, y = r.top + ((1 - p.y) / 2) * r.height;
      canvas.dispatchEvent(new w.MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 }));
      await waitFor(() => doc().querySelector('.sui-menu'), { timeout: 5000 });
      const labels = [...doc().querySelectorAll('.sui-menu .sui-lbl')].map((n) => n.textContent);
      expect(labels).toContain('Duplicate');
      expect(labels).toContain('Group selection');
      expect(primary()).toBeTruthy();
    }, { timeout: 60000 }));
  });
})();
