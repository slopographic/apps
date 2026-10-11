/* Builds the option controls for a conversion from its spec list, and reads their values back.
 * Every control has a label; hints are linked with aria-describedby. */
import { h } from './dom.js';

const idOf = (key) => `cv-o-${key}`;

export function renderOptions(container, specs, defaults = {}) {
  container.replaceChildren();
  container.closest('fieldset').hidden = !specs.length;
  for (const s of specs) {
    const id = idOf(s.key);
    const value = defaults[s.key] !== undefined ? defaults[s.key] : s.value;
    const hint = s.hint ? h('p', { class: 'cv-hint', id: `${id}-hint` }, s.hint) : null;
    const describe = s.hint ? `${id}-hint` : null;
    let control, wrap;
    if (s.type === 'checkbox') {
      control = h('input', { type: 'checkbox', id, checked: !!value, 'aria-describedby': describe });
      wrap = h('div', { class: 'cv-opt cv-check' }, h('label', { for: id }, control, ' ', s.label), hint);
    } else if (s.type === 'select') {
      control = h('select', { id, 'aria-describedby': describe }, s.options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
      wrap = h('div', { class: 'cv-opt' }, h('label', { for: id }, s.label), control, hint);
    } else if (s.type === 'range') {
      const out = h('output', { for: id }, String(value));
      control = h('input', { type: 'range', id, min: s.min, max: s.max, step: 1, value, 'aria-describedby': describe, oninput: () => { out.textContent = control.value; } });
      wrap = h('div', { class: 'cv-opt' }, h('label', { for: id }, s.label, ' ', out), control, hint);
    } else if (s.type === 'color') {
      control = h('input', { type: 'color', id, value, 'aria-describedby': describe });
      wrap = h('div', { class: 'cv-opt' }, h('label', { for: id }, s.label), control, hint);
    } else {
      control = h('input', { type: s.type === 'number' ? 'number' : 'text', id, min: s.min, max: s.max, placeholder: s.placeholder, value: value ?? '', 'aria-describedby': describe, inputmode: s.type === 'number' ? 'numeric' : undefined });
      wrap = h('div', { class: 'cv-opt' }, h('label', { for: id }, s.label), control, hint);
    }
    container.append(wrap);
  }
}

/** Current values as { key: value }. Numbers are numbers, blank number fields are undefined, checkboxes are booleans. */
export function readOptions(container, specs) {
  const out = {};
  for (const s of specs) {
    const el = container.querySelector(`#${idOf(s.key)}`);
    if (!el) continue;
    if (s.type === 'checkbox') out[s.key] = el.checked;
    else if (s.type === 'number') out[s.key] = el.value === '' ? undefined : Number(el.value);
    else out[s.key] = el.value;
  }
  return out;
}
