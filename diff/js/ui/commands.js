/* Slop Compare: the page's commands (SlopCmd: Ctrl+K, the shortcut editor, macros) and, loaded when the AI panel or WebMCP
 * first asks, the assistant's commands with arguments (ai-commands.js). The same functions as the buttons.
 *   diff.compare  Compare (Mod+Enter)        diff.next / diff.prev  Next and Previous change (F7 / Shift+F7, Alt+↓ / Alt+↑)
 *   diff.open-a / diff.open-b / diff.swap / diff.clear / diff.view   diff.report-html / -pdf / diff.patch / diff.drive
 * ES module. */
import { setOpts, swap } from './state.js';

export function init(app) {
  const C = window.SlopCmd;
  if (!C) return;
  C.init({ app: 'diff' });
  const S = app.S, has = () => !!S.result, both = () => !!(S.sides.a.file || S.sides.a.text) && !!(S.sides.b.file || S.sides.b.text);
  const out = (f) => () => app.export.download(f).catch((e) => window.SlopUI.toast(e.message, 4000));
  C.register([
    { id: 'diff.compare', title: 'Compare', group: 'Compare', keys: ['Mod+Enter'], keywords: ['diff', 'run', 'check'], when: both, run: () => app.compare() },
    { id: 'diff.next', title: 'Next change', group: 'Compare', keys: ['F7', 'Alt+ArrowDown'], when: () => app.count() > 0, run: () => app.go(1) },
    { id: 'diff.prev', title: 'Previous change', group: 'Compare', keys: ['Shift+F7', 'Alt+ArrowUp'], when: () => app.count() > 0, run: () => app.go(-1) },
    { id: 'diff.open-a', title: 'Open a file as A…', group: 'File', keys: [], keywords: ['original', 'left'], run: () => window.SlopIntake.pick({ to: 'diff', data: { side: 'a' }, multiple: false }) },
    { id: 'diff.open-b', title: 'Open a file as B…', group: 'File', keys: [], keywords: ['changed', 'right'], run: () => window.SlopIntake.pick({ to: 'diff', data: { side: 'b' }, multiple: false }) },
    { id: 'diff.swap', title: 'Swap A and B', group: 'Edit', keys: [], run: () => swap() },
    { id: 'diff.clear', title: 'Clear both sides', group: 'Edit', keys: [], when: () => both() || has(), run: () => app.clearAll() },
    { id: 'diff.view', title: 'Switch between side by side and unified', group: 'View', keys: [], keywords: ['split', 'inline'], run: () => setOpts({ view: S.opts.view === 'split' ? 'unified' : 'split' }) },
    { id: 'diff.report-html', title: 'Download the report (HTML)', group: 'File', keys: [], when: has, run: out('html') },
    { id: 'diff.report-pdf', title: 'Download the report (PDF)', group: 'File', keys: [], when: has, run: out('pdf') },
    { id: 'diff.patch', title: 'Download a .patch', group: 'File', keys: [], keywords: ['unified diff', 'git'], when: () => app.export.canPatch(), run: out('patch') },
    { id: 'diff.drive', title: 'Save the report to Slop Drive', group: 'File', keys: [], when: has, run: () => app.export.saveToDrive('html') },
  ]);
  // the AI commands read Slop Drive and site files through shared/commands/sources.js (loaded with them)
  const sources = () => (window.SlopCmdSources ? Promise.resolve() : new Promise((res, rej) => {
    const s = Object.assign(document.createElement('script'), { src: new URL('../../../shared/commands/sources.js', import.meta.url).href });
    s.onload = () => res(); s.onerror = () => rej(new Error('Could not load sources.js')); document.head.append(s);
  }));
  C.provide({ prepare: () => sources().then(() => import('./ai-commands.js')).then((m) => m.register(app)) });
}
