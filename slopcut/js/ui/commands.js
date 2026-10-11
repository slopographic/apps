/* SlopCut: every action as a command (for menus, shortcuts and the Spotlight palette).
   Registered with the shared SlopCmd package (shared/commands/) when it is available; until then a
   small built-in dispatcher and palette handle the same definitions. Actions live on SE.act.* */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util;
  const act = SE.act = SE.act || {};
  const C = SE.cmd = { list: [] };
  const run = (name, ...a) => () => (act[name] ? act[name](...a) : undefined);
  const hasClips = () => SE.doc.clips.length > 0;
  const hasSel = () => SE.app.selectedIds().length > 0;
  const T = SE.model.TRANSITIONS;

  C.list = [
    // File
    { id: 'file.import', title: 'Import media…', group: 'File', keys: ['Mod+I'], keywords: ['open', 'video', 'audio', 'image', 'add'], run: () => SE.app.openDialog() },
    { id: 'file.drive', title: 'Import from Slop Drive…', group: 'File', keywords: ['drive', 'open'], when: () => !!window.SlopHub && !SE.offline, run: () => SE.app.openFromDrive() },
    { id: 'file.new', title: 'New project', group: 'File', keys: ['Alt+Mod+N'], run: run('newProject') },
    { id: 'file.open', title: 'Open project (.slopedit)…', group: 'File', keys: ['Mod+O'], run: run('openProject') },
    { id: 'file.save', title: 'Save project (.slopedit)', group: 'File', keys: ['Mod+S'], keywords: ['download', 'zip'], run: run('saveProject') },
    { id: 'file.saveDrive', title: 'Save project to Slop Drive…', group: 'File', when: () => !!window.SlopHub && !SE.offline, run: run('saveProjectDrive') },
    { id: 'file.download', title: 'Download project (.slopedit)', group: 'File', run: run('downloadProject') },
    { id: 'file.export', title: 'Export video…', group: 'File', keys: ['Mod+E'], keywords: ['render', 'mp4', 'webm', 'h264'], when: hasClips, run: run('exportVideo') },
    { id: 'file.gif', title: 'Export GIF…', group: 'File', keywords: ['animated', 'gif'], when: hasClips, run: run('exportGif') },
    { id: 'file.snapshot', title: 'Snapshot frame to PNG', group: 'File', keys: ['Shift+E'], keywords: ['still', 'frame', 'image', 'screenshot'], run: run('snapshot') },
    { id: 'file.snapshotSend', title: 'Send frame to PhotoSlop', group: 'File', keywords: ['photoslop', 'still', 'edit'], when: () => !!window.SlopHub && !SE.offline, run: run('snapshotSend') },
    { id: 'file.sample', title: 'Load sample project', group: 'File', keywords: ['demo', 'example'], run: () => SE.sample && SE.sample.load() },
    { id: 'file.offline', title: 'Download app (offline .html)', group: 'File', run: run('downloadApp') },
    // Edit
    { id: 'edit.undo', title: 'Undo', group: 'Edit', keys: ['Mod+Z'], when: () => SE.history.canUndo(), run: () => SE.history.undo() },
    { id: 'edit.redo', title: 'Redo', group: 'Edit', keys: ['Shift+Mod+Z', 'Mod+Y'], when: () => SE.history.canRedo(), run: () => SE.history.redo() },
    { id: 'edit.cut', title: 'Cut', group: 'Edit', keys: ['Mod+X'], when: hasSel, run: run('cut') },
    { id: 'edit.copy', title: 'Copy', group: 'Edit', keys: ['Mod+C'], when: hasSel, run: run('copy') },
    { id: 'edit.paste', title: 'Paste at playhead', group: 'Edit', keys: ['Mod+V'], run: run('paste') },
    { id: 'edit.duplicate', title: 'Duplicate clip', group: 'Edit', keys: ['Shift+Mod+D'], when: hasSel, run: run('duplicate') },
    { id: 'edit.delete', title: 'Delete (lift)', group: 'Edit', keys: ['Delete', 'Backspace'], when: hasSel, run: run('remove', false) },
    { id: 'edit.rippleDelete', title: 'Ripple delete', group: 'Edit', keys: ['Shift+Delete', 'Shift+Backspace'], keywords: ['close gap'], when: hasSel, run: run('remove', true) },
    { id: 'edit.split', title: 'Split at playhead', group: 'Edit', keys: ['S'], keywords: ['razor', 'cut', 'blade'], when: hasClips, run: run('split', false) },
    { id: 'edit.splitAll', title: 'Split all tracks at playhead', group: 'Edit', keys: ['Shift+S'], when: hasClips, run: run('split', true) },
    { id: 'edit.selectAll', title: 'Select all clips', group: 'Edit', keys: ['Mod+A'], when: hasClips, run: run('selectAll') },
    { id: 'edit.deselect', title: 'Deselect all', group: 'Edit', keys: ['Shift+Mod+A'], run: () => SE.app.select([]) },
    { id: 'edit.link', title: 'Link / unlink audio and video', group: 'Edit', keys: ['Mod+L'], when: hasSel, run: run('toggleLink') },
    { id: 'edit.nudgeL', title: 'Nudge clip one frame left', group: 'Edit', keys: ['Alt+ArrowLeft'], when: hasSel, run: run('nudge', -1) },
    { id: 'edit.nudgeR', title: 'Nudge clip one frame right', group: 'Edit', keys: ['Alt+ArrowRight'], when: hasSel, run: run('nudge', 1) },
    { id: 'edit.trimIn', title: 'Ripple trim start to playhead', group: 'Edit', keys: ['Q'], when: hasClips, run: run('trimToPlayhead', 'in') },
    { id: 'edit.trimOut', title: 'Ripple trim end to playhead', group: 'Edit', keys: ['W'], when: hasClips, run: run('trimToPlayhead', 'out') },
    // Playback
    { id: 'play.toggle', title: 'Play / pause', group: 'Playback', keys: ['Space'], run: () => SE.player.toggle() },
    { id: 'play.reverse', title: 'Shuttle reverse (J)', group: 'Playback', keys: ['J'], run: () => SE.player.shuttle(-1) },
    { id: 'play.stop', title: 'Stop (K)', group: 'Playback', keys: ['K'], run: () => SE.player.pause() },
    { id: 'play.forward', title: 'Shuttle forward (L)', group: 'Playback', keys: ['L'], run: () => SE.player.shuttle(1) },
    { id: 'play.prevFrame', title: 'Previous frame', group: 'Playback', keys: ['ArrowLeft'], run: () => SE.player.step(-1) },
    { id: 'play.nextFrame', title: 'Next frame', group: 'Playback', keys: ['ArrowRight'], run: () => SE.player.step(1) },
    { id: 'play.back', title: 'Back 1 second', group: 'Playback', keys: ['Shift+ArrowLeft'], run: () => SE.player.seek(SE.player.time - 1) },
    { id: 'play.fwd', title: 'Forward 1 second', group: 'Playback', keys: ['Shift+ArrowRight'], run: () => SE.player.seek(SE.player.time + 1) },
    { id: 'play.prevEdit', title: 'Go to previous edit', group: 'Playback', keys: ['ArrowUp'], run: run('gotoEdit', -1) },
    { id: 'play.nextEdit', title: 'Go to next edit', group: 'Playback', keys: ['ArrowDown'], run: run('gotoEdit', 1) },
    { id: 'play.start', title: 'Go to start', group: 'Playback', keys: ['Home'], run: () => SE.player.seek(0) },
    { id: 'play.end', title: 'Go to end', group: 'Playback', keys: ['End'], run: () => SE.player.seek(SE.model.duration(SE.doc)) },
    { id: 'play.markIn', title: 'Mark in', group: 'Playback', keys: ['I'], run: run('markIn') },
    { id: 'play.markOut', title: 'Mark out', group: 'Playback', keys: ['O'], run: run('markOut') },
    { id: 'play.clearInOut', title: 'Clear in and out', group: 'Playback', keys: ['Alt+X'], run: run('clearInOut') },
    { id: 'play.loop', title: 'Loop playback', group: 'Playback', keys: ['Shift+L'], checked: () => !!(SE.player && SE.player.loop), run: () => { SE.player.loop = !SE.player.loop; SE.emit('transport', {}); } },
    // Tools and timeline
    { id: 'tool.select', title: 'Selection tool', group: 'Tools', keys: ['V'], checked: () => SE.timeline && SE.timeline.tool === 'select', run: () => SE.timeline.setTool('select') },
    { id: 'tool.razor', title: 'Razor tool', group: 'Tools', keys: ['C'], keywords: ['blade', 'cut'], checked: () => SE.timeline && SE.timeline.tool === 'razor', run: () => SE.timeline.setTool('razor') },
    { id: 'tool.ripple', title: 'Ripple edit tool', group: 'Tools', keys: ['B'], checked: () => SE.timeline && SE.timeline.tool === 'ripple', run: () => SE.timeline.setTool('ripple') },
    { id: 'tool.snap', title: 'Snapping', group: 'Tools', keys: ['N'], keywords: ['magnet'], checked: () => SE.timeline && SE.timeline.snap, run: () => SE.timeline.toggleSnap() },
    { id: 'tl.zoomIn', title: 'Zoom timeline in', group: 'Timeline', keys: ['='], run: () => SE.timeline.zoomBy(1.4) },
    { id: 'tl.zoomOut', title: 'Zoom timeline out', group: 'Timeline', keys: ['-'], run: () => SE.timeline.zoomBy(1 / 1.4) },
    { id: 'tl.fit', title: 'Zoom to fit', group: 'Timeline', keys: ['\\'], run: () => SE.timeline.fit() },
    { id: 'tl.marker', title: 'Add marker', group: 'Timeline', keys: ['M'], run: run('addMarker') },
    { id: 'tl.title', title: 'Add title at playhead', group: 'Timeline', keys: ['T'], keywords: ['text', 'caption'], run: run('addTitle') },
    { id: 'tl.color', title: 'Add colour matte at playhead', group: 'Timeline', keywords: ['solid', 'background'], run: run('addColor') },
    { id: 'tl.effect', title: 'Add random effect layer at playhead', group: 'Timeline', keywords: ['effect', 'grain', 'glitch', 'vignette', 'colour shift', 'zoom', 'random', 'adjustment'], run: run('addEffect') },
    { id: 'tl.vtrack', title: 'Add video track', group: 'Timeline', run: run('addTrack', 'video') },
    { id: 'tl.atrack', title: 'Add audio track', group: 'Timeline', run: run('addTrack', 'audio') },
    { id: 'tl.settings', title: 'Sequence settings…', group: 'Timeline', keywords: ['resolution', 'fps', 'size'], run: run('sequenceSettings') },
    // Clip
    ...T.map(([type, label]) => ({ id: 'tr.' + type, title: 'Add transition: ' + label, group: 'Transitions', keys: type === 'cross' ? ['Mod+D'] : undefined, keywords: ['transition', 'fade', type], when: hasClips, run: run('addTransition', type) })),
    { id: 'tr.remove', title: 'Remove transition', group: 'Transitions', when: hasSel, run: run('addTransition', null) },
    { id: 'clip.fadeIn', title: 'Fade in (1 s)', group: 'Clip', when: hasSel, run: run('fade', 'in') },
    { id: 'clip.fadeOut', title: 'Fade out (1 s)', group: 'Clip', when: hasSel, run: run('fade', 'out') },
    { id: 'clip.speed', title: 'Speed / duration…', group: 'Clip', keys: ['Mod+R'], keywords: ['slow motion', 'fast'], when: hasSel, run: run('speedDialog') },
    { id: 'clip.reset', title: 'Reset all (settings, keeps media)', group: 'Clip', when: hasSel, run: run('resetClip') },
    { id: 'clip.keyPlayhead', title: 'Keyframe at playhead (all properties)', group: 'Clip', keywords: ['animation', 'keyframe', 'key', 'position', 'scale', 'rotation', 'opacity'], when: hasSel, run: run('keyAtPlayhead') },
    { id: 'clip.keysReset', title: 'Reset keyframes', group: 'Clip', keywords: ['animation', 'keyframe'], when: hasSel, run: run('resetKeys') },
    { id: 'clip.effectReset', title: 'Reset random effect layer', group: 'Clip', when: hasSel, run: run('resetEffect') },
    { id: 'clip.volKey', title: 'Add volume keyframe at playhead', group: 'Clip', keys: ['Shift+K'], when: hasSel, run: run('addVolumeKey') },
    // Templates and random edit
    { id: 'tpl.panel', title: 'Templates panel', group: 'Sequence', keys: ['Shift+G'], keywords: ['layout', 'split', 'grid', 'picture in picture', 'slots'], run: run('openTemplates') },
    { id: 'tpl.random', title: 'Random edit…', group: 'Sequence', keys: ['Shift+R'], keywords: ['shuffle', 'auto edit', 'montage', 'seed', 'build'], run: run('randomDialog') },
    { id: 'tpl.reshuffle', title: 'Reshuffle random edit (new seed)', group: 'Sequence', keywords: ['shuffle', 'seed'], when: () => !!SE.doc.random, run: run('reshuffleRandom') },
    { id: 'tpl.clear', title: 'Clear template layout', group: 'Sequence', when: () => !!SE.doc.layout, run: run('clearLayout') },
    ...SE.templates.list.map((t) => ({ id: 'tpl.apply.' + t.id, title: 'Apply template: ' + t.name, group: 'Templates', keywords: ['layout', 'slots', t.desc], run: run('applyTemplate', t.id) })),
    // View
    { id: 'view.safe', title: 'Safe area overlay', group: 'View', keys: ["'"], checked: () => !!(SE.preview && SE.preview.safe), run: run('toggleSafe') },
    { id: 'view.quality', title: 'Preview quality: full / half', group: 'View', checked: () => !!(SE.preview && SE.preview.half), run: run('toggleQuality') },
    ...SE.app.THEMES.map(([t, label]) => ({ id: 'view.theme.' + t, title: 'Theme: ' + label, group: 'View', checked: () => document.documentElement.getAttribute('data-theme') === t, run: () => SE.app.setTheme(t) })),
    // Help
    { id: 'help.search', title: 'Search commands…', group: 'Help', keys: window.SlopCmd ? undefined : ['Mod+K'], run: () => C.palette() },
    { id: 'help.keys', title: 'Keyboard shortcuts…', group: 'Help', keys: ['?', 'Shift+?'], run: () => C.keymap() },
    { id: 'help.about', title: 'About SlopCut & privacy', group: 'Help', run: run('about') }
  ];
  const byId = new Map(C.list.map((c) => [c.id, c]));
  C.get = (id) => byId.get(id);
  C.run = function (id) {
    if (window.SlopCmd && registered) return SlopCmd.run(id);
    const c = byId.get(id); if (!c || (c.when && !c.when())) return;
    return c.run({});
  };
  C.enabled = (id) => { const c = byId.get(id); return !!c && (!c.when || !!c.when()); };
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const pretty = (k) => k.replace(/Mod\+/g, isMac ? '⌘' : 'Ctrl+').replace(/Shift\+/g, isMac ? '⇧' : 'Shift+').replace(/Alt\+/g, isMac ? '⌥' : 'Alt+').replace('Arrow', '').replace('Delete', 'Del').replace('Backspace', '⌫');
  /** Display string of the first shortcut of a command ('' when none). */
  C.keyFor = function (id) {
    if (window.SlopCmd && registered && SlopCmd.keyFor) return SlopCmd.keyFor(id) || '';
    const c = byId.get(id); return c && c.keys ? pretty(c.keys[0]) : '';
  };
  /** A SlopUI.menu item for a command. */
  C.item = function (id, label) {
    const c = byId.get(id); if (!c) return null;
    return { label: label || c.title, key: C.keyFor(id).replace(/^⌘/, 'Ctrl+'), check: c.checked ? c.checked() : undefined, disabled: c.when ? !c.when() : false, act: () => C.run(id) };
  };

  /* ------------------------------------------------------------ SlopCmd or fallback */
  let registered = false;
  C.register = function () {
    if (registered || !window.SlopCmd) return registered;
    try {
      SlopCmd.init({ app: 'slopedit' });
      SlopCmd.register(C.list.map((c) => Object.assign({}, c, { icon: undefined })));
      registered = true;
      if (SlopCmd.on) SlopCmd.on('change', () => SE.emit('keys', {}));
    } catch (e) { console.warn('SlopCut: SlopCmd registration failed', e); }
    return registered;
  };
  C.usingShared = () => registered;
  C.palette = () => (registered && SlopCmd.open ? SlopCmd.open() : SE.cmdFallback && SE.cmdFallback.palette());
  C.keymap = () => (registered && SlopCmd.openKeymap ? SlopCmd.openKeymap() : SE.cmdFallback && SE.cmdFallback.keymap());
  /** Register with SlopCmd (loaded by index.html); the built-in fallback covers pages without it. */
  C.load = async function () {
    if (!C.register() && SE.cmdFallback) SE.cmdFallback.install(C.list);
  };
})();
