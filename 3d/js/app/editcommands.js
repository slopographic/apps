/* Slop 3D mesh edit commands: mode keys (1 vertex, 2 edge, 3 face), selection (A all, I invert, Alt+A or Escape none),
 * transforms (G move, R rotate, S scale, E extrude), mesh tools (X delete, W subdivide, M merge, Shift+F flip, F fill,
 * H hide, Alt+H show) and the Mesh menu. Tab toggles edit mode. The `when` guards keep the object-mode keys (1-3 views,
 * F frame, G grid, H hide object, Delete) apart from these. Sets window.Slop3D.editcommands. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const E = S.edit, MM = S.editmodal, SEL = S.meshsel;
  const editing = () => E.active() && !MM.active();
  const C = (...a) => S.commands.C(...a);

  /** Selected edges (converted from faces or vertices when needed) grown into their loops. */
  function loopOfSelection() {
    const m = E.mesh();
    E.loopSelect([...SEL.convert(m, E.sel(), 'edge').ids]);
  }
  /** The Mesh menu (also used by the right-click menu in edit mode). */
  function menuItems() {
    const c = (id, label) => S.menus.cmd(id, label);
    return [
      c('3d.mesh.vertex', 'Vertex mode'), c('3d.mesh.edge', 'Edge mode'), c('3d.mesh.face', 'Face mode'), '-',
      c('3d.mesh.all', 'Select all'), c('3d.mesh.invert', 'Invert selection'), c('3d.mesh.none', 'Deselect all'), '-',
      c('3d.mesh.move', 'Move'), c('3d.mesh.rotate', 'Rotate'), c('3d.mesh.scale', 'Scale'), c('3d.mesh.extrude', 'Extrude faces'), '-',
      c('3d.mesh.delete', 'Delete'), c('3d.mesh.subdivide', 'Subdivide faces'), c('3d.mesh.merge', 'Merge at centre'),
      c('3d.mesh.mergeDist', 'Merge by distance'), c('3d.mesh.flip', 'Flip normals'), c('3d.mesh.fill', 'Fill'), c('3d.mesh.loop', 'Select loop'), '-',
      c('3d.mesh.hide', 'Hide selection'), c('3d.mesh.reveal', 'Show all hidden'), '-',
      c('3d.edit.toggle', 'Exit edit mode'),
    ];
  }
  function list() {
    const mode = (id, m, title, key) => C(id, title, 'Edit', [key], () => E.setMode(m), { when: editing });
    return [
      C('3d.edit.toggle', 'Edit mode on or off', 'Edit', ['Tab'], () => E.toggle()),
      mode('3d.mesh.vertex', 'vertex', 'Vertex mode', '1'),
      mode('3d.mesh.edge', 'edge', 'Edge mode', '2'),
      mode('3d.mesh.face', 'face', 'Face mode', '3'),
      C('3d.mesh.all', 'Select all elements', 'Edit', ['A'], () => E.selectAll(), { when: editing }),
      C('3d.mesh.invert', 'Invert selection', 'Edit', ['I'], () => E.invert(), { when: editing }),
      C('3d.mesh.none', 'Deselect all elements', 'Edit', ['Alt+A', 'Escape'], () => E.clear(), { when: editing }),
      C('3d.mesh.move', 'Move elements', 'Transform', ['G'], () => MM.start('move'), { when: editing }),
      C('3d.mesh.rotate', 'Rotate elements', 'Transform', ['R'], () => MM.start('rotate'), { when: editing }),
      C('3d.mesh.scale', 'Scale elements', 'Transform', ['S'], () => MM.start('scale'), { when: editing }),
      C('3d.mesh.extrude', 'Extrude faces', 'Mesh', ['E'], () => MM.start('extrude'), { when: editing }),
      C('3d.mesh.delete', 'Delete elements', 'Mesh', ['X', 'Delete'], () => E.remove(), { when: editing }),
      C('3d.mesh.subdivide', 'Subdivide faces', 'Mesh', ['W'], () => E.subdivide(), { when: editing }),
      C('3d.mesh.merge', 'Merge at centre', 'Mesh', ['M'], () => E.mergeCentre(), { when: editing }),
      C('3d.mesh.mergeDist', 'Merge by distance', 'Mesh', [], () => E.mergeByDistance(), { when: editing }),
      C('3d.mesh.flip', 'Flip normals', 'Mesh', ['Shift+F'], () => E.flip(), { when: editing }),
      C('3d.mesh.fill', 'Fill loop with a face', 'Mesh', ['F'], () => E.fill(), { when: editing }),
      C('3d.mesh.loop', 'Select edge loop', 'Mesh', [], loopOfSelection, { when: () => editing() && E.hasSel() }),
      C('3d.mesh.hide', 'Hide selection', 'Mesh', ['H'], () => E.hide(), { when: editing }),
      C('3d.mesh.reveal', 'Show all hidden', 'Mesh', ['Alt+H'], () => E.reveal(), { when: editing }),
      C('3d.menu.mesh', 'Mesh menu', 'Mesh', [], () => S.commands.openMenu(document.getElementById('btnMesh'), menuItems()), { hidden: true, when: editing }),
    ];
  }

  S.editcommands = { list, menuItems, editing };
})();
