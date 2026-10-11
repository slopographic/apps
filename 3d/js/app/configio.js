/* Slop 3D config files (app): File > Import config… reads a scene3d config (core/config.js) and adds its objects in one
 * undo step, all or nothing. File > Export config… writes the scene's primitives and lights in the same shape.
 * Registration with shared/config is a stub: registerStub() does nothing until SlopConfig exists there.
 * Sets window.Slop3D.configio. */
(function () {
  'use strict';
  const S = (window.Slop3D = window.Slop3D || {});
  const s = S.state.s, A = S.actions;
  const toast = (m) => { if (window.SlopUI) SlopUI.toast(m); };

  /** Validates config text and adds it to the scene. Returns true when it was added. */
  function importText(text) {
    let data;
    try { data = JSON.parse(String(text)); } catch (e) { toast('That file is not valid JSON'); return false; }
    const r = S.config.validate(data);
    if (!r.ok) { toast('Config not imported: ' + r.errors.slice(0, 3).join('; ')); return false; }
    if (!r.trees.length) { toast('The config has no objects or lights'); return false; }
    A.addTrees(r.trees);
    toast(`Imported ${r.trees.length} item${r.trees.length === 1 ? '' : 's'}`);
    return true;
  }
  function importDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', async () => {
      const f = input.files && input.files[0];
      if (f) importText(await f.text());
    });
    input.click();
  }
  function exportConfig() {
    const r = S.config.exportScene(s.doc);
    if (!r.data.objects.length && !r.data.lights.length) { toast('Nothing to export: the scene has no primitives or lights'); return false; }
    if (window.SlopUI) SlopUI.download(new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' }), (s.file.name || 'scene') + '.config.json');
    if (r.skipped) toast(`${r.skipped} edited or imported mesh${r.skipped === 1 ? '' : 'es'} left out (only primitives are written)`);
    return true;
  }
  /** TODO(shared/config): when shared/config exists, register kind 'scene3d' for app '3d' there (data: the scene3d
   * object list, validated by S.config.validate, built by addTrees, written by S.config.exportScene). Until then this
   * does nothing, and the File menu items above work on their own. */
  function registerStub() {
    return !!(window.SlopConfig && typeof window.SlopConfig.register === 'function');
  }
  /** Commands for the palette and the File menu. */
  function commands(C) {
    return [
      C('3d.file.importConfig', 'Import config…', 'File', [], () => importDialog()),
      C('3d.file.exportConfig', 'Export config…', 'File', [], () => exportConfig()),
    ];
  }

  S.configio = { importText, importDialog, exportConfig, registerStub, commands };
})();
