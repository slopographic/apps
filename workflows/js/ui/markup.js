/* Slop Workflows: the tool's DOM, made for one instance (ids are "<ns>-<name>": wf-run for the first tool on a page,
 * wf2-run for the next). Three parts: the list (saved and templates; not in a compact tool, which has "Open ▾" instead),
 * the workflow (name, steps, + Add step) and the side (files, run, progress, results).
 *   markup(ns, { compact, landmark }) → { root, list, main, side, $ } ; $(name) is the element with id <ns>-<name> */
import { h } from '../../../convert/js/ui/dom.js';
import { TEMPLATES } from '../core/templates.js';

const btn = (id, label, cls = '', more = {}) => h('button', { type: 'button', class: `sui-btn ${cls}`.trim(), id, ...more }, label);

export function markup(ns, { compact = false, landmark = false } = {}) {
  const id = (n) => `${ns}-${n}`;
  const list = compact ? null : h('aside', { class: 'wf-list', id: id('list'), 'aria-label': 'Workflows' },
    h('div', { class: 'wf-list-top' }, btn(id('new'), 'New workflow', 'sui-primary'), btn(id('import'), 'Import…', '', { title: 'Open a .slopflow file' })),
    h('h2', { class: 'wf-lh' }, 'Saved'), h('ul', { class: 'wf-ul', id: id('saved'), 'aria-label': 'Saved workflows' }),
    h('h2', { class: 'wf-lh' }, 'Templates'), h('ul', { class: 'wf-ul', id: id('templates'), 'aria-label': 'Templates' }));
  const main = h(landmark ? 'main' : 'div', { class: 'wf-main', id: id('main'), 'aria-label': landmark ? undefined : 'Workflow' },
    compact ? null : h('div', { class: 'wf-phonebar' }, btn(id('back'), '‹ Workflows'), btn(id('phone-files'), 'Files and run', 'sui-primary', { 'aria-haspopup': 'dialog' })),
    h('div', { class: 'wf-head' },
      h('label', { class: 'wf-sr', for: id('name') }, 'Workflow name'),
      h('input', { class: 'sui-input wf-name', id: id('name'), autocomplete: 'off', spellcheck: 'false', maxlength: '120' }),
      h('span', { class: 'wf-count', id: id('count') }), h('span', { class: 'wf-state', id: id('state'), role: 'status' }),
      h('span', { class: 'wf-head-acts' },
        compact ? btn(id('open'), 'Open', 'wf-open', { 'aria-haspopup': 'menu', title: 'Templates and saved workflows' }) : null,
        btn(id('undo'), 'Undo', '', { disabled: true }), btn(id('export'), 'Export', '', { title: 'Download as a .slopflow file' }),
        btn(id('save'), 'Save', '', { title: 'Save in this browser' }), btn(id('share'), 'Share link', '', { title: 'Copy a link with this workflow in it' }))),
    h('section', { class: 'wf-empty', id: id('empty'), 'aria-labelledby': id('empty-h') },
      h('h2', { class: 'wf-h1', id: id('empty-h') }, 'Chain apps into one workflow'),
      h('p', { class: 'wf-lead' }, 'Run a batch of files through several apps in one go: remove the background, put on your watermark, resize, convert, zip. Every step runs on this device; nothing is uploaded.'),
      h('p', { class: 'wf-lead' }, 'Add a step below, or start from a template:'),
      h('div', { class: 'wf-tpl-row' }, ...TEMPLATES.map((t) => btn('', t.name, '', { 'data-template': t.id, id: undefined })))),
    h('ol', { class: 'wf-steps', id: id('steps'), 'aria-label': 'Steps', hidden: true }),
    h('div', { class: 'wf-add-row' }, btn(id('add'), '+ Add step', 'wf-add', { title: 'Add a step' })));
  const side = h('aside', { class: 'wf-side', id: id('side'), 'aria-label': 'Files and run' });
  const root = h('div', { class: 'wf-tool' + (compact ? ' wf-compact' : ''), 'data-wf-ns': ns }, list, main, side);
  return { root, list, main, side, $: (n) => root.querySelector('#' + id(n)) };
}
