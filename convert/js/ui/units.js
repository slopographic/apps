/* Units widget: type a number, pick the units, read the exact answer. Built with the DOM helper. */
import { categories, convert } from '../core/units.js';
import { h } from './dom.js';

export function mountUnits(root) {
  const cats = categories();
  const cat = h('select', { id: 'cv-u-cat' }, cats.map((c) => h('option', { value: c.key }, c.label)));
  const value = h('input', { id: 'cv-u-value', type: 'text', inputmode: 'decimal', value: '1', 'aria-describedby': 'cv-u-note' });
  const from = h('select', { id: 'cv-u-from' });
  const to = h('select', { id: 'cv-u-to' });
  const out = h('output', { id: 'cv-u-out', for: 'cv-u-value', 'aria-live': 'polite', class: 'cv-u-out' });
  const note = h('p', { id: 'cv-u-note', class: 'cv-hint' }, 'Exact when the answer has a finite decimal form. Otherwise rounded to 12 decimal places and marked ≈.');
  const fill = () => {
    const c = cats.find((x) => x.key === cat.value);
    from.replaceChildren(...c.units.map((u) => h('option', { value: u.key }, u.label)));
    to.replaceChildren(...c.units.map((u) => h('option', { value: u.key }, u.label)));
    to.selectedIndex = Math.min(1, c.units.length - 1);
    calc();
  };
  const calc = () => {
    try {
      const r = convert(cat.value, from.value, to.value, value.value.trim() || '0');
      out.textContent = `${r.exact ? '' : '≈ '}${r.text}`;
      out.classList.remove('cv-error');
    } catch (e) {
      out.textContent = e.message;
      out.classList.add('cv-error');
    }
  };
  const swap = h('button', { type: 'button', class: 'cv-btn', onclick: () => { const a = from.value; from.value = to.value; to.value = a; calc(); } }, 'Swap units');
  cat.addEventListener('change', fill);
  for (const el of [from, to, value]) {
    el.addEventListener('input', calc);
    el.addEventListener('change', calc);
  }
  root.replaceChildren(h('form', { class: 'cv-units', onsubmit: (e) => { e.preventDefault(); calc(); }, 'aria-label': 'Unit converter' },
    h('div', { class: 'cv-opt' }, h('label', { for: 'cv-u-cat' }, 'Category'), cat),
    h('div', { class: 'cv-unit-row' },
      h('div', { class: 'cv-opt' }, h('label', { for: 'cv-u-value' }, 'Value'), value),
      h('div', { class: 'cv-opt' }, h('label', { for: 'cv-u-from' }, 'From'), from)),
    h('div', { class: 'cv-unit-row' }, swap, h('div', { class: 'cv-opt' }, h('label', { for: 'cv-u-to' }, 'To'), to)),
    h('div', { class: 'cv-result' }, h('span', { class: 'cv-result-label' }, 'Result'), out),
    note));
  fill();
}
