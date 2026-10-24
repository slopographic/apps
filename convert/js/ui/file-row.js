/* One row of the file list (li.cv-file): a checkbox to select it, the name and kind, its own "Convert to" menu (a
 * format tile and the conversion's name, shared/ui/menubutton.js, searchable by the conversions' keywords), Remove, and
 * the Options of its target (file-opts.js, drawn by the list). Also the menu control the bulk bar uses.
 *   fileRow(it, { reason, choices, target, selected, onPick, onSelect, options })
 *   targetButton({ label, choices, target, onPick, empty, cls })  -> button (a SlopMenuButton) */
import { h } from './dom.js';
import { fmtSize } from '../io/files.js';
import { KIND_LABEL } from '../core/detect.js';
import '../../../shared/ui/menubutton.js';   // window.SlopMenuButton
import '../../../shared/ui/flow.js';         // window.SlopFlow.tile

export const tileOf = (kind) => window.SlopFlow.tile(kind || 'file', { size: 'sm' });

/** Menu items from choices ({ id, label, ext, group }), grouped by kind the way the big picker groups them. */
function menuItems(choices, target) {
  const groups = new Map();
  for (const c of choices) { if (!groups.has(c.group)) groups.set(c.group, []); groups.get(c.group).push(c); }
  const many = groups.size > 1, out = [];
  for (const [name, list] of groups) {
    if (many) out.push({ heading: name });
    for (const c of list) out.push({ value: c.id, label: c.label, icon: tileOf(c.ext), checked: c.id === target, keywords: c.keywords || [] });
  }
  return out;
}

/** The compact "Convert to" control: shows the chosen format's tile and name, opens the menu of choices. */
export function targetButton({ label, choices, target, onPick, empty, cls = '' }) {
  const on = choices.find((c) => c.id === target);
  const b = h('button', { type: 'button', class: 'cv-to ' + cls, 'data-target': target || '', 'aria-label': `${label}: ${on ? on.label : empty}` },
    on ? tileOf(on.ext) : null,
    h('span', { class: 'cv-to-label' }, on ? on.label : empty),
    h('span', { class: 'cv-to-caret', 'aria-hidden': 'true' }, '▾'));
  if (!choices.length) { b.disabled = true; return b; }
  b.menu = window.SlopMenuButton.attach(b, { label, items: () => menuItems(choices, target), empty, onPick });
  return b;
}

export function fileRow(it, { reason, choices, target, selected, onPick, onSelect, options = null }) {
  const meta = `${KIND_LABEL[it.kind] || 'File'} · ${fmtSize(it.size)}`;
  const box = h('input', { type: 'checkbox', class: 'cv-file-check', 'data-select': it.id, 'aria-label': `Select ${it.name}`, checked: !!selected });
  box.addEventListener('click', (e) => onSelect(it, box.checked, e.shiftKey));
  const control = reason ? null : h('div', { class: 'cv-file-to' },
    h('span', { class: 'cv-file-to-h', 'aria-hidden': 'true' }, 'Convert to'),
    targetButton({ label: `Convert ${it.name} to`, choices, target, onPick: (id) => onPick(it, id), empty: 'No format' }));
  return h('li', { class: 'cv-file' + (reason ? ' cv-skip' : '') + (selected ? ' cv-selected' : ''), 'data-id': it.id },
    reason ? h('span', { class: 'cv-file-check-gap' }) : box,
    h('div', { class: 'cv-file-main' },
      h('span', { class: 'cv-file-name', text: it.name }),
      h('span', { class: 'cv-file-meta', text: meta })),
    control,
    h('button', { type: 'button', class: 'cv-btn cv-small cv-file-rm', 'data-remove': it.id, 'aria-label': `Remove ${it.name}` }, 'Remove'),
    options,
    reason ? h('p', { class: 'cv-file-msg' }, reason) : null,
    it.error ? h('p', { class: 'cv-file-msg cv-error', role: 'alert' }, it.error) : null);
}
