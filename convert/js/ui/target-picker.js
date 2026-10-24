/* The "Convert to" picker: every format the files can become, as file tiles grouped by kind (Spreadsheets, Images…),
 * one click or the arrow keys to choose. The hidden <select> (#cv-target) stays the one holder of the choice: the
 * picker is drawn from the same candidates and sets it (tool.js), so the code and tests that read the select keep working.
 *   drawPicker(host, cands, value, onPick, emptyText)   host is the radiogroup; cands are catalog entries ({ id, label,
 *     group, ext }); onPick(id) when a tile is chosen; emptyText when there is nothing to choose yet.
 *   focusPicker(host)   brings the picker into view and focuses the chosen tile (the flow picture's ▾ calls it). */
import { h } from './dom.js';

const tileOf = (kind) => (window.SlopFlow && window.SlopFlow.tile ? window.SlopFlow.tile(kind, { size: 'sm' }) : h('span', { class: 'cv-pick-ext' }, String(kind || '').toUpperCase()));

export function drawPicker(host, cands, value, onPick, emptyText) {
  if (!cands.length) { host.replaceChildren(h('p', { class: 'cv-pick-empty' }, emptyText)); return; }
  const groups = new Map();
  for (const c of cands) { const g = c.group || 'Other'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(c); }
  const many = groups.size > 1;
  host.replaceChildren(...[...groups].map(([name, list]) => h('div', { class: 'cv-pick-group' },
    many ? h('p', { class: 'cv-pick-h' }, name) : null,
    h('div', { class: 'cv-pick-row' }, ...list.map((c) => {
      const on = c.id === value;
      const b = h('button', { type: 'button', class: 'cv-pick', role: 'radio', 'aria-checked': String(on), tabindex: on ? 0 : -1, 'data-id': c.id },
        tileOf(c.ext || 'file'), h('span', { class: 'cv-pick-label' }, c.label));   // no fixed output kind: a plain FILE tile
      b.addEventListener('click', () => onPick(c.id));
      return b;
    })))));
  if (!host.querySelector('[aria-checked="true"]')) { const first = host.querySelector('.cv-pick'); if (first) first.tabIndex = 0; }
  if (!host.dataset.keys) {   // arrow keys move the choice across every group, like one radio group
    host.dataset.keys = '1';
    host.addEventListener('keydown', (e) => {
      const all = [...host.querySelectorAll('.cv-pick')], i = all.indexOf(document.activeElement);
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (i < 0 || !step) return;
      e.preventDefault();
      const next = all[(i + step + all.length) % all.length];
      next.click();
      const again = host.querySelector(`[data-id="${next.dataset.id}"]`);
      if (again) again.focus();
    });
  }
}

export function focusPicker(host) {
  const on = host.querySelector('.cv-pick[aria-checked="true"]') || host.querySelector('.cv-pick');
  try { host.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* older browsers */ }
  if (on) on.focus({ preventScroll: true });
  host.classList.remove('cv-pick-flash'); void host.offsetWidth; host.classList.add('cv-pick-flash');
}
