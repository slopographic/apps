/* Slop Serial counter: many photos in, each read once on this device, a table of unique serials and a table of totals.
 * Recognition is the Slop AI Tools OCR engine (PP-OCRv4 in the inference worker), as on the OCR page. Photos stay in this
 * browser. The rules (pattern, tally, CSV) are in extract.js. */
import { DEFAULT_PATTERN, serialsFor, serialsIn, tally, csvOf } from './extract.js';

const T = window.SlopAITools;
const $ = (id) => document.getElementById(id);
const MAX_SIDE = 2200; // photos are scaled down to this long side before reading: enough for small print, quicker to read
const state = { photos: [], busy: false, nextId: 1 };

const say = (s) => { $('msg').textContent = s; };
const pattern = () => $('pattern').value.trim() || DEFAULT_PATTERN;
/** A photo's serials for the page; an invalid pattern shows no serials (the message says why). */
const serialsOf = (p) => { try { return serialsFor(p, pattern()); } catch (e) { return []; } };
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const isImage = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(f.name);

/** Adds the photos given; the first use shows the first-use notice (Your files stay in this browser…). */
async function addFiles(list) {
  const all = [...list];
  const files = all.filter(isImage);
  if (!files.length) { say('Only photos can be added. Pick JPEG, PNG or WebP pictures.'); return; }
  if (!(await window.SlopFirstRun.once('serials', {
    title: 'Serial counter',
    lines: ['Each photo is read here, on this device, with the same text reader as the OCR page. Serials are found with a pattern you can change.'],
    downloads: [],
  }))) return;
  for (const f of files) {
    state.photos.push({ id: state.nextId++, name: f.name, file: f, text: '', read: false, error: null, manual: new Set(), removed: new Set() });
  }
  const skipped = all.length - files.length;
  say(`${files.length} photo${files.length === 1 ? '' : 's'} added. Press Read photos.${skipped ? ` Skipped ${skipped} that are not photos.` : ''}`);
  render();
}

async function readOne(p, onProgress) {
  const { bitmap, w, h } = await T.image(p.file, { maxSide: MAX_SIDE });   // scaled in aitools/common.js
  const r = await T.call('ocr', { bitmap, w, h }, { transfer: [bitmap], onProgress });
  p.text = r.lines.map((l) => l.text).join('\n');
  p.read = true;
  p.error = null;
}

async function readAll() {
  const todo = state.photos.filter((p) => !p.read);
  if (state.busy || !todo.length) return;
  state.busy = true;
  const prog = $('prog');
  prog.value = 0;
  render();
  try {
    await T.ensure('ppocr-v4', say);
    for (const [k, p] of todo.entries()) {
      say(`Reading ${p.name} (${k + 1} of ${todo.length})…`);
      try {
        await readOne(p, (q) => { prog.value = q.total ? q.done / q.total : 0; });
      } catch (e) {
        p.error = e.message; // the photo stays unread, so Read photos tries it again
      }
      render();
    }
    const found = tally(state.photos, pattern()).totals;
    say(`Read ${found.read} photo${found.read === 1 ? '' : 's'}: ${found.quantity} unique serial${found.quantity === 1 ? '' : 's'}.`);
  } catch (e) {
    say(e.message);
  } finally {
    state.busy = false;
    render();
  }
}

/** A typed serial is added to the photo; a found one is removed from it, and a typed one is simply taken off. */
function changeSerial(p, s, add) {
  if (add) { p.removed.delete(s); p.manual.add(s); } else if (p.manual.has(s)) p.manual.delete(s); else p.removed.add(s);
  render();
}

