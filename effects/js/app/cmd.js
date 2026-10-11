// Slop Effects commands: every action with a keyboard shortcut or a palette entry (SlopCmd). Keys that edit text (undo,
// copy, paste, delete, space) do nothing while a text field has the focus, so the field keeps its own behaviour. Classic
// script: window.SlopEffects.cmd.
(function (g) {
  'use strict';
  const ns = (g.SlopEffects = g.SlopEffects || {});
  const D = () => ns.defs;

  /** Registers the commands. ctx: { S, act, ka, io, tr (transport), preview, toast }. */
  function init(ctx) {
    const C = g.SlopCmd;
    if (!C || !C.register) return;
    const { S, act, ka, io, tr } = ctx;
    const typing = () => ns.dom.typing();
    const notTyping = () => !typing();
    const hasLayer = () => !!S.sel.layer;
    const cmds = [
      { id: 'fx.undo', title: 'Undo', group: 'Edit', keys: ['Mod+Z'], keywords: 'back revert', when: notTyping, run: () => S.undo() },
      { id: 'fx.redo', title: 'Redo', group: 'Edit', keys: ['Mod+Shift+Z', 'Mod+Y'], keywords: 'forward again', when: notTyping, run: () => S.redo() },
      { id: 'fx.copy', title: 'Copy selected keyframes', group: 'Edit', keys: ['Mod+C'], when: () => notTyping() && S.sel.keys.length > 0, run: () => ka.copy() },
      { id: 'fx.paste', title: 'Paste keyframes at the playhead', group: 'Edit', keys: ['Mod+V'], when: notTyping, run: () => ka.paste() },
      { id: 'fx.delete', title: 'Delete selected keyframes, or the layer', group: 'Edit', keys: ['Delete', 'Backspace'], when: notTyping, run: () => act.deleteSelection() },
      { id: 'fx.dup', title: 'Duplicate layer', group: 'Layer', keys: ['Mod+D'], when: () => notTyping() && hasLayer(), run: () => act.duplicateLayer() },
      { id: 'fx.up', title: 'Bring layer forward', group: 'Layer', keys: [']'], when: hasLayer, run: () => act.moveLayer(-1) },
      { id: 'fx.down', title: 'Send layer back', group: 'Layer', keys: ['['], when: hasLayer, run: () => act.moveLayer(1) },
      { id: 'fx.play', title: 'Play or pause', group: 'Playback', keys: ['Space'], when: notTyping, run: () => tr.toggle() },
      { id: 'fx.start', title: 'Go to start', group: 'Playback', keys: ['Home'], when: notTyping, run: () => tr.start() },
      { id: 'fx.end', title: 'Go to end', group: 'Playback', keys: ['End'], when: notTyping, run: () => tr.end() },
      { id: 'fx.prev', title: 'Previous frame', group: 'Playback', keys: ['ArrowLeft'], repeat: true, when: notTyping, run: () => tr.stepFrames(-1) },
      { id: 'fx.next', title: 'Next frame', group: 'Playback', keys: ['ArrowRight'], repeat: true, when: notTyping, run: () => tr.stepFrames(1) },
      { id: 'fx.prev10', title: 'Back 10 frames', group: 'Playback', keys: ['Shift+ArrowLeft'], repeat: true, when: notTyping, run: () => tr.stepFrames(-10) },
      { id: 'fx.next10', title: 'Forward 10 frames', group: 'Playback', keys: ['Shift+ArrowRight'], repeat: true, when: notTyping, run: () => tr.stepFrames(10) },
      { id: 'fx.nudge-l', title: 'Nudge selected keyframes back one frame', group: 'Keyframes', keys: ['Alt+ArrowLeft'], repeat: true, when: () => S.sel.keys.length > 0, run: () => ka.nudge(-1) },
      { id: 'fx.nudge-r', title: 'Nudge selected keyframes forward one frame', group: 'Keyframes', keys: ['Alt+ArrowRight'], repeat: true, when: () => S.sel.keys.length > 0, run: () => ka.nudge(1) },
      { id: 'fx.loop', title: 'Toggle loop', group: 'Playback', keys: ['L'], when: notTyping, run: () => S.setLoop(!S.loop) },
      { id: 'fx.in', title: 'Set play range start (In)', group: 'Playback', keys: ['I'], when: notTyping, run: () => tr.setIn() },
      { id: 'fx.out', title: 'Set play range end (Out)', group: 'Playback', keys: ['O'], when: notTyping, run: () => tr.setOut() },
      { id: 'fx.range-clear', title: 'Clear play range', group: 'Playback', keys: ['Alt+X'], when: notTyping, run: () => tr.clearRange() },
      { id: 'fx.new-solid', title: 'Add solid layer', group: 'Layer', keys: ['Mod+Shift+N'], run: () => act.addLayer('solid') },
      { id: 'fx.new-text', title: 'Add text layer', group: 'Layer', keys: ['Mod+Shift+T'], run: () => act.addLayer('text', { size: 120 }) },
      { id: 'fx.new-null', title: 'Add null layer', group: 'Layer', run: () => act.addLayer('null') },
      { id: 'fx.media', title: 'Add image or video from this computer', group: 'Layer', run: () => io.importFromComputer() },
      { id: 'fx.media-drive', title: 'Add image or video from Slop Drive', group: 'Layer', run: () => io.importFromDrive() },
      { id: 'fx.render', title: 'Render…', group: 'File', keys: ['Mod+E'], run: () => ctx.renderDialog() },
      { id: 'fx.save', title: 'Save project to Slop Drive', group: 'File', keys: ['Mod+S'], run: () => io.saveDrive() },
      { id: 'fx.open', title: 'Open project from Slop Drive', group: 'File', keys: ['Mod+O'], run: () => io.openDrive() },
      { id: 'fx.new', title: 'New project', group: 'File', run: () => io.newProject() },
      { id: 'fx.comp', title: 'Composition settings', group: 'Composition', run: () => ctx.compDialog() },
      { id: 'fx.random', title: 'Add random motion to the selected layer', group: 'Motion', when: hasLayer, run: () => ctx.focusMotion() },
    ];
    for (const kind of ['solid', 'shape', 'text', 'null']) {
      cmds.push({ id: `fx.add-${kind}`, title: `Add ${D().label(D().LAYER_TYPES, kind).toLowerCase()} layer`, group: 'Layer', run: () => act.addLayer(kind, kind === 'text' ? { size: 120 } : {}) });
    }
    for (const [name, label] of [['fade-in', 'Fade in'], ['slide-up', 'Slide up'], ['pop', 'Pop'], ['spin-in', 'Spin in']]) {
      cmds.push({ id: `fx.in-${name}`, title: `Animate in: ${label}`, group: 'Motion', when: hasLayer, run: () => ka.animate('in', name) });
      cmds.push({ id: `fx.out-${name}`, title: `Animate out: ${label}`, group: 'Motion', when: hasLayer, run: () => ka.animate('out', name) });
    }
    for (const [v, l] of D().EASES.filter((e) => e[0] !== 'bezier')) {
      cmds.push({ id: `fx.ease-${v}`, title: `Set selected key ease: ${l}`, group: 'Keyframes', when: () => S.sel.keys.length > 0, run: () => ka.setEaseAll(v) });
    }
    for (const kind of D().EFFECT_KINDS) {
      cmds.push({ id: `fx.effect-${kind}`, title: `Add effect: ${D().EFFECTS[kind].label}`, group: 'Effects', when: hasLayer, run: () => act.addEffect(kind) });
    }
    C.register(cmds);
  }

  ns.cmd = { init };
})(typeof window !== 'undefined' ? window : globalThis);
