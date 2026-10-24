/* Slop Workflows: every action as a SlopCmd command (the menus, Ctrl+K and the Slop AI assistant use the same list).
 * Commands with args (shared/commands/args.js) let the assistant build and run a workflow: add a step by its operation id
 * with its options, set one option, remove or move a step, open a template, run. app_state (provide) is the workflow,
 * its steps with their options and problems, the files and the results.
 * The page's tool only (a dialog's tool has its own buttons and the global "Run a workflow…").
 *   init(tool)   tool: mountWorkflow's result */
import { TEMPLATES } from '../core/templates.js';
import { saveBlob } from '../../../convert/js/io/files.js';

const g = globalThis;
let S, R, edit, tool;
const checks = () => tool.steps.checks();
const addStep = (id, o, at) => tool.addStep(id, o, at);
const stepAt = (n) => {
  const i = Math.round(Number(n)) - 1;
  if (!(i >= 0 && i < S.doc.steps.length)) throw new Error(`There is no step ${n}; the workflow has ${S.doc.steps.length}.`);
  return i;
};
function parseOptions(text) {
  if (text == null || text === '') return {};
  if (typeof text === 'object') return text;
  try { const o = JSON.parse(text); if (o && typeof o === 'object' && !Array.isArray(o)) return o; } catch (e) { /* below */ }
  throw new Error('options must be a JSON object, like {"width": 1080}.');
}

const undo = () => tool.undo();

function state() {
  const res = checks();
  return {
    workflow: S.doc.name, saved: !!S.id,
    steps: S.doc.steps.map((s, i) => ({ step: i + 1, id: s.id, label: (R.byId(s.id) || {}).label || s.id, options: s.options, keep: !!s.keep, problem: res[i] && res[i].message || '' })),
    files: S.files.map((f) => ({ name: f.name, kind: f.kind })),
    running: !!(S.run && S.run.busy),
    results: S.run && S.run.result ? S.run.result.outputs.map((o) => o.name) : [],
    templates: TEMPLATES.map((t) => t.id),
  };
}

