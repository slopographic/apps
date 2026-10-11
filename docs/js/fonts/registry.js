/* Slop Docs — fonts/registry: the document font families. Each has four static TrueType faces in
 * shared/fonts/<dir>/ttf/ (no kerning or ligature tables). The SAME bytes are used three ways:
 * registered as a FontFace for the on-screen SVG pages, parsed for text measurement (advance widths),
 * and subset into the PDF. That is what makes screen and PDF line breaks identical.
 * Word and Google font names map to metric-compatible families (Calibri → Carlito, Arial → Arimo …). */
import { parseTTF } from './ttf.js';

export const FAMILIES = [
  { name: 'Carlito', dir: 'carlito', stem: 'Carlito', cat: 'sans-serif', aliases: ['calibri', 'aptos', 'calibri light', 'segoe ui', 'candara', 'corbel'] },
  { name: 'Arimo', dir: 'arimo', stem: 'Arimo', cat: 'sans-serif', aliases: ['arial', 'helvetica', 'helvetica neue', 'liberation sans', 'verdana', 'tahoma', 'open sans', 'roboto', 'noto sans', 'sans-serif', 'trebuchet ms', 'lato', 'source sans pro'] },
  { name: 'Tinos', dir: 'tinos', stem: 'Tinos', cat: 'serif', aliases: ['times new roman', 'times', 'liberation serif', 'georgia', 'garamond', 'book antiqua', 'palatino', 'palatino linotype', 'serif', 'merriweather', 'noto serif', 'pt serif', 'lora'] },
  { name: 'Caladea', dir: 'caladea', stem: 'Caladea', cat: 'serif', aliases: ['cambria', 'constantia'] },
  { name: 'Cousine', dir: 'cousine', stem: 'Cousine', cat: 'monospace', aliases: ['courier new', 'courier', 'liberation mono', 'consolas', 'monospace', 'lucida console', 'menlo', 'monaco', 'roboto mono', 'source code pro'] },
  { name: 'Inter Tight', dir: 'inter-tight', stem: 'InterTight', cat: 'sans-serif', aliases: ['inter'] },
  { name: 'Archivo', dir: 'archivo', stem: 'Archivo', cat: 'sans-serif', aliases: [] },
  { name: 'JetBrains Mono', dir: 'jetbrains-mono', stem: 'JetBrainsMono', cat: 'monospace', aliases: [] },
];
export const DEFAULT_FAMILY = 'Carlito';
const STYLE = ['Regular', 'Bold', 'Italic', 'BoldItalic'];
let BASE = new URL('../../../shared/fonts/', import.meta.url).href;
/** Where the shared/fonts folder lives (the offline build points this at embedded data). */
export function setFontBase(url) { BASE = url; }
/** Optional override: (dir, file) → Promise<ArrayBuffer>, used by the offline single-file build. */
let fetcher = null;
export function setFontFetcher(fn) { fetcher = fn; }

