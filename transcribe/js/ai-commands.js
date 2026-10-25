/* Slop Transcribe's commands with arguments (shared/commands/args.js): the Ctrl+K palette, the Slop AI panel (the header's
 * AI button), WebMCP and macros all get their tools from these (shared/ai/cmdtools.js). Each one calls the page's own
 * actions (app.js: add, run, select; the queue; exports.js fileOf; SlopAITools.toDrive), never a second copy of them.
 * new_batch clears the list and starts again, with Drive files and a language and model for them.
 * From the palette a command gets args = null and does what its button does.
 *   wireCommands({ queue, add, run, select, current, draw, say, models, catalog, tools, languages })
 * Ids start with "tr.". Transcribe reports its progress in the status line and stops (after the current file) when
 * ctx.signal aborts. The rollback the assistant's "Undo all AI changes" uses brings back the corrected texts only: files
 * removed or cleared, and transcripts read again, do not come back. */
import { fileOf, textOf, FORMATS } from './exports.js';
import { isMedia } from './queue.js';

export function wireCommands({ queue: q, add, run, select, current, draw, say, models, catalog: C, tools: T, languages }) {
  const S = window.SlopCmd;
  if (!S || !S.register) return null;
  S.init({ app: 'transcribe' });
  const $ = (id) => document.getElementById(id);
  const FILE = { name: 'file', type: 'number', integer: true, min: 1, max: 1e9, description: 'file id from app_state; the selected file when left out' };
  const LANG = { name: 'language', type: 'enum', options: [['auto', 'Detect automatically'], ...languages.map((l) => [l.code, l.name])],
    description: "'auto' finds the language, or a Whisper language code such as en, sv, de (an English name works too); the language chosen in the app when left out" };
  const MODEL = { name: 'model', type: 'enum', values: C.MODELS.map((m) => m.id), description: 'Whisper model id; it must be downloaded already. The quick model or your chosen one when left out' };

  /** The file a command works on: the id given, else the selected one. */
  function itemOf(id, { done = false } = {}) {
    const it = id != null ? q.get(id) : current();
    if (!it) throw new Error(id != null ? `There is no file ${id}. Use app_state for the ids.` : 'No file is selected. Add a file first.');
    if (done && it.status !== 'done') throw new Error(`“${it.name}” has no transcript yet. Transcribe it first.`);
    return it;
  }
  const pick = (a) => a || {};

  async function addFromDrive(a) {
    const H = window.SlopHub;
    if (!a) { if (window.SlopIntake && SlopIntake.fromDrive) { await SlopIntake.fromDrive({ to: $('trDrop'), accept: ['audio/*', 'video/*'] }); return 'Opened Slop Drive.'; } throw new Error('Slop Drive is not available here.'); }
    if (!H) throw new Error('Slop Drive is not available here.');
    const file = await driveFile(H, a), id = add([file]);
    if (!id) throw new Error(`“${file.name}” is not an audio or video file.`);
    return `Added “${file.name}” as file ${id}. Transcribe it next.`;
  }
  /** A Slop Drive file by { id } or { name } (or part of it), as a File. */
  async function driveFile(H, a) {
    let rec = null;
    if (a.id) rec = await H.get(a.id);
    else if (a.name) {
      const want = a.name.trim().toLowerCase(), all = await H.list({ accept: ['audio/*', 'video/*'] }); // intake-ok: an AI command looks a Drive file up by name (a lookup; the person's picker is SlopIntake.fromDrive)
      rec = all.find((r) => String(r.name).toLowerCase() === want) || all.find((r) => String(r.name).toLowerCase().includes(want)) || null;
    } else throw new Error('Give the Slop Drive id or the name of the file.');
    if (!rec || !rec.blob) throw new Error(`No file ${a.id ? 'with id ' + a.id : 'named “' + a.name + '”'} in Slop Drive.`);
    return new File([rec.blob], rec.name || 'Recording', { type: rec.type || rec.blob.type || '' });
  }

  /** A new batch: the list is cleared, the Drive files (all found first) are added, and the language and model are set
   *  for them as the Language and model dialog does. */
  async function newBatch(a) {
    a = a || {};
    if (q.busy) throw new Error('Stop transcribing first.');
    const H = window.SlopHub, files = [];
    if ((a.files || []).length && !H) throw new Error('Slop Drive is not available here.');
    for (const n of a.files || []) {
      const f = await driveFile(H, { id: n }).catch(() => driveFile(H, { name: n }));   // an id, else a name
      if (!isMedia(f)) throw new Error(`“${f.name}” is not an audio or video file.`);
      files.push(f);
    }
    if (a.model && window.SlopAIManager && !/^(installed|update)$/.test(await window.SlopAIManager.status(a.model))) {
      throw new Error(`The model ${a.model} is not downloaded. Download it from the Language and model dialog first.`);
    }
    const was = q.items.length;
    q.clear(); select(null); say('');
    if (files.length) add(files);
    if (a.language || a.model) { models.choice.set({ language: a.language || models.choice.language, model: a.model || null }); models.drawButton(); }
    const ids = q.items.map((x) => x.id);
    return `Started a new batch (${was} file(s) cleared) with ${ids.length} file(s)${ids.length ? ` (ids ${ids.join(', ')})` : ''}; next: ${models.choice.label()}.${ids.length ? ' Transcribe it next.' : ''}`;
  }

  async function transcribe(a, ctx) {
    if (q.busy) throw new Error('Transcribing is already running. Wait for it, or stop it.');
    if (!a) { await run(); return 'Transcribed the waiting files.'; }
    if (a.model && window.SlopAIManager && !/^(installed|update)$/.test(await window.SlopAIManager.status(a.model))) {
      throw new Error(`The model ${a.model} is not downloaded. Download it from the Language and model dialog first.`);
    }
    if (a.file != null) {
      const it = itemOf(a.file);
      if (it.status === 'reading') throw new Error(`“${it.name}” is being read right now.`);
      if (it.status === 'done') q.redo(it.id, { model: a.model, language: a.language });
    }
    const todo = q.items.filter((x) => x.status === 'waiting' || x.status === 'error');
    if (!todo.length) throw new Error('No files are waiting. Add a file first, or name a file to read it again.');
    const signal = ctx && ctx.signal, stop = () => { q.stop(); say('Stopping after this file…'); };
    if (signal) { if (signal.aborted) throw new Error('Stopped before it started.'); signal.addEventListener('abort', stop, { once: true }); }
    try { await run({ language: a.language, model: a.model }); } finally { if (signal) signal.removeEventListener('abort', stop); }
    const out = todo.map((x) => q.get(x.id)).filter(Boolean), ok = out.filter((x) => x.status === 'done'), bad = out.filter((x) => x.status === 'error');
    const parts = [`Transcribed ${ok.length} of ${out.length} file${out.length === 1 ? '' : 's'}`];
    if (ok.length) parts.push(`(${ok.map((x) => `${x.id}: ${x.language || '?'}`).join(', ')})`);
    let s = parts.join(' ') + '.';
    if (bad.length) s += ' Could not read: ' + bad.map((x) => `${x.name} (${x.error})`).join('; ') + '.';
    if (signal && signal.aborted) s += ' Stopped on request; the rest are still waiting.';
    return s;
  }

  /** The transcript as text, SRT or WebVTT (the same files the Download button makes). */
  async function transcript(a) {
    const it = itemOf(pick(a).file, { done: true }), format = a ? a.format : 'text', times = a ? a.times : false;
    const text = format === 'text' ? textOf(it, { times }) : await (await fileOf(it, format, { times })).blob.text();
    if (!a) { try { await navigator.clipboard.writeText(text); say('Copied.'); } catch (e) { say('Could not copy: select the text and copy it.'); } }
    return text;
  }

  async function save(a) {
    const it = itemOf(pick(a).file, { done: true }), format = a ? a.format : $('trFormat').value;
    const o = await fileOf(it, format, { times: a ? a.times : $('trTimes').checked });
    const id = await T.toDrive(o.name, o.blob, 'transcribe');
    if (!id) throw new Error('Slop Drive is not available here.');
    say(`Saved ${o.name} to Slop Drive.`);
    return `Saved ${o.name} to Slop Drive (id ${id}).`;
  }

  function correct(a) {
    if (!a) { $('trText').focus(); return 'Edit the text in the transcript box.'; }
    const it = itemOf(a.file, { done: true }), before = textOf(it);
    let text;
    if (a.text != null && a.text !== '') text = a.text;
    else if (a.find) {
      const n = before.split(a.find).length - 1;
      if (!n) throw new Error(`“${a.find}” is not in the transcript.`);
      text = before.split(a.find).join(a.replace || '');
    } else if (a.revert) text = null;
    else throw new Error('Give the new text, or find and replace, or revert.');
    q.edit(it.id, text);
    if (it.id !== (current() || {}).id) select(it.id); else { $('trText').value = textOf(it, { times: $('trTimes').checked }); draw(); }
    return text == null ? `Undid the corrections of “${it.name}”.` : `Corrected “${it.name}”: corrections are kept for Text and Word.`;
  }

  S.register([
    { id: 'tr.new-batch', tool: 'new_batch', title: 'Start a new batch', group: 'File', destructive: true, keywords: ['new', 'start', 'session', 'clear'],
      description: 'Clear the list and start a new batch of files to transcribe: optionally with audio or video files from Slop Drive and the language and model to read them with.',
      args: [{ name: 'files', type: 'array', maxItems: 50, items: { type: 'string' }, description: 'Slop Drive ids or names (or part of them) of audio or video files' },
        LANG, MODEL],
      run: newBatch },
    { id: 'tr.add-from-drive', tool: 'add_from_drive', title: 'Add a file from Slop Drive', group: 'File', keywords: ['drive', 'open', 'audio', 'video'],
      description: 'Add an audio or video file from Slop Drive to the list, by its Drive id or its name.',
      args: [{ name: 'id', type: 'string', maxLength: 100, description: 'Slop Drive file id' }, { name: 'name', type: 'string', maxLength: 300, description: 'file name (or part of it) when the id is not known' }],
      run: addFromDrive },
    { id: 'tr.transcribe', tool: 'transcribe', title: 'Transcribe', group: 'File', keywords: ['whisper', 'speech', 'text', 'run'],
      description: 'Turn the speech of every waiting file into text on this device, or read one file again with another language or model. Shows progress; it can take a while.',
      args: [LANG, MODEL, Object.assign({}, FILE, { description: 'read this file (again, when it is done); otherwise every waiting file' })],
      run: transcribe },
    { id: 'tr.stop', tool: 'stop', title: 'Stop transcribing', group: 'File', when: () => q.busy, description: 'Stop after the file being read now.', args: [],
      run: () => { q.stop(); say('Stopping after this file…'); return 'Stopping after the current file.'; } },
    { id: 'tr.get-transcript', tool: 'get_transcript', title: 'Copy the transcript', group: 'Edit', keywords: ['text', 'srt', 'vtt', 'subtitles', 'copy'],
      description: 'Return the transcript of a file as plain text, SRT subtitles or WebVTT subtitles (from the palette: copy it). Changes nothing.',
      args: [FILE, { name: 'format', type: 'enum', values: ['text', 'srt', 'vtt'], default: 'text', description: 'text uses your corrections; srt and vtt keep the timed segments' },
        { name: 'times', type: 'boolean', default: false, description: 'text only: put the time before each line' }],
      run: transcript },
    { id: 'tr.save-to-drive', tool: 'save_transcript', title: 'Save the transcript to Slop Drive', group: 'File', keywords: ['save', 'export', 'drive', 'docx', 'srt', 'vtt', 'txt'],
      description: 'Save the transcript of a file to Slop Drive as text, Word, SRT or WebVTT.',
      args: [FILE, { name: 'format', type: 'enum', options: FORMATS.map((f) => [f.id, f.label]), default: 'txt' }, { name: 'times', type: 'boolean', default: false, description: 'text and Word: times before the lines' }],
      run: save },
    { id: 'tr.correct', tool: 'correct_text', title: 'Correct the transcript', group: 'Edit', keywords: ['edit', 'fix', 'replace'],
      description: 'Correct the text of a transcript: give the whole new text, or a word to find and its replacement, or revert to what was heard. Subtitles keep the timed segments.',
      args: [FILE, { name: 'text', type: 'string', maxLength: 200000, description: 'the whole corrected text' }, { name: 'find', type: 'string', maxLength: 500, description: 'text to replace everywhere' },
        { name: 'replace', type: 'string', maxLength: 500, default: '', description: 'what find becomes' }, { name: 'revert', type: 'boolean', default: false, description: 'drop all corrections' }],
      run: correct },
    { id: 'tr.select', tool: 'select_file', title: 'Show a file’s transcript', group: 'View', description: 'Select a file in the list so its transcript shows.', args: [Object.assign({}, FILE, { required: true })],
      run: (a) => { if (!a) return; const it = itemOf(a.file); select(it.id); return `Showing “${it.name}”.`; } },
    { id: 'tr.remove', tool: 'remove_file', title: 'Remove a file from the list', group: 'File', destructive: true, description: 'Remove one file and its transcript from the list.', args: [FILE],
      run: (a) => { const it = itemOf(pick(a).file); if (!q.remove(it.id)) throw new Error(`“${it.name}” is being read right now.`); if (current() == null) select(null); return `Removed “${it.name}”.`; } },
    { id: 'tr.clear', tool: 'clear_files', title: 'Clear the list', group: 'File', destructive: true, description: 'Remove every file and transcript from the list.', args: [],
      run: () => { if (!q.clear()) throw new Error('Stop transcribing first.'); select(null); say(''); return 'Cleared the list.'; } },
  ]);
  S.provide({
    state: () => ({ app: 'Slop Transcribe', busy: q.busy, selected: (current() || {}).id || null,
      next: { language: models.choice.language, model: models.choice.model || C.QUICK },
      files: q.items.map((x) => ({ id: x.id, name: x.name, status: x.status, progress: Math.round(x.progress * 100), seconds: x.seconds && Math.round(x.seconds),
        language: x.language, model: x.model, segments: x.segments.length, corrected: x.text != null, error: x.error || undefined })) }),
    checkpoint: () => {
      const texts = new Map(q.items.map((x) => [x.id, x.text]));
      return () => { for (const [id, text] of texts) if (q.get(id)) q.edit(id, text); select((current() || {}).id || null); };
    },
  });
  return S;
}
