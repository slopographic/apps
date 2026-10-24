/* SlopAgentWorkspace: the files an AI agent works with on this page, and the operations registry, as neutral tool
 * definitions for the generator (shared/agent/tools.js). Classic script; window.SlopAgentWorkspace. Files are named by
 * ids and never leave the device:
 *   result:<n>  a file an operation or workflow made in this page (kept for the visit)
 *   app:<n>     a file the app has open (the same event the Convert dialog asks, shared/convert/provided.js)
 *   drive:<id>  a Slop Drive file (SlopHub, shared/hub.js)
 *   defs({ app, root }) → [list_files, open_file?, save_to_drive, download, list_operations, run_operation, run_workflow]
 *   file(id) → Promise<File>, add(blob, name) → id, results()
 * The operations are shared/ops/all.js (every File convert conversion, the apps' operations, the recorded macros), run by
 * the one runner (workflows/js/core/plan.js runWorkflow); its modules load on the first call only. */
(function (g) {
  'use strict';
  if (g.SlopAgentWorkspace) return;
  const SCRIPT = document.currentScript;
  const ROOT = SCRIPT && SCRIPT.src ? new URL('../../', SCRIPT.src).href : new URL('/', location.href).href;
  const made = new Map(), opened = new Map();
  let seq = 0, appSeq = 0;
  const mod = (rel) => import(new URL(rel, ROOT).href);
  const asFile = (blob, name) => (blob instanceof File && blob.name === name ? blob : new File([blob], name || 'file', { type: blob.type || '' }));
  const brief = (id, f, where) => ({ id, name: f.name, type: f.type || '', size: f.size, where });
  const fileIds = { type: 'array', items: { type: 'string' }, description: 'file ids from list_files (result:…, app:…, drive:…)' };

  function add(blob, name) { const id = 'result:' + (++seq); made.set(id, asFile(blob, name)); return id; }

  async function appFiles() {
    try {
      const { ask } = await mod('shared/convert/provided.js');
      const { files } = await ask();
      opened.clear(); appSeq = 0;
      return files.map((f) => { const id = 'app:' + (++appSeq); opened.set(id, f); return brief(id, f, 'open in this app'); });
    } catch (e) { return []; }
  }
  async function file(id) {
    id = String(id || '');
    if (made.has(id)) return made.get(id);
    if (id.startsWith('app:')) { if (!opened.size) await appFiles(); if (opened.has(id)) return opened.get(id); }
    if (id.startsWith('drive:') && g.SlopHub) {
      const r = await g.SlopHub.get(id.slice(6));
      if (r && r.blob) { const f = asFile(r.blob, r.name); f.slopDrive = r; return f; }
    }
    throw new Error(`No file "${id}". Use list_files to see the ids.`);
  }

  /* ---------- the operations ---------- */
  let opsP = null;
  function ops() {
    if (!opsP) opsP = (async () => {
      const [R, plan, detect, io, load] = await Promise.all([mod('shared/ops/all.js'), mod('workflows/js/core/plan.js'), mod('convert/js/core/detect.js'), mod('convert/js/io/files.js'), mod('shared/ops/load.js')]);
      await load.scripts(['shared/commands/args.js', 'shared/ops/flowdoc.js'], () => g.SlopCmdArgs && g.SlopFlowDoc);
      if (R.macrosReady) await Promise.race([R.macrosReady, new Promise((r) => setTimeout(r, 3000))]).catch(() => {});
      return { R, plan, detect, io };
    })().catch((e) => { opsP = null; throw e; });
    return opsP;
  }
  function describeOp(R, op, full) {
    const o = { id: op.id, label: op.label, app: R.appLabel(op.app), takes: op.from, makes: op.ext || (op.out ? 'depends on the options' : 'the same kind'), mode: op.mode };
    if (op.kind === 'macro') o.step = { kind: 'macro', app: op.app, macroId: op.macroId };
    if (full) { o.options = g.SlopCmdArgs.jsonSchema(R.argsOf(op)); if (op.description) o.description = op.description; }
    return o;
  }
  async function runFlow(raw, ids) {
    const { R, plan, detect, io } = await ops();
    const F = g.SlopFlowDoc;
    const { doc, errors } = typeof raw === 'string' ? F.fromText(raw) : F.normalize(raw);
    if (!doc) throw new Error(errors[0] || 'This is not a workflow.');
    if (!doc.steps.length) throw new Error('The workflow has no steps.');
    const list = [].concat(ids || []);
    if (!list.length) throw new Error('Give the files to work on: files: ["result:1"] (ids from list_files).');
    const items = [];
    for (const id of list) {
      const f = await file(id);
      items.push({ id, name: f.name, file: f, kind: detect.detectKind(f.name, f.type, await io.readHead(f)) });
    }
    const res = await plan.runWorkflow(doc, items, R);
    const out = res.outputs.concat(res.middles || []).map((o) => { const id = add(o.blob || o.file, o.name); return brief(id, made.get(id), 'result'); });
    return { files: out, errors: res.errors.map((e) => `Step ${e.step}: ${e.message}`), notes: (res.notes || []).concat(errors), next: out.length ? 'save_to_drive, download or open_file with these ids.' : undefined };
  }

  function defs({ app = 'this app' } = {}) {
    const H = () => g.SlopHub || null;
    const list = [
      { name: 'list_files', title: 'List files', readOnly: true, untrusted: true,
        description: `List the files you can work with: the results made in this page, the files open in ${app}, and Slop Drive (this device's own file store). Each has an id for the other tools.`,
        inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'a word in the file name' } } },
        run: async (a) => {
          const q = String(a.query || '').toLowerCase(), hit = (f) => !q || f.name.toLowerCase().includes(q);
          const res = [...made].map(([id, f]) => brief(id, f, 'result'));
          const drive = H() ? (await H().list().catch(() => [])).slice(0, 200).map((r) => ({ id: 'drive:' + r.id, name: r.name, type: r.type, size: r.size, where: 'Slop Drive' })) : [];
          return res.concat(await appFiles(), drive).filter(hit).slice(0, 100);
        } },
      { name: 'save_to_drive', title: 'Save to Slop Drive',
        description: 'Save a file to Slop Drive on this device: a result or open file by id, or new text with a name and content. Returns the Drive id.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'file id from list_files' }, name: { type: 'string', description: 'file name, e.g. notes.md (for new text, or to rename)' }, content: { type: 'string', description: 'the text of a new file' } } },
        run: async (a) => {
          if (!H()) throw new Error('Slop Drive is not available on this page.');
          const f = a.id ? await file(a.id) : a.content != null ? new File([String(a.content)], String(a.name || 'untitled.txt'), { type: /\.json$/i.test(a.name || '') ? 'application/json' : /\.md$/i.test(a.name || '') ? 'text/markdown' : 'text/plain' }) : null;
          if (!f) throw new Error('Give an id, or a name and content.');
          const name = String(a.name || f.name).replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'file';
          const id = await H().put(f, { name, from: 'agent', app: (H().self && H().self.app) || undefined });
          return { id: 'drive:' + id, name, saved: 'Slop Drive, on this device' };
        } },
      { name: 'download', title: 'Download a file',
        description: 'Download a file (by id) to this device\'s Downloads folder, as the browser does for any download.',
        inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'file id from list_files' } }, required: ['id'] },
        run: async (a) => {
          const f = await file(a.id);
          if (g.SlopUI && g.SlopUI.download) g.SlopUI.download(f, f.name);
          else { const u = URL.createObjectURL(f), l = Object.assign(document.createElement('a'), { href: u, download: f.name }); document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
          return `Downloaded ${f.name}.`;
        } },
      { name: 'list_operations', title: 'List file operations', readOnly: true,
        description: 'List the file operations this site can run on the device (every File convert conversion, background removal, watermark, resize, upscale, OCR, PDF tools, recorded macros). Filter by a word or a file kind (png, pdf, csv…); a filtered list (up to 25) includes each operation\'s options as JSON Schema.',
        inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'words in the name' }, kind: { type: 'string', description: 'a file kind the operation takes, e.g. png or pdf' } } },
        run: async (a) => {
          const { R } = await ops();
          const q = String(a.query || '').toLowerCase().split(/\s+/).filter(Boolean), k = String(a.kind || '').toLowerCase().replace(/^\./, '');
          const hits = R.all().filter((op) => (!k || R.accepts(op, k)) && q.every((w) => `${op.id} ${op.label} ${op.group || ''} ${(op.keywords || []).join(' ')}`.toLowerCase().includes(w)));
          const full = (q.length || k) && hits.length <= 25;
          return { count: hits.length, operations: hits.slice(0, 400).map((op) => describeOp(R, op, full)), hint: full ? undefined : 'Filter with query or kind to see the options.' };
        } },
      { name: 'run_operation', title: 'Run a file operation',
        description: 'Run one operation (id from list_operations) on files (ids from list_files). The new files stay in this page as result ids until you save or download them. Nothing is uploaded.',
        inputSchema: { type: 'object', properties: { operation: { type: 'string', description: 'operation id from list_operations' }, files: fileIds, options: { type: 'object', description: 'the operation\'s options (see list_operations)' } }, required: ['operation', 'files'] },
        run: async (a) => {
          const { R } = await ops(), op = R.byId(String(a.operation));
          if (!op) throw new Error(`No operation "${a.operation}". Use list_operations.`);
          const step = op.kind === 'macro' ? describeOp(R, op).step : { kind: 'op' };
          return runFlow({ kind: 'slopflow', v: 1, name: op.label, steps: [Object.assign(step, { id: op.id, options: a.options || {} })] }, a.files);
        } },
      { name: 'run_workflow', title: 'Run a workflow',
        description: 'Run a Slop Workflows document on files: { kind: "slopflow", v: 1, name, steps: [{ kind: "op", id, options }] } (an object), or workflow_text: the text of a .slopflow file. Each step\'s files go to the next step; the results stay in this page as result ids.',
        inputSchema: { type: 'object', properties: { workflow: { type: 'object', description: 'the .slopflow document' }, workflow_text: { type: 'string', description: 'or the text of a .slopflow file' }, files: fileIds }, required: ['files'] },
        run: (a) => runFlow(a.workflow || a.workflow_text, a.files) },
    ];
    const I = g.SlopIntake;
    if (I && I.take && I.spec && I.spec()) list.splice(1, 0, { name: 'open_file', title: 'Open a file in this app',
      description: `Open a file (a Slop Drive or result id from list_files) in ${app}, the same way as opening it from Slop Drive. The app may ask the person whether to add it or start a new document.`,
      inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'file id from list_files' } }, required: ['id'] },
      run: async (a) => {
        const f = await file(a.id), s = await I.take(f.slopDrive ? [f.slopDrive] : [f], { source: f.slopDrive ? 'drive' : 'api' });
        if (s.added && s.added.length) return `Opened ${f.name} in ${app}.`;
        throw new Error(s.skipped && s.skipped.length ? s.skipped[0].reason : `${app} did not open ${f.name}.`);
      } });
    return list;
  }

  g.SlopAgentWorkspace = { defs, file, add, results: () => [...made].map(([id, f]) => brief(id, f, 'result')), ROOT };
})(window);
