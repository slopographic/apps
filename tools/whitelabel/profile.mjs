// Brand profiles (brand/profiles/<id>.json): loading, checking and the facts the build derives from one.
// The schema is documented in brand/README.md ("Profiles"); validate() is its executable form.
// Node only. Tests: tests/node/whitelabel-profile.test.mjs.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const HEX = /^#[0-9a-f]{3,8}$/i;
const TOKENS = ['background', 'surface', 'text', 'accent', 'border'];
const LANGS = ['en', 'es', 'fr', 'de', 'pt-BR', 'it', 'ar', 'sv'];

/** Every problem with a profile, as readable lines (empty when it is valid). */
export function validate(p) {
  const errs = [];
  const need = (k, ok, what) => { if (!ok(p[k])) errs.push(`${k}: ${what}`); };
  const isStr = (v) => typeof v === 'string' && v.trim() !== '';
  need('id', (v) => /^[a-z][a-z0-9-]*$/.test(v || ''), 'lower-case id, the file name');
  need('name', isStr, 'the product name');
  need('origin', (v) => /^https:\/\/[a-z0-9.-]+$/.test(v || ''), 'https origin without a trailing slash');
  need('cname', (v) => /^[a-z0-9.-]+$/.test(v || ''), 'the custom domain');
  need('defaultLang', (v) => LANGS.includes(v), `one of ${LANGS.join(', ')}`);
  need('naming', (v) => v === 'brand' || v === 'plain', "'brand' or 'plain'");
  need('tone', (v) => v === 'playful' || v === 'plain', "'playful' or 'plain'");
  need('mascot', (v) => typeof v === 'boolean', 'true or false');
  need('github', (v) => /^[A-Za-z0-9-]+$/.test(v || ''), 'GitHub account of the site');
  need('brandTerms', (v) => Array.isArray(v) && v.length > 0 && v.every(isStr), 'words that only this brand uses');
  need('colors', (v) => v && ['ink', 'paper', 'accent'].every((k) => HEX.test(v[k])), 'ink, paper and accent as #hex');
  need('media', (v) => typeof v === 'boolean', 'true (ship shots, clips and videos) or false');
  need('analytics', (v) => typeof v === 'boolean', 'true or false');
  need('footer', (v) => typeof v === 'string', 'the footer line');
  need('legal', (v) => v && isStr(v.holder) && /^\d{4}$/.test(v.year || ''), '{ holder, year }');
  for (const [id, t] of Object.entries(p.themes || {})) {
    if (id === 'hide') { if (!Array.isArray(t)) errs.push('themes.hide: a list of theme ids'); continue; }
    for (const k of TOKENS) if (!HEX.test((t || {})[k] || '')) errs.push(`themes.${id}.${k}: #hex`);
  }
  if (p.logo && typeof p.logo === 'object' && !isStr(p.logo.text)) errs.push('logo.text: the wordmark text');
  if (p.publish) for (const k of ['repo', 'branch', 'secret', 'author', 'email']) if (!isStr(p.publish[k])) errs.push(`publish.${k}: required`);
  if (p.publish && !/^[\w.-]+\/[\w.-]+$/.test(p.publish.repo || '')) errs.push('publish.repo: owner/name');
  return errs;
}

/** The profiles folder in this repo (another one can be passed to the build), every profile in a folder, and one by id
 * (throws with the problems when it is invalid). */
export const profilesDir = (root) => path.join(root, 'brand', 'profiles');
export function allProfiles(dir) {
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .filter((f) => !f.endsWith('.map.json')).map((f) => JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
}
export function loadProfile(dir, id) {
  const file = path.join(dir, `${id}.json`);
  if (!existsSync(file)) throw new Error(`no profile ${id} (${file})`);
  const p = JSON.parse(readFileSync(file, 'utf8'));
  const errs = validate(p);
  if (p.id !== id) errs.push(`id: '${p.id}' does not match the file name`);
  if (errs.length) throw new Error(`profile ${id}:\n  ${errs.join('\n  ')}`);
  return p;
}

/** The registry as the source tree has it: { id: { name, plain } } and the [brand name, plain name] pairs. */
export function registryNames(root) {
  const win = {};
  vm.runInNewContext(readFileSync(path.join(root, 'shared', 'apps.js'), 'utf8'), { window: win });
  return win.SLOP_APPS.map((a) => [a.brandName, a.plain]).filter(([a, b]) => a && b && a !== b);
}

/** The visible-name pairs for a profile: registry names (when naming is plain), the tone's copy layer, the profile's own
 * copy, and the source brand name -> the profile's name. Later sources override earlier ones. */
export function phrasePairs(root, p) {
  const map = new Map();
  if (p.naming === 'plain') for (const [a, b] of registryNames(root)) map.set(a, b);
  if (p.tone === 'plain') {
    const tone = JSON.parse(readFileSync(path.join(root, 'brand', 'copy', 'plain.json'), 'utf8'));
    for (const [a, b] of Object.entries(tone)) if (a !== '_') map.set(a, b);
  }
  for (const [a, b] of Object.entries(p.copy || {})) map.set(a, b);
  if (p.seo && p.seo.titleSuffix) map.set(' | Slopographic', p.seo.titleSuffix);   // page titles have a length limit
  map.set('Slopographic', p.name);
  map.set('>slopographic<', `>${p.name}<`);                       // the home link under each app's name
  return [...map.entries()];
}

/** The rename map of a profile: <profiles dir>/<id>.map.json, { stem: [source, target], compounds: [{ from, to, fromCamel?,
 * toCamel?, path? }] }. One file holds every token and folder rename, so the reverse (import.mjs) reads the same map. */
export function loadMap(dir, id) {
  const file = path.join(dir, `${id}.map.json`);
  if (!existsSync(file)) return null;
  const m = JSON.parse(readFileSync(file, 'utf8'));
  const errs = [];
  if (!Array.isArray(m.stem) || m.stem.length !== 2 || !/^[a-z]+$/.test(m.stem[1] || '')) errs.push('stem: [source, lower-case target]');
  for (const c of m.compounds || []) {
    if (!/^[a-z0-9-]+$/.test(c.from || '') || !/^[a-z0-9]+$/.test(c.to || '')) errs.push(`compound ${c.from}: from and to in lower case (to without dashes)`);
    if (c.path && !/^[a-z0-9-]+$/.test(c.path)) errs.push(`compound ${c.from}: path is a folder name`);
  }
  if (errs.length) throw new Error(`map ${id}:\n  ${errs.join('\n  ')}`);
  return { stem: m.stem, compounds: m.compounds || [] };
}

/** The words a build of profile p must not contain: the source brand's and every other profile's brand terms, and the
 * profile's own extra `forbid` list. */
export function forbiddenTerms(dir, p) {
  const terms = new Set(['slop', 'slurp', ...(p.forbid || [])]);
  for (const o of allProfiles(dir)) if (o.id !== p.id) for (const t of o.brandTerms) terms.add(t.toLowerCase());
  return [...terms].map((t) => t.toLowerCase());
}
