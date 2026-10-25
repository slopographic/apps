/* Slop 3D config files (app). The shared format (shared/config, HANDOFF.md there): kind 'scene' for app '3d', data
 * { objects, lights } as core/config.js reads and writes them. The kind's check() runs core/config.js validate, so a file
 * is checked by the same rules as before: all or nothing. Import also takes the older bare { objects, lights } JSON.
 * File ▸ Config: export current config, plain template, import, ask AI. Sets window.Slop3D.configio. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const s = S.state.s, A = S.actions;
  const C = window.SlopConfig, D = window.SlopConfigDialog;
  const APP = '3d';
  const toast = (m) => { if (window.SlopUI) SlopUI.toast(m); };

  /** Validates config text and adds it to the scene. Returns true when it was added. Accepts the shared envelope or bare JSON. */
  function importText(text) {
    let data;
    try { data = JSON.parse(String(text)); } catch (e) { toast('That file is not valid JSON'); return false; }
    if (C && data && data.format === C.consts.FORMAT) { C.importText(String(text), { app: APP }).then((res) => D.showResult(res)); return true; }
    const r = S.config.validate(data);
    if (!r.ok) { toast('Config not imported: ' + r.errors.slice(0, 3).join('; ')); return false; }
    if (!r.trees.length) { toast('The config has no objects or lights'); return false; }
    A.addTrees(r.trees);
    toast(`Imported ${r.trees.length} item${r.trees.length === 1 ? '' : 's'}`);
    return true;
  }
  function importDialog() {
    if (D) { D.importDialog({ app: APP }); return; }
    // without the shared config dialog: a part of the one intake of its own ('3d.config')
    const SI = window.SlopIntake;
    if (!SI.spec('3d.config')) SI.register({ id: '3d.config', main: false, paste: false, toast: false, limit: 1, accept: { types: ['application/json'], exts: ['.json'], noun: 'a config file' }, process: async (f) => { await importText(await f.text()); return f.name; } });
    SI.pick({ to: '3d.config', multiple: false, accept: '.json,application/json' });
  }
  function exportConfig() {
    const r = S.config.exportScene(s.doc);
    if (!r.data.objects.length && !r.data.lights.length) { toast('Nothing to export: the scene has no primitives or lights'); return false; }
    if (C) { C.exportKind('scene', APP, (s.file.name || 'scene')).then((f) => SlopUI.download(f, f.name)).catch((e) => toast('Could not export: ' + e.message)); }
    else if (window.SlopUI) SlopUI.download(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }), (s.file.name || 'scene') + '.config.json');
    if (r.skipped) toast(`${r.skipped} edited or imported mesh${r.skipped === 1 ? '' : 'es'} left out (only primitives are written)`);
    return true;
  }

  /** Registers kind 'scene' for app '3d'. Called once at boot (main.js), after the shared config scripts have loaded. */
  function registerConfig() {
    if (!C || !D || !C.F) return false;
    const F = C.F, free = F.obj({}, { strict: false });
    const check = (data) => {
      const r = S.config.validate(data);
      return r.ok ? [] : r.errors.map((e) => ({ path: '', message: String(e) }));
    };
    C.registerKind('scene', APP, {
      strict: true,
      fields: {
        objects: F.list(free, { max: 2000, desc: 'primitives: box, sphere, cylinder and the rest, each with a name, a position, rotation and scale, and a material' }),
        lights: F.list(free, { max: 200, desc: 'lights: point, directional or spot, with position and colour' }),
      },
    }, async (data) => {
      const r = S.config.validate(data);
      if (!r.ok) throw new Error(r.errors.slice(0, 3).join('; '));
      if (r.trees.length) A.addTrees(r.trees); // one undo step
    }, {
      label: 'Scene', description: 'Primitives and lights with positions, sizes and colours',
      read: () => S.config.exportScene(s.doc).data, check,
    });
    return true;
  }

  /** Commands for the palette and the File menu. The Config group holds the four shared actions. */
  function commands(C2) {
    const cfg = D ? D.commands({ app: APP, prefix: '3d' }) : [];
    return [
      C2('3d.file.importConfig', 'Import config…', 'File', [], () => importDialog()),
      C2('3d.file.exportConfig', 'Export config…', 'File', [], () => exportConfig()),
    ].concat(cfg.map((c) => C2(c.id, c.title, 'Config', [], c.run)));
  }

  S.configio = { importText, importDialog, exportConfig, registerConfig, registerStub: registerConfig, commands };
})();
