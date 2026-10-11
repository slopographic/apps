/* Undo and redo by workbook snapshots. A snapshot is the native JSON of the whole workbook plus the
   active sheet and selection. transact(fn) records one undo step if fn changed anything. */
import { S, changed } from './state.js';
import { toNative, fromNative } from '../io/native.js';

const LIMIT = 200;
let undoList = [], redoList = [];
const json = () => JSON.stringify(toNative(S.wb));
const snap = () => ({ json: json(), si: S.si, sel: { ...S.sel } });

/** Run fn as one undoable step. Returns fn's result. */
export function transact(fn) {
  const before = snap();
  try { return fn(); } finally {
    if (json() !== before.json) {
      undoList.push(before);
      if (undoList.length > LIMIT) undoList.shift();
      redoList = [];
      changed();
    }
  }
}
/** Start of a step that is finished later with commitStep(before) (drags). */
export const beginStep = () => snap();
export function commitStep(before) {
  if (json() === before.json) return;
  undoList.push(before); redoList = [];
  changed();
}
function restore(s) {
  S.wb = fromNative(JSON.parse(s.json));
  S.si = Math.min(s.si, S.wb.sheets.length - 1);
  S.sel = { ...s.sel };
  S.edit = null;
  changed();
}
export function undo() { if (!undoList.length) return false; redoList.push(snap()); restore(undoList.pop()); return true; }
export function redo() { if (!redoList.length) return false; undoList.push(snap()); restore(redoList.pop()); return true; }
export const canUndo = () => undoList.length > 0;
export const canRedo = () => redoList.length > 0;
/** Forget all steps (after opening a file). */
export function resetHistory() { undoList = []; redoList = []; }
