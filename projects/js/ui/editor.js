// The task editor: a SlopUI dialog for one task (new or existing): title, description, column, assignee (from the
// project's people, or a new name), priority, start and end (a one-day task when only one is given), due day, tags, the
// CRM customer it is for (when there are customers), the checklist and what it waits for. Save checks first and keeps
// the dialog open on a problem; it is one undo step, and later tasks move on when the dates change. Delete has Undo.
// Exposes window.SlopProjects.editor.
(function (g) {
  'use strict';
  const NS = (g.SlopProjects = g.SlopProjects || {});
  const UI = g.SlopUI, el = UI.el;
  const PRI = [['none', 'None'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']];
  const field = (label, node, cls) => el('label', { class: `field${cls ? ` ${cls}` : ''}` }, el('span', null, label), node);
  const input = (id, type, value, extra = {}) => el('input', { id, type, value: value ?? '', autocomplete: 'off', ...extra });
  const select = (id, opts, value) => el('select', { id }, opts.map(([v, l]) => el('option', { value: v, selected: String(v) === String(value ?? '') }, l)));

  /** The record from the form, or { error }. */
  function read(body, f, parts, task) {
    const v = (id) => body.querySelector(`#${id}`).value.trim();
    const title = v('peTitle');
    if (!title) return { error: 'Give the task a title.' };
    let start = v('peStart'), end = v('peEnd');
    if (start && !end) end = start;
    if (end && !start) start = end;
    if (start && end < start) return { error: 'The end is before the start.' };
    const s = NS.state;
    const cust = body.querySelector('#peCustomer');
    return {
      value: {
        ...(task ? { id: task.id } : { order: NS.board.inColumn(s.tasks, v('peColumn')).length }),
        projectId: s.project.id, title, description: v('peDesc') || undefined, column: v('peColumn'), assignee: v('peWho') || undefined,
        priority: v('pePriority'), start: start || undefined, end: end || undefined, due: v('peDue') || undefined,
        tags: [...new Set(v('peTags').split(',').map((x) => x.trim().slice(0, 40)).filter(Boolean))].slice(0, 20),
        checklist: parts.check.value(), deps: parts.deps.value(), customerId: (cust && cust.value) || undefined,
      },
    };
  }

  /** Opens the editor. opts: { task } to edit, or { column, title, start } for a new one. */
  function open(opts = {}) {
    const s = NS.state, p = s.project;
    if (!p) return null;
    const task = opts.task ? s.tasks.find((t) => t.id === opts.task.id) || opts.task : null;
    const f = task || { title: opts.title || '', column: opts.column || p.columns[0].id, priority: 'none', tags: [], checklist: [], deps: [], start: opts.start, end: opts.start };
    const people = NS.board.peopleOf(p, s.tasks);
    const parts = { check: NS.editorParts.checklist(f.checklist), deps: NS.editorParts.waitsFor(task ? task.id : null, f.deps, s.tasks) };
    const customers = [...s.customers.entries()].sort((a, b) => a[1].localeCompare(b[1]));
    const body = el('form', { class: 'pe-form', onsubmit: (e) => e.preventDefault() },
      field('Title', input('peTitle', 'text', f.title, { maxlength: 200, required: true, autofocus: true }), 'wide'),
      field('Description', el('textarea', { id: 'peDesc', rows: 3, maxlength: 5000 }, f.description || ''), 'wide'),
      field('Column', select('peColumn', p.columns.map((c) => [c.id, c.name]), f.column)),
      field('Assignee', el('span', { class: 'pe-who' }, input('peWho', 'text', f.assignee, { list: 'pePeople', maxlength: 80, placeholder: 'Nobody' }),
        el('datalist', { id: 'pePeople' }, people.map((n) => el('option', { value: n }))))),
      field('Priority', select('pePriority', PRI, f.priority || 'none')),
      field('Due', input('peDue', 'date', f.due)),
      field('Start', input('peStart', 'date', f.start)),
      field('End', input('peEnd', 'date', f.end)),
      field('Tags, separated by commas', input('peTags', 'text', (f.tags || []).join(', '), { maxlength: 400 }), 'wide'),
      customers.length ? field('Customer (Slop CRM)', el('span', { class: 'inline' }, select('peCustomer', [['', 'No customer'], ...customers], f.customerId),
        el('a', { class: 'btn small', href: '../crm/#customers', title: 'Open Slop CRM' }, 'CRM')), 'wide') : null,
      el('div', { class: 'wide' }, parts.check.el),
      el('div', { class: 'wide' }, parts.deps.el),
      el('p', { class: 'note wide' }, 'With a start and an end, the task shows on the timeline. A task that waits for others starts after they end.'));
    const save = async () => {
      const r = read(body, f, parts, task);
      if (r.error) { UI.toast(r.error); return false; }
      const ok = await NS.actions.saveTask(r.value);
      return ok ? undefined : false;
    };
    const buttons = [{ label: 'Cancel' }];
    if (task) buttons.push({ label: 'Delete', danger: true, act: () => { NS.actions.deleteTask(task.id); } });
    buttons.push({ label: task ? 'Save' : 'Add task', primary: true, act: save });
    return UI.dialog({ title: task ? 'Edit task' : 'New task', body, buttons, cls: 'pe-dlg', dismissable: true });
  }

  NS.editor = { open, read };
})(typeof window !== 'undefined' ? window : globalThis);
