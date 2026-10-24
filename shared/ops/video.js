/* Video operations for Slop Workflows and the AI (registry: shared/ops/registry.js). No second video stack: each one
 * runs SlopCut's own commands in its hidden copy (slopcut/?macro-host=1, shared/macros/frame.js runInHost; SlopCut's
 * host is slopcut/js/ai/host.js) and renders with SlopCut's WebCodecs export. Speech is Slop Transcribe's engine
 * (shared/ops/speech.js), run in this page so its download question is seen. Trimming is File convert's "Cut video
 * (trim)" (video-trim), not repeated here.
 *   slopedit.edl          Edit list → video: a JSON edit decision list (shared/video/edl.js) and the media it names
 *   slopedit.reframe      Reframe video: 16:9 → 9:16 (or another aspect), filling the frame around a focus point
 *   slopedit.captions     Add captions to video: from an .srt/.vtt given with it, or transcribed on this device
 *   slopedit.reel         Remix to reel: Reel Remix's random edit of the clips, optionally with captions
 *   transcribe.text       Video or audio → transcript (TXT), SRT or VTT
 * hostSteps(op, options, files) → the SlopCut steps an operation replays (pure; Node tests read it). */
import { register } from './registry.js';
import { stem } from './load.js';

const VIDEO = ['mp4', 'webm', 'mov'], AUDIO = ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'opus'], PICS = ['png', 'jpg', 'webp', 'gif'];
const HOST = { app: 'slopedit', url: 'slopcut/?macro-host=1' };
const ASPECT = { key: 'aspect', type: 'select', label: 'Frame', value: 'same', options: [['same', 'As the edit or source'], ['9:16', 'Vertical 9:16 (1080×1920)'], ['16:9', 'Landscape 16:9 (1920×1080)'], ['1:1', 'Square 1:1'], ['4:5', 'Portrait 4:5']] };
const FORMAT = { key: 'format', type: 'select', label: 'Save as', value: 'mp4', options: [['mp4', 'MP4'], ['webm', 'WebM']] };
const QUALITY = { key: 'quality', type: 'select', label: 'Quality', value: 'high', options: [['low', 'Low (small file)'], ['medium', 'Medium'], ['high', 'High'], ['max', 'Maximum']] };
const WIDTH = { key: 'width', type: 'number', label: 'Width (0 = as the frame)', min: 0, max: 7680, value: 0, hint: 'with Height, a custom size' };
const HEIGHT = { key: 'height', type: 'number', label: 'Height (0 = as the frame)', min: 0, max: 4320, value: 0 };
const FPS = { key: 'fps', type: 'select', label: 'Frame rate', value: 0, options: [[0, 'As the edit'], [24, '24'], [25, '25'], [30, '30'], [60, '60']] };
const LANGUAGE = { key: 'language', type: 'text', label: 'Language', value: 'auto', hint: 'auto, or a code such as en, sv, de' };
const CAPTIONS = [{ key: 'captions', type: 'select', label: 'Captions', value: 'none', options: [['none', 'None'], ['file', 'From the .srt or .vtt given'], ['transcribe', 'Transcribe the sound on this device']] }, LANGUAGE,
  { key: 'captionSize', type: 'number', label: 'Caption size (% of the height)', min: 1, max: 20, step: 0.5, value: 4.5 },
  { key: 'captionPosition', type: 'select', label: 'Caption position', value: 'bottom', options: [['bottom', 'Bottom'], ['lower-third', 'Lower third'], ['center', 'Centre'], ['top', 'Top']] }];
const OUT = [FORMAT, QUALITY, WIDTH, HEIGHT, FPS];

