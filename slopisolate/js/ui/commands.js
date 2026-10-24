/* SlopIsolate — SlopCmd commands: every menu action, tool, view and zoom step as a command (ids co.*), so the
 * Spotlight palette finds them and the person can rebind any key. The actions are the shared ones in
 * CO.menus.act (ui/menus.js), so a key, a menu item and a palette row do the same thing. */
(function () {
  'use strict';
  const CO = window.CO, S = CO.state, H = CO.history;
  const hub = () => (document.documentElement.dataset.offline ? null : window.SlopHub || null);
  const cur = () => S.current();
  const hasDone = () => S.items.some((i) => i.status === 'done');
  const hasItem = () => !!cur();

  /** The command list. Each row: {id, title, group, keys, run, when?, checked?, keywords?}. */
  function list(a) {
    const C = [];
    const add = (id, title, group, keys, run, extra) => C.push(Object.assign({ id, title, group, keys, run }, extra || {}));

    add('co.file-open', 'Open images…', 'File', ['Mod+O'], () => a.open(), { keywords: ['add', 'import', 'file', 'photos'] });
    add('co.file-sample', 'Try a sample image', 'File', [], () => a.sample(), { keywords: ['demo', 'sloppo', 'example'] });
    if (hub()) add('co.file-drive', 'Open from Slop Drive…', 'File', [], () => a.driveOpen(), { keywords: ['drive', 'files'] });
    add('co.export-one', 'Export…', 'File', ['Mod+S'], () => a.exportOne(), { when: () => !!cur() && cur().status === 'done', keywords: ['download', 'save', 'png', 'webp', 'jpg'] });
    add('co.export-all', 'Export all as ZIP…', 'File', ['Shift+Mod+S'], () => a.exportAll(), { when: hasDone, keywords: ['batch', 'zip', 'download'] });

    if (window.SlopFlowDoc) add('co.add-to-workflow', 'Add to a workflow…', 'File', [], () => a.workflow(), { keywords: ['workflow', 'batch', 'pipeline', 'chain', 'automate'] });

    add('co.undo', 'Undo', 'Edit', ['Mod+Z'], () => a.undo(), { when: () => H.can(cur(), 'undo') });
    add('co.redo', 'Redo', 'Edit', ['Shift+Mod+Z', 'Mod+Y'], () => a.redo(), { when: () => H.can(cur(), 'redo') });
    add('co.clear-edits', 'Clear brush edits', 'Edit', [], () => a.clearEdits(), { when: () => hasItem() && CO.brush.hasEdits(cur()), keywords: ['reset', 'keep', 'remove'] });

    add('co.tool-pan', 'Tool: Pan', 'Tools', ['H'], () => a.tool('pan'), { checked: () => S.tool === 'pan' });
    add('co.tool-keep', 'Tool: Keep brush', 'Tools', ['K'], () => a.tool('keep'), { checked: () => S.tool === 'keep', keywords: ['restore', 'brush', 'paint'] });
    add('co.tool-remove', 'Tool: Remove brush', 'Tools', ['R'], () => a.tool('remove'), { checked: () => S.tool === 'remove', keywords: ['erase', 'brush', 'paint'] });

    add('co.view-result', 'View: Result', 'View', [], () => a.view('result'), { when: hasItem, checked: () => S.view === 'result' });
    add('co.view-before', 'View: Before / after', 'View', [], () => a.view('before'), { when: hasItem, checked: () => S.view === 'before' });
    add('co.view-mask', 'View: Mask', 'View', [], () => a.view('mask'), { when: hasItem, checked: () => S.view === 'mask' });
    add('co.view-fit', 'Fit to window', 'View', ['0'], () => a.fit(), { when: hasItem });
    add('co.zoom-in', 'Zoom in', 'View', ['+', '='], () => a.zoom(1.25), { when: hasItem });
    add('co.zoom-out', 'Zoom out', 'View', ['-'], () => a.zoom(0.8), { when: hasItem });
    add('co.panel', 'Show or hide settings panel', 'View', [], () => a.panel());

    for (const [v, l, s] of [['pro', 'Pro (dark)', 'dark'], ['light', 'Light', 'light'], ['classic', 'Classic', 'classic']]) {
      add('co.theme-' + v, 'Theme: ' + l, 'View', [], () => a.theme(v), { checked: () => !!window.SlopTheme && SlopTheme.get() === s });
    }
    return C;
  }

  function init() {
    const SC = window.SlopCmd, a = CO.menus && CO.menus.act;
    if (!SC || !a) return;
    try {
      SC.init({ app: 'cutout' });
      SC.register(list(a).concat(CO.bulk && CO.bulk.commands ? CO.bulk.commands() : [], window.CO.configCommands ? window.CO.configCommands() : []));
    } catch (err) { console.warn('SlopIsolate: commands are off', err); }
  }

  CO.commands = { init };
})();
