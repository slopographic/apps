/* The bar above the file list: "Select all", and once rows are selected "N selected · Convert to [..] · Remove". Its
 * Convert to offers only the formats every selected file can become (targets.js sharedTargets); when there are none it
 * says so plainly. Selection is the items' `selected` flag; a shift-click on a row's checkbox selects the range from the
 * last one clicked (tool.js select()).
 *   drawBulk(host, { items, selected, choices, target, onAll, onPick, onRemove, onNone }) */
import { h } from './dom.js';
import { targetButton } from './file-row.js';

export function drawBulk(host, { items, selected, choices, target, onAll, onPick, onRemove, onNone }) {
  host.hidden = items.length < 2 && !selected.length;
  if (host.hidden) { host.replaceChildren(); return; }
  const all = h('input', { type: 'checkbox', class: 'cv-file-check cv-bulk-allbox' });
  all.checked = selected.length > 0 && selected.length === items.length;
  all.indeterminate = selected.length > 0 && !all.checked;
  all.addEventListener('change', () => onAll(all.checked));
  const n = selected.length;
  const parts = [h('label', { class: 'cv-bulk-all' }, all, h('span', null, 'Select all'))];
  if (n) {
    parts.push(h('span', { class: 'cv-bulk-n', role: 'status' }, `${n} selected`));
    parts.push(choices.length
      ? h('div', { class: 'cv-file-to' }, h('span', { class: 'cv-file-to-h', 'aria-hidden': 'true' }, 'Convert to'),
        targetButton({ label: `Convert the ${n} selected file${n === 1 ? '' : 's'} to`, choices, target, onPick, empty: 'Choose', cls: 'cv-bulk-to' }))
      : h('p', { class: 'cv-bulk-none' }, `No format fits ${n === 1 ? 'the selected file' : `all ${n} selected files`}. Select files of one kind, or set each row.`));
    parts.push(h('button', { type: 'button', class: 'cv-btn cv-small cv-bulk-rm' }, 'Remove'));
    parts.push(h('button', { type: 'button', class: 'cv-btn cv-small cv-bulk-clear' }, 'Clear selection'));
  }
  host.replaceChildren(...parts);
  const rm = host.querySelector('.cv-bulk-rm'), none = host.querySelector('.cv-bulk-clear');
  if (rm) { rm.setAttribute('aria-label', `Remove the ${n} selected file${n === 1 ? '' : 's'}`); rm.addEventListener('click', onRemove); }
  if (none) none.addEventListener('click', onNone);
}