/** The export settings SlopCut's host.save takes. */
export function saveOptions(o = {}) {
  const s = { format: o.format || 'mp4', quality: o.quality || 'high' };
  if (+o.width && +o.height) Object.assign(s, { width: +o.width, height: +o.height });
  else if (o.aspect && o.aspect !== 'same') s.aspect = o.aspect;
  if (+o.fps) s.fps = +o.fps;
  return s;
}
/** The SlopCut steps (command ids and args) an operation replays in the hidden copy. srt: caption text when known. */
export function hostSteps(id, o = {}, { edl = null, srt = null, listen = false } = {}) {
  const steps = [], style = { size: (Number(o.captionSize) || 4.5) / 100, position: o.captionPosition || 'bottom' };
  const caps = srt ? [{ cmd: 'cut.captions', args: Object.assign({ srt }, style) }] : listen ? [{ cmd: 'cut.captions', args: Object.assign({ transcribe: 'timeline', language: o.language || 'auto' }, style) }] : [];
  if (id === 'slopedit.edl') steps.push({ cmd: 'cut.build', args: { edit_list: edl } });
  if (id === 'slopedit.reframe') steps.push({ cmd: 'cut.reframe', args: { aspect: o.aspect && o.aspect !== 'same' ? o.aspect : '9:16', focus_x: Number(o.focus ?? 50) / 100 } });
  if (id === 'slopedit.reel') steps.push({ cmd: 'cut.randomEdit', args: { target: Number(o.target) || 15, pace: o.pace || 'fast', aspect: o.aspect && o.aspect !== 'same' ? o.aspect : '9:16', layout: o.layout || 'none', seed: o.seed || undefined,
    width: +o.width && +o.height ? +o.width : undefined, height: +o.width && +o.height ? +o.height : undefined } });
  return steps.concat(caps).map((s) => ({ cmd: s.cmd, args: JSON.parse(JSON.stringify(s.args)), title: s.cmd }));
}

let frame = null;
const host = async () => (frame = frame || (await import('../macros/frame.js')).runInHost);
const speech = () => import('./speech.js');
const isSubs = (f) => f.kind === 'srt' || f.kind === 'vtt' || /\.(srt|vtt)$/i.test(f.name);
const isEdl = (f) => f.kind === 'json' || /\.json$/i.test(f.name);

/** Run steps in SlopCut's hidden copy on a main file (+ media) and hand the video back. */
async function render(id, main, media, steps, o, ctx = {}) {
  const run = await host();
  const r = await run(HOST, main, steps, Object.assign({ media, place: id !== 'slopedit.edl' && id !== 'slopedit.reel' }, saveOptions(o)), { signal: ctx.signal, progress: ctx.progress, timeout: 60 * 60 * 1000 });
  if (ctx.progress) ctx.progress(1);
  return r;
}
/** Captions: { srt } from the subtitle file given, or { listen } (the hidden SlopCut transcribes the edit's own sound;
 *  the model download is asked for here first, in the page the person sees). */
async function captionsOf(mode, subs, ctx) {
  if (mode === 'file') { if (!subs) throw new Error('Add an .srt or .vtt file with the video, or choose Transcribe.'); return { srt: await subs.file.text() }; }
  if (mode !== 'transcribe') return {};
  await (await speech()).prepare({ progress: ctx.progress });
  return { listen: true };
}

async function edl(files, o, ctx) {
  const list = files.find(isEdl);
  if (!list) throw new Error('Add the edit list (a .json file) with the media it names.');
  const doc = JSON.parse(await list.file.text()), media = files.filter((f) => f !== list).map((f) => f.file);
  const r = await render('slopedit.edl', list.file, media, hostSteps('slopedit.edl', o, { edl: doc }), o, ctx);
  return [{ name: `${stem(doc.name || list.name)}.${r.kind}`, blob: r.blob, kind: r.kind }];
}
async function onVideo(id, files, o, ctx) {
  const video = files.find((f) => !isSubs(f)), subs = files.find(isSubs);
  if (!video) throw new Error('Add a video.');
  const mode = id !== 'slopedit.captions' ? 'none' : subs && o.captions !== 'transcribe' ? 'file' : 'transcribe';
  const r = await render(id, video.file, [], hostSteps(id, o, await captionsOf(mode, subs, ctx)), o, ctx);
  const tag = { 'slopedit.reframe': o.aspect && o.aspect !== 'same' ? o.aspect.replace(':', 'x') : '9x16', 'slopedit.captions': 'captions' }[id];
  return [{ name: `${stem(video.name)}-${tag}.${r.kind}`, blob: r.blob, kind: r.kind }];
}
async function reel(files, o, ctx) {
  const clips = files.filter((f) => !isSubs(f));
  if (!clips.length) throw new Error('Add the clips and pictures for the reel.');
  const r = await render('slopedit.reel', clips[0].file, clips.slice(1).map((f) => f.file), hostSteps('slopedit.reel', o, await captionsOf(o.captions, files.find(isSubs), ctx)), o, ctx);
  return [{ name: `reel-${o.seed || 'remix'}.${r.kind}`.replace(/[^\w.-]+/g, '-'), blob: r.blob, kind: r.kind }];
}
async function transcript(files, o, ctx) {
  const f = files[0], S = await speech();
  const segs = await S.transcribe(f.file, { language: o.language || 'auto', signal: ctx.signal, progress: ctx.progress });
  const fmt = o.format || 'srt', text = await S.formatted(segs, fmt), ext = fmt === 'txt-times' ? 'txt' : fmt;
  const type = fmt === 'srt' ? 'application/x-subrip' : fmt === 'vtt' ? 'text/vtt' : 'text/plain';
  return [{ name: `${stem(f.name)}.${ext}`, blob: new Blob([text], { type }), kind: ext }];
}