export function init(t) {
  const C = g.SlopCmd;
  if (!C) return;
  tool = t; ({ S, R, edit } = t);
  const { lib, runner, frame } = t;
  C.init({ app: 'workflows' });
  const ops = R.all().map((o) => [o.id, `${o.label} (${R.appLabel(o.app)})`]);
  const W = 'Workflows';
  C.register([
    { id: 'workflows.run', title: 'Workflows: run the workflow', group: W, keys: ['Mod+Enter'], destructive: false, keywords: ['start', 'go', 'process', 'batch'],
      description: 'Runs every step on the files in the panel and lists the results.',
      run: async () => { const r = await runner.run(); if (!r.ok && !r.outputs) throw new Error(r.message); return r.message; } },
    { id: 'workflows.stop', title: 'Workflows: stop the run', group: W, keys: [], when: () => !!(S.run && S.run.busy), run: () => runner.stop() },
    { id: 'workflows.add-step', title: 'Workflows: add a step…', group: W, keys: ['Mod+Shift+A'], destructive: false, keywords: ['operation', 'app', 'new step'],
      description: 'Adds a step at the end (or at a position) with option values. The options are the step’s own; unknown ones are dropped.',
      args: [{ name: 'op', type: 'enum', options: ops, description: 'the operation id' },
        { name: 'options', type: 'string', maxLength: 20000, description: 'a JSON object of option values, e.g. {"width": 1080, "format": "jpg"}' },
        { name: 'at', type: 'number', integer: true, min: 1, max: 40, description: 'the position, 1 = first (default: the end)' }],
      run: (args) => {
        if (!args || !args.op) { const b = tool.root.querySelector('.wf-add'); if (b) b.click(); return ''; }
        const r = addStep(args.op, parseOptions(args.options), { at: args.at ? args.at - 1 : null });
        const op = R.byId(args.op), res = checks(), i = S.doc.steps.findIndex((s) => s.uid === r.step.uid);
        return [`Added step ${i + 1}: ${op.label}.`, ...r.notes, ...r.errors, res[i] && res[i].message].filter(Boolean).join(' ');
      } },
    { id: 'workflows.set-option', title: 'Workflows: set a step option', group: W, keys: [], hidden: true, destructive: false,
      args: [{ name: 'step', type: 'number', integer: true, min: 1, max: 40, required: true }, { name: 'key', type: 'string', required: true }, { name: 'value', type: 'string', required: true }],
      run: (a) => {
        const i = stepAt(a.step), op = R.byId(S.doc.steps[i].id);
        if (!op.options.some((o) => o.key === a.key)) throw new Error(`${op.label} has no option ${a.key}. It has: ${op.options.map((o) => o.key).join(', ')}.`);
        const v = R.validateOptions(op, { ...S.doc.steps[i].options, [a.key]: a.value });
        if (!v.ok) throw new Error(v.errors.join(' '));
        edit(`Change ${op.label}`, (d) => { d.steps[i].options = { ...d.steps[i].options, [a.key]: v.options[a.key] }; });
        return `Step ${i + 1} (${op.label}): ${a.key} is ${v.options[a.key]}.`;
      } },
    { id: 'workflows.remove-step', title: 'Workflows: remove a step', group: W, keys: [], hidden: true,
      args: [{ name: 'step', type: 'number', integer: true, min: 1, max: 40, required: true }],
      run: (a) => { const i = stepAt(a.step), l = (R.byId(S.doc.steps[i].id) || {}).label; edit(`Remove ${l}`, (d) => { d.steps.splice(i, 1); }); return `Removed step ${i + 1} (${l}).`; } },
    { id: 'workflows.move-step', title: 'Workflows: move a step', group: W, keys: [], hidden: true, destructive: false,
      args: [{ name: 'step', type: 'number', integer: true, min: 1, max: 40, required: true }, { name: 'to', type: 'number', integer: true, min: 1, max: 40, required: true }],
      run: (a) => { const i = stepAt(a.step), j = stepAt(a.to); edit('Move step', (d) => { const [s] = d.steps.splice(i, 1); d.steps.splice(j, 0, s); }); return `Moved step ${i + 1} to ${j + 1}.`; } },
    { id: 'workflows.template', title: 'Workflows: open a template', group: W, keys: [], destructive: false,
      args: [{ name: 'template', type: 'enum', options: TEMPLATES.map((t) => [t.id, t.name]), required: true }],
      run: (a) => { if (!a) { frame.showList(); return ''; } lib.openTemplate(a.template); return `Opened the ${a.template} template.`; } },
    { id: 'workflows.rename', title: 'Workflows: rename the workflow', group: W, keys: [], hidden: true, destructive: false,
      args: [{ name: 'name', type: 'string', maxLength: 120, required: true }],
      run: (a) => { edit('Rename', (d) => { d.name = a.name; }); return `Renamed to ${a.name}.`; } },
    { id: 'workflows.new', title: 'Workflows: new workflow', group: W, keys: [], run: () => lib.newFlow() },
    { id: 'workflows.save', title: 'Workflows: save in this browser', group: W, keys: ['Mod+S'], destructive: false, run: async () => (await lib.save()).ok ? 'Saved.' : 'Not saved.' },
    { id: 'workflows.export', title: 'Workflows: export as a .slopflow file', group: W, keys: [], keywords: ['download', 'file', 'backup'], destructive: false, run: () => `Downloaded ${lib.exportFile()}.` },
    { id: 'workflows.import', title: 'Workflows: import a .slopflow file…', group: W, keys: ['Mod+O'], keywords: ['open', 'file'], run: () => lib.pickImport() },
    { id: 'workflows.share', title: 'Workflows: copy a link to this workflow', group: W, keys: [], keywords: ['share', 'url', 'send'], destructive: false, run: async () => (await lib.shareLink()).url },
    { id: 'workflows.undo', title: 'Workflows: undo', group: W, keys: [], when: () => S.history.size > 0, run: undo },
    { id: 'workflows.files', title: 'Workflows: add files…', group: W, keys: [], keywords: ['open', 'pictures', 'choose'], run: () => runner.drop && runner.drop.choose() },
    { id: 'workflows.clear-files', title: 'Workflows: clear the files', group: W, keys: [], when: () => S.files.length > 0, run: () => runner.clearFiles() },
    { id: 'workflows.zip', title: 'Workflows: download all results (ZIP)', group: W, keys: [], destructive: false, when: () => !!(S.run && S.run.result && S.run.result.outputs.length),
      run: async () => { saveBlob(await runner.resultsZip(), `${S.doc.name || 'workflow'}.zip`); return 'Downloaded the ZIP.'; } },
  ]);
  C.provide({ state, checkpoint: () => { const n = S.history.size; return async () => { while (S.history.size > n) await S.history.undo(); }; } });
  if (g.SlopUndo) g.SlopUndo.keys(S.history, undo);
}
