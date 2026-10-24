/* Slop Workflows: the run panel of one tool (SlopFrame's panel on the page, a column in a dialog; a bottom sheet on
 * phones). Files in (the shared drop zone, shared/drop), Run and Stop, the progress of every file at every step, and the
 * results: download one or all (ZIP), save to Slop Drive, or open one in another app (shared/hub.js). The run itself is
 * core/plan.js on the one runner (convert/js/core/chain-run.js).
 *   createRun(ctx, panelEl, { frame, drop, onResults }) → { render, run, stop, addFiles, clearFiles, results, resultsZip, drop }
 *     run() → { ok, message, outputs }; onResults(outputs) after each run: [{ name, blob, kind }] */
import { checksOf } from './steps.js';
import { firstProblem, kindsLabel } from '../core/compat.js';
import { runWorkflow } from '../core/plan.js';
import { detectKind } from '../../../convert/js/core/detect.js';
import { readHead, uniqueName, saveBlob } from '../../../convert/js/io/files.js';
import { writeZip } from '../../../convert/js/io/zip.js';
import { h } from '../../../convert/js/ui/dom.js';

const g = globalThis;
const MIME = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain', md: 'text/markdown', json: 'application/json', csv: 'text/csv', svg: 'image/svg+xml' };
const size = (n) => (g.SlopHub ? g.SlopHub.fmtSize(n) : `${Math.round(n / 1024)} KB`);
const toast = (m) => { if (g.SlopUI) g.SlopUI.toast(m); };
const SYM = { wait: '·', run: '…', done: '✓', error: '✕' };
const typeOf = (o) => o.blob.type || MIME[o.kind] || MIME[(/\.([a-z0-9]+)$/i.exec(o.name) || [])[1]] || 'application/octet-stream';
let seq = 0;

