/* Slop 3D commands: every menu item, toolbar button and shortcut is a SlopCmd command with the id 3d.<group>.<name>.
 * Shortcuts: F frame, 1-4 views, W wireframe, G grid, H hide, Delete, Mod+D duplicate, Mod+G group, arrows nudge
 * (Shift+Up/Down for Y). Nudging is off while the outliner has focus, so its arrow keys move the tree.
 * Sets window.Slop3D.commands: register(ui) → the command list. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const A = S.actions, st = S.state, s = st.s, F = S.files;
  const ADD = [['cube', 'Add cube'], ['sphere', 'Add sphere'], ['cylinder', 'Add cylinder'], ['cone', 'Add cone'], ['torus', 'Add torus'],
    ['plane', 'Add plane'], ['blob', 'Add blob'], ['group', 'Add group'], ['directional', 'Add sun (directional light)'], ['ambient', 'Add ambient light']];
  const VIEWS = [['front', '1', 'Front view'], ['top', '2', 'Top view'], ['side', '3', 'Side view'], ['perspective', '4', 'Perspective view']];
  const nudgeOk = () => { const a = document.activeElement; return !(a && a.closest && a.closest('.outl-list')); };
  const C = (id, title, group, keys, run, extra = {}) => Object.assign({ id, title, group, keys, run, noRecent: false }, extra);

  function openMenu(anchor, items) {
    if (!window.SlopUI || !anchor) return;
    const r = anchor.getBoundingClientRect();
    SlopUI.menu(items, r.left, r.bottom + 4);
  }
  function selectAll() { st.select(Object.keys(s.doc.nodes)); }

  /** ui: { applyView(), rename(id), frame(ids), setView(name), stage } */
  function list(ui) {
    const out = [
      C('3d.file.new', 'New scene', 'File', ['Mod+Shift+N'], () => F.newScene()),
      C('3d.file.open', 'Open…', 'File', ['Mod+O'], () => F.openDialog()),
      C('3d.file.import', 'Import OBJ, GLB, glTF or image…', 'File', ['Mod+I'], () => F.importDialog()),
      C('3d.file.drive', 'Open from Slop Drive…', 'File', [], () => F.openFromDrive()),
      C('3d.file.save', 'Save to Slop Drive', 'File', ['Mod+S'], () => F.save()),
      C('3d.file.download', 'Download .s3d', 'File', ['Mod+Shift+S'], () => F.downloadScene()),
      C('3d.file.exportObj', 'Export OBJ…', 'File', [], () => F.exportObj()),
      C('3d.file.png1', 'Render PNG (1×)', 'File', [], () => F.exportPng(1)),
      C('3d.file.png2', 'Render PNG (2×)', 'File', [], () => F.exportPng(2)),
      C('3d.edit.undo', 'Undo', 'Edit', ['Mod+Z'], () => A.undo()),
      C('3d.edit.redo', 'Redo', 'Edit', ['Mod+Shift+Z', 'Mod+Y'], () => A.redo()),
      C('3d.edit.duplicate', 'Duplicate', 'Edit', ['Mod+D'], () => A.duplicate()),
      C('3d.edit.delete', 'Delete', 'Edit', ['Delete', 'Backspace'], () => A.remove(), { when: nudgeOk }),
      C('3d.edit.group', 'Group selection', 'Edit', ['Mod+G'], () => A.group()),
      C('3d.edit.ungroup', 'Ungroup', 'Edit', ['Mod+Shift+G'], () => A.ungroup()),
      C('3d.edit.selectall', 'Select all', 'Edit', ['Mod+A'], () => selectAll()),
      C('3d.edit.deselect', 'Deselect', 'Edit', ['Escape'], () => st.select([]), { when: () => s.sel.length > 0 }),
      C('3d.object.rename', 'Rename…', 'Object', ['F2'], () => ui.rename(st.primary()), { when: () => !!st.primary() }),
      C('3d.object.hide', 'Hide or show', 'Object', ['H'], () => A.setVisible(s.sel, !(s.doc.nodes[st.primary()] || { visible: true }).visible), { when: () => s.sel.length > 0 }),
      C('3d.view.frame', 'Frame selection', 'View', ['F'], () => ui.frame(s.sel)),
      C('3d.view.frameAll', 'Frame all', 'View', ['Home'], () => ui.frame([])),
      C('3d.view.wire', 'Wireframe', 'View', ['W'], () => { s.view.wire = !s.view.wire; ui.applyView(); }),
      C('3d.view.grid', 'Grid', 'View', ['G'], () => { s.view.grid = !s.view.grid; ui.applyView(); }),
      C('3d.view.axes', 'Axes', 'View', [], () => { s.view.axes = !s.view.axes; ui.applyView(); }),
      C('3d.menu.add', 'Add menu', 'Object', [], (ctx) => openMenu(document.getElementById('btnAdd'), S.menus.addItems()), { hidden: true }),
      C('3d.menu.export', 'Export menu', 'File', [], () => openMenu(document.getElementById('btnExport'), [
        S.menus.cmd('3d.file.download', 'Download .s3d'), S.menus.cmd('3d.file.exportObj', 'Export OBJ…'), '-',
        S.menus.cmd('3d.file.png1', 'Render PNG (1×)'), S.menus.cmd('3d.file.png2', 'Render PNG (2×)')]), { hidden: true }),
    ];
    for (const [k, title] of ADD) out.push(C(`3d.add.${k}`, title, 'Add', [], () => A.add(k)));
    for (const [name, key, title] of VIEWS) out.push(C(`3d.view.${name}`, title, 'View', [key], () => ui.setView(name)));
    const nudge = (id, title, axis, sign, keys) => C(id, title, 'Nudge', keys, () => A.nudge(axis, sign), { when: nudgeOk, repeat: true });
    out.push(nudge('3d.nudge.left', 'Nudge left (−X)', 0, -1, ['ArrowLeft']), nudge('3d.nudge.right', 'Nudge right (+X)', 0, 1, ['ArrowRight']),
      nudge('3d.nudge.back', 'Nudge towards back (−Z)', 2, -1, ['ArrowUp']), nudge('3d.nudge.front', 'Nudge towards front (+Z)', 2, 1, ['ArrowDown']),
      nudge('3d.nudge.up', 'Nudge up (+Y)', 1, 1, ['Shift+ArrowUp']), nudge('3d.nudge.down', 'Nudge down (−Y)', 1, -1, ['Shift+ArrowDown']));
    return out;
  }

  S.commands = { list, openMenu, C };
})();
