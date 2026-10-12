/* SlopLabel — ui/configs-dlg: File ▸ Save as config… and File ▸ Configs…: save the open label's setup by name, apply a config
 * to the open label (one undo step), rename, duplicate, save as a preset, delete, and export to or import from a JSON file.
 * A configs file dropped on the app is imported too (ui/export.js). Storage is io/configs-store.js. Classic script. */
'use strict';

const persistNote = (msg) => (LabelConfigs.persisted ? msg : msg + ' (storage is blocked here, so it lasts only for this visit)');
/** Applies a config to the open label as one undo step (undo takes it back). Returns the notes about data columns. */
function applyConfigToLabel(name, body) {
  let notes = [];
  editDoc((d) => { notes = applyConfigToDoc(d, body); }, `Apply config “${name}”`);
  fitView();
  SlopUI.toast(notes.length ? notes.join('. ') + '.' : `Applied “${name}”. Undo takes it back.`, 4800);
}
/** File ▸ Save as config…: the open label's setup under a name. */
async function saveConfigDialog() {
  let body;
  try { body = configFromDoc(App.doc); } catch (e) { SlopUI.alert('This label cannot be saved as a config', e.message || String(e)); return; }
  const name = await SlopUI.prompt('Save as config', 'Config name', cleanConfigName(App.doc.name), { ok: 'Save', placeholder: 'e.g. 4 × 6 shipping' });
  if (name == null) return;
  const r = LabelConfigs.add(name, body);
  if (!r.ok) { SlopUI.toast(r.error); return; }
  SlopUI.toast(persistNote(`Saved config “${r.record.name}”`), 4200);
}
/** Imports a configs file (text). Reports what was added and what was refused. */
function importConfigsText(text) {
  const r = LabelConfigs.importText(text);
  if (!r.ok) { SlopUI.alert('Could not import the configs', r.error); return r; }
  SlopUI.toast(`Imported ${r.added} config${r.added === 1 ? '' : 's'}`);
  if (r.rejected.length) SlopUI.alert(`${r.rejected.length} config${r.rejected.length === 1 ? ' was' : 's were'} not imported`, r.rejected.map((x) => `${x.name}: ${x.error}`).join('; '));
  return r;
}
/** The one-line summary of a config, for the list. */
const configSummary = (b) => `${num(b.label.w, 2)} × ${num(b.label.h, 2)} mm · ${b.stock.kind === 'sheet' ? `${b.stock.cols} × ${b.stock.rows} per sheet` : 'roll'} · ${b.dpi} dpi`
  + (b.data ? ` · ${b.data.columns.length} data column${b.data.columns.length === 1 ? '' : 's'}` : '');

/** File ▸ Configs…: the saved configs, with their actions. */
function configsDialog() {
  let dlg;
  const list = mk('div', { class: 'cfg-list' });
  const draw = () => {
    const rows = LabelConfigs.configs;
    list.replaceChildren(...(rows.length ? rows.map((r) => cfgRow(r)) : [mk('p', { class: 'hint' }, 'No saved configs yet. Use File ▸ Save as config… to keep the open label’s size, stock, printer settings and data columns under a name.')]));
  };
  const cfgRow = (r) => {
    const acts = mk('div', { class: 'cfg-acts' },
      fBtn('Apply', () => { dlg.close(true); applyConfigToLabel(r.name, r.body); }, { cls: 'primary' }),
      fBtn('Rename', async () => {
        const n = await SlopUI.prompt('Rename config', 'New name', r.name, { ok: 'Rename' });
        if (n == null) return;
        const res = LabelConfigs.rename(r.id, n);
        if (!res.ok) SlopUI.toast(res.error);
        draw();
      }),
      fBtn('Duplicate', () => { const res = LabelConfigs.duplicate(r.id); if (!res.ok) SlopUI.toast(res.error); draw(); }),
      fBtn('Save as preset', () => { const res = LabelConfigs.saveAsPreset(r.id); SlopUI.toast(res.ok ? persistNote(`Saved preset “${res.record.name}”`) : res.error); }),
      fBtn('Delete', async () => {
        if (!(await SlopUI.confirm('Delete this config?', `“${r.name}” is removed from this browser. Presets saved from it stay.`, 'Delete', { danger: true }))) return;
        LabelConfigs.remove(r.id); draw();
      }));
    return mk('div', { class: 'cfg-row' }, mk('div', { class: 'cfg-main' }, mk('b', null, r.name), mk('small', { class: 'mono' }, configSummary(r.body))), acts);
  };
  const notice = LabelConfigs.readOnly ? mk('div', { class: 'msg warn' }, 'The configs saved in this browser were written by another version of SlopLabel. They are shown as empty and kept as they are.')
    : !LabelConfigs.persisted ? mk('div', { class: 'msg warn' }, 'Storage is blocked here, so configs last only for this visit. Export them to keep them.') : null;
  draw();
  dlg = SlopUI.dialog({ title: 'Configs', cls: 'sl-wide', body: mk('div', { class: 'dlg-form' },
    mk('p', { class: 'sui-p' }, 'A config is a label setup: the size and stock (sheet grid included), units and resolution, printer settings, the default text and shape style, and the data columns. Applying one to the open label is a single undo step.'),
    notice, list),
  buttons: [
    { label: 'Import…', act: async () => { const f = (await SlopUI.pickFiles({ accept: '.json,application/json' }))[0]; if (f) { importConfigsText(await f.text()); draw(); } return false; } },
    { label: 'Export all…', act: () => { if (!LabelConfigs.configs.length) { SlopUI.toast('No configs to export yet'); return false; } SlopUI.download(new Blob([LabelConfigs.exportText()], { type: 'application/json' }), 'sloplabel-configs.json'); return false; } },
    { label: 'Close', primary: true },
  ] });
}
