/* Slop Drive — ui/dnd: drag items (pointer events, so it also works in the Nodes view) onto anything with
 * data-drop: folders in the pane, the sidebar tree, breadcrumbs, Slop Drive (root), Starred and Trash.
 * Hold Alt (or Ctrl) to copy instead of move. Plus drag-and-drop upload of files and folders from the computer. */
'use strict';
(function (DR) {
  const S = DR.S, el = DR.el, $ = DR.$;
  let justEnded = 0;
  DR.dragJustEnded = () => Date.now() - justEnded < 60;

  /** Run a drop of items onto a data-drop value. Exposed for tests. */
  DR.dropOn = async function (target, items, copy = false) {
    if (!items.length) return 0;
    if (target === 'trash') return DR.trash(items);
    if (target === 'star') return DR.setStar(items, true);
    const dest = target === 'root' || target == null ? null : target;
    if (dest && !S.folders.has(dest)) return 0;
    if (copy) return DR.copy(items, dest);
    return DR.move(items, dest);
  };
  function targetAt(x, y, keys) {
    const t = document.elementFromPoint(x, y), d = t && t.closest('[data-drop]');
    if (!d) return null;
    const v = d.dataset.drop;
    if (keys.includes('d:' + v)) return null;
    return { node: d, value: v };
  }
  DR.wireDrag = function () {
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.pointerType === 'touch') return;
      const src = e.target.closest('#pane [data-key], #tree [data-key]');
      if (!src || e.target.closest('input, .twisty, .no-drag')) return;
      const x0 = e.clientX, y0 = e.clientY;
      let ghost = null, over = null, keys = null;
      const move = (ev) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
          const k = src.dataset.key;
          if (!S.sel.has(k)) DR.select([k]);
          keys = [...S.sel];
          const items = DR.items(keys);
          if (!items.length || items.some((i) => i.trashedAt)) { cleanup(); return; }
          ghost = el('div', { class: 'ghost' }, DR.badge(items[0], 'badge xs'), el('span', null, items.length === 1 ? items[0].name : `${items.length} items`));
          document.body.append(ghost); document.body.classList.add('dragging');
        }
        ghost.style.transform = `translate(${ev.clientX + 12}px, ${ev.clientY + 10}px)`;
        const t = targetAt(ev.clientX, ev.clientY, keys);
        if (over && (!t || t.node !== over.node)) over.node.classList.remove('drop');
        if (t) {
          const items = DR.items(keys), ok = t.value === 'trash' || t.value === 'star' || DR.canMove(items, t.value === 'root' ? null : t.value);
          if (ok) t.node.classList.add('drop');
          over = ok ? t : null;
        } else over = null;
        ghost.classList.toggle('copy', ev.altKey || ev.ctrlKey || ev.metaKey);
      };
      const up = (ev) => {
        const t = over, copy = ev.altKey || ev.ctrlKey || ev.metaKey, wasDrag = !!ghost;
        cleanup();
        if (wasDrag) { justEnded = Date.now(); if (t) DR.dropOn(t.value, DR.items(keys), copy); }
      };
      function cleanup() {
        removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', cleanup);
        if (over) over.node.classList.remove('drop');
        if (ghost) ghost.remove();
        document.body.classList.remove('dragging');
      }
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', cleanup);
    });
  };

  /* ---------- upload by dropping files from the computer ---------- */
  // Files and folders go to the folder under the pointer (or the open folder). SlopDrop (shared/drop) takes the drop,
  // shows the progress strip above the pane, and uploads each file; a lone Slop backup opens in Backup & restore.
  DR.wireDropUpload = function () {
    let hover = null; // the data-drop target under the pointer at the last dragover (the drop reads it)
    const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files');
    addEventListener('dragover', (e) => {
      if (!hasFiles(e)) return;
      document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
      const d = document.elementFromPoint(e.clientX, e.clientY);
      const t = d && d.closest('[data-drop]');
      hover = t && t.dataset.drop !== 'trash' && t.dataset.drop !== 'star' ? t : null;
      if (hover) hover.classList.add('drop');
    });
    let batchDest = null;
    const dest = () => (hover ? (hover.dataset.drop === 'root' ? null : hover.dataset.drop) : DR.dest());
    window.SlopDrop.attach(document.getElementById('drvDrop'), {
      accept: { any: true, allowEmpty: true, noun: 'a file' },
      compact: true,
      targets: [document.body],
      files: async (dt) => {
        document.querySelectorAll('.drop').forEach((n) => n.classList.remove('drop'));
        batchDest = dest();
        const list = await DR.readDrop(dt);
        if (list.length === 1 && /\.slop$/i.test(list[0].file.name)) {
          if (await window.SlopUI.confirm('Restore this backup?', `“${list[0].file.name}” looks like a Slopographic backup. Open it in Backup & restore instead of uploading it?`, 'Open backup', { cancel: 'Just upload' })) {
            if (window.SlopBackupUI) window.SlopBackupUI.open.choose = null;
            DR.backupDialog();
            for (let i = 0; i < 100 && !(window.SlopBackupUI && window.SlopBackupUI.open.choose); i++) await new Promise((r) => setTimeout(r, 50));
            if (window.SlopBackupUI && window.SlopBackupUI.open.choose) window.SlopBackupUI.open.choose(list[0].file);
            return [];
          }
        }
        return list.map((r) => Object.assign(r.file, { slopPath: r.path, slopDest: batchDest }));
      },
      process: async (file) => {
        await DR.importFiles([{ file, path: file.slopPath }], file.slopDest);
        return file.name;
      },
    });
  };
})(window.DR);
