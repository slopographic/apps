/* Slop Photo Sorter: swipe through a pile of photos and keep the best. Photos come from a drop, Choose files or a whole
 * folder; they stay in this browser's memory (nothing is uploaded or stored). Start sorting opens the swipe deck shared
 * with Slop Gallery (shared/deck/deck.js): like, dislike, skip, back, tag. The grid shows each photo with its decision and
 * tags, filtered by All, Not sorted yet, Liked, Disliked or a tag; a click opens the deck there. The liked photos download
 * as a ZIP or go to Slop Drive; the decisions download as CSV. The model is js/model.js. */
import { writeZip } from '../../shared/office/zip.js';

const M = window.SlopSorter.model, UI = window.SlopUI, $ = (id) => document.getElementById(id);
const set = M.create(), urls = new Map();
let which = 'all', dropZone = null;
const say = (t) => { $('soMsg').textContent = t || ''; };
const urlOf = (id) => { if (!urls.has(id)) { const it = set.get(id); if (it) urls.set(id, URL.createObjectURL(it.file)); } return urls.get(id) || null; };
const shown = () => M.filter(set.items, which);

const deck = window.SlopDeck.create({
  photo: (id) => set.get(id), url: (id) => Promise.resolve(urlOf(id)), release: () => {},
  setLiked: (id, v) => set.setLiked(id, v), addTag: (id, t) => set.addTag(id, t), removeTag: (id, t) => set.removeTag(id, t),
  on: (fn) => set.on(fn), onClose: () => draw(),
});

function add(files) {
  const added = set.add(files);
  const skipped = [...(files || [])].length - added.length;
  say(added.length ? `${added.length} photo${added.length === 1 ? '' : 's'} added${skipped ? `; ${skipped} other file${skipped === 1 ? '' : 's'} left out` : ''}. Press Start sorting.`
    : 'No photos there: JPEG, PNG, WebP, GIF, AVIF and SVG pictures can be sorted.');
  draw();
  return added;
}

/** The filter buttons with their counts; a tag gets its own button once a photo has it. */
function drawFilters(c) {
  const opts = [['all', `All ${c.all}`], ['unsorted', `Not sorted yet ${c.unsorted}`], ['liked', `Liked ${c.liked}`], ['disliked', `Disliked ${c.disliked}`],
    ...c.tags.map(([t, n]) => [`tag:${t}`, `#${t} ${n}`])];
  if (!opts.some(([k]) => k === which)) which = 'all';
  $('soFilters').replaceChildren(...opts.map(([k, label]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'so-filter'; b.textContent = label; b.setAttribute('aria-pressed', String(k === which));
    b.addEventListener('click', () => { which = k; draw(); });
    return b;
  }));
}

function card(it, i, list) {
  const li = document.createElement('li');
  li.className = `so-card${it.liked ? ' is-' + it.liked : ''}`;
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'so-thumb'; b.title = `${it.name}: sort from here`;
  b.setAttribute('aria-label', `${it.name}${it.liked ? `, ${it.liked}` : ''}. Sort from here`);
  const img = document.createElement('img');
  img.loading = 'lazy'; img.alt = ''; img.src = urlOf(it.id);
  b.append(img);
  b.addEventListener('click', () => deck.open(list.map((x) => x.id), { start: i }));
  const badge = document.createElement('span');
  badge.className = 'so-badge'; badge.textContent = it.liked === 'liked' ? '♥' : it.liked === 'disliked' ? '✕' : '';
  const name = document.createElement('span');
  name.className = 'so-name'; name.textContent = it.tags.length ? `${it.name} · ${it.tags.map((t) => '#' + t).join(' ')}` : it.name;
  li.append(b, badge, name);
  return li;
}

