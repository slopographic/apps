/* Slop OCR page: files in, text out. Recognition is the Slop AI Tools OCR engine (PaddleOCR in the inference worker,
 * reached through window.SlopAITools from aitools/common.js, which loads first as a classic script). The model is only
 * used after the gate passes; nothing downloads here except from the Language and model dialog (shared/ocr/choose.js):
 * without a choice the bundled Chinese and English model reads first, and a line under the text offers the model for
 * another script when the text looks like one. Layout, outputs and drawing live in the modules beside this file. */
import { isSupported, openFile, renderPage } from './sources.js';
import { linesToText, rowsOf } from './layout.js';
import { drawPage } from './overlay.js';
import { plainText, markdownText, docxFile, searchablePdf, jpegBytes, saveBlob, copyText } from './export.js';
import { sampleReceipt } from './sample.js';
import { createOcrChoice } from '../../shared/ocr/choose.js';

const T = window.SlopAITools;
const $ = (id) => document.getElementById(id);
const EXPORT_IDS = ['dlTxt', 'dlMd', 'dlDocx', 'dlPdf', 'copy'];
const state = { pages: [], cur: 0, busy: false, shown: null };
const choice = createOcrChoice({ ui: window.SlopUI, storageHref: '../settings/#storage' });
let dropZone = null;   // the SlopDrop zone (its preview shows while no page is open)

