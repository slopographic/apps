/* Slop Transcribe: the files to transcribe and what came out of each, read one after another. The engine is passed in
 * (app.js gives the Whisper engine of Slop AI Tools; the tests give a fake), so the queue itself has no page or worker.
 *   const q = createQueue({ engine, onChange })
 *     engine: { prepare(onStatus), samples(file) -> Float32Array (16 kHz mono), transcribe(samples, language, onProgress) -> { segments, language } }
 *   q.add(files) -> the new items; q.remove(id); q.clear(); q.get(id); q.items (a copy); q.busy
 *   q.run({ language }) reads every waiting (or failed) item in turn; q.stop() stops after the current one
 *   q.edit(id, text) keeps the person's corrected text for an item (exports use it; times stay with the segments)
 * An item: { id, name, file, size, seconds, status: waiting | reading | done | error, progress (0..1), segments, language,
 * text (corrected text or null), error }. */
export const MAX_SECONDS = 2 * 3600;
export const RATE = 16000;
const AUDIO = /^(audio|video)\//, EXT = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|weba|webm|mp4|m4v|mov|mkv|3gp|amr|wma)$/i;

/** Pure: can this file be transcribed (an audio or video file by its type, or by its name: some browsers give no type)? */
export const isMedia = (f) => !!f && (AUDIO.test(f.type || '') || EXT.test(f.name || ''));

export function createQueue({ engine, onChange = () => {} }) {
  let items = [], seq = 0, busy = false, stopping = false;
  const changed = () => onChange(api);
  const find = (id) => items.find((x) => x.id === id) || null;

  function add(files) {
    const added = [...files].filter(isMedia).map((file) => ({
      id: ++seq, name: file.name || `Recording ${seq}`, file, size: file.size || 0, seconds: null,
      status: 'waiting', progress: 0, segments: [], language: null, text: null, error: null,
    }));
    items = items.concat(added);
    changed();
    return added;
  }
  function remove(id) { if (busy && find(id) && find(id).status === 'reading') return false; items = items.filter((x) => x.id !== id); changed(); return true; }
  function clear() { if (busy) return false; items = []; changed(); return true; }
  function edit(id, text) { const it = find(id); if (it) it.text = text; }

  /** One item: decode, check the length, transcribe with progress. Errors stay on the item; the queue goes on. */
  async function one(it, language) {
    it.status = 'reading'; it.progress = 0; it.error = null; changed();
    try {
      const samples = await engine.samples(it.file);
      it.seconds = samples.length / RATE;
      if (it.seconds > MAX_SECONDS) throw new Error('It is longer than 2 hours. Split it into shorter parts.');
      if (it.seconds < 0.5) throw new Error('It is too short to transcribe.');
      const r = await engine.transcribe(samples, language, (p) => { it.progress = p.total ? p.done / p.total : 0; changed(); });
      Object.assign(it, { segments: r.segments || [], language: r.language || null, status: 'done', progress: 1, text: null });
    } catch (e) {
      Object.assign(it, { status: 'error', error: (e && e.message) || String(e), progress: 0 });
    }
    changed();
  }

  async function run({ language = 'auto', onStatus } = {}) {
    if (busy) return false;
    const todo = items.filter((x) => x.status === 'waiting' || x.status === 'error');
    if (!todo.length) return false;
    busy = true; stopping = false; changed();
    try {
      await engine.prepare(onStatus);
      for (const it of todo) {
        if (stopping) break;
        if (find(it.id)) await one(it, language);
      }
    } finally { busy = false; stopping = false; changed(); }
    return true;
  }

  const api = {
    add, remove, clear, edit, run,
    stop() { if (busy) stopping = true; },
    get: (id) => find(id),
    get items() { return items.slice(); },
    get busy() { return busy; },
  };
  return api;
}
