/* Autosave draft in this browser's IndexedDB (per-viewer convenience only, never the real copy).
   Written about 0.6 s after the last change; read back on a plain start with no ?drive=. */
import { S, on } from './state.js';
import { toNative } from '../io/native.js';

const DB = 'slop-tables-drafts', STORE = 'drafts', KEY = 'current';
let timer = null;

function open() {
  return new Promise((res, rej) => {
    if (!window.indexedDB) { rej(new Error('no IndexedDB')); return; }
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function run(mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(STORE, mode), req = fn(t.objectStore(STORE));
    t.oncomplete = () => { d.close(); res(req && req.result); };
    t.onerror = () => { d.close(); rej(t.error); };
  });
}

export const readDraft = () => run('readonly', (s) => s.get(KEY));
export const clearDraft = () => run('readwrite', (s) => s.delete(KEY));

export function writeDraftNow() {
  if (!S.wb) return;
  try {
    run('readwrite', (s) => s.put({ json: JSON.stringify(toNative(S.wb)), name: S.file.name, driveId: S.file.driveId, folderId: S.file.folderId, time: Date.now() }, KEY))
      .catch(() => { /* storage blocked: the workbook still works, it is just not kept */ });
  } catch (e) { /* ignore */ }
}

/** Keep the draft in step with the workbook. */
export function init() {
  const later = () => { clearTimeout(timer); timer = setTimeout(writeDraftNow, 600); };
  on('change', later);
  on('open', later);
}
