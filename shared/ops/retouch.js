/* PhotoSlop's Auto retouch as headless operations, for Slop Workflows (registry: shared/ops/registry.js):
 *   photoslop.auto-enhance   "Auto enhance photos": levels, white balance, exposure, shadows and highlights, vibrance,
 *                            gentle sharpening, optional denoise and straighten
 *   photoslop.portrait       "Portrait retouch": skin smoothing, blemish healing, red-eye and optional whitening
 * Both run PhotoSlop itself in its hidden copy (shared/macros/frame.js runInHost, the one PhotoSlop macros use): open the
 * picture, run the command (ps.retouch.auto-enhance or ps.retouch.portrait, photoslop/js/retouch/boot.js) with these
 * options, write the result. So a workflow, the menus, Ctrl+K and the AI panel share one implementation. On this device;
 * face detection is used only when the person has turned it on in Profile. toArgs(id, options) maps these options to the
 * command's arguments. */
import { register } from './registry.js';
import { IMAGE_IN, pictureKind, stem } from './load.js';

const HOST = { app: 'photoslop', url: 'photoslop/?macro-host=1' };
let runInHost = null;
const runner = async () => (runInHost = runInHost || (await import('../macros/frame.js')).runInHost);

const FORMAT = { key: 'format', type: 'select', label: 'Save as', value: 'same', options: [['same', 'Same as the file'], ['png', 'PNG'], ['jpg', 'JPG'], ['webp', 'WebP']] };
const QUALITY = { key: 'quality', type: 'range', label: 'Quality (JPG, WebP)', min: 40, max: 100, step: 1, value: 92 };
const outKind = (k, o = {}) => (!o.format || o.format === 'same' ? pictureKind(k) : o.format);
const bool = (v, d) => (v === undefined ? d : !!v);

/** The command and its arguments for an operation's options. */
export function toArgs(id, o = {}) {
  if (id === 'photoslop.auto-enhance') {
    return ['ps.retouch.auto-enhance', { strength: Number(o.strength ?? 100), white_balance: bool(o.white_balance, true), sharpen: Number(o.sharpen ?? 25),
      denoise: o.denoise || 'none', straighten: bool(o.straighten, false) }];
  }
  return ['ps.retouch.portrait', { smoothing: Number(o.smoothing ?? 45), blemishes: bool(o.blemishes, true), red_eye: bool(o.red_eye, true),
    teeth: Number(o.teeth ?? 0), eyes: Number(o.eyes ?? 0), faces: 'auto', subject: false }];
}

function op(id, title, options, description, keywords) {
  return {
    group: 'Pictures', from: IMAGE_IN, ext: 'png', mode: 'each', out: outKind, engine: 'photoslop', description, keywords,
    options: options.concat([FORMAT, QUALITY]),
    async run(files, o = {}, ctx = {}) {
      const f = files[0], kind = outKind(f.kind, o), [cmd, args] = toArgs(id, o), run = await runner();
      const r = await run(HOST, f.file, [{ cmd, args, title }], { format: kind, quality: Number(o.quality ?? 92) / 100 }, { signal: ctx.signal, timeout: 5 * 60 * 1000 });
      if (ctx.progress) ctx.progress(1);
      return [{ name: `${stem(f.name)}.${r.kind}`, blob: r.blob, kind: r.kind }];
    },
  };
}

export const RETOUCH_OPS = register([
  { id: 'photoslop.auto-enhance', label: 'Auto enhance photos', ...op('photoslop.auto-enhance', 'Auto enhance', [
    { key: 'strength', type: 'range', label: 'Strength (%)', min: 0, max: 100, step: 1, value: 100 },
    { key: 'white_balance', type: 'checkbox', label: 'Fix the colour cast (white balance)', value: true },
    { key: 'sharpen', type: 'range', label: 'Sharpen (%)', min: 0, max: 100, step: 1, value: 25 },
    { key: 'denoise', type: 'select', label: 'Denoise', value: 'none', options: [['none', 'Off'], ['light', 'Light'], ['medium', 'Medium'], ['strong', 'Strong']] },
    { key: 'straighten', type: 'checkbox', label: 'Straighten a tilted horizon (rotates and crops)', value: false },
  ], 'Fixes each photo on this device: levels and contrast, white balance, exposure, shadows and highlights, vibrance and gentle sharpening (PhotoSlop’s Auto enhance).',
  ['auto enhance', 'auto fix', 'white balance', 'colour cast', 'levels', 'exposure', 'brighten', 'photo fix', 'retouch']) },
  { id: 'photoslop.portrait', label: 'Portrait retouch', ...op('photoslop.portrait', 'Portrait retouch', [
    { key: 'smoothing', type: 'range', label: 'Skin smoothing (%)', min: 0, max: 100, step: 1, value: 45 },
    { key: 'blemishes', type: 'checkbox', label: 'Heal blemishes', value: true },
    { key: 'red_eye', type: 'checkbox', label: 'Fix red eyes (needs face detection, Profile)', value: true },
    { key: 'teeth', type: 'range', label: 'Whiten teeth (%)', min: 0, max: 100, step: 1, value: 0 },
    { key: 'eyes', type: 'range', label: 'Whiten eyes (%)', min: 0, max: 100, step: 1, value: 0 },
  ], 'Retouches portraits on this device: smooths skin (keeping pores and edges), heals small blemishes, fixes red eyes, optional teeth and eye whitening (PhotoSlop’s Portrait retouch).',
  ['portrait', 'skin', 'smooth skin', 'blemish', 'acne', 'red eye', 'teeth whitening', 'retouch', 'beauty']) },
], { app: 'photoslop', label: 'PhotoSlop' });
