/* Video conversion with ffmpeg.wasm (ffmpeg compiled for the browser). Browser only.
 * The small JavaScript part is vendored (vendor/ffmpeg, MIT). The ffmpeg core (about 30 MB of WebAssembly, GPL-2.0-or-later)
 * is fetched the first time a video conversion runs, from the Slopographic cdn repository at a pinned commit, with jsDelivr
 * as the fallback. Both are checked against the SHA-256 below before ffmpeg runs; the licence and source are in the cdn repo
 * (engines/ffmpeg/0.12.10). Every file is converted in memory: nothing is uploaded. One ffmpeg runs at a time (requests queue). */

export const CORE_VERSION = '0.12.10';
/** The cdn repository at a fixed commit (so a later change to the repo cannot change the file the site runs). */
const CDN_BASE = 'https://raw.githubusercontent.com/slopographic/cdn/3fef2eab53fd8bbc406e99ca0efa1a2d2e3e98f6/engines/ffmpeg/0.12.10/';
/** The checksums of the two files (also in the cdn repo's manifest.json). */
const CORE_FILES = {
  'ffmpeg-core.js': '67a48f11645f85439f3fde4f2119042c16b374b910206b7a7a24f342e28dcae3',
  'ffmpeg-core.wasm': '9f57947a5bd530d8f00c5b3f2cb2a3492faa7e5d823315342d6a8656d0a6b7b7',
};
/** Larger inputs are refused before any work: the whole file must fit in the browser's memory for ffmpeg. */
export const MAX_INPUT_BYTES = 400 * 1024 * 1024;

/** Downloads one core file from the cdn and checks its SHA-256. Returns a blob URL for ffmpeg. */
async function fetchCoreFile(name) {
  let lastErr = null;
  for (const base of [CDN_BASE]) {
    try {
      const r = await fetch(base + name, { cache: 'force-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = await r.arrayBuffer();
      const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
      if (digest !== CORE_FILES[name]) throw new Error('checksum does not match');
      const type = name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript';
      return URL.createObjectURL(new Blob([buf], { type }));
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('unavailable');
}

let instance = null;
let loading = null;
let queue = Promise.resolve();
let logTail = [];

/** Loads ffmpeg once, with its log kept so a failure can say why. */
export function loadFFmpeg() {
  if (instance) return Promise.resolve(instance);
  if (!loading) {
    loading = (async () => {
      const mod = await import(new URL('../../../vendor/ffmpeg/index.js', import.meta.url).href);
      const ff = new mod.FFmpeg();
      ff.on('log', ({ message }) => { logTail.push(message); if (logTail.length > 40) logTail.shift(); });
      try {
        const coreURL = await fetchCoreFile('ffmpeg-core.js');
        const wasmURL = await fetchCoreFile('ffmpeg-core.wasm');
        await ff.load({ coreURL, wasmURL });
      } catch (e) {
        loading = null;
        throw new Error('Could not load the video engine. Check the connection and try again.');
      }
      instance = ff;
      return ff;
    })();
  }
  return loading;
}

/** One ffmpeg run: writes the input, runs ffmpeg with args, reads the output and cleans up. Returns { ok, bytes | log }. */
async function attempt(inputName, data, args, outputName) {
  const ff = await loadFFmpeg();
  logTail = [];
  // a copy each time: writeFile hands the buffer to the worker, so a retry needs its own bytes
  await ff.writeFile(inputName, data.slice());
  try {
    const code = await ff.exec(args);
    if (code !== 0) return { ok: false, log: logTail.slice(-12).join('\n') };
    const out = await ff.readFile(outputName);
    return { ok: true, bytes: out instanceof Uint8Array ? out : new TextEncoder().encode(String(out)) };
  } finally {
    await ff.deleteFile(inputName).catch(() => {});
    await ff.deleteFile(outputName).catch(() => {});
  }
}

/** Stops the engine so the next job starts a fresh one (after a runtime error inside ffmpeg.wasm the instance can be left unusable). */
function resetEngine() {
  const old = instance;
  instance = null;
  loading = null;
  try { if (old) old.terminate(); } catch (e) { /* already stopped */ }
}

/** Runs one job, queued behind the others. A runtime error restarts the engine and tries once more on a fresh one. */
function job(inputName, data, args, outputName) {
  const run = queue.then(async () => {
    try {
      return await attempt(inputName, data, args, outputName);
    } catch (e) {
      resetEngine();
      return await attempt(inputName, data, args, outputName);
    }
  });
  queue = run.catch(() => {});
  return run;
}

/** Converts one file. opts: { args(inName, outName) -> string[], output: 'mp4', fallback?: same shape (tried when the first fails) }. */
export async function convertVideo(file, { name, args, output, fallback }) {
  if (file.size > MAX_INPUT_BYTES) throw new Error('This file is larger than 400 MB, so it is too big for the browser to convert.');
  const inName = 'input' + extOf(file.name);
  const outName = 'output.' + output;
  const data = new Uint8Array(await file.arrayBuffer());
  let r = await job(inName, data, args(inName, outName), outName);
  if (!r.ok && fallback) r = await job(inName, data, fallback(inName, outName), outName);
  if (!r.ok) throw new Error('The conversion failed. ' + lastLine(r.log));
  return { name: name + '.' + output, blob: new Blob([r.bytes], { type: MIME[output] || 'application/octet-stream' }) };
}

const MIME = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', gif: 'image/gif', webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg' };
const extOf = (n) => { const m = /\.[A-Za-z0-9]{1,5}$/.exec(String(n || '')); return m ? m[0].toLowerCase() : '.bin'; };
/** The last ffmpeg line that names an error, for the message. */
function lastLine(log) {
  const lines = String(log || '').split('\n').filter((l) => /error|invalid|no such|unable|not |failed|unknown/i.test(l));
  return lines.length ? lines[lines.length - 1].trim() : 'The video may use a format this browser engine cannot read.';
}
