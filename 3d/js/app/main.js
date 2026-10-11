/* Slop 3D boot: loads three.js from vendor/, builds the stage, camera, gizmo, objects, viewport, panels and
 * commands, wires the toolbar, and opens ?drive=<id> when this page was launched from Slop Drive.
 * Without WebGL the page says so and stays usable for file work. Exposes window.Slop3D.app (used by the tests). */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const st = S.state, s = st.s;
  const $ = (id) => document.getElementById(id);
  const fmtCount = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  function showNoGL(msg) {
    const box = $('nogl');
    box.textContent = msg;
    box.hidden = false;
    $('hint').hidden = true;
  }
  function wireToolbar() {
    document.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('[data-cmd]');
      if (b && !b.disabled && window.SlopCmd) { e.preventDefault(); SlopCmd.run(b.dataset.cmd); }
    });
    const snap = $('snap');
    for (const step of S.snap.STEPS) snap.append(new Option(step ? String(step) : 'Off', String(step)));
    snap.addEventListener('change', () => S.actions.setSnap(snap.value));
  }
  function statusLine(cam) {
    const meshes = Object.values(s.doc.nodes).filter((n) => n.type === 'mesh').length;
    const picked = st.primary() && s.doc.nodes[st.primary()];
    const name = picked ? `${picked.name} (${S.model.typeLabel(picked)})` : 'Nothing selected';
    const view = cam && cam.st.view ? cam.st.view[0].toUpperCase() + cam.st.view.slice(1) : 'Free';
    const snapTxt = s.snapStep > 0 ? ` · snap ${s.snapStep}` : '';
    const editTxt = S.edit.active()
      ? ` · Edit: ${S.edit.mode()} mode · ${S.edit.sel().ids.size} ${({ vertex: 'vertex|vertices', edge: 'edge|edges', face: 'face|faces' })[S.edit.mode()].split('|')[S.edit.sel().ids.size === 1 ? 0 : 1]} selected${S.edit.info() ? ' · ' + S.edit.info() : ''}`
      : '';
    $('status').textContent = `${fmtCount(meshes, 'object')}${s.sel.length > 1 ? ` · ${s.sel.length} selected` : ''} · ${name} · ${view} view${snapTxt}${editTxt}`;
  }
  /** Toolbar state for mesh edit mode: the Edit button's pressed state and the mode and Mesh buttons. */
  function editToolbar() {
    const on = S.edit.active();
    $('btnEdit').setAttribute('aria-pressed', String(on));
    $('editModes').hidden = !on;
    $('btnMesh').hidden = !on;
    for (const b of document.querySelectorAll('#editModes [data-cmd]')) b.setAttribute('aria-pressed', String(b.dataset.cmd === '3d.mesh.' + S.edit.mode()));
  }
  function setTitle() {
    const name = s.file.name || 'Untitled';
    $('docName').textContent = name + (s.file.dirty ? ' •' : '');
    document.title = (s.file.dirty ? '• ' : '') + name + ' — Slop 3D';
  }

  async function boot() {
    const canvas = $('view');
    wireToolbar();
    const rename = (id) => {
      const n = s.doc.nodes[id];
      if (!n || !window.SlopUI) return;
      SlopUI.prompt('Rename', 'Name', n.name).then((v) => { if (v && v.trim()) S.actions.setField(id, 'name', v.trim()); });
    };
    S.outliner.create($('outliner'), { rename });
    S.inspector.create($('inspector'));
    st.on('file', setTitle);
    st.on('doc', setTitle);
    st.on('sel', setTitle);
    if (!S.stage.hasWebGL()) showNoGL('This browser has no WebGL, so the 3D view cannot draw. Files still open, save and export.');
    let THREE = null, stage = null;
    try {
      if (S.stage.hasWebGL()) { THREE = await S.stage.loadThree(); stage = S.stage.create(canvas, THREE); }
    } catch (e) { showNoGL('The 3D view could not start: ' + (e.message || e)); stage = null; }
    if (!stage) {
      st.on('doc', () => statusLine(null));
      st.on('sel', () => statusLine(null));
      statusLine(null);
      await S.files.launch();
      document.body.dataset.ready = '1';
      return;
    }
    const cam = S.camera.create(THREE, stage);
    const gizmo = S.gizmo.create(THREE, stage.overlay);
    const objects = S.objects.create(THREE, stage.world, () => stage.request());
    const editview = S.editview.create(THREE);
    const view = S.viewport.create({ canvas, stage, cam, gizmo, objects, menus: S.menus });
    S.files.bindStage(stage);
    const applyView = () => {
      for (const it of objects.items.values()) if (it.mesh) it.mesh.material.wireframe = s.view.wire;
      stage.setGrid(s.view.grid);
      stage.setAxes(s.view.axes);
      stage.setBackground(s.doc.background || '#1d1e22');
      $('btnWire').setAttribute('aria-pressed', String(s.view.wire));
      $('btnGrid').setAttribute('aria-pressed', String(s.view.grid));
      stage.request();
    };
    const ui = { applyView, rename, frame: (ids) => view.frame(ids), setView: (name) => { cam.setView(name); view.redraw(); } };
    const cmds = S.commands.list(ui);
    if (window.SlopCmd) { SlopCmd.init({ app: '3d' }); SlopCmd.register(cmds); }
    const sync = () => {
      objects.sync(s.doc, { selected: s.sel });
      applyView();
      statusLine(cam);
    };
    st.on('doc', sync);
    st.on('sel', sync);
    st.on('snap', () => statusLine(cam));
    const syncEdit = () => {
      if (!S.edit.active()) editview.clear();
      else { const it = objects.items.get(S.edit.node().id); editview.sync(it && it.obj, S.edit.mesh(), S.edit.sel()); }
      editToolbar();
      statusLine(cam);
      stage.request();
    };
    st.on('doc', syncEdit);
    st.on('sel', syncEdit);
    st.on('edit', syncEdit);
    new ResizeObserver(() => { stage.resize(); stage.request(); }).observe(canvas);
    S.app = { THREE, stage, cam, gizmo, objects, view, ui, commands: cmds, editview };
    S.configio.registerStub();
    cam.apply();
    sync();
    view.redraw();
    await S.files.launch();
    view.frame([]);
    document.body.dataset.ready = '1';
  }

  boot().catch((e) => { console.error(e); showNoGL('Slop 3D could not start: ' + (e.message || e)); });
})();
