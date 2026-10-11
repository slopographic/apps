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
    throw new Error(`SlopConfigDialog.open: unknown dialog "${which}"`);
  }

  function menuItems(o = {}) {
    return [
      { label: 'Import config…', act: () => importDialog(o) },
      { label: 'Export config…', act: () => exportDialog(o) },
      { label: 'Make one with AI…', act: () => aiDialog(o) },
    ];
  }

  const api = { open, importDialog, exportDialog, aiDialog, menuItems, showResult, makeAi: null };
  g.SlopConfigDialog = api;
})(typeof window !== 'undefined' ? window : globalThis);
