/* Slop Workflows: every action as a SlopCmd command (the menus, Ctrl+K and the Slop AI assistant use the same list).
 * The commands with args, which let the assistant build, run and export a workflow, are in ai-commands.js; the rest are
 * here. app_state (provide) is the workflow, its steps with their options and problems, the files and the results.
 * The page's tool only (a dialog's tool has its own buttons and the global "Run a workflow…").
 *   init(tool)   tool: mountWorkflow's result */
import { TEMPLATES } from '../core/templates.js';
import { saveBlob } from '../../../convert/js/io/files.js';
import { aiCommands } from './ai-commands.js';

const g = globalThis;
let S, R, tool;
const checks = () => tool.steps.checks();
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
  tool = t; ({ S, R } = t);
  const { lib, runner } = t;
  C.init({ app: 'workflows' });
  const W = 'Workflows';
  C.register(aiCommands(t).concat([
    { id: 'workflows.stop', title: 'Workflows: stop the run', group: W, keys: [], when: () => !!(S.run && S.run.busy), run: () => runner.stop() },
    { id: 'workflows.import', title: 'Workflows: import a .slopflow file…', group: W, keys: ['Mod+O'], keywords: ['open', 'file'], run: () => lib.pickImport() },
    { id: 'workflows.share', title: 'Workflows: copy a link to this workflow', group: W, keys: [], keywords: ['share', 'url', 'send'], destructive: false, run: async () => (await lib.shareLink()).url },
    { id: 'workflows.undo', title: 'Workflows: undo', group: W, keys: [], when: () => S.history.size > 0, run: undo },
    { id: 'workflows.files', title: 'Workflows: add files…', group: W, keys: [], keywords: ['open', 'pictures', 'choose'], run: () => runner.drop && runner.drop.choose() },
    { id: 'workflows.clear-files', title: 'Workflows: clear the files', group: W, keys: [], when: () => S.files.length > 0, run: () => runner.clearFiles() },
    { id: 'workflows.zip', title: 'Workflows: download all results (ZIP)', group: W, keys: [], destructive: false, when: () => !!(S.run && S.run.result && S.run.result.outputs.length),
      run: async () => { saveBlob(await runner.resultsZip(), `${S.doc.name || 'workflow'}.zip`); return 'Downloaded the ZIP.'; } },
  ]));
  C.provide({ state, checkpoint: () => { const n = S.history.size; return async () => { while (S.history.size > n) await S.history.undo(); }; } });
  if (g.SlopUndo) g.SlopUndo.keys(S.history, undo);
}
