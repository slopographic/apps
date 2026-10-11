/* Slop Code: the tab strip. A dot marks unsaved text. Each tab is a button, and its close button is labelled. */
import { el } from './dom.js';

/** Redraw the tabs. `onSelect(doc)` and `onClose(doc)` are called from the buttons. */
export function renderTabs(host, docs, activeDoc, { onSelect, onClose }) {
  host.replaceChildren();
  for (const d of docs) {
    const on = d === activeDoc;
    const tab = el('div', { class: 'cd-tab' + (on ? ' on' : ''), role: 'presentation' },
      el('button', { type: 'button', role: 'tab', 'aria-selected': on ? 'true' : 'false', class: 'cd-tab-name',
        title: d.name + (d.dirty ? ' (unsaved)' : ''), onclick: () => onSelect(d) }, d.name,
        d.dirty ? el('span', { class: 'cd-dirty', 'aria-label': 'unsaved' }, '•') : null),
      el('button', { type: 'button', class: 'cd-tab-x', 'aria-label': 'Close ' + d.name, title: 'Close', onclick: () => onClose(d) }, '×'));
    host.append(tab);
  }
  const act = host.querySelector('.cd-tab.on');
  if (act && act.scrollIntoView) act.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