function draw() {
  const items = set.items, c = M.counts(items), list = shown();
  $('soWork').hidden = items.length === 0;
  if (dropZone) dropZone.empty(!items.length);
  drawFilters(c);
  $('soGrid').replaceChildren(...list.map((it, i) => card(it, i, list)));
  $('soNone').hidden = list.length > 0;
  $('soStart').textContent = c.unsorted ? `Start sorting (${c.unsorted})` : 'Sort again';
  $('soStart').disabled = !items.length;
  for (const id of ['soZip', 'soDrive']) $(id).disabled = !c.liked;
  $('soCsv').disabled = $('soClear').disabled = !items.length;
}

/** Start sorting: the photos not sorted yet (or, when all are, the ones shown). */
function start() {
  const todo = M.filter(set.items, 'unsorted'), list = todo.length ? todo : shown();
  if (list.length) deck.open(list.map((x) => x.id));
}

const liked = () => M.filter(set.items, 'liked');
/** A name not used yet in the ZIP or the Drive folder (two photos of the same name from different folders). */
function names(list) {
  const seen = new Set();
  return list.map((x) => {
    let n = x.name, k = 2;
    while (seen.has(n.toLowerCase())) n = x.name.replace(/(\.[^.]*)?$/, (ext) => ` (${k++})${ext || ''}`);
    seen.add(n.toLowerCase());
    return n;
  });
}
async function zipLiked() {
  const list = liked(), n = names(list);
  say(`Packing ${list.length} photos…`);
  const bytes = await writeZip(list.map((x, i) => ({ path: n[i], data: x.file })), { compress: false });   // photos are compressed already
  UI.download(bytes, 'liked-photos.zip');   // writeZip gives a Blob already
  say(`${list.length} liked photo${list.length === 1 ? '' : 's'} in liked-photos.zip.`);
}
async function driveLiked() {
  const H = window.SlopHub;
  if (!H) { say('Slop Drive is not available here.'); return; }
  const list = liked(), n = names(list), stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const folderId = await H.appSubfolderId('sorter', `Liked ${stamp}`);
  for (let i = 0; i < list.length; i++) await H.put(list[i].file, { name: n[i], from: 'sorter', folderId, meta: { tags: list[i].tags } });
  say(`${list.length} liked photo${list.length === 1 ? '' : 's'} saved to Slop Drive, in Photo Sorter › Liked ${stamp}.`);
}
function clear() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear(); set.clear(); which = 'all'; say(''); draw();
}

function wire() {
  dropZone = window.SlopDrop.attach($('soDrop'), {
    accept: { types: ['image/*'], exts: ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif', '.svg', '.bmp'], noun: 'a photo' },
    input: $('soPick'), label: 'Drop photos here, or choose photos', hint: 'As many as you like. They stay on this device.',
    preview: { picture: { src: '../assets/shots/sorter.jpg', alt: 'Photos sorted into liked and disliked, with tags' },
      steps: ['Drop photos or a whole folder', 'Swipe: ↑ like, ↓ dislike, type to tag', 'Download the keepers as a ZIP'] },
    sample: { label: 'Try it with 8 sample photos', files: () => window.SlopSamples.photos(8) },
    process: async (file) => { add([file]); return file.name; },
  });
  $('soFolder').addEventListener('click', () => $('soDir').click());
  $('soDir').addEventListener('change', (e) => { add([...e.target.files]); e.target.value = ''; });
  $('soStart').addEventListener('click', start);
  $('soZip').addEventListener('click', zipLiked);
  $('soDrive').addEventListener('click', driveLiked);
  $('soCsv').addEventListener('click', () => UI.download(new Blob([M.csv(set.items)], { type: 'text/csv' }), 'photo-decisions.csv'));
  $('soClear').addEventListener('click', clear);
  set.on(() => draw());
  addEventListener('beforeunload', (e) => { if (set.items.some((x) => x.liked || x.tags.length)) { e.preventDefault(); e.returnValue = ''; } });
  draw();
}

wire();
window.SlopSorter.app = { set, deck, add, start, draw, zipLiked, get which() { return which; } };
