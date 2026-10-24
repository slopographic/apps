/* Slop Tables: files dropped on the window open as workbooks (SlopDrop: the outline, the "Drop to add" label, refusals
 * with a reason and the result toast). .stab, .xlsx, .xlsm, .ods, .csv and .tsv; each opens in its own tab through
 * storage.js openFile. The strip under the sheet tabs is hidden at rest and shows only while files are read. A drag of the
 * shared copy buffer (not a file) is still the paste of ui/buffer.js. */
import { $ } from './state.js';
import { openFile, OPEN_EXTS, SHEET_TYPES } from './storage.js';
import { MIME } from '../io/native.js';

let drop = null;
export function wireDrop() {
  const D = window.SlopDrop, zone = $('dropZone');
  if (!D || !zone) return null;
  drop = D.attach(zone, {
    accept: { types: [MIME, ...SHEET_TYPES, 'text/csv', 'text/tab-separated-values', 'application/vnd.ms-excel'], exts: OPEN_EXTS, noun: 'a spreadsheet' },
    limit: 10,
    compact: true,
    label: 'Drop a spreadsheet to open it',
    targets: [$('grid')],
    process: async (file) => { await openFile(file); return file.name; },
  });
  return drop;
}
export const dropper = () => drop;
