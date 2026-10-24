/* Slop Transcribe: drawing the file list and the transcript pane from the queue. No state of its own: the selection and
 * the "show times" choice are app.js's. Sizes and lengths read as people write them. */
import { languageName } from './languages.js';
const $ = (id) => document.getElementById(id);
const X = () => globalThis.SlopTranscript;
const STATUS = { waiting: 'Waiting', reading: 'Transcribing…', done: 'Done', error: 'Could not read' };

/** Pure: "4.2 MB · 03:12" for a file, its length once known. */
export function metaOf(item) {
  const mb = item.size >= 1e6 ? `${(item.size / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(item.size / 1e3))} KB`;
  return [mb, item.seconds ? X().clock(item.seconds) : ''].filter(Boolean).join(' · ');
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

/** One row of the file list. */
function row(item, selected, actions) {
  const li = el('li', 'tr-file' + (item.id === selected ? ' is-on' : ''));
  li.dataset.id = item.id;
  li.tabIndex = 0;
  li.setAttribute('aria-selected', String(item.id === selected));
  const main = el('div', 'tr-file-main');
  main.append(el('span', 'tr-file-name', item.name), el('span', 'tr-file-meta', metaOf(item)));
  const chip = el('span', `tr-chip is-${item.status}`, item.status === 'reading' ? `${Math.round(item.progress * 100)}%` : STATUS[item.status]);
  const x = el('button', 'tr-x', '×');
  x.type = 'button';
  x.setAttribute('aria-label', `Remove ${item.name}`);
  x.addEventListener('click', (e) => { e.stopPropagation(); actions.remove(item.id); });
  li.append(main, chip, x);
  if (item.status === 'reading') { const bar = el('progress', 'tr-prog'); bar.max = 1; bar.value = item.progress; li.append(bar); }
  if (item.error) li.append(el('p', 'tr-err', item.error));
  li.addEventListener('click', () => actions.select(item.id));
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); actions.select(item.id); } });
  return li;
}

/** The list, the counts and the buttons the state allows. */
export function drawList(q, selected, actions) {
  const list = q.items;
  $('trFiles').replaceChildren(...list.map((it) => row(it, selected, actions)));
  $('trEmpty').hidden = list.length > 0;
  const waiting = list.filter((x) => x.status === 'waiting' || x.status === 'error').length;
  $('trRun').disabled = q.busy || !waiting;
  $('trRun').textContent = q.busy ? 'Transcribing…' : waiting > 1 ? `Transcribe ${waiting} files` : 'Transcribe';
  $('trStop').hidden = !q.busy;
  $('trClear').disabled = q.busy || !list.length;
  $('trCount').textContent = list.length ? `${list.filter((x) => x.status === 'done').length} of ${list.length} done` : '';
}

/** The transcript pane for the selected item: its text (editable once done), its meta, and the export buttons. */
export function drawTranscript(item, { times }) {
  const done = !!item && item.status === 'done';
  $('trPaneTitle').textContent = item ? item.name : 'Transcript';
  $('trPaneMeta').textContent = !item ? 'Add a file or record your voice, then press Transcribe.'
    : done ? [metaOf(item), item.language ? `language ${languageName(item.language)}` : '', `${X().words($('trText').value)} words`].filter(Boolean).join(' · ')
      : item.status === 'error' ? item.error : STATUS[item.status];
  for (const id of ['trCopy', 'trDownload', 'trFormat', 'trDrive', 'trDocs', 'trTimes']) $(id).disabled = !done;
  $('trText').readOnly = !done;
  $('trEdited').hidden = !(done && item.text != null);
}

/** The text the box shows for an item: the corrections, or the segments (with times when asked). */
export function textFor(item, { times }) {
  if (!item || item.status !== 'done') return '';
  return item.text != null ? item.text : X().txt(item.segments, { times });
}
