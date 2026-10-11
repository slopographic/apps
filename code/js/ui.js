/* Slop Code: the chrome around the editor. Tabs, the empty state, the status bar, the Files drawer (a phone
 * drawer under 720 px), the preview pane and the SlopGuard "unsaved" flag. */
import * as docs from './docs.js';
import { renderTabs } from './tabs.js';
import { isWrap } from './editor.js';
import { langOf } from './lang.js';
import { renderOpenEditors } from './explorer.js';

export const $ = (id) => document.getElementById(id);
export const env = { view: null };
const handlers = { select: () => {}, close: () => {} };

export function setHandlers(h) { Object.assign(handlers, h); }
export const toast = (msg) => window.SlopUI && SlopUI.toast(msg);

/** Redraw the tabs, the empty state, the buttons, the status bar and the unsaved flag. */
export function renderChrome() {
  const list = docs.list(), cur = docs.current();
  const pick = { onSelect: (d) => handlers.select(d), onClose: (d) => handlers.close(d) };
  renderTabs($('cd-tabs'), list, cur, pick);
  renderOpenEditors($('cd-open-list'), list, cur, pick);
  $('cd-empty').hidden = list.length > 0;
  $('cd-editor').hidden = list.length === 0;
  $('cd-save').disabled = !cur;
  $('cd-saveas').disabled = !cur;
  $('cd-run').disabled = !cur;
  setStatus();
  if (window.SlopGuard && SlopGuard.setUnsaved) SlopGuard.setUnsaved('code', list.some((d) => d.dirty));
}

/** The status bar: language, cursor position, cursors, wrap and saved state. */
export function setStatus() {
  const cur = docs.current(), view = env.view, bar = $('cd-status');
  if (!cur || !view) { bar.textContent = ''; return; }
  const sel = view.state.selection, head = sel.main.head, line = view.state.doc.lineAt(head);
  const parts = [langOf(cur).label, `Ln ${line.number}, Col ${head - line.from + 1}`];
  if (sel.ranges.length > 1) parts.push(`${sel.ranges.length} cursors`);
  parts.push(isWrap() ? 'Wrap on' : 'Wrap off', cur.dirty ? 'Unsaved changes' : 'Saved to Slop Drive');
  bar.textContent = parts.join('  ·  ');
}

const phone = () => window.matchMedia('(max-width: 719px)').matches;
/** Show or hide the file tree: a drawer on a phone, a column on a desktop. */
export function setTreeOpen(on) {
  const app = $('cd-app');
  if (phone()) { app.classList.toggle('cd-drawer-open', !!on); $('cd-scrim').hidden = !on; }
  else app.classList.toggle('cd-tree-hidden', !on);
  $('cd-files').setAttribute('aria-expanded', on ? 'true' : 'false');
}
export const treeOpen = () => (phone() ? $('cd-app').classList.contains('cd-drawer-open') : !$('cd-app').classList.contains('cd-tree-hidden'));

/** The preview pane (the Run output and the console). */
export function setPreview(on) {
  $('cd-preview').hidden = !on;
  $('cd-app').classList.toggle('cd-pv-open', !!on);
}
