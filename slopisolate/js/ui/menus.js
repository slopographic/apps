/* SlopIsolate — menus: the File / Edit / View / Help bar, the More menu (theme, Send to, about), the top-bar
 * buttons (undo, redo, download, panel, more) and the empty-state buttons. The shared actions live in
 * CO.menus.act, so the menus and the SlopCmd commands (ui/commands.js) run the same code. */
(function () {
  'use strict';
  const CO = window.CO, U = CO.util, S = CO.state, H = CO.history, $ = U.$, h = U.h;
  const hub = () => (document.documentElement.dataset.offline ? null : window.SlopHub || null);
  const toast = (m) => window.SlopUI && SlopUI.toast(m);
  const cur = () => S.current();
  const done = () => { const it = cur(); return !!it && it.status === 'done'; };
  /* The app's names and the shared theme ids (shared/theme/theme.js): the choice is saved through SlopTheme.set. */
  const THEMES = [['pro', 'Pro (dark)', 'dark'], ['light', 'Light', 'light'], ['classic', 'Classic', 'classic']];

  /* ---------- shared actions ---------- */
  async function guard(fn) { try { await fn(); } catch (e) { toast(e.message || String(e)); } }
  function needItem() { const it = cur(); if (!it) throw new Error('Open an image first'); return it; }
  const act = {
    open: () => CO.files.open(),
    sample: () => CO.files.sample(),
    driveOpen: () => guard(() => SlopIntake.fromDrive({ to: 'cutout', accept: ['image/*'], title: 'Open from Slop Drive' })),
    exportOne: (it) => guard(() => CO.export.one(it || needItem())),
    exportAll: () => guard(() => CO.export.all()),
    // Slop Workflows: Remove background as a step, with the model and the look of the image on screen, or of the selected
    // pictures where they agree (a setting they differ on comes from the image on screen) (shared/ops/flowdoc.js)
    workflow: () => guard(() => {
      const src = cur() || S.defaults, items = S.bulk() ? S.targets() : [src];
      const it = CO.settings.agreed(items, src, S.modelOf);
      return window.SlopFlowDoc.addToWorkflow({ id: 'slopisolate.remove-bg' }, { settings: { model: it.model || S.model, look: { bg: it.bg, shadow: it.shadow, crop: it.crop } } });
    }),
    undo: () => { const it = cur(); if (H.can(it, 'undo')) H.undo(it); },
    redo: () => { const it = cur(); if (H.can(it, 'redo')) H.redo(it); },
    clearEdits: () => {
      if (S.bulk()) return CO.bulk.act('clear');   // with a selection: every selected picture, one undo step
      const it = cur();
      if (!it || !CO.brush.hasEdits(it)) return toast('No brush edits to clear');
      const old = it.edit.slice();
      it.edit.fill(128);
      // The entry holds the bytes it swaps with, so undo restores `old` and redo clears again.
      H.push(it, { kind: 'stroke', label: 'Clear brush edits', tiles: [{ x0: 0, y0: 0, w: it.w, h: it.h, bytes: old }], rect: { x: 0, y: 0, x1: it.w, y1: it.h } });
    },
    tool: (t) => S.setTool(t),
    view: (v) => S.setView(v),
    fit: () => CO.view.fit(),
    zoom: (f) => { const r = $('#stage').getBoundingClientRect(); CO.view.zoomAt(f, r.width / 2, r.height / 2); },
    panel: () => {
      if (CO.sheet && CO.sheet.isPhone()) return CO.sheet.toggle();   // a phone: the settings bottom sheet
      const off = $('#app').classList.toggle('no-panel');
      U.store.set('panel', !off);
      $('#btnPanel').setAttribute('aria-expanded', String(!off));
    },
    theme: (v) => {
      const row = THEMES.find(([x]) => x === v) || THEMES[0];
      const r = window.SlopTheme ? SlopTheme.set(row[2]) : { ok: false, error: 'The theme script did not load.' };
      if (!r.ok) { if (window.SlopTheme) SlopTheme.apply(row[2]); toast(r.error); }
    },
    keys: () => (window.SlopCmd ? SlopCmd.openKeymap() : SlopUI.alert('Keyboard shortcuts', 'Ctrl or ⌘ + O open · + S export · + Z undo · K keep · R remove · H pan · 0 fit · + and − zoom')),
    about: () => SlopUI.alert('SlopIsolate', 'Background removal that runs entirely on this device. Nothing is uploaded, and exports never carry a watermark.'),
  };

  /* ---------- menu items (built fresh each time a menu opens, so states and keys are current) ---------- */
  const keyOf = (id, fallback) => (window.SlopCmd ? SlopCmd.keyFor(id) : fallback) || '';
  function fileItems() {
    const out = [
      { label: 'Open…', key: keyOf('co.file-open', 'Ctrl+O'), act: act.open },
      { label: 'Sample image', key: keyOf('co.file-sample'), act: act.sample },
      { label: 'Config', sub: window.SlopConfigDialog ? SlopConfigDialog.menuItems({ app: 'cutout' }) : [] },
    ];
    if (hub()) out.push({ label: 'Open from Slop Drive…', act: act.driveOpen });
    out.push('-',
      { label: 'Export…', key: keyOf('co.export-one', 'Ctrl+S'), act: act.exportOne, disabled: !done() },
      { label: 'Export all…', key: keyOf('co.export-all', 'Ctrl+Shift+S'), act: act.exportAll, disabled: !S.items.some((i) => i.status === 'done') });
    if (window.SlopFlowDoc) out.push('-', { label: 'Add to a workflow…', act: act.workflow });
    return out;
  }
  function editItems() {
    const it = cur(), ul = H.label(it, 'undo'), rl = H.label(it, 'redo');
    return [
      { label: 'Undo' + (ul ? ' ' + ul : ''), key: keyOf('co.undo', 'Ctrl+Z'), act: act.undo, disabled: !H.can(it, 'undo') },
      { label: 'Redo' + (rl ? ' ' + rl : ''), key: keyOf('co.redo', 'Ctrl+Shift+Z'), act: act.redo, disabled: !H.can(it, 'redo') },
      '-',
      { label: 'Clear brush edits', act: act.clearEdits, disabled: !it || !CO.brush.hasEdits(it) },
      ...(window.SlopMacros ? ['-', SlopMacros.recording ? { label: 'Stop recording and save the macro…', act: () => SlopMacros.stop() } : { label: 'Record a macro', act: () => SlopMacros.record() },
        { label: 'Macros…', act: () => SlopMacros.openPanel() }] : []),
    ];
  }
  function viewItems() {
    const has = !!cur();
    return [
      ...[['result', 'Result'], ['before', 'Before/after'], ['mask', 'Mask']].map(([v, l]) => ({ label: l, check: S.view === v, act: () => act.view(v), disabled: !has })),
      '-',
      { label: 'Fit to window', key: keyOf('co.view-fit', '0'), act: act.fit, disabled: !has },
      { label: 'Zoom in', key: keyOf('co.zoom-in', '+'), act: () => act.zoom(1.25), disabled: !has },
      { label: 'Zoom out', key: keyOf('co.zoom-out', '-'), act: () => act.zoom(0.8), disabled: !has },
    ];
  }
  function helpItems() {
    return [{ label: 'Keyboard shortcuts…', key: '', act: act.keys }];
  }
  function moreItems() {
    const now = window.SlopTheme ? SlopTheme.get() : 'dark';
    const out = [{ label: 'Theme', sub: THEMES.map(([v, l, s]) => ({ label: l, check: now === s, act: () => act.theme(v) })) }];
    // Open in: the same items as the toolbar's Open in… (ui/openin.js, SlopOuttake), for the selection when there is one.
    const sub = S.bulk() ? CO.openIn.bulkItems() : CO.openIn.items(cur());
    out.push({ label: 'Open in', sub, disabled: !sub.length });
    if (hub() && cur() && cur().request) out.push({ label: 'Send mask back to PhotoSlop', act: () => CO.send.mask(), disabled: !done() });
    // A narrow top bar hides Clear saved work (css/themes.css); the More menu runs the same button.
    const clear = $('#btnClearSaved');
    if (clear) out.push({ label: 'Clear saved work…', act: () => clear.click() });
    out.push('-', { label: 'About SlopIsolate', act: act.about });
    return out;
  }

  /** Open a menu under a button. */
  function openAt(build, btn) {
    const r = btn.getBoundingClientRect();
    SlopUI.menu(build(), r.left, r.bottom + 2);
  }
  const BAR = [['File', fileItems], ['Edit', editItems], ['View', viewItems], ['Help', helpItems]];
  function buildBar() {
    const nav = $('#menus');
    for (const [name, build] of BAR) {
      const b = h('button', { type: 'button', class: 'menu-b', 'aria-haspopup': 'menu' }, name);
      b.addEventListener('click', () => openAt(build, b));
      // Once one menu is open, hovering the others switches to them (like a desktop menu bar).
      b.addEventListener('pointerenter', () => { if (document.querySelector('.sui-menu[data-level="0"]')) openAt(build, b); });
      nav.append(b);
    }
  }

  /* ---------- top-bar and empty-state buttons ---------- */
  function bindButtons() {
    const undo = $('#btnUndo'), redo = $('#btnRedo'), panel = $('#btnPanel'), more = $('#btnMore');
    U.btnIcon(undo, 'undo'); U.btnIcon(redo, 'redo');
    U.btnIcon($('#btnDownload'), 'download');
    U.btnIcon(panel, 'panel'); U.btnIcon(more, 'more');
    U.btnIcon($('#emptyOpen'), 'open', 'Choose images');
    U.btnIcon($('#emptySample'), 'sparkle', 'Try a sample');
    undo.addEventListener('click', () => act.undo());
    redo.addEventListener('click', () => act.redo());
    $('#btnDownload').addEventListener('click', () => act.exportOne());
    panel.addEventListener('click', () => { if (!CO.sheet.isPhone()) act.panel(); });   // on a phone it is the sheet's toggle
    more.addEventListener('click', () => openAt(moreItems, more));
    $('#emptyOpen').addEventListener('click', () => act.open());
    $('#emptySample').addEventListener('click', () => act.sample());
  }
  /** Undo/redo enabled state and their tooltips follow the active image's history. */
  function sync() {
    const it = cur(), undo = $('#btnUndo'), redo = $('#btnRedo');
    undo.disabled = !H.can(it, 'undo'); redo.disabled = !H.can(it, 'redo');
    const ul = H.label(it, 'undo'), rl = H.label(it, 'redo');
    undo.title = 'Undo' + (ul ? ' ' + ul : ''); redo.title = 'Redo' + (rl ? ' ' + rl : '');
  }

  function init() {
    // Phones: the settings panel is a bottom sheet (shared/ui/sheet.js: this button, ×, Escape, a tap outside, swipe down).
    CO.sheet = SlopSheet.attach({ root: $('#app'), panel: $('#props'), phone: '(max-width: 900px)', toggles: [$('#btnPanel')], label: 'Settings' });
    // the settings panel's width: dragged on its edge and kept (shared/ui/resize-panel.js, every side panel's one implementation)
    if (window.SlopResizePanel) SlopResizePanel.attach($('#props'), { app: 'slopisolate', id: 'props', edge: 'start', width: 304, min: 260, max: 560,
      phone: '(max-width: 900px)', cssVar: '--props-w', target: $('#app'), label: 'Settings' });
    buildBar(); bindButtons(); sync();
    ['history', 'activeItem', 'item', 'list'].forEach((t) => CO.on(t, sync));
    if (U.store.get('panel', true) === false) $('#app').classList.add('no-panel');
    $('#btnPanel').setAttribute('aria-expanded', String(!CO.sheet.isPhone() && !$('#app').classList.contains('no-panel')));
  }

  CO.menus = { init, act, moreItems };
})();