export const VIDEO_OPS = register([
  { id: 'slopedit.edl', label: 'Edit list → video', group: 'Video', from: ['json'], with: VIDEO.concat(AUDIO, PICS, ['srt', 'vtt']), ext: 'mp4', mode: 'combine', out: (k, o) => o.format || 'mp4',
    description: 'A whole edit from a JSON edit list (clips with in and out, titles, transitions, captions, music with ducking), rendered by SlopCut. Give the edit list and the media it names.',
    keywords: ['edit decision list', 'edl', 'montage', 'assemble', 'video editor', 'slopcut'], options: [ASPECT].concat(OUT), run: edl },
  { id: 'slopedit.reframe', label: 'Reframe video', group: 'Video', from: VIDEO, ext: 'mp4', mode: 'each', out: (k, o) => o.format || 'mp4',
    description: 'Another frame shape (16:9 to 9:16 for reels and shorts): the picture fills the new frame, kept around the focus point.',
    keywords: ['vertical', '9:16', 'reel', 'shorts', 'tiktok', 'crop', 'aspect ratio', 'portrait'],
    options: [Object.assign({}, ASPECT, { value: '9:16', options: ASPECT.options.slice(1) }), { key: 'focus', type: 'range', label: 'Focus (left 0 – right 100)', min: 0, max: 100, value: 50 }].concat(OUT), run: (f, o, c) => onVideo('slopedit.reframe', f, o, c) },
  { id: 'slopedit.captions', label: 'Add captions to video', group: 'Video', from: VIDEO, with: ['srt', 'vtt'], ext: 'mp4', mode: 'combine', out: (k, o) => o.format || 'mp4',
    description: 'Captions burned into the video at the right times: from an .srt or .vtt given with it, or transcribed on this device (Whisper).',
    keywords: ['subtitles', 'burn in', 'captions', 'srt', 'open captions'], options: CAPTIONS.map((x) => (x.key === 'captions' ? Object.assign({}, x, { value: 'transcribe', options: x.options.slice(1) }) : x)).concat(OUT), run: (f, o, c) => onVideo('slopedit.captions', f, o, c) },
  { id: 'slopedit.reel', label: 'Remix to reel', group: 'Video', from: VIDEO.concat(PICS), with: ['srt', 'vtt'], ext: 'mp4', mode: 'combine', out: (k, o) => o.format || 'mp4',
    description: 'Reel Remix\'s random edit of the clips and pictures (target length, pace, layout, seed) as a finished video, vertical by default, with captions if asked.',
    keywords: ['reel', 'remix', 'montage', 'highlights', 'shorts', 'random edit', 'tiktok'],
    options: [{ key: 'target', type: 'number', label: 'Length (seconds)', min: 1, max: 600, value: 15 }, { key: 'pace', type: 'select', label: 'Pace', value: 'fast', options: [['fast', 'Fast'], ['medium', 'Medium'], ['slow', 'Slow']] },
      { key: 'layout', type: 'text', label: 'Layout', value: 'none', hint: 'none, random, single, split-h, pip, grid-2x2…' }, { key: 'seed', type: 'text', label: 'Seed', value: '', hint: 'the same seed gives the same edit' },
      Object.assign({}, ASPECT, { value: '9:16', options: ASPECT.options.slice(1) })].concat(CAPTIONS, OUT), run: reel },
], { app: 'slopedit', label: 'SlopCut' });

export const TRANSCRIBE_OPS = register([
  { id: 'transcribe.text', label: 'Video → transcript', group: 'Audio and video', from: VIDEO.concat(AUDIO), ext: 'srt', mode: 'each', out: (k, o) => (o.format === 'txt-times' ? 'txt' : o.format || 'srt'),
    description: 'The words spoken in a video or sound file, on this device (Whisper): subtitles (SRT, VTT) or plain text.', engine: 'whisper',
    keywords: ['transcribe', 'speech to text', 'subtitles', 'srt', 'captions', 'whisper'],
    options: [{ key: 'format', type: 'select', label: 'Save as', value: 'srt', options: [['srt', 'Subtitles (.srt)'], ['vtt', 'Web subtitles (.vtt)'], ['txt', 'Text'], ['txt-times', 'Text with times']] }, LANGUAGE], run: transcript },
], { app: 'transcribe', label: 'Slop Transcribe' });
