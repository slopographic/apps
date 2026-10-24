/* Draws the tool's lists: the files (one row each with its own Convert to and Options, file-row.js and file-opts.js),
 * the bulk bar for the selected rows (bulk.js), and the converted files with their Download links. Focus survives the
 * redraw (focus.js).
 *   drawFiles(tool, { bulk })     tool is the ConvertTool (its items, targets and handlers); bulk: false keeps the bar
 *   drawResults(ui, outputs) */
import { h } from './dom.js';
import { fmtSize } from '../io/files.js';
import { choicesFor, sharedTargets, commonTarget, keywordsOf, WITH } from './targets.js';
import { conversionById } from '../core/catalog.js';
import { optionsBox } from './file-opts.js';
import { fileRow } from './file-row.js';
import { drawBulk } from './bulk.js';
import { keepFocus } from './focus.js';

const choice = (c) => ({ id: c.id, label: c.label, ext: c.ext || 'file', group: c.group || 'Other', keywords: keywordsOf(c) });

/** A card's Options: the options of its own target, with its own values. */
function rowOptions(tool, it, target) {
  const conv = target && target !== WITH ? conversionById(target) : null;
  return optionsBox({ conv, values: tool.valuesOf(it, conv), prefix: `${it.id}-`, label: 'Options', open: it.optsOpen,
    onToggle: (o) => { it.optsOpen = o; }, onChange: (v, final) => tool.rowOptions(it, conv, v, final) });
}

export function drawFiles(tool, { bulk = true } = {}) {
  const ui = tool.ui, act = tool.active(), only = tool.only;
  keepFocus(bulk ? [ui.list, ui.bulk] : [ui.list], ui.drop, () => {
    ui.list.replaceChildren(...(tool.items.length ? tool.items.map((it) => {
      const reason = tool.skipReason(it), target = reason ? '' : tool.targetOf(it);
      return fileRow(it, { reason, choices: reason ? [] : choicesFor(it, act, only), target, selected: !reason && it.selected,
        onPick: (x, id) => tool.rowPick(x, id), onSelect: (x, on, range) => tool.select(x, on, range), options: reason ? null : rowOptions(tool, it, target) });
    }) : [h('li', { class: 'cv-empty' }, 'No files yet.')]));
    if (!bulk) return;
    const sel = tool.selected(), common = commonTarget(sel, act, only), conv = common ? conversionById(common) : null;
    const every = (on) => { for (const i of act) i.selected = on; tool.render(); };
    const options = sel.length > 1 && conv ? optionsBox({ conv, values: tool.valuesOf(sel[0], conv), prefix: `${tool.ns === 'cv' ? '' : tool.ns}bulk-`, cls: 'cv-bulk-opts',
      label: `Options for the ${sel.length} selected`, open: tool.bulkOptsOpen, onToggle: (o) => { tool.bulkOptsOpen = o; },
      onChange: (v, final) => tool.bulkOptions(sel.filter((i) => tool.targetOf(i) === conv.id), conv, v, final) }) : null;
    drawBulk(ui.bulk, { items: act, selected: sel, target: common, choices: sharedTargets(sel, only).map(choice), options,
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
