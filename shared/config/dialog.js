/* SlopConfigDialog: the reusable "Import config…", "Export config…" and "Make one with AI…" dialogs, built on SlopUI.
 *   SlopConfigDialog.open('import' | 'export' | 'ai', { app })   or   SlopConfigDialog.menuItems({ app }) for a menu.
 * app defaults to SlopHub's app id. Needs shared/slopui.js and the shared/config scripts; dialog-ai.js adds the AI dialog.
 * Nothing is applied except a value that passed validation (io.js). Classic script, exposes window.SlopConfigDialog. */
(function (g) {
  'use strict';
  if (g.SlopConfigDialog) return;
  const C = g.SlopConfig, UI = () => g.SlopUI;

  const appOf = (o = {}) => o.app || (g.SlopHub && g.SlopHub.self && g.SlopHub.self.app) || C.consts.SHARED_APP;
  const note = (msg) => { try { UI().toast(msg); } catch (e) { /* no toast layer on this page */ } };
  const errorList = (errors) => UI().el('ul', { class: 'sui-errors' },
    (errors || []).map((e) => UI().el('li', null, e.path ? `${e.path}: ${e.message}` : e.message)));

  /** Shows the outcome of an import or an apply. Success is a toast; anything else lists what was wrong. */
  function showResult(res, title = 'Not imported') {
    if (!res || res.cancelled) return;
    if (res.ok) { note(`Applied: ${res.value.name}`); return; }
    const body = UI().el('div', null, UI().el('p', { class: 'sui-p' }, 'Nothing was applied.'), errorList(res.errors));
    UI().dialog({ title, body, buttons: [{ label: 'OK', primary: true }] });
  }

  async function runFile(app) {
    const files = await UI().pickFiles({ accept: '.json,.slop.json,application/json' });
    if (files && files[0]) showResult(await C.importFile(files[0], { app }));
  }

  /** "Import config…": a file from this computer, or from Slop Drive. The file is checked before anything changes. */
  function importDialog(o = {}) {
    const app = appOf(o);
    const body = UI().el('p', { class: 'sui-p' }, 'Choose a .slop.json file. It is checked in full first; nothing changes unless every part is valid.');
    UI().dialog({
      title: o.title || 'Import config', body,
      buttons: [
        { label: 'Cancel' },
        { label: 'From Slop Drive…', act: () => { C.importFromDrive({ app }).then((res) => showResult(res)); } },
        { label: 'From this computer…', primary: true, act: () => { runFile(app); } },
      ],
    });
  }

  /** "Export config…": pick a kind the app can export, name it, and download <name>.slop.json. */
  function exportDialog(o = {}) {
    const app = appOf(o);
    const choices = C.kinds(app).filter((e) => e.read);
    if (!choices.length) { note('Nothing to export here yet'); return; }
    const sel = UI().select(choices.map((e) => [e.kind, e.label]), choices[0].kind);
    const name = UI().el('input', { class: 'sui-input', type: 'text', value: `${app}-${choices[0].kind}`, maxlength: 120 });
    const desc = UI().el('input', { class: 'sui-input', type: 'text', placeholder: 'Optional', maxlength: 1000 });
    const body = UI().el('div', null, UI().field('Kind', sel), UI().field('Name', name), UI().field('Description', desc));
    UI().dialog({
      title: o.title || 'Export config', body,
      buttons: [
        { label: 'Cancel' },
        { label: 'Export', primary: true, act: async () => {
          try {
            const file = await C.exportKind(sel.value, app, name.value.trim() || 'config', { description: desc.value.trim() || undefined });
            UI().download(file, file.name);
          } catch (e) { note(`Could not export: ${e.message}`); return false; }
        } },
      ],
    });
  }

  /** The AI dialog is in dialog-ai.js; it sets makeAi when loaded. */
  function aiDialog(o = {}) {
    if (!api.makeAi) { note('The AI dialog is not loaded on this page'); return; }
    api.makeAi({ ...o, app: appOf(o) });
  }

  function open(which, o = {}) {
    if (which === 'import') return importDialog(o);
    if (which === 'export') return exportDialog(o);
    if (which === 'ai') return aiDialog(o);
    if (which === 'template') return templateDialog(o);
    throw new Error(`SlopConfigDialog.open: unknown dialog "${which}"`);
  }

  /** "Export plain template…": a valid example file (every key, example values) to fill in and import again. */
  function templateDialog(o = {}) {
    const app = appOf(o);
    const choices = C.kinds(app);
    if (!choices.length) { note('No config kinds for this app yet'); return; }
    const sel = UI().select(choices.map((e) => [e.kind, e.label]), choices[0].kind);
    const body = UI().el('div', null, UI().field('Kind', sel),
      UI().el('p', { class: 'sui-p' }, 'The file has every key with an example value. Replace the values, keep the keys, then import it.'));
    UI().dialog({
      title: o.title || 'Export plain template', body,
      buttons: [
        { label: 'Cancel' },
        { label: 'Export', primary: true, act: () => {
          try {
            const example = o.example && o.example.kind === sel.value ? o.example.value : C.exampleValue(sel.value, app);
            const file = C.exportFile(sel.value, app, `${app}-${sel.value}-template`, example,
              { description: 'Template: replace the example values and keep every key' });
            UI().download(file, file.name);
          } catch (e) { note(`Could not export: ${e.message}`); return false; }
        } },
      ],
    });
  }

  /** o.example = { kind, value }: a hand-made example for one kind (an app can show its own shape). */
  /** Drag and drop: a .slop.json file dropped anywhere on the page is checked and imported. The drop is taken only when
   * it holds such a file; other drops reach the app as usual. Bound once per page, in the capture phase. */
  let dropBound = false;
  function bindDrop(o = {}) {
    if (dropBound || !g.addEventListener) return;
    dropBound = true;
    const app = appOf(o);
    const hasFiles = (e) => !!e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    g.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); }, true); // lets the drop land
    g.addEventListener('drop', (e) => {
      const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
      const cfg = files.find((f) => /\.slop\.json$/i.test(f.name || ''));
      if (!cfg) return;
      e.preventDefault();
      e.stopPropagation();
      C.importFile(cfg, { app }).then((res) => showResult(res));
    }, true);
  }

  /** Call once per page: binds drag and drop. Returns the four menu items (see menuItems). */
  function install(o = {}) { bindDrop(o); return menuItems(o); }

  /** The four Config items for a SlopUI.menu: export current config, plain template, import, ask AI. */
  function menuItems(o = {}) {
    return [
      { label: 'Export current config…', act: () => exportDialog(o) },
      { label: 'Export plain template…', act: () => templateDialog(o) },
      { label: 'Import config…', act: () => importDialog(o) },
      { label: 'Ask AI to write a config…', act: () => aiDialog(o) },
    ];
  }

  /** The same four actions as palette commands (SlopCmd shape): ids '<prefix>.config.export' and so on. */
  function commands(o = {}) {
    const pre = o.prefix || appOf(o);
    return [
      { id: `${pre}.config.export`, title: 'Export current config…', group: 'Config', keywords: ['save', 'json', 'slop'], run: () => exportDialog(o) },
      { id: `${pre}.config.template`, title: 'Export plain template…', group: 'Config', keywords: ['example', 'blank', 'empty'], run: () => templateDialog(o) },
      { id: `${pre}.config.import`, title: 'Import config…', group: 'Config', keywords: ['load', 'open', 'drop'], run: () => importDialog(o) },
      { id: `${pre}.config.ai`, title: 'Ask AI to write a config…', group: 'Config', keywords: ['make', 'generate', 'model'], run: () => aiDialog(o) },
    ];
  }

  const api = { open, importDialog, exportDialog, templateDialog, aiDialog, menuItems, commands, install, bindDrop, showResult, makeAi: null };
  g.SlopConfigDialog = api;
})(typeof window !== 'undefined' ? window : globalThis);
