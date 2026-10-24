/* More picture, sound, video and map conversions, added to CONVERSIONS in catalog.js:
 *   favicon-pack                        a picture as a website's favicon set in a ZIP (favicon.js)
 *   audio-trim                          a piece of an audio or video file's sound as WAV or MP3, with fades (cut.js, audio.js)
 *   video-trim                          a piece of a video, streams copied (fast) or cut at the exact frame (ffmpeg-engine.js)
 *   gpx-to-geojson, kml-to-geojson      GPS tracks and Google Earth files as GeoJSON (geo-read.js)
 *   geojson-to-gpx, geojson-to-csv      GeoJSON as GPX or as a table of points (geo-write.js; csv.js writes the table)
 * Exports MEDIA_GEO. */
import { faviconZip } from './favicon.js';
import { cutChannels, cutRange } from './cut.js';
import { decodeAudio, channelsOf, encodeWav, encodeMp3, loadLame } from './audio.js';
import { convertVideo } from './ffmpeg-engine.js';
import { gpxToGeojson, kmlToGeojson } from './geo-read.js';
import { geojsonToGpx, geojsonToRows } from './geo-write.js';
import { parseJson } from './structured.js';
import { rowsToCsv } from './csv.js';
import { decodeText } from './text.js';
import { stemOf as base } from '../io/files.js';

const textOf = async (f) => decodeText(new Uint8Array(await f.file.arrayBuffer()));
const out = (name, data, type) => ({ name, blob: new Blob([data], { type }) });
const IMAGE = ['png', 'jpg', 'webp', 'bmp', 'gif', 'svg', 'avif', 'ico'];
const AUDIO_IN = ['mp4', 'webm', 'mov', 'm4a', 'mp3', 'wav', 'ogg', 'flac'];
const VIDEO_IN = ['mp4', 'webm', 'mov'];
const START = { key: 'start', type: 'text', label: 'Start', value: '0', placeholder: '0:00', hint: 'Seconds (75) or minutes and seconds (1:15).' };
const END = { key: 'end', type: 'text', label: 'End', placeholder: 'The end of the file', hint: 'Blank keeps everything after the start.' };
const n = (v) => Math.round(v * 1000) / 1000;

async function favicon(files, o = {}) {
  const f = files[0], fill = !!o.fill;
  const blob = await faviconZip(f.file, f.kind, { name: o.name || base(f.name), background: fill ? o.background : 'transparent', color: fill ? o.background : '#ffffff', padding: o.padding });
  return [{ name: `${base(f.name)}-favicons.zip`, blob }];
}

async function audioTrim(files, o = {}) {
  const f = files[0];
  const buf = await decodeAudio(new Uint8Array(await f.file.arrayBuffer()));
  const chans = cutChannels(channelsOf(buf), buf.sampleRate, o);
  const res = o.output === 'mp3'
    ? [{ name: `${base(f.name)}-cut.mp3`, blob: encodeMp3(await loadLame(), chans, buf.sampleRate, Number(o.bitrate) || 192), kind: 'mp3' }]
    : [{ name: `${base(f.name)}-cut.wav`, blob: new Blob([encodeWav(chans, buf.sampleRate)], { type: 'audio/wav' }), kind: 'wav' }];
  res.info = `Kept ${n(chans[0].length / buf.sampleRate)} s of ${n(buf.duration)} s.`;
  return res;
}

const ENC = {
  mp4: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart'],
  mov: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-f', 'mov'],
  webm: ['-c:v', 'libvpx', '-b:v', '1M', '-c:a', 'libvorbis', '-b:a', '128k'],
};
async function videoTrim(files, o = {}) {
  const f = files[0], ext = VIDEO_IN.includes(f.kind) ? f.kind : 'mp4';
  const { from, to } = cutRange(o);
  const len = Number.isFinite(to) ? ['-t', String(n(to - from))] : [];
  const copy = (i, x) => ['-ss', String(from), '-i', i, ...len, '-map', '0', '-c', 'copy', '-avoid_negative_ts', 'make_zero', ...(ext === 'webm' ? [] : ['-movflags', '+faststart']), x];
  const exact = (i, x) => ['-i', i, '-ss', String(from), ...len, ...ENC[ext], x];
  const r = await convertVideo(f.file, { name: `${base(f.name)}-cut`, output: ext, args: o.exact ? exact : copy, fallback: o.exact ? null : exact });
  return [{ ...r, kind: ext }];
}

