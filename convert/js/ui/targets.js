/* Per-file targets: each file in the list has its own "Convert to". Every list of formats here comes from the catalog's
 * conversionsFor (one source of truth): a file's own list is conversionsFor([its kind]), a set of files' shared list is
 * conversionsFor(their kinds).
 *   item.target   null (not chosen: the default for its kind), a conversion id, or WITH ('@with': goes with a model)
 * Companions: a kind in a conversion's `with` list (an OBJ's .mtl, a glTF's .bin, textures) goes with the models in the
 * list when there are any and it has no format of its own or a file in the list names it; it is never converted on its own
 * then. A picture can also be converted on its own: its menu offers both. */
import { CONVERSIONS, conversionsFor, conversionById } from '../core/catalog.js';

export const WITH = '@with';
const HOSTS = CONVERSIONS.filter((c) => c.with);
const generic = (c) => c.from.includes('*');

/** The formats one file of this kind can become (on a converter page, only that page's conversion). */
export const ownTargets = (kind, only = null) => conversionsFor([kind], only);

/** The default for a kind: `prefer` when it fits, else the first conversion made for the kind (not one that takes any
 *  file, such as Base64 or ZIP, unless that is all there is). The same order as the catalog, so the same as before. */
export function defaultTarget(kind, only = null, prefer = null) {
  const list = ownTargets(kind, only);
  if (prefer && list.some((c) => c.id === prefer)) return prefer;
  const c = list.find((x) => !generic(x)) || list[0];
  return c ? c.id : '';
}

/** The models in the list a companion of this kind could go with. */
export function modelsFor(item, items) {
  const hosts = HOSTS.filter((c) => c.with.includes(item.kind));
  if (!hosts.length) return [];
  return items.filter((i) => i !== item && hosts.some((c) => c.from.includes(i.kind)));
}
export const canAccompany = (item, items) => modelsFor(item, items).length > 0;

/** Kinds whose text may name their companions (a model, an .mtl, a glTF): their first bytes are kept as `refs`. */
const REF_KINDS = new Set(HOSTS.flatMap((c) => [...c.from, ...c.with.filter((k) => !ownTargets(k).some((x) => !generic(x)))]));
export const needsRefs = (kind) => REF_KINDS.has(kind);
export async function readRefs(file) { return new TextDecoder('latin1').decode(await file.slice(0, 2 << 20).arrayBuffer()); }
/** A companion goes with the model by default when it has no format of its own (an .mtl, a .bin) or when a file in the
 *  list names it (map_Kd logo.png in the .mtl): a photo dropped beside a model, but not named by it, is converted on its own. */
function goesWith(item, items, only) {
  if (!ownTargets(item.kind, only).some((c) => !generic(c))) return true;
  return items.some((i) => i !== item && i.refs && i.refs.includes(item.name));
}

/** The target a file runs with: its choice when that still fits, else its default (WITH for a companion of a model). */
export function resolve(item, items, only = null) {
  const t = item.target;
  const accompany = canAccompany(item, items);
  if (t === WITH && accompany) return WITH;
  if (t && t !== WITH && ownTargets(item.kind, only).some((c) => c.id === t)) return t;
  if (accompany && goesWith(item, items, only)) return WITH;
  return defaultTarget(item.kind, only);
}

/** The choices of one file's menu: [{ id, label, ext, group }] (WITH first for a companion). */
export function choicesFor(item, items, only = null) {
  const own = ownTargets(item.kind, only).map((c) => ({ id: c.id, label: c.label, ext: c.ext || 'file', group: c.group || 'Other' }));
  const models = modelsFor(item, items);
  if (!models.length) return own;
  const name = models.length === 1 ? models[0].name : `${models.length} models`;
  return [{ id: WITH, label: `With ${name}`, ext: models[0].kind, group: 'Goes with' }, ...own];
}

/** The formats every one of these files can become (companions count as going with their model). */
export function sharedTargets(items, only = null) {
  if (!items.length) return [];
  return conversionsFor([...new Set(items.map((i) => i.kind))], only);
}

/** Sets one conversion on a file, if it fits: its own format, or WITH when the conversion takes it beside a model. */
export function applyTarget(item, items, id, only = null) {
  if (ownTargets(item.kind, only).some((c) => c.id === id)) { item.target = id; return true; }
  const c = conversionById(id);
  if (c && c.with && c.with.includes(item.kind) && canAccompany(item, items)) { item.target = WITH; return true; }
  return false;
}

/** The runs: one per conversion in use, in list order, each with its files. A conversion that takes companions gets the
 *  companions in the list too. */
export function groupsFor(items, only = null) {
  const by = new Map(), mates = [];
  for (const it of items) {
    const t = resolve(it, items, only);
    if (t === WITH) { mates.push(it); continue; }
    const conv = t && conversionById(t);
    if (!conv) continue;
    if (!by.has(t)) by.set(t, { conv, items: [] });
    by.get(t).items.push(it);
  }
  for (const g of by.values()) if (g.conv.with) g.items.push(...mates.filter((m) => g.conv.with.includes(m.kind)));
  return [...by.values()];
}

/** The target every one of these files shares ('' when they differ or there are none). Companions are left out. */
export function commonTarget(items, all, only = null) {
  const ts = new Set(items.map((i) => resolve(i, all, only)).filter((t) => t !== WITH));
  return ts.size === 1 ? [...ts][0] : '';
}