export function createRun(ctx, panelEl, { frame = null, drop: dropOpts = {}, onResults = null } = {}) {
  const { S, R, on, emit, ns } = ctx;
  const checks = () => checksOf(ctx);
  let statusText = '';
  const filesBox = h('div', { class: 'wf-files' }), zone = h('div', { class: 'wf-drop', id: `${ns}-drop` }), fileList = h('ul', { class: 'wf-file-list', 'aria-label': 'Files in' });
  const grid = h('div', { class: 'wf-grid-wrap' });
  filesBox.append(zone, fileList);

  async function addFiles(list) {
    const added = [];
    for (const file of list) {
      const kind = detectKind(file.name, file.type, await readHead(file));
      const it = { id: 'f' + (++seq), name: file.name || 'file', file, kind, size: file.size };
      S.files.push(it); added.push(it);
    }
    S.run = null;
    emit('files', added);
    return added;
  }
  function clearFiles() { S.files = []; S.run = null; emit('files', []); }
  function removeFile(id) { S.files = S.files.filter((f) => f.id !== id); emit('files', []); }

  function drawFiles() {
    fileList.replaceChildren(...S.files.map((f) => h('li', { class: 'wf-file' },
      globalThis.SlopFlow.tile(f.kind || 'file', { size: 'sm' }),
      h('span', { class: 'wf-file-name', title: f.name }, f.name), h('span', { class: 'wf-file-meta' }, `${kindsLabel([f.kind])} · ${size(f.size)}`),
      h('button', { type: 'button', class: 'sui-btn wf-file-x', 'aria-label': `Remove ${f.name}`, title: 'Remove', onclick: () => removeFile(f.id) }, '×'))));
    fileList.hidden = !S.files.length;
  }

  function drawGrid() {
    const r = S.run;
    if (!r) { grid.replaceChildren(); return; }
    const steps = S.doc.steps.map((s, i) => (R.byId(s.id) || { label: s.id }).label || `Step ${i + 1}`);
    const head = h('tr', null, h('th', { scope: 'col' }, 'File'), ...steps.map((l, i) => h('th', { scope: 'col', title: l }, String(i + 1))));
    const rows = r.items.map((f) => h('tr', null, h('th', { scope: 'row', title: f.name }, f.name), ...steps.map((l, i) => {
      const c = r.cells.get(`${f.id}:${i + 1}`) || { state: 'wait' };
      const text = c.state === 'run' && c.fraction != null ? `${Math.round(c.fraction * 100)}%` : SYM[c.state];
      return h('td', { class: `wf-c wf-c-${c.state}`, title: `${l}: ${c.state === 'error' ? c.message : { wait: 'waiting', run: 'working', done: 'done' }[c.state]}` }, text);
    })));
    grid.replaceChildren(h('table', { class: 'wf-grid', 'aria-label': 'Progress of each file at each step' }, h('thead', null, head), h('tbody', null, ...rows)));
  }

  function results() {
    const r = S.run && S.run.result;
    if (!r) return [];
    const taken = new Set();
    const out = r.outputs.map((o) => ({ ...o, name: uniqueName(o.name, taken) }));
    for (const m of r.middles) out.push({ ...m, name: uniqueName(m.name, taken), mid: true });
    return out;
  }
  async function resultsZip() {
    const list = results();
    return writeZip(await Promise.all(list.map(async (o) => ({ path: o.name, data: new Uint8Array(await o.blob.arrayBuffer()) }))));
  }
  const zipName = () => `${(S.doc.name || 'workflow').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'workflow'}.zip`;
  async function saveAll() {
    const H = g.SlopHub;
    if (!H) return;
    for (const o of results()) await H.put(o.blob, { name: o.name, from: 'workflows', app: 'workflows' });
    toast(`Saved ${results().length} files to Slop Drive`);
  }

  function render() {
    if (!panel) return;
    drawFiles();
    const r = S.run, busy = !!(r && r.busy), res = checks(), problem = firstProblem(res), n = S.files.length, steps = S.doc.steps.length;
    const ready = n && steps && !problem && !busy;
    const note = busy ? statusText : problem ? problem.message : !steps ? 'Add a step to the workflow first.' : !n ? 'Add the files to run it on.'
      : `${n} file${n === 1 ? '' : 's'} through ${steps} step${steps === 1 ? '' : 's'}.`;
    const list = results(), sections = [
      { title: `Files (${n})`, key: 'files', body: filesBox, actions: n ? [{ label: 'Clear files', id: `${ns}-clear`, run: clearFiles, disabled: busy }] : null },
      { title: 'Run', key: 'run', note, actions: [
        { label: busy ? 'Running…' : 'Run workflow', id: `${ns}-run`, primary: true, disabled: !ready, run: () => run() },
        busy ? { label: 'Stop', id: `${ns}-stop`, run: stop } : null] },
    ];
    if (r) sections.push({ title: 'Progress', key: 'progress', body: grid, note: r.result ? summary(r) : '' });
    if (r && r.result) {
      sections.push({ title: `Results (${list.length})`, key: 'results', empty: 'Nothing was made.', list: list.map((o) => ({
        name: o.name, meta: `${kindsLabel([o.kind || ''])} · ${size(o.blob.size)}${o.mid ? ` · step ${o.step}, kept` : ''}`,
        actions: [{ label: 'Download', run: () => saveBlob(o.blob, o.name) },
          { label: 'Open in', menu: () => (g.SlopHub ? g.SlopHub.sendMenuItems(() => o.blob, o.name, typeOf(o), { folder: true }) : []), empty: 'No app opens this kind of file' }],
      })) });
      if (list.length) sections.push({ title: 'All results', key: 'all', actions: [
        { label: 'Download all (ZIP)', id: `${ns}-zip`, primary: true, run: async () => saveBlob(await resultsZip(), zipName()) },
        g.SlopHub ? { label: 'Save all to Slop Drive', id: `${ns}-drive`, run: saveAll } : null] });
    }
    panel.render(sections);
    drawGrid();
  }

  function summary(r) {
    const res = r.result, made = res.outputs.length, bad = res.errors.filter((e) => e.message !== 'Cancelled');
    const parts = [res.cancelled ? 'Stopped.' : `Done: ${made} file${made === 1 ? '' : 's'} made.`];
    if (bad.length) parts.push(`${bad.length} problem${bad.length === 1 ? '' : 's'}: ${bad[0].message}`);
    return [...parts, ...res.info, ...(res.notes || [])].filter(Boolean).join(' ');
  }

  function stop() { if (S.run && S.run.busy) { S.run.abort.abort(); statusText = 'Stopping after this file…'; render(); } }

  async function run() {
    if (S.run && S.run.busy) return { ok: false, message: 'A run is already going.' };
    const problem = firstProblem(checks());
    if (!S.doc.steps.length) return { ok: false, message: 'The workflow has no steps.' };
    if (!S.files.length) return { ok: false, message: 'Add files first.' };
    if (problem) { toast(problem.message); render(); return { ok: false, message: problem.message }; }
    const items = S.files.map((f) => ({ id: f.id, name: f.name, file: f.file, kind: f.kind }));
    S.run = { busy: true, abort: new AbortController(), cells: new Map(), items, result: null };
    statusText = 'Starting…';
    emit('run-start');
    render();
    let raf = 0;
    const onUnit = (u) => {
      for (const id of u.ids) S.run.cells.set(`${id}:${u.step}`, u);
      if (u.state === 'run' && u.fraction == null) statusText = `Step ${u.step} of ${S.doc.steps.length}: ${(R.byId(S.doc.steps[u.step - 1].id) || {}).label || ''}…`;
      emit('unit', u);
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); });
    };
    try {
      S.run.result = await runWorkflow(S.doc, items, R, { secrets: S.secrets, signal: S.run.abort.signal, onUnit });
    } catch (e) {
      S.run.result = { outputs: [], middles: [], errors: [{ ids: [], step: 0, message: e.message }], info: [], cancelled: false };
    }
    S.run.busy = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    render();
    const msg = summary(S.run);
    toast(msg.split('. ')[0]);
    if (frame && frame.isPhone && frame.isPhone()) frame.openSheet();
    emit('run-done', S.run);
    if (onResults) try { onResults(results()); } catch (e) { console.error(e); }
    return { ok: !S.run.result.errors.length, message: msg, outputs: S.run.result.outputs.length };
  }

  const panel = g.SlopFramePanel.create(panelEl, { title: 'Files and run' });
  const drop = g.SlopDrop.attach(zone, Object.assign({
    accept: { any: true, noun: 'a file' }, label: 'Drop files to run the workflow on', hint: 'Pictures, PDFs, documents… Read on this device, never uploaded.',
    sample: g.SlopSamples ? { label: 'Try 3 sample photos', files: () => g.SlopSamples.photos(3) } : undefined,
    process: async (file) => { const [it] = await addFiles([file]); return it.id; },
    done: () => render(),
  }, dropOpts));
  on('files', render);
  on('doc', render);
  return { render, run, stop, addFiles, clearFiles, results, resultsZip, drop };
}
