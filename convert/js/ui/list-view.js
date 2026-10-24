/* Draws the tool's lists: the files (one row each with its own Convert to, file-row.js), the bulk bar for the selected
 * rows (bulk.js), and the converted files with their Download links. Focus survives the redraw (focus.js).
 *   drawFiles(tool)               tool is the ConvertTool (its items, targets and handlers)
 *   drawResults(ui, outputs) */
import { h } from './dom.js';
import { fmtSize } from '../io/files.js';
import { choicesFor, sharedTargets, commonTarget } from './targets.js';
import { fileRow } from './file-row.js';
import { drawBulk } from './bulk.js';
import { keepFocus } from './focus.js';

const choice = (c) => ({ id: c.id, label: c.label, ext: c.ext || 'file', group: c.group || 'Other' });

export function drawFiles(tool) {
  const ui = tool.ui, act = tool.active(), only = tool.only;
  keepFocus([ui.list, ui.bulk], ui.drop, () => {
    ui.list.replaceChildren(...(tool.items.length ? tool.items.map((it) => {
      const reason = tool.skipReason(it);
      return fileRow(it, { reason, choices: reason ? [] : choicesFor(it, act, only), target: reason ? '' : tool.targetOf(it), selected: !reason && it.selected,
        onPick: (x, id) => tool.rowPick(x, id), onSelect: (x, on, range) => tool.select(x, on, range) });
    }) : [h('li', { class: 'cv-empty' }, 'No files yet.')]));
    const sel = tool.selected();
    const every = (on) => { for (const i of act) i.selected = on; tool.render(); };
    drawBulk(ui.bulk, { items: act, selected: sel, target: commonTarget(sel, act, only), choices: sharedTargets(sel, only).map(choice),
      onAll: every, onNone: () => every(false), onPick: (id) => tool.bulkPick(id),
      onRemove: () => { tool.items = tool.items.filter((i) => !sel.includes(i)); tool.render(); } });
  });
}

export function drawResults(ui, outputs) {
  ui.results.hidden = !outputs.length;
  ui.zip.hidden = outputs.length < 2;
  ui.outList.replaceChildren(...outputs.map((o) => h('li', { class: 'cv-out-item' },
    h('span', { class: 'cv-file-name', text: o.name }),
    h('span', { class: 'cv-file-meta', text: fmtSize(o.blob.size) }),
    h('a', { class: 'cv-btn cv-small cv-primary', href: o.url, download: o.name }, 'Download'))));
}