const byLower = new Map();
for (const f of FAMILIES) { byLower.set(f.name.toLowerCase(), f); for (const a of f.aliases) byLower.set(a, f); }
/** The family that renders a font name (unknown names fall back by a serif/mono guess). */
export function familyOf(name) {
  const k = String(name || '').trim().replace(/^["']|["']$/g, '').toLowerCase();
  if (byLower.has(k)) return byLower.get(k);
  if (/mono|code|courier|consol/.test(k)) return byLower.get('cousine');
  if (/serif|times|roman|garamond|georgia|book|minion|baskerville/.test(k) && !/sans/.test(k)) return byLower.get('tinos');
  return byLower.get(DEFAULT_FAMILY.toLowerCase());
}
export const cssFamily = (fam) => `SD ${fam.name}`;
export const faceKey = (fam, b, i) => `${fam.dir}-${(b ? 1 : 0) + (i ? 2 : 0)}`;

const faces = new Map(); // key → face | Promise
const listeners = new Set();
export function onFontLoad(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** A loaded face { key, fam, b, i, ttf, bytes, css } or null when it is still loading. */
export function face(name, b = false, i = false) {
  const fam = typeof name === 'object' ? name : familyOf(name);
  const k = faceKey(fam, b, i), f = faces.get(k);
  if (f && !(f instanceof Promise)) return f;
  if (!f) loadFace(fam, b, i).catch(() => {});
  return null;
}
/** Load (once) one face; resolves to the face. */
export function loadFace(fam, b = false, i = false) {
  if (typeof fam !== 'object') fam = familyOf(fam);
  const k = faceKey(fam, b, i);
  if (faces.has(k)) return Promise.resolve(faces.get(k));
  const file = `${fam.stem}-${STYLE[(b ? 1 : 0) + (i ? 2 : 0)]}.ttf`;
  const p = (async () => {
    const buf = fetcher ? await fetcher(fam.dir, file) : await fetch(`${BASE}${fam.dir}/ttf/${file}`).then((r) => { if (!r.ok) throw new Error('Font ' + file + ' ' + r.status); return r.arrayBuffer(); });
    const bytes = new Uint8Array(buf), ttf = parseTTF(bytes);
    const css = cssFamily(fam);
    if (typeof FontFace !== 'undefined' && typeof document !== 'undefined') {
      const ff = new FontFace(css, bytes.slice().buffer, { weight: b ? '700' : '400', style: i ? 'italic' : 'normal' });
      await ff.load(); document.fonts.add(ff);
    }
    const out = { key: k, fam, b, i, ttf, bytes, css, cache: new Map() };
    faces.set(k, out);
    for (const fn of listeners) try { fn(out); } catch (e) { console.error(e); }
    return out;
  })();
  faces.set(k, p);
  p.catch(() => faces.delete(k));
  return p;
}
/** Load every face a list of { font, b, i } needs (plus the default regular). */
export async function ensureFaces(list) {
  const want = new Map([[faceKey(familyOf(DEFAULT_FAMILY), false, false), [familyOf(DEFAULT_FAMILY), false, false]]]);
  for (const s of list) { const fam = familyOf(s.font); want.set(faceKey(fam, s.b, s.i), [fam, !!s.b, !!s.i]); }
  await Promise.all([...want.values()].map(([f, b, i]) => loadFace(f, b, i).catch((e) => console.warn(e.message))));
}
/** The face to use for text: the wanted face, or the closest loaded one while it loads. */
export function bestFace(name, b, i) {
  const fam = familyOf(name);
  return face(fam, b, i) || face(fam, b, false) || face(fam, false, false) || face(DEFAULT_FAMILY, false, false) || null;
}
export const loadedFaces = () => [...faces.values()].filter((f) => !(f instanceof Promise));

let canvas = null;
function fallbackWidth(ch, size) {
  if (typeof document === 'undefined') return size * 0.6;
  canvas = canvas || document.createElement('canvas').getContext('2d');
  canvas.font = `${size}px sans-serif`;
  return canvas.measureText(ch).width;
}
/** Advance width of one code point in points. */
export function charWidth(f, cp, size) {
  if (!f) return size * 0.5;
  let w = f.cache.get(cp);
  if (w === undefined) {
    const g = f.ttf.has(cp) ? f.ttf.gid(cp) : -1;
    w = g >= 0 ? f.ttf.adv(g) / f.ttf.upm : (cp === 9 || cp === 10 ? 0 : -1);
    f.cache.set(cp, w);
  }
  return w >= 0 ? w * size : fallbackWidth(String.fromCodePoint(cp), size);
}
/** Width of a string in points (sum of advances: no kerning, no ligatures, same as the PDF). */
export function textWidth(f, text, size) {
  let w = 0;
  for (const ch of text) w += charWidth(f, ch.codePointAt(0), size);
  return w;
}
/** Vertical metrics in points for a size: { asc, desc, gap, line }. */
export function vmetrics(f, size) {
  if (!f) return { asc: size * 0.9, desc: size * 0.25, gap: 0, line: size * 1.15 };
  const k = size / f.ttf.upm;
  return { asc: f.ttf.asc * k, desc: f.ttf.desc * k, gap: f.ttf.gap * k, line: (f.ttf.asc + f.ttf.desc + f.ttf.gap) * k };
}