const geo = (read, what) => async (files) => {
  const f = files[0], g = read(await textOf(f));
  const res = [out(`${base(f.name)}.geojson`, JSON.stringify(g, null, 2) + '\n', 'application/geo+json')];
  const c = (t) => g.features.filter((x) => x.geometry.type === t).length;
  res.info = `${g.features.length} ${what} feature${g.features.length === 1 ? '' : 's'}: ${c('Point')} point${c('Point') === 1 ? '' : 's'}, ${g.features.length - c('Point')} line${g.features.length - c('Point') === 1 ? '' : 's'} or shape${g.features.length - c('Point') === 1 ? '' : 's'}.`;
  return res;
};
async function toGpx(files) {
  const f = files[0], r = geojsonToGpx(parseJson(await textOf(f)), { name: base(f.name) });
  const res = [out(`${base(f.name)}.gpx`, r.text, 'application/gpx+xml')];
  res.info = `${r.waypoints} waypoint${r.waypoints === 1 ? '' : 's'} and ${r.tracks} track${r.tracks === 1 ? '' : 's'}${r.outlines ? `; ${r.outlines} area outline${r.outlines === 1 ? ' is' : 's are'} written as tracks` : ''}.`;
  return res;
}
async function toCsv(files, o = {}) {
  const f = files[0], rows = geojsonToRows(parseJson(await textOf(f)));
  return [out(`${base(f.name)}.csv`, rowsToCsv(rows, { delimiter: o.delimiter || ',' }), 'text/csv')];
}

const GEO = 'Maps and GPS';
export const MEDIA_GEO = [
  { id: 'favicon-pack', label: 'Favicon set for a website (ICO, PNG)', group: 'Images', from: IMAGE, ext: 'zip', mode: 'each', keywords: ['favicon', 'icon', 'apple-touch-icon', 'manifest', 'website'],
    options: [{ key: 'name', type: 'text', label: 'Site name (for the manifest)', placeholder: 'My site' },
      { key: 'padding', type: 'select', label: 'Space around the picture', value: '0', options: [['0', 'None'], ['5', 'A little (5%)'], ['10', 'Some (10%)'], ['15', 'More (15%)']] },
      { key: 'fill', type: 'checkbox', label: 'Fill the background', value: false, hint: 'Off: transparent, except the Apple icon, which is always filled (iPhones show transparency as black).' },
      { key: 'background', type: 'color', label: 'Background colour', value: '#ffffff' }],
    run: favicon },
  { id: 'audio-trim', label: 'Cut audio (trim)', group: 'Audio and video', from: AUDIO_IN, ext: 'wav', mode: 'each', keywords: ['trim', 'cut', 'clip', 'ringtone', 'fade'],
    options: [START, END, { key: 'fadeIn', type: 'number', label: 'Fade in (seconds)', min: 0, max: 60, step: 0.1, value: 0 },
      { key: 'fadeOut', type: 'number', label: 'Fade out (seconds)', min: 0, max: 60, step: 0.1, value: 0 },
      { key: 'output', type: 'select', label: 'Save as', value: 'wav', options: [['wav', 'WAV (lossless)'], ['mp3', 'MP3']] },
      { key: 'bitrate', type: 'select', label: 'MP3 bitrate', value: '192', options: [['128', '128 kbps'], ['192', '192 kbps'], ['320', '320 kbps']] }],
    run: audioTrim },
  { id: 'video-trim', engine: 'ffmpeg', label: 'Cut video (trim)', group: 'Audio and video', from: VIDEO_IN, ext: 'mp4', mode: 'each', keywords: ['trim', 'cut', 'clip', 'shorten'],
    options: [START, END, { key: 'exact', type: 'checkbox', label: 'Cut at the exact frame (slower: the video is re-encoded)', value: false, hint: 'Off: the streams are copied, which is fast and loses nothing, but the cut starts at the nearest key frame before the start.' }],
    run: videoTrim },
  { id: 'gpx-to-geojson', label: 'GPX to GeoJSON', group: GEO, from: ['gpx'], ext: 'geojson', mode: 'each', keywords: ['gps', 'track', 'strava', 'garmin', 'map'], options: [], run: geo(gpxToGeojson, 'GPX') },
  { id: 'kml-to-geojson', label: 'KML to GeoJSON', group: GEO, from: ['kml'], ext: 'geojson', mode: 'each', keywords: ['google earth', 'google maps', 'map', 'placemark'], options: [], run: geo(kmlToGeojson, 'KML') },
  { id: 'geojson-to-gpx', label: 'GeoJSON to GPX', group: GEO, from: ['geojson'], ext: 'gpx', mode: 'each', keywords: ['gps', 'track', 'waypoints', 'garmin'], options: [], run: toGpx },
  { id: 'geojson-to-csv', label: 'GeoJSON to CSV (points)', group: GEO, from: ['geojson'], ext: 'csv', mode: 'each', keywords: ['latitude', 'longitude', 'coordinates', 'table', 'excel'],
    options: [{ key: 'delimiter', type: 'select', label: 'Separator', value: ',', options: [[',', 'Comma'], [';', 'Semicolon'], ['\t', 'Tab']] }], run: toCsv },
];
