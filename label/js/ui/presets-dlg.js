/* SlopLabel — ui/presets-dlg: File ▸ Presets…, the gallery of built-in label presets (A4 sheets, rolls and single labels) and the
 * user's own presets (saved from a config). Each has a preview of its page. A preset opens in a new tab, or is applied to the
 * open label as one undo step. Classic script; uses core/presets.js, configs-dlg.js and the helpers of ui/dialogs.js. */
'use strict';

/** A preset opens in a new tab ('tab') or is applied to the open label ('apply'). */
function presetChoice(p, how) {
  if (how === 'apply') { applyConfigToLabel(p.name, p.body); return; }
  const T = openDocTab(docFromConfig(p.body, p.name), { label: 'New from preset', dirty: true });
  SlopUI.toast(`Opened “${p.name}” in a new tab`);
  return T;
}

/** File ▸ Presets…: the gallery. */
function presetsDialog() {
  let dlg;
  const tile = (p, mine) => {
    const b = p.body, slots = presetSlots(b);
    const preview = mk('span', { class: 'tp' });
    preview.innerHTML = presetPreviewSvg(b, p.name); // numbers and the escaped name only (core/presets.js)
    const round = b.label.radius >= Math.min(b.label.w, b.label.h) / 2 - 0.01; // a round label, not just rounded corners
    const meta = [b.stock.kind === 'sheet' ? `${slots} per sheet` : null, round ? 'round' : null].filter(Boolean).join(' · ');
    const acts = mk('div', { class: 'cfg-acts' },
      fBtn('New tab', () => { dlg.close(true); presetChoice(p, 'tab'); }, { cls: 'primary' }),
      fBtn('This tab', () => { dlg.close(true); presetChoice(p, 'apply'); }),
      mine ? fBtn('Remove', async () => { if (!(await SlopUI.confirm('Remove this preset?', `“${p.name}” is removed from this browser.`, 'Remove', { danger: true }))) return; LabelConfigs.removePreset(p.id); dlg.close(true); presetsDialog(); }) : null);
    return mk('div', { class: 'tpl pst' }, preview, mk('b', null, p.name), mk('small', null, [p.desc, meta].filter(Boolean).join(' · ')), acts);
  };
  const groups = PRESET_GROUPS.map((g) => mk('div', { class: 'pst-group' }, mk('h4', { class: 'sec-h' }, g),
    mk('div', { class: 'tpl-grid' }, ...PRESETS.filter((p) => p.group === g).map((p) => tile(p, false)))));
  const mine = LabelConfigs.presets;
  if (mine.length) groups.push(mk('div', { class: 'pst-group' }, mk('h4', { class: 'sec-h' }, 'Your presets'),
    mk('div', { class: 'tpl-grid' }, ...mine.map((r) => tile({ id: r.id, name: r.name, desc: 'Saved from a config', group: 'mine', body: r.body }, true)))));
  dlg = SlopUI.dialog({ title: 'Presets', cls: 'sl-wide', body: mk('div', null,
    mk('p', { class: 'sui-p' }, 'Pick a preset to start a new tab with that layout, or apply it to this tab (one undo step). Sheet sizes follow the stock library; a sheet’s labels are checked to fit its page.'),
    ...groups),
  buttons: [{ label: 'Close', primary: true }] });
}