const say = (s) => { $('msg').textContent = s; };
/** What the page makes and how: in the drop zone once the tool can run, and above the model prompt before that. */
const PREVIEW = {
  picture: { src: '../assets/shots/ocr.jpg', alt: 'A receipt with a box around each line it read, and the text beside it' },
  steps: ['Drop photos, scans or PDFs', 'Press Read text, then fix anything it misread', 'Save as text, Word or a searchable PDF'],
};
const allRead = () => state.pages.length > 0 && state.pages.every((p) => p.done);
const stem = () => {
  const f = state.pages[0] && state.pages[0].file;
  return (f ? f.name.replace(/\.[^.]+$/, '') : 'document').replace(/[\\/:*?"<>|]+/g, '_') + '-ocr';
};

/** Enables the Read and export buttons that the current state allows. */
function refresh() {
  const n = state.pages.length;
  $('work').hidden = n === 0;
  if (dropZone) dropZone.empty(!n); // the preview in the zone is for an empty page only
  $('read').disabled = state.busy || n === 0 || allRead();
  $('pages').replaceChildren(...state.pages.map((p, i) => new Option(`${i + 1}. ${p.label}${p.done ? '' : ' (not read yet)'}`, String(i))));
  $('pages').value = String(state.cur);
  $('prev').disabled = state.cur <= 0;
  $('next').disabled = state.cur >= n - 1;
  const ready = allRead() && !state.busy;
  for (const id of EXPORT_IDS) $(id).disabled = !ready;
  const p = state.pages[state.cur];
  $('text').readOnly = !p || !p.done;
  if (p && document.activeElement !== $('text')) $('text').value = p.text || '';
}

/** The picture of a page, from the cache when it is the one on screen. */
async function canvasOf(i) {
  if (state.shown && state.shown.i === i) return state.shown.canvas;
  const canvas = await renderPage(state.pages[i]);
  state.shown = { i, canvas };
  return canvas;
}
async function paint() {
  const p = state.pages[state.cur];
  if (!p) return;
  const i = state.cur, canvas = await canvasOf(i);
  if (i !== state.cur) return;
  drawPage($('preview'), canvas, p.lines || [], $('boxes').checked);
}
async function show(i) {
  if (i < 0 || i >= state.pages.length) return;
  state.cur = i;
  state.shown = null;
  refresh();
  try { await paint(); } catch (e) { say('Could not draw this page: ' + e.message); }
}

async function addFiles(list) {
  const files = [...list];
  if (!files.length) return;
  const skipped = files.filter((f) => !isSupported(f)).map((f) => f.name);
  const first = state.pages.length;
  for (const f of files.filter(isSupported)) {
    say(`Opening ${f.name}…`);
    try { state.pages.push(...(await openFile(f))); } catch (e) { say(e.message); }
  }
  if (skipped.length) say(`Only images and PDFs can be read. Skipped: ${skipped.join(', ')}.`);
  else if (state.pages.length > first) say(`${state.pages.length} page${state.pages.length === 1 ? '' : 's'} ready. Press Read text.`);
  if (state.pages.length > first) await show(first);
  else refresh();
}

/** Reads one page into p: the picture goes to the worker, the lines and the text come back. */
async function readPage(p, i, model, onProgress) {
  const canvas = await renderPage(p);
  const bitmap = await createImageBitmap(canvas);
  const r = await T.call('ocr', { model, bitmap, w: canvas.width, h: canvas.height }, {
    transfer: [bitmap],
    onProgress: (q) => onProgress(q),
  });
  Object.assign(p, { w: canvas.width, h: canvas.height, lines: r.lines, skipped: r.skipped || 0, model, text: linesToText(r.lines), done: true, error: null, edited: false });
  if (i === state.cur) state.shown = { i, canvas };
}

async function readAll() {
  if (state.busy || allRead()) return;
  const todo = state.pages.map((p, i) => ({ p, i })).filter((x) => !x.p.done);
  state.busy = true;
  const prog = $('prog');
  prog.hidden = false; prog.value = 0;
  $('read').disabled = true;
  $('suggest').replaceChildren();
  try {
    const pick = await choice.pick();
    if (!pick) { say('Choose the language of the text, and download its model, to read it.'); return; }
    await T.ensure(pick.model, say);
    for (let k = 0; k < todo.length; k++) {
      const { p, i } = todo[k];
      say(`Reading ${p.label} (${k + 1} of ${todo.length})…`);
      try {
        await readPage(p, i, pick.model, (q) => {
          prog.value = q.total ? q.done / q.total : 0;
          say(q.stage === 'detect' ? `Finding text lines in ${p.label}…` : `Reading line ${q.done + 1} of ${q.total} in ${p.label}…`);
        });
      } catch (e) {
        p.error = e.message; // the page stays unread, so Read text tries it again
      }
      if (i === state.cur) await paint();
      refresh();
    }
    const lines = state.pages.reduce((n, p) => n + (p.lines ? rowsOf(p.lines).length : 0), 0);
    const failed = state.pages.filter((p) => p.error);
    say(failed.length
      ? `Could not read ${failed.length} page${failed.length === 1 ? '' : 's'}: ${failed[0].error}`
      : lines ? `${lines} line${lines === 1 ? '' : 's'} read. Check the text before you use it.` : 'No text found on these pages.');
    offer(pick.model);
  } catch (e) {
    say('Could not read the text: ' + e.message);
  } finally {
    state.busy = false;
    prog.hidden = true;
    refresh();
  }
}

/** After a read with no language chosen: the line that offers a better model (shared/ocr/suggest.js), whose button opens
 *  the dialog; once a model is chosen there, the pages are read again with it. */
function offer(model) {
  const read = state.pages.filter((p) => p.done && p.model === model);
  const s = choice.suggest(read.flatMap((p) => p.lines || []), model, read.reduce((n, p) => n + (p.skipped || 0), 0));
  const el = choice.suggestion(s, again);
  $('suggest').replaceChildren(...(el ? [el] : []));
}
/** Reads every page again with the model just chosen; asks first when the person corrected the text. */
async function again() {
  if (state.busy || !state.pages.length) return;
  if (state.pages.some((p) => p.edited) && !(await window.SlopUI.confirm('Read the text again?', 'The new text replaces the text on every page, and the corrections you made are lost.', 'Read again'))) return;
  for (const p of state.pages) p.done = false;
  refresh();
  await readAll();
}

/** The pages as the outputs want them: the text as edited, the lines and the picture size. */
const outPages = () => state.pages.map((p) => ({ text: p.text || '', lines: p.lines || [], w: p.w, h: p.h }));

async function exportPdf() {
  const prog = $('prog'), base = outPages();
  prog.hidden = false; prog.value = 0;
  setExporting(true, 'Making the searchable PDF…');
  try {
    const pages = [];
    for (let i = 0; i < base.length; i++) {
      const canvas = await renderPage(state.pages[i]);
      pages.push({ ...base[i], w: canvas.width, h: canvas.height, image: await jpegBytes(canvas) });
      prog.value = (i + 1) / base.length;
    }
    const blob = await searchablePdf(pages, { title: stem() });
    saveBlob(stem() + '.pdf', blob);
    say('Searchable PDF saved. Its text layer is invisible; it is there for search and copy.');
  } catch (e) {
    say('The searchable PDF could not be made: ' + e.message);
  } finally {
    prog.hidden = true;
    setExporting(false);
  }
}

function setExporting(on, text) {
  state.busy = on;
  if (text) say(text);
  refresh();
}

function wire() {
  // The drop zone is SlopDrop (shared/drop): drops and the Choose files button (the only thing that opens the picker)
  // go through addFiles, one file at a time. The page's own picker input keeps its accept list.
  const file = $('file'), accept = file.getAttribute('accept');
  dropZone = window.SlopDrop.attach($('drop'), {
    accept: { any: true, noun: 'an image or a PDF' },
    input: file,
    label: 'Drop images or PDFs here, or choose files',
    preview: PREVIEW,
    sample: { label: 'Try it with a sample receipt', files: async () => [await sampleReceipt()] },
    process: async (f) => { await addFiles([f]); return f.name; },
  });
  file.setAttribute('accept', accept);
  $('read').addEventListener('click', readAll);
  $('prev').addEventListener('click', () => show(state.cur - 1));
  $('next').addEventListener('click', () => show(state.cur + 1));
  $('pages').addEventListener('change', (e) => show(parseInt(e.target.value, 10)));
  $('boxes').addEventListener('change', () => paint());
  $('text').addEventListener('input', () => { const p = state.pages[state.cur]; if (p) { p.text = $('text').value; p.edited = true; } });
  choice.button($('lang'), () => { if (state.pages.some((p) => p.done)) again(); });
  $('dlTxt').addEventListener('click', () => saveBlob(stem() + '.txt', new Blob([plainText(outPages())], { type: 'text/plain' })));
  $('dlMd').addEventListener('click', () => saveBlob(stem() + '.md', new Blob([markdownText(outPages())], { type: 'text/markdown' })));
  $('dlDocx').addEventListener('click', async () => {
    say('Making the Word file…');
    try {
      saveBlob(stem() + '.docx', await docxFile(outPages(), { title: stem() }));
      say('Word file saved.');
    } catch (e) { say('The Word file could not be made: ' + e.message); }
  });
  $('dlPdf').addEventListener('click', exportPdf);
  $('copy').addEventListener('click', async () => {
    say((await copyText(plainText(outPages()))) ? 'Copied all the text.' : 'Copy was blocked here. Select the text and copy it.');
  });
  $('clear').addEventListener('click', () => {
    if (state.busy) return;
    state.pages = []; state.cur = 0; state.shown = null;
    $('suggest').replaceChildren();
    $('text').value = ''; $('file').value = '';
    say('Cleared.');
    refresh();
  });
}

wire();
const intro = window.SlopDrop.panel.preview(PREVIEW);
if (intro) $('intro').append(intro);
T.gate('ocr', () => {
  $('ui').hidden = false;
  $('intro').hidden = true; // the drop zone shows the same preview now
  refresh();
});
