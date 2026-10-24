/* PhotoSlop: the effect preset picker (Layer ▸ Apply Effect Preset…, the layer's right-click menu). Its own dialog
 * rather than SlopPresets.openPicker, because it previews: choosing a row puts that preset's effects on the layer at
 * once, with no history step. Apply writes them as one step ('Apply Preset: …'). Close, Cancel and Escape put the
 * layer back as it was. Export, Import and Delete use the shared registry (shared/presets). Rows use the sp-* classes
 * in css/presets.css. */
'use strict';

/** The chips a preset shows: one per effect, with a colour dot where the effect has a colour. */
function fxPresetChips(p) {
  return h('div', { class: 'sp-thumb sp-chips' }, p.params.effects.map((e) => {
    const colour = e.p.color || e.p.c1;
    return h('span', { class: 'sp-chip' }, colour ? h('i', { class: 'sp-dot', style: { background: colour } }) : null, SlopPresets.EFFECT_TYPES[e.type].label);
  }));
}

function openFxPresetPicker(layerId) {
  const L0 = D.layers.find((l) => l.id === layerId);
  if (!L0) return;
  const orig = L0.fx || null;
  const SP = SlopPresets;
  let sel = null, applied = false;
  const list = h('ul', { class: 'sp-list', role: 'listbox', 'aria-label': 'Presets' });
  const status = h('p', { class: 'sui-p sp-status', role: 'status' });
  const exportBtn = h('button', { type: 'button', class: 'sui-btn' }, 'Export…');
  const deleteBtn = h('button', { type: 'button', class: 'sui-btn sui-danger' }, 'Delete');
  const importBtn = h('button', { type: 'button', class: 'sui-btn' }, 'Import…');
  const mine = () => { const p = sel && SP.get(sel); return p && !p.builtin ? p : null; };

  /** Puts the layer back to what it was before the picker opened (no history step). */
  const restore = () => { patchLayer(layerId, { fx: orig }); emit('doc'); };
  /** Shows a preset on the layer while it is chosen (no history step). */
  const preview = (p) => {
    if (!p) { restore(); return; }
    const L = D.layers.find((l) => l.id === layerId);
    if (!L) return;
    const { add } = fxPresetPlan(p);
    const next = (orig || []).concat(add);
    patchLayer(layerId, { fx: next.length ? next : null });
    emit('doc');
  };
  const choose = (id) => { sel = id; preview(sel ? SP.get(sel) : null); paint(); };

  function paint() {
    const rows = SP.list({ kind: 'effect', app: 'photoslop' });
    list.replaceChildren(...rows.map((p) => {
      const on = p.id === sel;
      const li = h('li', { role: 'option', 'aria-selected': on ? 'true' : 'false', tabindex: '0', class: 'sp-row' + (on ? ' on' : ''), 'data-id': p.id },
        fxPresetChips(p),
        h('span', { class: 'sp-name' }, h('b', null, p.label), h('small', null, (p.builtin ? 'Built-in' : 'Mine') + ' · Effect' + (p.description ? ' · ' + p.description : ''))));
      li.addEventListener('click', () => choose(p.id));
      li.addEventListener('dblclick', () => { if (applyChosen()) closeDlg(); });
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' && applyChosen()) closeDlg(); });
      return li;
    }));
    if (!rows.length) list.append(h('li', { class: 'sp-empty' }, 'No presets here yet. Save one from a layer’s menu, or import a .slop.json file.'));
    exportBtn.disabled = !sel;
    deleteBtn.disabled = !mine();
  }
  /** Writes the chosen preset to the layer as one step. False when nothing is chosen or nothing can apply. */
  function applyChosen() {
    const p = sel && SP.get(sel);
    if (!p) { status.textContent = 'Choose a preset first.'; return false; }
    restore();
    const r = fxPresetApply(layerId, p);
    if (!r.added) { preview(p); status.textContent = 'Nothing in “' + p.label + '” can apply to a layer here.'; return false; }
    applied = true;
    SlopUI.toast('Applied “' + p.label + '”' + (r.skipped ? ` (${r.skipped} effect${r.skipped > 1 ? 's' : ''} skipped)` : ''));
    return true;
  }

  exportBtn.addEventListener('click', () => { const f = sel && SP.exportFile(sel); if (f) SlopUI.download(f.blob, f.name); });
  // Import comes in the one way (shared/intake): a spec of its own, for this dialog.
  SlopIntake.register({ id: 'photoslop.fx-preset', main: false, paste: false, limit: 1, toast: false,
    accept: { types: ['application/json'], exts: ['.json'], noun: 'an effects preset (.slop.json)' },
    process: async (f) => {
      const r = await SP.importFile(f);
      status.textContent = r.ok ? 'Imported.' : SP.errorText(r.errors);
      if (r.ok) choose(r.id); else paint();
      return r.ok;
    } });
  importBtn.addEventListener('click', () => SlopIntake.pick({ to: 'photoslop.fx-preset', multiple: false }));
  deleteBtn.addEventListener('click', async () => {
    const m = mine();
    if (!m || !(await SlopUI.confirm('Delete preset', 'Delete “' + m.label + '”? It is removed from Slop Drive for every app.', 'Delete', { danger: true }))) return;
    const r = await SP.remove(m.id);
    if (!r.ok) status.textContent = SP.errorText(r.errors);
    sel = null; restore(); paint();
  });

  const repaint = () => paint();
  window.addEventListener('slop-presets:change', repaint);
  const body = h('div', { class: 'sp-dialog' }, h('div', { class: 'sp-tools' }, exportBtn, importBtn, deleteBtn), list, status,
    h('p', { class: 'sp-help' }, 'Choose a preset to preview it on the layer. Apply keeps it as one undo step.'));
  let closeDlg = () => {};
  SlopUI.dialog({
    title: 'Apply effect preset', cls: 'sp-dlg', body,
    onClose: (ok) => { window.removeEventListener('slop-presets:change', repaint); if (!applied) restore(); },
    buttons: [
      { label: 'Close' },
      { label: 'Apply', primary: true, act: () => applyChosen() },
    ],
  });
  // Closes the dialog from a double click or Enter on a row (the Close button's own handler does the restore).
  closeDlg = () => { const x = body.closest('.sui-back'); const b = x && x.querySelector('.sui-x'); if (b) b.click(); };
  paint();
}
