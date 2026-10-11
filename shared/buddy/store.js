// XP, levels and hats. XP lives in localStorage; level = 1 + floor(sqrt(xp / 8)).
const KEY = 'slop.mascot.v1';

/** One new hat per level, in unlock order (drawn in hats.js). */
export const HAT_ORDER = ['sprout', 'party', 'beanie', 'bow', 'headphones', 'cowboy', 'chef', 'pirate', 'tophat',
  'viking', 'wizard', 'ninja', 'knight', 'gradcap', 'propeller', 'catears', 'halo', 'crown'];
const LABEL = {
  sprout: 'Sprout', party: 'Party hat', beanie: 'Beanie', bow: 'Bow', headphones: 'Headphones', cowboy: 'Cowboy hat',
  chef: 'Chef hat', pirate: 'Pirate hat', tophat: 'Top hat', viking: 'Viking helmet', wizard: 'Wizard hat',
  ninja: 'Ninja band', knight: 'Knight helmet', gradcap: 'Grad cap', propeller: 'Propeller cap', catears: 'Cat ears',
  halo: 'Halo', crown: 'Crown',
};
export const hatLabel = (h) => (h ? LABEL[h] || h : 'No hat');

export const levelFor = (xp) => 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 8));
/** XP needed to reach a level. */
export const xpFor = (lv) => 8 * (lv - 1) * (lv - 1);
export const hatsFor = (lv) => HAT_ORDER.slice(0, Math.max(0, lv - 1));
/** He grows a little each level, up to +45%. */
export const scaleFor = (lv) => 1 + Math.min(0.45, (lv - 1) * 0.06);

export function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || '{}');
    const xp = Math.max(0, Math.floor(+d.xp || 0));
    const hats = hatsFor(levelFor(xp));
    const hat = d.hat === null ? null : hats.includes(d.hat) ? d.hat : hats[hats.length - 1] || null;
    const rage = Math.max(0, Math.min(3, +d.rage || 0));
    return { xp, hat, rage, fav: d.fav || null, hate: d.hate || null, stock: d.stock || {} };
  } catch (e) { return { xp: 0, hat: null, rage: 0, fav: null, hate: null, stock: {} }; }
}
/** Merge fields into the saved state. */
export function save(d) {
  try {
    const cur = JSON.parse(localStorage.getItem(KEY) || '{}');
    localStorage.setItem(KEY, JSON.stringify(Object.assign(cur, d)));
  } catch (e) { /* private mode: progress lasts this visit */ }
}
