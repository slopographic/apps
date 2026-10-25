/* The block menu for Slop Notes: Heading, Table, Video link, Image, Code block, Checklist, Quote, Divider, Callout and Link.
 * Each block is plain Markdown written at the caret of the source (insertAtCaret in editor.js), so it survives export and
 * reopening. The dialogs are SlopUI dialogs. A block whose value is missing or wrong is not inserted; the dialog says why. */
import { insertAtCaret } from './editor.js';
import { blankTable } from './table.js';
import { videoCard } from './video.js';

const el = (tag, attrs, ...kids) => SlopUI.el(tag, attrs, ...kids);
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const whole = (s, lo, hi) => { const n = Number(s); return Number.isInteger(n) && n >= lo && n <= hi ? n : 0; };
const MAX_IMAGE = 2 * 1024 * 1024;

/** A dialog with named fields: spec maps a name to { label, type: 'text' | 'number', value, min, max, placeholder }.
 * read(values) returns the result, or false to keep the dialog open (after a toast). Resolves with the result, or null. */
function form(title, ok, spec, read) {
  const inputs = {};
  const rows = Object.entries(spec).map(([k, o]) => {
    inputs[k] = o.type === 'number'
      ? SlopUI.number(o.value, o.min, o.max)
      : el('input', { class: 'sui-input', type: 'text', value: o.value || '', placeholder: o.placeholder || '' });
    return SlopUI.field(o.label, inputs[k]);
  });
  return new Promise((res) => {
    let out = null;
    SlopUI.dialog({
      title, body: el('div', { class: 'nt-form' }, ...rows),
      buttons: [{ label: 'Cancel' }, { label: ok, primary: true, act: () => {
        const values = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, String(i.value).trim()]));
        const r = read(values);
        if (r === false) return false;
        out = r;
      } }],
      onClose: (done) => res(done ? out : null),
    });
  });
}

const readAsDataURL = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

export async function addHeading(level) {
  const t = await SlopUI.prompt('Heading ' + level, 'Heading text', '', { ok: 'Insert' });
  if (t == null || !clean(t)) return;
  insertAtCaret('#'.repeat(level) + ' ' + clean(t));
}

export async function addTable() {
  const v = await form('Insert table', 'Insert', {
    rows: { label: 'Rows under the header', type: 'number', value: 2, min: 1, max: 50 },
    cols: { label: 'Columns', type: 'number', value: 3, min: 1, max: 10 },
  }, (x) => {
    const rows = whole(x.rows, 1, 50), cols = whole(x.cols, 1, 10);
    if (!rows || !cols) { SlopUI.toast('Rows 1 to 50, columns 1 to 10'); return false; }
    return { rows, cols };
  });
  if (v) insertAtCaret(blankTable(v.rows, v.cols));
}

export async function addVideo() {
  const v = await form('Video link', 'Insert', {
    url: { label: 'YouTube, Vimeo or video file link', type: 'text', placeholder: 'https://' },
    title: { label: 'Title (optional)', type: 'text' },
  }, (x) => {
    const card = videoCard(x.url, x.title);
    if (!card) { SlopUI.toast('Use a YouTube, Vimeo or direct video (.mp4, .webm…) link'); return false; }
    return card;
  });
  if (v) insertAtCaret(v);
}

/** A picture from the computer, kept in the note as a data URL (PNG, JPEG, GIF or WebP, up to 2 MB): the page's one way
 *  in for files (shared/intake, spec 'notes'), from Insert ▸ Image… or a pasted picture outside the text. */
function registerIntake() {
  if (window.SlopIntake.spec('notes')) return;
  window.SlopIntake.register({
    id: 'notes', limit: 1, accept: { types: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'], noun: 'a PNG, JPEG, GIF or WebP picture', maxBytes: MAX_IMAGE },
    process: async (file) => {
      const url = await readAsDataURL(file);
      const alt = file.name.replace(/\.[^.]+$/, '').replace(/[[\]()<>"\n]/g, ' ').trim() || 'Image';
      if (insertAtCaret('![' + alt + '](' + url + ')') === false) throw new Error('has no note to go in: open or make a note first');
      return file.name;
    },
  });
}
if (globalThis.SlopIntake) registerIntake();
export function addImage() { return window.SlopIntake.pick({ to: 'notes', multiple: false, accept: 'image/png,image/jpeg,image/gif,image/webp' }); }

export async function addCode() {
  const v = await form('Code block', 'Insert', {
    lang: { label: 'Language (optional)', type: 'text', placeholder: 'js, python, css…' },
  }, (x) => ({ lang: x.lang.replace(/[^\w+#.-]/g, '').slice(0, 20) }));
  if (!v) return;
  const head = '```' + v.lang + '\n';
  insertAtCaret(head + '\n```', [head.length, head.length]);
}

export async function addChecklist() {
  const t = await SlopUI.prompt('Checklist', 'One item per line', '', { ok: 'Insert', multiline: true });
  if (t == null) return;
  const items = String(t).split('\n').map(clean).filter(Boolean);
  if (items.length) insertAtCaret(items.map((s) => '- [ ] ' + s).join('\n'));
}

export async function addQuote() {
  const t = await SlopUI.prompt('Quote', 'Quoted text', '', { ok: 'Insert', multiline: true });
  if (t == null) return;
  const lines = String(t).split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length) insertAtCaret(lines.map((s) => '> ' + s).join('\n'));
}

/** A callout: a quote that starts with its [!KIND] marker (NOTE, TIP or WARNING). */
export async function addCallout(kind) {
  const label = kind[0] + kind.slice(1).toLowerCase();
  const t = await SlopUI.prompt(label + ' callout', 'Text', '', { ok: 'Insert', multiline: true });
  if (t == null) return;
  const lines = String(t).split('\n').map((s) => s.trim()).filter(Boolean);
  if (lines.length) insertAtCaret(['> [!' + kind + ']', ...lines.map((s) => '> ' + s)].join('\n'));
}

export async function addLink() {
  const v = await form('Link', 'Insert', {
    text: { label: 'Text', type: 'text' },
    url: { label: 'Web address', type: 'text', placeholder: 'https://' },
  }, (x) => {
    const url = x.url;
    if (!/^(https?:\/\/|mailto:)/i.test(url)) { SlopUI.toast('Use an http, https or mailto address'); return false; }
    const safe = url.replace(/[()\s]/g, (c) => ({ '(': '%28', ')': '%29', ' ': '%20' })[c]);
    return { text: clean(x.text).replace(/[[\]]/g, '') || url, url: safe };
  });
  if (v) insertAtCaret('[' + v.text + '](' + v.url + ')');
}

/** The items of the block menu (the Insert block button and the right-click menu of the source). */
export function blockItems() {
  return [
    { label: 'Heading', sub: [1, 2, 3].map((n) => ({ label: 'Heading ' + n, act: () => addHeading(n) })) },
    { label: 'Table…', act: addTable },
    { label: 'Video link…', act: addVideo },
    { label: 'Image…', act: addImage },
    { label: 'Code block…', act: addCode },
    { label: 'Checklist…', act: addChecklist },
    { label: 'Quote…', act: addQuote },
    { label: 'Divider', act: () => insertAtCaret('---') },
    { label: 'Callout', sub: ['NOTE', 'TIP', 'WARNING'].map((k) => ({ label: k[0] + k.slice(1).toLowerCase() + '…', act: () => addCallout(k) })) },
    { label: 'Link…', act: addLink },
  ];
}
