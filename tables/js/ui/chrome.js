/* The parts around the grid: toolbar state, name box, formula bar, status bar and the file name. */
import { S, $, range, redraw, toast, changed } from './state.js';
import { canUndo, canRedo } from './history.js';
import { activeStyle, stats } from './actions.js';
import { syncBar } from './editor.js';
import { moveTo } from './nav.js';
import { parseRange, addr } from '../engine/refs.js';
import { NUMBER_FORMATS } from './numfmt.js';
import * as Sheets from './sheets.js';
import { fileName } from './storage.js';

export function init() {
  const nb = $('namebox');
  nb.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const p = parseRange(nb.value.trim());
    if (!p) { toast('Type a cell like B7 or a range like A1:C9'); return; }
    moveTo(p.r1, p.c1);
    S.sel.er = p.r2; S.sel.ec = p.c2;
    nb.blur(); redraw();
  });
  const nf = $('nf');
  nf.replaceChildren(...NUMBER_FORMATS.map(([label, code]) => new Option(label, code)));
  const title = $('fileName');
  title.addEventListener('change', () => { S.file.name = title.value.trim() || 'Untitled spreadsheet'; changed(); }); // the tab takes the new name
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
}

export function render() {
  $('btnUndo').disabled = !canUndo();
  $('btnRedo').disabled = !canRedo();
  const st = activeStyle();
  $('btnBold').setAttribute('aria-pressed', String(!!st.b));
  $('btnBold').classList.toggle('on', !!st.b);
  $('btnItalic').setAttribute('aria-pressed', String(!!st.i));
  $('btnItalic').classList.toggle('on', !!st.i);
  const nf = $('nf'), code = st.nf || 'General';
  if (![...nf.options].some((o) => o.value === code)) nf.append(new Option('Custom: ' + code, code));
  if (nf.value !== code) nf.value = code;
  const nb = $('namebox');
  if (document.activeElement !== nb) {
    const g = range();
    nb.value = addr(g.r1, g.c1) + (g.r1 === g.r2 && g.c1 === g.c2 ? '' : ':' + addr(g.r2, g.c2));
  }
  syncBar();
  const s = stats();
  $('status').textContent = s && s.count ? `Count ${s.count}` + (s.nums ? `   Sum ${fmtNum(s.sum)}   Average ${fmtNum(s.avg)}` : '') : '';
  const title = $('fileName');
  if (document.activeElement !== title) title.value = S.file.name;
  $('saveState').textContent = S.file.dirty ? 'Unsaved changes' : S.file.driveId ? 'Saved to Slop Drive' : 'Not saved yet';
  $('saveState').classList.toggle('dirty', !!S.file.dirty);
  document.title = (S.file.dirty ? '• ' : '') + fileName() + ' — Slop Tables';
  Sheets.render();
}

const fmtNum = (n) => (Number.isInteger(n) ? String(n) : (Math.round(n * 1e6) / 1e6).toLocaleString());
