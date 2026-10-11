// The task editor: a SlopUI dialog for one task. It holds the fields, a repeat and a reminder, a CRM customer link and the
// zone of a due time. Subtasks are added and removed in the dialog and saved at once (they are tasks of their own).
// Saving validates first, and a bad form keeps the dialog open. Exposes window.SlopTodo.editor.
(function (g) {
  'use strict';
  const S = g.SlopData, T = g.SlopTime, TS = g.SlopTaskStore, TK = g.SlopTasks, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopTodo = g.SlopTodo || {});
  const REMINDERS = [{ v: '', label: 'No reminder' }, { v: 0, label: 'At the due time' }, { v: 15, label: '15 minutes before' }, { v: 60, label: '1 hour before' }, { v: 1440, label: '1 day before' }];
  const FALLBACK = ['UTC', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Tokyo'];
  const field = (id, label, node) => el('label', { class: 'field' }, el('span', null, label), node);
  const inp = (id, type, value, label, extra = {}) => el('input', { id, type, value: value ?? '', 'aria-label': label, ...extra });
  const sel = (id, opts, value, label) => el('select', { id, 'aria-label': label }, opts.map((o) => el('option', { value: o.v, selected: String(o.v) === String(value) }, o.label)));

  function zones(current) {
    let all = FALLBACK;
    try { if (Intl.supportedValuesOf) all = Intl.supportedValuesOf('timeZone'); } catch (e) { /* short list */ }
    return [...new Set([current, T.deviceZone(), ...all].filter(Boolean))];
  }

  /** The editor's starting values for a task, or for a new one (list and due day preset). */
  function start(task, opts) {
    if (task) return { ...task, tags: (task.tags || []).join(', '), remind: task.remind ?? '', freq: task.freq || 'none', tz: task.tz || T.deviceZone() };
    return { title: opts.title || '', notes: '', due: opts.due || '', dueTime: '', tz: T.deviceZone(), priority: 'none', list: opts.list || 'Inbox',
      tags: '', freq: 'none', until: '', remind: '', customerId: opts.customerId || '', parentId: opts.parentId || '' };
  }

  /**
   * Opens the editor. opts: { task (to edit), list, due, parentId, title, customerId, today, onDone }. A subtask is added
   * with parentId set; its parent's dialog shows it in the list.
   */
  async function open(opts = {}) {
    const task = opts.task || null;
    const f = start(task, opts);
    const cust = await S.store.list('customers');
    const customers = cust.ok ? cust.value.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))) : [];
    const lists = await listNames();
    const kids = task ? (await S.store.list('tasks')).value.filter((t) => t.parentId === task.id) : [];
    const subs = el('ul', { class: 'sub-list', 'aria-label': 'Subtasks' }, kids.sort(TK.compare).map((k) => subRow(k)));
    const subInput = inp('tSubTitle', 'text', '', 'New subtask', { maxlength: 200, placeholder: 'Add a subtask' });
    const subAdd = el('button', { type: 'button', class: 'btn', onclick: async () => {
      const title = subInput.value.trim();
      if (!task || !title) return;
      const r = await TS.save({ title, list: f.list || 'Inbox', parentId: task.id, done: false });
      if (!r.ok) UI.toast(r.message); else { subInput.value = ''; subs.append(subRow(r.value)); }
    } }, 'Add');
    const body = el('form', { class: 'task-form', id: 'tForm', onsubmit: (e) => e.preventDefault() },
      field('teTitle', 'Title', inp('teTitle', 'text', f.title, 'Title', { maxlength: 200, required: true, autofocus: true })),
      field('tNotes', 'Notes', el('textarea', { id: 'tNotes', rows: 3, maxlength: 5000, 'aria-label': 'Notes' }, f.notes || '')),
      el('div', { class: 'ev-row' },
        field('tDue', 'Due date', inp('tDue', 'date', f.due, 'Due date')),
        field('tTime', 'Due time', inp('tTime', 'time', f.dueTime, 'Due time'))),
      field('tTz', 'Zone of the due time', sel('tTz', zones(f.tz).map((z) => ({ v: z, label: z })), f.tz, 'Zone of the due time')),
      el('div', { class: 'ev-row' },
        field('tPriority', 'Priority', sel('tPriority', [{ v: 'none', label: 'None' }, { v: 'low', label: 'Low' }, { v: 'high', label: 'High' }], f.priority, 'Priority')),
        field('teList', 'List', el('span', null, inp('teList', 'text', f.list, 'List', { list: 'tListNames', maxlength: 40 }),
          el('datalist', { id: 'tListNames' }, lists.map((n) => el('option', { value: n })))))),
      field('tTags', 'Tags, separated by commas', inp('tTags', 'text', f.tags, 'Tags', { maxlength: 400 })),
      el('div', { class: 'ev-row' },
        field('tRepeat', 'Repeat', sel('tRepeat', [{ v: 'none', label: 'Does not repeat' }, { v: 'daily', label: 'Every day' }, { v: 'weekly', label: 'Every week' }, { v: 'monthly', label: 'Every month' }, { v: 'yearly', label: 'Every year' }], f.freq, 'Repeat')),
        field('tUntil', 'Repeat until (optional)', inp('tUntil', 'date', f.until, 'Repeat until'))),
      el('div', { class: 'ev-row' },
        field('tRemind', 'Reminder', sel('tRemind', REMINDERS.map((r) => ({ v: r.v, label: r.label })), f.remind, 'Reminder'))),
      field('tCustomer', 'Customer', sel('tCustomer', [{ v: '', label: 'No customer' }, ...customers.map((c) => ({ v: c.id, label: c.name }))], f.customerId, 'Customer')),
      el('p', { class: 'note' }, 'A due time shows in Slop Calendar as a block. A task with no due date is not on the calendar.'),
      task ? el('section', { class: 'sub-sec' }, el('h4', { class: 'sub-t' }, 'Subtasks'), subs,
        el('div', { class: 'inline' }, subInput, subAdd)) : el('p', { class: 'note' }, 'Save the task first to add subtasks.'));
    const read = () => {
      const v = (id) => body.querySelector(`#${id}`).value;
      return { title: v('teTitle'), notes: v('tNotes'), due: v('tDue'), dueTime: v('tTime'), tz: v('tTz'), priority: v('tPriority'),
        list: v('teList'), tags: v('tTags'), freq: v('tRepeat'), until: v('tUntil'), remind: v('tRemind'), customerId: v('tCustomer'),
        parentId: f.parentId };
    };
    const save = async () => {
      const res = TS.fromForm(read(), task);
      if (!res.ok) { UI.toast(res.error); return false; }
      const r = await TS.save(res.value);
      if (!r.ok) { UI.toast(r.message || 'Could not save the task.'); return false; }
      if (opts.onDone) opts.onDone(r.value);
      return true;
    };
    const remove = async () => {
      const kidCount = kids.length;
      const yes = await UI.confirm('Delete this task?', kidCount ? `Its ${kidCount} subtask${kidCount === 1 ? '' : 's'} are deleted too.` : 'This cannot be undone.', 'Delete', { danger: true });
      if (!yes) return false;
      const r = await TS.remove(task.id);
      if (!r.ok) { UI.toast(r.message); return false; }
      if (opts.onDone) opts.onDone(null);
      return true;
    };
    const buttons = [{ label: 'Cancel' }];
    if (task) buttons.push({ label: 'Delete', danger: true, act: remove });
    buttons.push({ label: 'Save', primary: true, act: async () => ((await save()) ? undefined : false) });
    return UI.dialog({ title: task ? 'Edit task' : 'New task', body, buttons, cls: 'task-dlg', dismissable: true });
  }

  /** One subtask in the dialog: its title and a checkbox that completes it at once. */
  function subRow(k) {
    return el('li', { class: `sub-row${k.done ? ' is-done' : ''}` },
      el('input', { type: 'checkbox', checked: !!k.done, 'aria-label': `Complete ${k.title}`, onchange: async (e) => {
        const r = e.target.checked ? await TS.complete(k.id) : await TS.reopen(k.id);
        if (!r.ok) UI.toast(r.message);
      } }),
      el('span', null, k.title));
  }

  /** The list names in use, for the list field's suggestions. */
  async function listNames() {
    const r = await S.store.list('tasks');
    return r.ok ? TK.listsOf(r.value) : ['Inbox'];
  }

  NS.editor = { open, start, zones, REMINDERS };
})(typeof window !== 'undefined' ? window : globalThis);
