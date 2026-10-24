/* Slop Transcribe: voice, MP3 or any audio or video file to text, on this device. Files come from a drop, Choose files,
 * Slop Drive (SlopDrop) or the microphone (record.js); queue.js reads them one after another through Whisper (the Slop AI
 * Tools engine, aitools/common.js, the same model and download as the Speech page); the transcript can be corrected,
 * copied, downloaded (exports.js) or saved to Slop Drive, or opened in Slop Docs. The SlopFlow picture shows "MP3 → TXT". */
import { createQueue } from './queue.js';
import { createRecorder } from './record.js';
import { FORMATS, fileOf, textOf, presetOf } from './exports.js';
import { drawList, drawTranscript, textFor } from './view.js';
import { fillLanguages } from './languages.js';
import '../../shared/ui/flow.js';

const T = window.SlopAITools, $ = (id) => document.getElementById(id);
const say = (s) => { $('trMsg').textContent = s || ''; };
let selected = null, times = false;
const flow = window.SlopFlow.create({ from: 'mp3', to: 'txt', size: 'lg', label: 'Audio or video to text' });
$('trFlow').append(flow.el);
fillLanguages($('trLang'));
$('trSteps').append(window.SlopDrop.panel.preview({ steps: ['Drop audio or video, or press Record', 'Press Transcribe: it runs on this device', 'Correct the text, then save it'] }));

/** The Whisper engine of Slop AI Tools. The model downloads once, after the person agrees (T.gate). */
const engine = {
  prepare: (onStatus) => T.ensure('whisper-tiny', onStatus),
  samples: (file) => T.audioSamples(file),
  transcribe: (samples, language, onProgress) => T.call('transcribe', { samples, language }, { transfer: [samples.buffer], onProgress }),
};
const q = createQueue({ engine, onChange: () => draw() });
const current = () => (selected && q.get(selected)) || null;

function draw() {
  drawList(q, selected, { select, remove: (id) => { q.remove(id); if (selected === id) selected = null; draw(); } });
  const it = current();
  if (document.activeElement !== $('trText')) $('trText').value = textFor(it, { times });
  drawTranscript(it, { times });
  const reading = q.items.find((x) => x.status === 'reading');
  const shown = reading || it || q.items[0];
  if (shown) flow.set({ from: (shown.name.match(/\.([a-z0-9]+)$/i) || [, 'mp3'])[1].toLowerCase(), to: 'txt' });
  flow.state(q.busy ? 'run' : it && it.status === 'done' ? 'done' : it && it.status === 'error' ? 'error' : 'idle');
  if (reading) {
    flow.progress(reading.progress);
    const n = q.items.indexOf(q.items.find((x) => x.id === reading.id)) + 1, of = q.items.length;
    say(`Transcribing ${reading.name}${of > 1 ? ` (${n} of ${of})` : ''}: ${Math.round(reading.progress * 100)}%. Long files take a while; it all runs on this device.`);
  }
}
function select(id) { selected = id; $('trText').value = textFor(current(), { times }); draw(); }

/** Adds files; the first one becomes the selection. */
function add(files) {
  const added = q.add(files);
  if (!added.length) { say('Only audio and video files can be transcribed: MP3, WAV, M4A, OGG, FLAC, WebM, MP4 and the like.'); return null; }
  if (!selected) selected = added[0].id;
  say(`${added.length} file${added.length === 1 ? '' : 's'} added. Press Transcribe.`);
  draw();
  return added[added.length - 1].id;
}

async function run() {
  say('');
  await q.run({ language: $('trLang').value, onStatus: say });
  const list = q.items, bad = list.filter((x) => x.status === 'error').length;
  say(bad ? `${bad} file${bad === 1 ? '' : 's'} could not be read; the reason is under each one.` : 'Done. Check the text before you use it: corrections are kept for Text and Word.');
  if (!current() || current().status !== 'done') { const first = list.find((x) => x.status === 'done'); if (first) select(first.id); }
  draw();
}

