/* SlopClean's headless operation, for Slop Workflows (registry: shared/ops/registry.js):
 *   clean.metadata   removes GPS, camera, dates and the rest with SlopClean's own core (clean/js/core/index.js strip: the
 *                    picture data is copied as it is, never re-encoded, and the result is read back). JPEG, PNG, WebP, TIFF.
 * TIFF is left to SlopClean itself: the other picture steps cannot read it in a browser.
 * removeOf(choice, cats) is the category set for each choice; the categories themselves are SlopClean's (tags.js CATS). */
import { register } from './registry.js';
import { scripts } from './load.js';

const g = globalThis;
const FILES = ['clean/js/core/bytes.js', 'clean/js/core/tags.js', 'clean/js/core/xmp.js', 'clean/js/core/tiff.js', 'clean/js/core/jpeg.js',
  'clean/js/core/png.js', 'clean/js/core/webp.js', 'clean/js/core/index.js'];
const KIND = { jpeg: 'jpg', png: 'png', webp: 'webp', tiff: 'tif' };

/** The categories to remove: 'app' is SlopClean's own default (each category's def), 'location' only GPS, 'all' every one. */
export function removeOf(choice, cats) {
  const out = {};
  for (const c of cats) out[c.id] = choice === 'all' ? true : choice === 'location' ? c.id === 'location' : !!c.def;
  return out;
}

async function strip(files, o) {
  await scripts(FILES, () => !!(g.SlopClean && g.SlopClean.strip));
  const f = files[0], C = g.SlopClean;
  const r = C.strip(new Uint8Array(await f.file.arrayBuffer()), { remove: removeOf(o.remove || 'app', C.CATS) });
  return [{ name: f.name, blob: new Blob([r.bytes], { type: r.mime }), kind: KIND[r.format] || f.kind }];
}

export const CLEAN_OPS = register([
  { id: 'clean.metadata', label: 'Remove metadata (EXIF, GPS)', group: 'Pictures', from: ['jpg', 'png', 'webp'], mode: 'each', out: (k) => k,
    description: 'Removes the location, camera, serial numbers, dates and other hidden fields without re-encoding the picture.',
    keywords: ['exif', 'gps', 'metadata', 'privacy', 'location', 'strip', 'clean'],
    options: [{ key: 'remove', type: 'select', label: 'Remove', value: 'app', options: [
      ['app', 'Everything but the colour profile and print size'], ['location', 'Only the location (GPS)'], ['all', 'Everything, colour profile too']] }],
    run: strip },
], { app: 'clean', label: 'SlopClean' });
