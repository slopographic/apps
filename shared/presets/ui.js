/* SlopPresets dialogs, shared by every app. openPicker lists the presets an app can apply (built-in and the person's own),
 * with a small thumbnail each, and applies the chosen one through the app's onApply callback, which writes the same data
 * the app's own controls write (so the app makes one undo step). Export, Import and Delete live in the same dialog.
 * openSave asks for a name (and a kind, when the app offers two) and saves what the app built, after validation.
 * Needs shared/slopui.js. Classic script. Exposes window.SlopPresets.openPicker and openSave. */
(function (g) {
  'use strict';
  const SP = (g.SlopPresets = g.SlopPresets || {});
  const SU = () => g.SlopUI;
  const el = (...a) => SU().el(...a);
  const KIND_LABEL = { effect: 'Effect', motion: 'Motion' };

  /** A small preview: effect chips with colour dots, or a curve of the motion over its duration. */
  function thumb(p) {
    if (p.kind === 'effect') {
      return el('div', { class: 'sp-thumb sp-chips' }, p.params.effects.map((e) => {
        const colour = e.p.color || e.p.c1;
        return el('span', { class: 'sp-chip' }, colour ? el('i', { class: 'sp-dot', style: { background: colour } }) : null, SP.EFFECT_TYPES[e.type].label);
      }));
    }
    if (!g.SlopMotion) return el('div', { class: 'sp-thumb' }, Math.round(p.params.duration * 100) / 100 + ' s');
    const names = Object.keys(p.params.tracks), track = names.find((n) => n !== 'opacity') || names[0];
    const N = 24, pts = [];
    for (let i = 0; i <= N; i++) pts.push(SP.motion.pose(p.params, (p.params.duration * i) / N)[track]);
    const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1, W = 96, H = 32;
    const d = pts.map((v, i) => `${i ? 'L' : 'M'}${((i / N) * W).toFixed(1)} ${(H - 4 - ((v - lo) / span) * (H - 8)).toFixed(1)}`).join(' ');
    return el('div', { class: 'sp-thumb' }, el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${track} over ${p.params.duration} s` },
      el('path', { d, fill: 'none', stroke: 'currentColor', 'stroke-width': '1.5' })));
  }

  /**
   * Opens the picker. opts: { kind ('effect' | 'motion' | null for both), app (registry id, filters what can apply here),
   * title, onApply(preset) }. onApply gets a copy of the preset; it returns nothing (or false to keep the dialog open).
   */
  SP.openPicker = function (opts) {
    const s = SU(), state = { sel: null }, list = el('ul', { class: 'sp-list', role: 'listbox', 'aria-label': 'Presets' });
    const mine = () => { const p = state.sel && SP.get(state.sel); return p && !p.builtin ? p : null; };
    const exportBtn = el('button', { type: 'button', class: 'sui-btn' }, 'Export…');
    const deleteBtn = el('button', { type: 'button', class: 'sui-btn sui-danger' }, 'Delete');
    const status = el('p', { class: 'sui-p sp-status', role: 'status' });
    function paint() {
      const rows = SP.list({ kind: opts.kind || undefined, app: opts.app || undefined });
      list.replaceChildren(...rows.map((p) => {
        const on = p.id === state.sel;
        const li = el('li', { role: 'option', 'aria-selected': on ? 'true' : 'false', tabindex: '0', class: 'sp-row' + (on ? ' on' : ''), 'data-id': p.id },
          thumb(p),
          el('span', { class: 'sp-name' }, el('b', null, p.label), el('small', null, (p.builtin ? 'Built-in' : 'Mine') + ' · ' + KIND_LABEL[p.kind] + (p.description ? ' · ' + p.description : ''))));
        li.addEventListener('click', () => { state.sel = p.id; paint(); });
        li.addEventListener('dblclick', async () => { if (await apply(p)) closeDlg(); });
        li.addEventListener('keydown', async (e) => { if (e.key === 'Enter' && await apply(p)) closeDlg(); });
        return li;
      }));
      if (!rows.length) list.append(el('li', { class: 'sp-empty' }, 'No presets here yet. Save one from the menu, or import a .slop.json file.'));
      const m = mine();
      exportBtn.disabled = !state.sel;
      deleteBtn.disabled = !m;
    }
    /** Runs onApply. Resolves false when the app kept the dialog open (it returned false), else true. */
    async function apply(p) {
      if (!p) return false;
      const r = await opts.onApply(SP.get(p.id));
      return r !== false;
    }
    let closeDlg = () => {};
    exportBtn.addEventListener('click', () => {
      const f = SP.exportFile(state.sel);
      if (f) s.download(f.blob, f.name);
      return false;
    });
    deleteBtn.addEventListener('click', async () => {
      const m = mine();
      if (!m || !(await s.confirm('Delete preset', 'Delete “' + m.label + '”? It is removed from Slop Drive for every app.', 'Delete', { danger: true }))) return false;
      const r = await SP.remove(m.id);
      if (!r.ok) status.textContent = SP.errorText(r.errors);
      state.sel = null; paint();
      return false;
    });
    const read = async (f) => {
      const r = await SP.importFile(f);
      status.textContent = r.ok ? 'Imported.' : SP.errorText(r.errors);
      if (r.ok) state.sel = r.id;
      paint();
      return f.name;
    };
    /** Import…: a part of the one intake ('presets.import') where the page has it. */
    const pickPreset = () => {
      const SI = window.SlopIntake;
      if (SI && SI.part) return SI.pick({ to: SI.part({ id: 'presets.import', limit: 1, accept: { types: ['application/json'], exts: ['.json'], noun: 'a preset file (.json)' }, process: read }), multiple: false, accept: '.json,.slop.json,application/json' });
      return window.SlopUI.pickFiles({ accept: '.json,.slop.json,application/json' }).then((fs) => (fs && fs[0] ? read(fs[0]) : null)); // intake-ok: a page without shared/intake
    };
    const importBtn = el('button', { type: 'button', class: 'sui-btn', onclick: pickPreset }, 'Import…');
    const body = el('div', { class: 'sp-dialog' }, el('div', { class: 'sp-tools' }, exportBtn, importBtn, deleteBtn), list, status);
    paint();
    g.addEventListener('slop-presets:change', paint);
    s.dialog({
      title: opts.title || 'Presets', cls: 'sp-dlg', body,
      onClose: () => g.removeEventListener('slop-presets:change', paint),
      buttons: [
        { label: 'Close' },
        { label: 'Apply', primary: true, act: async () => {
          if (!state.sel) { status.textContent = 'Choose a preset first.'; return false; }
          return apply(SP.get(state.sel));
        } },
      ],
    });
    // Closes this dialog from a double click or Enter (the Apply button closes it itself when the app accepts).
    closeDlg = () => { const x = body.closest('.sui-back'); const b = x && x.querySelector('.sui-x'); if (b) b.click(); };
  };

  /**
   * Opens the save dialog. opts: { app, apps? (default [app]), kinds? (['effect'], ['motion'] or both), build(kind) →
   * params or null when that kind does not apply to the selection, title?, onSaved(record) }. Saving validates the preset;
   * a refusal keeps the dialog open with the reason.
   */
  SP.openSave = function (opts) {
    const s = SU();
    const kinds = opts.kinds || ['effect'];
    const name = el('input', { class: 'sui-input', type: 'text', maxlength: String(SP.LIMITS.label), 'aria-label': 'Name', value: opts.defaultName || '' });
    const desc = el('input', { class: 'sui-input', type: 'text', maxlength: String(SP.LIMITS.description), 'aria-label': 'Description' });
    const kindSel = s.select(kinds.map((k) => [k, KIND_LABEL[k]]), kinds[0]);
    const body = el('div', null,
      kinds.length > 1 ? s.field('Kind', kindSel) : null,
      s.field('Name', name), s.field('Description', desc),
      el('p', { class: 'sui-p' }, 'Applies in: ' + (opts.apps || [opts.app]).map((a) => SP.APPS[a] || a).join(', ') + '.'));
    s.dialog({
      title: opts.title || 'Save as preset', cls: 'sui-narrow',
      body,
      buttons: [
        { label: 'Cancel' },
        { label: 'Save', primary: true, act: async () => {
          const kind = kindSel.value;
          const params = opts.build(kind);
          if (!params) { s.toast('Nothing here to save as a ' + KIND_LABEL[kind].toLowerCase() + ' preset'); return false; }
          const r = await SP.save({ kind, label: name.value, description: desc.value.trim() || undefined, apps: opts.apps || [opts.app], params });
          if (!r.ok) { s.toast(SP.errorText(r.errors)); return false; }
          s.toast('Saved preset “' + r.record.label + '”');
          if (opts.onSaved) opts.onSaved(r.record);
        } },
      ],
    });
    setTimeout(() => name.focus(), 0);
  };
})(typeof window !== 'undefined' ? window : globalThis);