function photoRow(p) {
  const li = el('li', 'sr-photo');
  const head = el('div', 'sr-photo-head');
  head.append(el('span', 'sr-name', p.name), el('span', 'sr-status', p.error ? 'Could not read: ' + p.error : p.read ? 'Read' : 'Not read yet'));
  li.append(head);
  const chips = el('div', 'sr-chips');
  for (const s of p.read ? serialsOf(p) : []) {
    const c = el('span', 'sr-chip', s);
    const x = el('button', 'sr-chip-x', '×');
    x.type = 'button';
    x.setAttribute('aria-label', `Remove ${s} from ${p.name}`);
    x.addEventListener('click', () => changeSerial(p, s, false));
    c.append(x);
    chips.append(c);
  }
  if (p.read && !chips.childNodes.length) chips.append(el('span', 'sr-none', 'No serial found'));
  li.append(chips);
  const form = el('form', 'sr-add');
  const input = el('input');
  input.placeholder = 'Type a serial';
  input.setAttribute('aria-label', `Add a serial to ${p.name}`);
  const btn = el('button', null, 'Add');
  btn.type = 'submit';
  form.append(input, btn);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const s = input.value.trim().toUpperCase();
    if (!s) return;
    if (!serialsIn(s, pattern()).includes(s)) { say(`“${s}” does not match the pattern.`); return; }
    changeSerial(p, s, true);
  });
  li.append(form);
  return li;
}

function renderPhotos() {
  $('photos').replaceChildren(...state.photos.map(photoRow));
}

function renderUnique(rows) {
  $('unique').replaceChildren(...rows.map((r) => {
    const tr = el('tr');
    tr.append(el('td', 'sr-mono', r.serial), el('td', null, String(r.count)), el('td', null, r.photos.join(', ')));
    return tr;
  }));
  $('unique-empty').hidden = rows.length > 0;
}

function renderTotals(t) {
  const items = [
    ['Photos', t.photos], ['Read', t.read], ['Photos with a serial', t.withSerial],
    ['Photos to review (no serial found)', t.needsReview], ['Unique serials (quantity)', t.quantity],
    ['Serial sightings', t.hits], ['Repeats (same serial in more than one photo)', t.repeats],
  ];
  $('totals').replaceChildren(...items.flatMap(([k, v]) => [el('dt', null, k), el('dd', 'sr-num', String(v))]));
}

/** Enables the buttons the state allows, and redraws the tables from the photos. */
function render() {
  let res;
  try {
    res = tally(state.photos, pattern());
    $('pattern').classList.remove('bad');
  } catch (e) {
    $('pattern').classList.add('bad');
    say(e.message);
    res = { unique: [], totals: { photos: state.photos.length, read: 0, withSerial: 0, needsReview: 0, hits: 0, quantity: 0, repeats: 0 } };
  }
  $('work').hidden = state.photos.length === 0;
  $('read').disabled = state.busy || !state.photos.some((p) => !p.read);
  $('clear').disabled = state.busy;
  $('prog').hidden = !state.busy;
  $('export-serials').disabled = res.unique.length === 0;
  $('export-photos').disabled = state.photos.length === 0;
  renderPhotos();
  renderUnique(res.unique);
  renderTotals(res.totals);
}

/** Saves a CSV: SlopAITools.download (aitools/common.js), the tools' one copy. */
function download(name, text) { window.SlopAITools.download(name, text, 'text/csv;charset=utf-8'); }

function exportSerials() {
  const { unique } = tally(state.photos, pattern());
  download('serials.csv', csvOf([['Serial', 'Count', 'Photos'], ...unique.map((r) => [r.serial, r.count, r.photos.join('; ')])]));
}

function exportPhotos() {
  const rows = state.photos.map((p) => [p.name, p.error ? 'Could not read' : p.read ? 'Read' : 'Not read', p.read ? serialsOf(p).join('; ') : '']);
  download('photos.csv', csvOf([['Photo', 'Status', 'Serials'], ...rows]));
}

function wire() {
  $('pick').addEventListener('change', (e) => { addFiles(e.target.files); e.target.value = ''; });
  const drop = $('drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles(e.dataTransfer.files); });
  $('pattern').addEventListener('input', () => render());
  $('read').addEventListener('click', readAll);
  $('export-serials').addEventListener('click', exportSerials);
  $('export-photos').addEventListener('click', exportPhotos);
  $('clear').addEventListener('click', () => {
    if (state.busy) return;
    state.photos = [];
    say('Cleared.');
    render();
  });
}

wire();
T.gate('ocr', () => {
  $('ui').hidden = false;
  render();
});
