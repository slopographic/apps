/* Sheet tabs: switch, add, rename (double-click or menu), delete, and a right-click menu. */
import { S, $, redraw, toast } from './state.js';
import { transact } from './history.js';
import { commitEdit } from './editor.js';

export function render() {
  const frag = document.createDocumentFragment();
  S.wb.sheets.forEach((sh, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab' + (i === S.si ? ' on' : '');
    b.textContent = sh.name;
    b.title = sh.name + ' (double-click to rename)';
    b.dataset.i = i;
    b.addEventListener('click', () => select(i));
    b.addEventListener('dblclick', () => rename(i));
    b.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      window.SlopUI.menu([{ label: 'Rename…', act: () => rename(i) }, { label: 'Delete sheet', act: () => remove(i) }, '-', { label: 'Add sheet', act: add }], e.clientX, e.clientY);
    });
    frag.append(b);
  });
  const plus = document.createElement('button');
  plus.type = 'button'; plus.className = 'tab tab-add'; plus.textContent = '+'; plus.title = 'Add sheet';
  plus.addEventListener('click', add);
  frag.append(plus);
  $('tabs').replaceChildren(frag);
}

export function select(i) {
  if (S.edit && !commitEdit()) return;
  if (i === S.si) { redraw(); return; }
  S.si = i;
  S.wb.active = i;
  S.sel = { r: 0, c: 0, er: 0, ec: 0 };
  const vp = $('vp');
  vp.scrollTop = 0; vp.scrollLeft = 0;
  redraw();
}

export function add() {
  if (S.edit && !commitEdit()) return;
  transact(() => S.wb.addSheet());
  select(S.wb.sheets.length - 1);
}

export async function rename(i = S.si) {
  const sh = S.wb.sheets[i];
  const name = await window.SlopUI.prompt('Rename sheet', 'Sheet name', sh.name, { ok: 'Rename' });
  if (name === null || name.trim() === sh.name) return;
  try { transact(() => S.wb.renameSheet(sh, name)); }
  catch (err) { toast(err.message); }
}

export async function remove(i = S.si) {
  const sh = S.wb.sheets[i];
  if (S.wb.sheets.length < 2) { toast('A workbook needs at least one sheet'); return; }
  const ok = await window.SlopUI.confirm('Delete sheet', `Delete “${sh.name}” and everything on it?`, 'Delete', { danger: true });
  if (!ok) return;
  transact(() => S.wb.removeSheet(sh));
  S.si = Math.min(S.si, S.wb.sheets.length - 1);
  select(S.si);
}