/** Record: the button starts and stops; a finished recording joins the queue like a file. */
const rec = createRecorder({ onTick: (s) => { $('trRecTime').textContent = window.SlopTranscript.clock(s); } });
async function toggleRecord() {
  if (rec.recording) {
    const file = await rec.stop();
    $('trRecord').classList.remove('is-on'); $('trRecord').textContent = 'Record'; $('trRecTime').hidden = true;
    const id = file && add([file]);
    if (id) select(id);
    return;
  }
  try { await rec.start(); } catch (e) { say(e.message); return; }
  $('trRecord').classList.add('is-on'); $('trRecord').textContent = 'Stop recording'; $('trRecTime').hidden = false;
  say('Recording… Press Stop recording when you are done.');
}

async function exportAs(format, then) {
  const it = current();
  if (!it || it.status !== 'done') return;
  const out = await fileOf(it, format, { times });
  return then(out);
}

function wire() {
  window.SlopDrop.attach($('trDrop'), {
    accept: { types: ['audio/*', 'video/*'], exts: ['.mp3', '.m4a', '.wav', '.ogg', '.opus', '.flac', '.webm', '.mp4', '.mov', '.mkv', '.amr', '.wma'], noun: 'an audio or video file' },
    input: $('trPick'), label: 'Drop audio or video files here, or choose files', hint: 'MP3, WAV, M4A, OGG, FLAC, video… Several at once. Nothing is uploaded.',
    // the steps are in the intro (shown before the model is in, as the From → To picture is); the sample is NASA's
    // public-domain Moon landing recording (assets/samples/moon-landing.txt)
    sample: { label: 'Try it with a sample: the Moon landing, 24 s', files: async () => [await window.SlopSamples.asset('moon-landing.ogg', 'Moon landing, Apollo 11.ogg', 'audio/ogg')] },
    process: async (file) => { const id = add([file]); if (!id) throw new Error('not an audio or video file'); return file.name; },
  });
  $('trFormat').replaceChildren(...FORMATS.map((f) => Object.assign(document.createElement('option'), { value: f.id, textContent: f.label })));
  const preset = presetOf(location.search);   // a task page's link, e.g. ?format=srt (not remembered)
  if (preset.format) $('trFormat').value = preset.format;
  $('trRun').addEventListener('click', run);
  $('trStop').addEventListener('click', () => { q.stop(); say('Stopping after this file…'); });
  $('trClear').addEventListener('click', () => { if (q.clear()) { selected = null; say(''); draw(); } });
  $('trRecord').addEventListener('click', toggleRecord);
  $('trTimes').addEventListener('change', (e) => { times = e.target.checked; const it = current(); if (it && it.text == null) $('trText').value = textFor(it, { times }); draw(); });
  $('trText').addEventListener('input', () => { const it = current(); if (it && it.status === 'done') { q.edit(it.id, $('trText').value); drawTranscript(it, { times }); } });
  $('trRevert').addEventListener('click', () => { const it = current(); if (it) { q.edit(it.id, null); $('trText').value = textFor(it, { times }); draw(); } });
  $('trCopy').addEventListener('click', async () => { const it = current(); if (!it) return; try { await navigator.clipboard.writeText(textOf(it, { times })); say('Copied.'); } catch (e) { say('Could not copy: select the text and copy it.'); } });
  $('trDownload').addEventListener('click', () => exportAs($('trFormat').value, (o) => T.download(o.name, o.blob)));
  $('trDrive').addEventListener('click', () => exportAs($('trFormat').value, async (o) => { const id = await T.toDrive(o.name, o.blob, 'transcribe'); say(id ? `Saved ${o.name} to Slop Drive.` : 'Slop Drive is not available here.'); }));
  $('trDocs').addEventListener('click', () => exportAs('docx', async (o) => { const id = await T.toDrive(o.name, o.blob, 'transcribe'); if (id) T.openDocs(id); else say('Slop Drive is not available here.'); }));
  draw();
}

// engine is exposed so a test can stand in a fake Whisper (the real model is a download the tests do not make)
window.SlopTranscribe = { queue: q, engine, add, run, select, presetOf, get selected() { return selected; } };
T.gate('speech', () => { $('trUi').hidden = false; });
wire();
