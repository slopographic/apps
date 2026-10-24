/* SlopIsolate — context menus. The queue thumbnail (open, select, retry, export, Open in, remove; the selection's menu
 * on a selected picture) and the canvas (undo, tools,
 * view, zoom, clear edits, or open/sample when empty). Every item calls the shared action it names: CO.menus.act,
 * CO.queue.open, CO.process and CO.export, so a menu item, a key and a palette row run the same code. */
(function () {
  'use strict';
  const CO = window.CO, S = CO.state, H = CO.history, U = CO.util;
  const cur = () => S.current();
  const act = () => CO.menus.act;
  const keyOf = (id, fallback) => (window.SlopCtx ? SlopCtx.keyFor(id, fallback) : fallback || '');

  /** Queue thumbnail: the image under the pointer. A picture that is part of a selection of two or more: the selection's
   *  menu (the settings panel's menu, ui/bulk-act.js). */
  function queueItems(it) {
    if (S.bulk() && S.sel.has(it.id)) return CO.bulk.menuItems();
    const out = [{ label: 'Open', act: () => CO.queue.open(it) }, { label: S.sel.has(it.id) ? 'Unselect' : 'Select', act: () => CO.bulk.toggle(it.id, { seed: true }) }];
    if (it.status === 'done') {
      out.push({ label: 'Export…', key: keyOf('co.export-one', 'Ctrl+S'), act: () => act().exportOne(it) });
      const sub = CO.openIn.items(it);
      if (sub.length) out.push({ label: 'Open in', sub });
    }
    if (it.status === 'error') out.push({ label: 'Retry', act: () => CO.process.rerun(it) });
    out.push('-', { label: 'Remove from queue', act: () => CO.process.remove(it) });
    return out;
  }

  /** Canvas: what the person can do to the image in view (or to start one when the stage is empty). */
  function canvasItems() {
    const it = cur(), a = act(), out = [];
    if (!it) {
      return [
        { label: 'Open images…', key: keyOf('co.file-open', 'Ctrl+O'), act: a.open },
        { label: 'Try a sample image', key: keyOf('co.file-sample'), act: a.sample },
      ];
    }
    if (H.can(it, 'undo')) out.push({ label: 'Undo' + (H.label(it, 'undo') ? ' ' + H.label(it, 'undo') : ''), key: keyOf('co.undo', 'Ctrl+Z'), act: a.undo });
    if (H.can(it, 'redo')) out.push({ label: 'Redo' + (H.label(it, 'redo') ? ' ' + H.label(it, 'redo') : ''), key: keyOf('co.redo', 'Ctrl+Shift+Z'), act: a.redo });
    if (CO.brush.hasEdits(it)) out.push({ label: 'Clear brush edits', key: keyOf('co.clear-edits'), act: a.clearEdits });
    if (out.length) out.push('-');
    out.push(
      { label: 'Keep brush', key: keyOf('co.tool-keep', 'K'), check: S.tool === 'keep', act: () => a.tool('keep') },
      { label: 'Remove brush', key: keyOf('co.tool-remove', 'R'), check: S.tool === 'remove', act: () => a.tool('remove') },
      { label: 'Pan', key: keyOf('co.tool-pan', 'H'), check: S.tool === 'pan', act: () => a.tool('pan') },
    );
    out.push('-', { label: 'Zoom in', key: keyOf('co.zoom-in', '+'), act: () => a.zoom(1.25) }, { label: 'Zoom out', key: keyOf('co.zoom-out', '-'), act: () => a.zoom(0.8) }, { label: 'Fit to window', key: keyOf('co.view-fit', '0'), act: a.fit });
    if (it.status === 'done') {
      out.push('-', { label: 'View', sub: [['result', 'Result'], ['before', 'Before/after'], ['mask', 'Mask']].map(([v, l]) => ({ label: l, check: S.view === v, act: () => a.view(v) })) });
      out.push({ label: 'Export…', key: keyOf('co.export-one', 'Ctrl+S'), act: () => a.exportOne(it) });
    }
    return out;
  }

  function resolve(target) {
    const tile = target && target.closest && target.closest('.q-item');
    if (tile) {
      const it = S.items.find((i) => String(i.id) === tile.dataset.id);
      return it ? queueItems(it) : null;
    }
    if (target && target.closest && target.closest('#stage')) return canvasItems();
    return null;
  }

  function init() {
    if (!window.SlopCtx) return;
    const queue = U.$('#queue'), stage = U.$('#stage');
    if (queue) SlopCtx.bind(queue, resolve);
    if (stage) SlopCtx.bind(stage, resolve);
  }

  CO.ctxmenu = { init, queueItems, canvasItems };
})();
