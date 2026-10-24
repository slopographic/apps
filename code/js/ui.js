/* Slop Code: the chrome around the editor. Tabs, the empty state, the status bar, the Files drawer (a phone
 * drawer under 720 px), the preview pane and the SlopGuard "unsaved" flag. */
import * as docs from './docs.js';
import { renderTabs } from './tabs.js';
import { isWrap } from './editor.js';
import { langOf } from './lang.js';
import { renderOpenEditors } from './explorer.js';
import { syncViewer } from './viewers.js';

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
  // The editor shows text tabs; a file view (picture, media, binary) or the Markdown preview takes its place.
  const text = !!cur && cur.kind === 'text', isMd = text && langOf(cur).id === 'markdown';
  if (cur && cur.preview && !isMd) cur.preview = false; // the language changed away from Markdown
  const other = !!cur && (cur.kind !== 'text' || !!cur.preview);
  $('cd-empty').hidden = list.length > 0;
  $('cd-editor').hidden = list.length === 0 || other;
  $('cd-viewer').hidden = !other;
  syncViewer(cur);
  $('cd-save').disabled = !text;
  $('cd-saveas').disabled = !text;
  $('cd-run').disabled = !text;
  const md = $('cd-md');
  md.hidden = !isMd;
  md.textContent = cur && cur.preview ? 'Edit' : 'Preview';
  md.setAttribute('aria-pressed', cur && cur.preview ? 'true' : 'false');
  setStatus();
  if (window.SlopGuard && SlopGuard.setUnsaved) SlopGuard.setUnsaved('code', list.some((d) => d.dirty));
}

/** The status bar: language, cursor position, cursors, wrap and saved state. */
export function setStatus() {
  const cur = docs.current(), view = env.view, bar = $('cd-status');
  if (!cur) { bar.textContent = ''; return; }
  if (cur.kind !== 'text') { bar.textContent = [cur.kind === 'binary' ? 'Not text' : cur.kind[0].toUpperCase() + cur.kind.slice(1), 'Read only here'].join('  ·  '); return; }
  if (!view) { bar.textContent = ''; return; }
  const sel = view.state.selection, head = sel.main.head, line = view.state.doc.lineAt(head);
  const parts = [langOf(cur).label, `Ln ${line.number}, Col ${head - line.from + 1}`];
  if (sel.ranges.length > 1) parts.push(`${sel.ranges.length} cursors`);
  parts.push(isWrap() ? 'Wrap on' : 'Wrap off', cur.dirty ? 'Unsaved changes' : 'Saved to Slop Drive');
  bar.textContent = parts.join('  ·  ');
}

export const isPhone = () => window.matchMedia('(max-width: 719px)').matches;
const phone = isPhone;
let drawer = null;
/** On a phone the Explorer is a drawer from the start edge: SlopSheet (shared/ui/sheet.js) gives it the Files button as
 * its toggle, the ×, Escape, a tap outside and a swipe left. */
export function initDrawer() {
  drawer = window.SlopSheet.attach({ root: $('cd-app'), panel: $('cd-tree'), side: 'start', phone: '(max-width: 719px)', toggles: [$('cd-files')], label: 'Explorer' });
}
/** Show or hide the file tree: a drawer on a phone, a column on a desktop. */
export function setTreeOpen(on) {
  if (phone()) { if (on) drawer.open(); else drawer.close(); return; }
  $('cd-app').classList.toggle('cd-tree-hidden', !on);
  $('cd-files').setAttribute('aria-expanded', on ? 'true' : 'false');
}
export const treeOpen = () => (phone() ? drawer.isOpen() : !$('cd-app').classList.contains('cd-tree-hidden'));

/** The preview pane (the Run output and the console). */
export function setPreview(on) {
  $('cd-preview').hidden = !on;
  $('cd-app').classList.toggle('cd-pv-open', !!on);
}
