/* SlopEdit: the menu bar (File, Edit, Clip, Sequence, View, Help), built from commands, plus the
   About dialog. Every item runs a command so shortcuts shown here always match the keymap. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, C = SE.cmd, A = SE.app;
  const h = U.h;
  const it = (id, label) => C.item(id, label);
  const has = (id) => C.get(id) && (!C.get(id).when || C.get(id).when());

  function sendSub() {
    if (!window.SlopHub || SE.offline) return null;
    return { label: 'Send frame to', sub: [it('file.snapshotSend', 'PhotoSLOP (current frame)')] };
  }
  const MENUS = {
    File: () => [
      it('file.import'), it('file.drive'), '-',
      it('file.new'), it('file.open'), it('file.save'), it('file.saveDrive'), it('file.download'), '-',
      it('file.export'), it('file.gif'), it('file.snapshot'), sendSub(), '-',
      it('file.sample'), it('file.offline'),
      { label: 'Autosave project in this browser', check: U.store.get('autosave', true), act: () => { const v = !U.store.get('autosave', true); U.store.set('autosave', v); if (!v) U.idb.del('project').catch(() => null); SlopUI.toast(v ? 'Autosave on (stored only in this browser)' : 'Autosave off; saved project deleted'); } }
    ],
    Edit: () => [
      it('edit.undo', SE.history.canUndo() ? 'Undo ' + SE.history.undoLabel() : 'Undo'),
      it('edit.redo', SE.history.canRedo() ? 'Redo ' + SE.history.redoLabel() : 'Redo'), '-',
      it('edit.cut'), it('edit.copy'), it('edit.paste'), it('edit.duplicate'), '-',
      it('edit.delete'), it('edit.rippleDelete'), it('edit.split'), it('edit.splitAll'), it('edit.trimIn'), it('edit.trimOut'), '-',
      it('edit.selectAll'), it('edit.deselect'), it('edit.link')
    ],
    Clip: () => [
      { label: 'Apply template', sub: SE.templates.list.map((t) => it('tpl.apply.' + t.id, t.name)) },
      { label: 'Add transition', sub: SE.model.TRANSITIONS.map(([t]) => it('tr.' + t, C.get('tr.' + t).title.replace('Add transition: ', ''))).concat(['-', it('tr.remove')]) },
      it('clip.fadeIn'), it('clip.fadeOut'), it('clip.speed'), it('clip.volKey'), '-',
      it('edit.nudgeL'), it('edit.nudgeR'), it('clip.reset')
    ],
    Sequence: () => [
      it('tpl.panel'), it('tpl.random'), it('tpl.reshuffle'), it('tpl.clear'), '-',
      it('tl.title'), it('tl.color'), it('tl.marker'), '-',
      it('tl.vtrack'), it('tl.atrack'), '-',
      it('play.markIn'), it('play.markOut'), it('play.clearInOut'), it('play.loop'), '-',
      it('tl.zoomIn'), it('tl.zoomOut'), it('tl.fit'), '-',
      it('tl.settings')
    ],
    View: () => [
      it('tool.select'), it('tool.razor'), it('tool.ripple'), it('tool.snap'), '-',
      it('view.safe'), it('view.quality'), '-',
      { label: 'Theme', sub: A.THEMES.map(([t]) => it('view.theme.' + t, C.get('view.theme.' + t).title.replace('Theme: ', ''))) }
    ],
    Help: () => [
      it('help.search'), it('help.keys'), it('help.about'), '-',
      { label: 'Slopographic home', act: () => { location.href = SE.offline ? 'https://slopographic.com/' : '../'; } }
    ]
  };
  SE.menus = { MENUS };
  SE.menus.build = function () {
    const bar = A.els.menus;
    for (const name of Object.keys(MENUS)) {
      const b = h('button', { type: 'button', class: 'menu-b', 'aria-haspopup': 'menu' }, name);
      b.addEventListener('click', (e) => { e.stopPropagation(); const r = b.getBoundingClientRect(); SlopUI.menu(MENUS[name](), r.left, r.bottom + 2); });
      bar.append(b);
    }
    A.els.btnMore.addEventListener('click', (e) => {
      e.stopPropagation(); const r = A.els.btnMore.getBoundingClientRect();
      SlopUI.menu(Object.keys(MENUS).map((n) => ({ label: n, sub: MENUS[n]() })), r.right - 220, r.bottom + 4);
    });
    A.els.btnUndo.addEventListener('click', () => C.run('edit.undo'));
    A.els.btnRedo.addEventListener('click', () => C.run('edit.redo'));
    A.els.btnSearch.addEventListener('click', () => C.palette());
    A.els.btnExport.addEventListener('click', () => (has('file.export') ? C.run('file.export') : SlopUI.toast('Add some clips to the timeline first')));
    const sync = () => {
      A.els.btnUndo.disabled = !SE.history.canUndo(); A.els.btnRedo.disabled = !SE.history.canRedo();
      A.els.btnUndo.title = 'Undo ' + SE.history.undoLabel() + ' (' + C.keyFor('edit.undo') + ')';
      A.els.btnRedo.title = 'Redo ' + SE.history.redoLabel() + ' (' + C.keyFor('edit.redo') + ')';
      A.els.btnSearch.title = 'Search commands (' + (C.usingShared() ? (SlopCmd.keyFor && SlopCmd.keyFor('cmd.palette')) || 'Ctrl+K' : C.keyFor('help.search')) + ')';
    };
    SE.on('change', sync); SE.on('keys', sync); sync();
  };
  SE.act.about = function () {
    const caps = SE.caps || {};
    SlopUI.dialog({ title: 'About SlopEdit', body: h('div', null,
      h('p', { class: 'sui-p' }, 'SlopEdit is a free video editor that runs entirely in your browser. Your footage is never uploaded: it is decoded, edited and encoded on this device.'),
      h('p', { class: 'sui-p' }, 'Export uses WebCodecs (hardware video encoding) with the MIT-licensed mp4-muxer and webm-muxer by Vanilagy. Browsers without WebCodecs fall back to real-time WebM recording.'),
      h('p', { class: 'sui-p' }, 'This browser: ' + (caps.summary || 'checking…')),
      h('p', { class: 'sui-p' }, 'Autosave keeps your project and media in this browser’s IndexedDB. Turn it off in File ▸ Autosave.')),
    buttons: [{ label: 'Nice', primary: true }] });
  };
})();
