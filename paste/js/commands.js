/* Slop Pastebin commands (SlopCmd: palette, shortcut editor and menu labels) and the right-click menus for pastes. */
import * as A from './actions.js';
import { S, byId, current } from './state.js';
import { $ } from './dom.js';

const has = () => !!current();

export function commandList() {
  const C = (id, title, group, keys, extra = {}) => Object.assign({ id: 'paste.' + id, title, group, keys, run: () => {} }, extra);
  return [
    C('new', 'New paste', 'File', ['Mod+Alt+N'], { keywords: ['create', 'text'], run: () => A.newPaste({ kind: 'text' }) }),
    C('image', 'Add image paste…', 'File', [], { keywords: ['picture', 'photo', 'upload'], run: () => A.addImage() }),
    C('copy', 'Copy paste', 'File', [], { keywords: ['clipboard'], when: has, run: () => A.copy(current()) }),
    C('download', 'Download paste', 'File', [], { keywords: ['save', 'file'], when: has, run: () => A.download(current()) }),
    C('share', 'Copy share link', 'File', ['Mod+Alt+L'], { keywords: ['link', 'url', 'share'], when: has, run: () => A.share(current()) }),
    C('delete', 'Move paste to Trash', 'Edit', [], { keywords: ['remove', 'delete'], when: has, run: () => A.remove(current()) }),
    C('find', 'Search pastes', 'Edit', ['Mod+Shift+F'], { keywords: ['find', 'filter'], run: () => $('pb-q').focus() }),
    C('next', 'Next paste', 'Go', ['Mod+Alt+ArrowDown'], { keywords: ['down'], run: () => A.step(1) }),
    C('prev', 'Previous paste', 'Go', ['Mod+Alt+ArrowUp'], { keywords: ['up'], run: () => A.step(-1) }),
  ];
}

export function registerCommands() {
  if (!window.SlopCmd) return;
  SlopCmd.init({ app: 'paste' });
  SlopCmd.register(commandList());
}

/** The menu for a paste in the list: Open, Copy, Download, Share link, Trash. */
export function menuFor(id) {
  const p = byId(id);
  if (!p) return null;
  return [
    { label: 'Open paste', act: () => A.open(id) },
    { label: 'Copy', act: () => A.copy(p) },
    { label: 'Download', act: () => A.download(p) },
    { label: 'Copy share link', key: window.SlopCtx ? SlopCtx.keyFor('paste.share') : '', act: () => A.share(p) },
    '-',
    { label: 'Move to Trash…', act: () => A.remove(p) },
  ];
}

/** Resolves the right-click or Menu key target: the nearest list item (data-kind="paste"). */
export function resolveMenu(target) {
  const item = target && target.closest ? target.closest('[data-kind="paste"]') : null;
  return item && S.pastes.length ? menuFor(item.dataset.id) : null;
}
