/* More audio, video and picture conversions, added to CONVERSIONS in catalog.js:
 *   to-ogg, to-opus, to-flac, to-m4a   the sound of an audio or video file as Ogg Vorbis, Opus, FLAC (lossless) or M4A
 *                                      (AAC), with the ffmpeg engine (ffmpeg-engine.js: downloaded once after its notice,
 *                                      engine: 'ffmpeg'); the tags (title, artist) are copied. Opus uses ffmpeg's own encoder
 *                                      at 48 kHz: libopus in this ffmpeg.wasm build stops the page
 *   gif-to-mp4                          an animated GIF as an H.264 MP4 (much smaller, plays everywhere), ffmpeg too
 *   to-avif                             a picture as AVIF, only where this browser's canvas can write AVIF (`available`:
 *                                      the menus leave it out elsewhere)
 * Browser only. Exports MEDIA_MORE. */
import { convertVideo } from './ffmpeg-engine.js';
import { convertImage, canEncode } from './image.js';
import { stemOf as base } from '../io/files.js';

const AUDIO_IN = ['mp4', 'webm', 'mov', 'm4a', 'mp3', 'wav', 'ogg', 'flac'];
const without = (k) => AUDIO_IN.filter((x) => x !== k);
const kbps = (value, list) => ({ key: 'bitrate', type: 'select', label: 'Bitrate', value, options: list.map((v) => [v, `${v} kbps`]) });

/** The audio track of a file, re-encoded: codec args for ffmpeg after '-c:a'. */
function audioTo(output, codec) {
  return async (files, o = {}) => {
    const f = files[0];
    const rate = o.bitrate ? ['-b:a', `${Number(o.bitrate)}k`] : [];
    return [await convertVideo(f.file, {
      name: base(f.name), output,
      args: (i, out) => ['-i', i, '-vn', '-map_metadata', '0', '-c:a', ...codec, ...rate, out],
    })];
  };
}

function gifToMp4() {
  return async (files, o = {}) => {
    const f = files[0];
    const q = String(Number(o.crf ?? 23));
    return [await convertVideo(f.file, {
      name: base(f.name), output: 'mp4',
      // H.264 in yuv420p needs even sides, so an odd GIF size is rounded down by one pixel
      args: (i, out) => ['-i', i, '-movflags', '+faststart', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', q, '-pix_fmt', 'yuv420p', '-an', out],
    })];
  };
}

async function toAvif(files, o = {}) {
  const f = files[0];
  const r = await convertImage(f.file, { kind: f.kind, to: 'avif', width: o.width, height: o.height, quality: (o.quality ?? 70) / 100 });
  return [{ name: `${base(f.name)}.avif`, blob: r.blob }];
}

const SIZE = [
  { key: 'width', type: 'number', label: 'Width (px)', min: 1, max: 10000, hint: 'Leave blank to keep the original size. Height follows the proportions.' },
  { key: 'height', type: 'number', label: 'Height (px)', min: 1, max: 10000 },
];
const AV = 'Audio and video';

export const MEDIA_MORE = [
  { id: 'to-ogg', engine: 'ffmpeg', label: 'To OGG (Vorbis)', group: AV, from: without('ogg'), ext: 'ogg', mode: 'each', options: [kbps('160', ['96', '128', '160', '192', '256'])], keywords: ['vorbis', 'audio'], run: audioTo('ogg', ['libvorbis']) },
  { id: 'to-opus', engine: 'ffmpeg', label: 'To Opus', group: AV, from: AUDIO_IN, ext: 'opus', mode: 'each', options: [kbps('96', ['48', '64', '96', '128', '160'])], keywords: ['ogg', 'voice', 'audio'], run: audioTo('opus', ['opus', '-strict', '-2', '-ar', '48000']) },
  { id: 'to-flac', engine: 'ffmpeg', label: 'To FLAC (lossless)', group: AV, from: without('flac'), ext: 'flac', mode: 'each', options: [], keywords: ['lossless', 'audio'], run: audioTo('flac', ['flac']) },
  { id: 'to-m4a', engine: 'ffmpeg', label: 'To M4A (AAC)', group: AV, from: without('m4a'), ext: 'm4a', mode: 'each', options: [kbps('192', ['128', '192', '256'])], keywords: ['aac', 'itunes', 'apple', 'audio'], run: audioTo('m4a', ['aac']) },
  { id: 'gif-to-mp4', engine: 'ffmpeg', label: 'GIF to MP4', group: AV, from: ['gif'], ext: 'mp4', mode: 'each', options: [{ key: 'crf', type: 'range', label: 'Quality (lower is better)', min: 18, max: 40, value: 23 }], keywords: ['video', 'animation'], run: gifToMp4() },
  { id: 'to-avif', label: 'To AVIF', group: 'Images', from: ['png', 'jpg', 'webp', 'bmp', 'gif', 'svg', 'ico'], ext: 'avif', mode: 'each', available: () => canEncode('image/avif'),
    options: [...SIZE, { key: 'quality', type: 'range', label: 'Quality', min: 10, max: 100, value: 70 }], keywords: ['av1'], run: toAvif },
];
