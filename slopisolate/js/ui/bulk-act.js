/* SlopIsolate — what can be done to the selected pictures, besides the settings (the panel edits those, ui/edit.js):
 * clear brush edits (one undo step for all), export as one ZIP, save to Slop Drive, Open in…, Run a workflow… (the
 * selected pictures go in), Add to a workflow… (with the settings they share), remove. Plus Copy settings, Paste
 * settings and Apply these settings to all. One list of actions feeds the settings panel's menu (panel-head.js), the
 * queue's right-click menu and the SlopCmd commands (so the palette and macros can run them).
 * CO.bulk.act(name, arg) · menuItems() · commands() */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, H = CO.history, B = CO.bulk, E = CO.edit;
  const toast = (m) => CO.emit('toast', m);
  const pics = () => B.items().filter((it) => it.kind !== 'video');
  const ready = () => pics().filter((it) => it.status === 'done');
  const word = (n) => `${n} picture${n === 1 ? '' : 's'}`;
  const hub = () => (document.documentElement.dataset.offline ? null : window.SlopHub || null);

  /** A brush-edit reset as an undo entry (the same one Edit ▸ Clear brush edits pushes). */
  function clearEntry(it, group) {
    if (!CO.brush.hasEdits(it)) return false;
    const old = it.edit.slice();
    it.edit.fill(128);
    const e = { kind: 'stroke', label: 'Clear brush edits', tiles: [{ x0: 0, y0: 0, w: it.w, h: it.h, bytes: old }], rect: { x: 0, y: 0, x1: it.w, y1: it.h } };
    if (group) e.group = group;
    H.push(it, e);
    return true;
  }
  B.clearEntry = clearEntry;

  const ACTIONS = {
    copy() { if (E.copy()) toast('Settings copied. Select pictures and choose Paste settings.'); },
    paste() {
      const items = S.targets();
      if (!E.clip()) return toast('Copy the settings of a picture first');
      E.paste(items);
      toast(`Settings pasted on ${word(items.length)}`);
    },
    applyAll() {
      if (!S.current()) return toast('Open a picture first');
      E.applyToAll();
      toast(`These settings now apply to all ${word(S.items.filter((it) => it.kind !== 'video').length)}`);
    },
    selectAll: () => B.selectAll(),
    selectNone: () => B.clear(),
    clear() {
      const g = H.group();
      const n = pics().filter((it) => clearEntry(it, g)).length;
      toast(n ? `Cleared the brush edits on ${word(n)}` : 'No brush edits to clear');
    },
    export() {
      const items = ready();
      if (!items.length) return toast('None of the selected pictures is ready yet');
      return CO.export.all(items);
    },
    drive() {
      if (!CO.drive || !CO.drive.ready()) return toast('Slop Drive is not available here');
      return B.run('Saving to Slop Drive', ready(), async (it) => {
        const { blob, ext } = await CO.export.encode(it);
        await CO.drive.saveResult(it, blob, U.baseName(it.name) + '-cutout.' + ext);
      });
    },
    /** Run a workflow… on the finished pictures of the selection (as exported: background, shadow, crop). */
    async workflow() {
      if (!window.SlopWorkflowEntry) return toast('Workflows are not available here');
      return window.SlopWorkflowEntry.open({ files: await B.files(), ask: false });
    },
    addToWorkflow: () => CO.menus.act.workflow(),
    remove() {
      const items = B.items();
      if (!items.length || !window.confirm || !window.confirm(`Remove ${word(items.length)} from the queue?`)) return;
      B.clear();
      return B.run('Removing', items, (it) => CO.process.remove(it));
    },
  };
  B.act = (name, arg) => {
    const fn = ACTIONS[name];
    return fn ? Promise.resolve().then(() => fn(arg)).catch((e) => toast(e.message || String(e))) : undefined;
  };

  /** The settings panel's menu (and the queue's right-click menu on a selected picture). */
  B.menuItems = function () {
    const cur = S.current(), clip = E.clip(), many = S.bulk(), n = S.targets().length;
    const all = S.items.filter((it) => it.kind !== 'video').length;
    const out = [
      { label: 'Copy settings', act: () => B.act('copy'), disabled: !cur || cur.kind === 'video' },
      { label: many ? `Paste settings on ${word(n)}` : 'Paste settings', act: () => B.act('paste'), disabled: !clip || !n },
      { label: `Apply these settings to all ${word(all)}`, act: () => B.act('applyAll'), disabled: !cur || all < 2 },
    ];
    if (!many) return out.concat('-', { label: 'Select all pictures', key: 'Ctrl+A', act: () => B.act('selectAll'), disabled: S.items.length < 2 });
    const r = ready().length, openIn = CO.openIn.bulkItems();
    out.push('-',
      { label: `Export ${word(r)} (ZIP)`, act: () => B.act('export'), disabled: !r },
      { label: 'Open in', sub: openIn, disabled: !openIn.length });
    if (hub()) out.push({ label: `Save ${word(r)} to Slop Drive`, act: () => B.act('drive'), disabled: !r });
    if (window.SlopWorkflowEntry) out.push({ label: 'Run a workflow…', act: () => B.act('workflow') });
    if (window.SlopFlowDoc) out.push({ label: 'Add to a workflow…', act: () => B.act('addToWorkflow') });
    out.push('-',
      { label: 'Clear brush edits', act: () => B.act('clear'), disabled: !pics().some((it) => CO.brush.hasEdits(it)) },
      { label: `Remove ${word(B.items().length)} from the queue`, act: () => B.act('remove') },
      { label: 'Select none', key: 'Esc', act: () => B.act('selectNone') });
    return out;
  };

  /** SlopCmd rows (ui/commands.js registers them with the rest). */
  B.commands = function () {
    const sel = () => S.bulk();
    const row = (id, title, name, when, keywords) => ({ id, title, group: 'Edit', keys: [], run: () => B.act(name), when, keywords });
    return [
      row('co.copy-settings', 'Copy settings', 'copy', () => !!S.current(), ['copy', 'look', 'settings']),
      row('co.paste-settings', 'Paste settings', 'paste', () => !!E.clip() && S.targets().length > 0, ['paste', 'look', 'settings', 'bulk']),
      row('co.apply-all', 'Apply these settings to all pictures', 'applyAll', () => !!S.current() && S.items.length > 1, ['bulk', 'batch', 'all', 'look']),
      row('co.select-all', 'Select all pictures', 'selectAll', () => S.items.length > 0, ['bulk', 'batch', 'selection']),
      row('co.select-none', 'Select none', 'selectNone', () => S.sel.size > 0, ['deselect', 'selection']),
      row('co.bulk-clear-edits', 'Clear brush edits on the selected pictures', 'clear', sel, ['bulk', 'reset', 'brush']),
      row('co.bulk-export', 'Export the selected pictures (ZIP)', 'export', sel, ['bulk', 'zip', 'download']),
      row('co.bulk-drive', 'Save the selected pictures to Slop Drive', 'drive', () => sel() && !!hub(), ['bulk', 'drive', 'save']),
      row('co.bulk-workflow', 'Run a workflow on the selected pictures…', 'workflow', () => sel() && !!window.SlopWorkflowEntry, ['bulk', 'workflow', 'batch']),
      row('co.bulk-remove', 'Remove the selected pictures', 'remove', sel, ['bulk', 'delete']),
    ];
  };

  /** The finished pictures of the selection (or the one on screen) as PNG files, as exported. */
  B.files = async function () {
    const items = (S.bulk() ? pics() : [S.current()]).filter((it) => it && it.kind !== 'video' && it.status === 'done');
    const out = [];
    for (const it of items) out.push(new File([(await CO.export.encode(it, 'png')).blob], U.baseName(it.name) + '-cutout.png', { type: 'image/png' }));
    return out;
  };
  // Run a workflow… (the shared command and dialog) asks the page for its files: the selected pictures, or the one on screen.
  window.addEventListener('slop:convert-files', (e) => e.detail.provide(() => B.files(), { app: 'SlopIsolate' }));
})();
