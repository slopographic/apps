/* Slop 3D context menus (right-click on an object or on empty viewport). Each item runs a registered SlopCmd
 * command, so the menu, the shortcut hints and the palette share one code path. Sets window.Slop3D.menus. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const M = S.model, st = S.state, s = st.s;
  const ADD = [['cube', 'Cube'], ['sphere', 'Sphere'], ['cylinder', 'Cylinder'], ['cone', 'Cone'], ['torus', 'Torus'], ['plane', 'Plane'], ['blob', 'Blob'], '-',
    ['group', 'Group'], '-', ['directional', 'Sun (directional light)'], ['ambient', 'Ambient light']];

  /** A SlopUI menu item for a command id (label and shortcut come from SlopCmd / SlopCtx). */
  function cmd(id, label, extra = {}) {
    const key = window.SlopCtx ? SlopCtx.keyFor(id) : '';
    return Object.assign({ label, key, act: () => { if (window.SlopCmd) SlopCmd.run(id); } }, extra);
  }
  function addItems() {
    return ADD.map((x) => (x === '-' ? '-' : cmd(`3d.add.${x[0]}`, x[1])));
  }
  function viewItems() {
    return [cmd('3d.view.perspective', 'Perspective'), cmd('3d.view.front', 'Front'), cmd('3d.view.top', 'Top'), cmd('3d.view.side', 'Side')];
  }
  function objectItems() {
    if (S.edit && S.edit.active()) return S.editcommands.menuItems();
    const p = st.primary(), n = p && s.doc.nodes[p];
    return [
      cmd('3d.edit.duplicate', 'Duplicate'),
      cmd('3d.edit.delete', 'Delete'),
      '-',
      cmd('3d.edit.group', 'Group selection', { disabled: !s.sel.length }),
      cmd('3d.edit.ungroup', 'Ungroup', { disabled: !(n && n.type === 'group') }),
      '-',
      cmd('3d.view.frame', 'Frame selection'),
      cmd('3d.object.hide', n && n.visible ? 'Hide' : 'Show'),
      cmd('3d.object.rename', 'Rename…'),
      '-',
      { label: 'Add', sub: addItems() },
    ];
  }
  function viewportItems() {
    if (S.edit && S.edit.active()) return S.editcommands.menuItems();
    return [
      { label: 'Add', sub: addItems() },
      '-',
      cmd('3d.edit.selectall', 'Select all'),
      cmd('3d.view.frameAll', 'Frame all'),
      { label: 'View', sub: viewItems() },
      { label: 'Layout', sub: window.SlopLayouts ? SlopLayouts.menu('3d') : [] },
      '-',
      cmd('3d.view.wire', 'Wireframe', { check: s.view.wire }),
      cmd('3d.view.grid', 'Grid', { check: s.view.grid }),
      cmd('3d.view.axes', 'Axes', { check: s.view.axes }),
      '-',
      cmd('3d.edit.undo', 'Undo', { disabled: !s.history.canUndo() }),
      cmd('3d.edit.redo', 'Redo', { disabled: !s.history.canRedo() }),
    ];
  }

  S.menus = { objectItems, viewportItems, addItems, cmd };
})();
