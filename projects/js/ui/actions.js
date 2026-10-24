// Slop Projects actions: every change the board, the timeline, the list and the dialogs make, each one write (one
// transaction) and one undo step (SlopUndo, shared/ui/undo.js): the toast says what was done and offers Undo, and Ctrl+Z
// undoes too. A date change moves later tasks on so no dependency is broken, in the same step. Exposes
// window.SlopProjects.actions.
(function (g) {
  'use strict';
  const NS = (g.SlopProjects = g.SlopProjects || {});
  const UI = g.SlopUI, T = g.SlopTime;
  const history = g.SlopUndo.create();
  const st = () => NS.state;
  const B = () => NS.board, D = () => NS.deps, ST = () => NS.store;
  const live = (msg) => { const n = document.getElementById('pLive'); if (n) n.textContent = msg; };
  const fail = (r, what) => { UI.toast(r && r.message ? `${what}: ${r.message}` : `${what}.`); return false; };
  const colName = (id) => ((st().project.columns || []).find((c) => c.id === id) || {}).name || id;
  const short = (day) => T.dayText(day, st().locale, { day: 'numeric', month: 'short' });

  /** Runs a write; on success keeps its undo step, says what was done and returns the write's value. */
  async function commit(promise, label, { toast = true } = {}) {
    const r = await promise;
    if (!r.ok) return fail(r, 'Not saved');
    if (r.value.undo.length) history.push(label, () => ST().write(r.value.undo));
    live(`${label}.`);
    if (toast) g.SlopUndo.toast(label, undo);
    await NS.app.reload();
    return r.value;
  }

  /** Undoes the newest step and says what was undone. */
  async function undo() {
    const r = await history.undo();
    UI.toast(r.ok ? `Undone: ${r.label}.` : r.message);
    live(r.ok ? `Undone: ${r.label}.` : r.message);
    if (r.ok) await NS.app.reload();
    return r.ok;
  }

  /** Moves a card to place `index` of a column (counted among all its cards). */
  function moveCard(id, column, index) {
    const tasks = st().tasks, t = tasks.find((x) => x.id === id);
    if (!t) return Promise.resolve(false);
    const changes = B().move(tasks, id, column, index);
    if (!changes.length) return Promise.resolve(false);
    const label = column === t.column ? `Moved "${t.title}" to place ${index + 1} in ${colName(column)}` : `Moved "${t.title}" to ${colName(column)}`;
    return commit(ST().patchTasks(changes), label);
  }

  /** Moves a card one column left or right (dir -1 or 1), or up and down its column (dy). Keeps its focus. */
  function nudge(id, dx, dy) {
    const p = st().project, tasks = st().tasks, t = tasks.find((x) => x.id === id);
    if (!t) return Promise.resolve(false);
    const cols = p.columns.map((c) => c.id), ci = cols.indexOf(B().columnOf(p, t));
    if (dx) {
      const to = cols[ci + dx];
      if (!to) return Promise.resolve(false);
      return moveCard(id, to, Math.min(B().indexOf(tasks, t), B().inColumn(tasks, to).length));
    }
    const at = B().indexOf(tasks, t) + dy;
    if (at < 0 || at >= B().inColumn(tasks, t.column).length) return Promise.resolve(false);
    return moveCard(id, t.column, at);
  }

  /** The patches for new dates on some tasks, with the later tasks moved on: [{ id, start, end }]. */
  function withShift(changes) {
    const by = new Map(changes.map((c) => [c.id, c]));
    const work = st().tasks.map((t) => (by.has(t.id) ? { ...t, ...by.get(t.id) } : t));
    const moved = D().shift(work).filter((c) => !by.has(c.id));
    return { list: [...changes, ...moved], moved: moved.length };
  }

  /** New dates for one task (a timeline drag or key); later tasks move on in the same step. */
  function setDates(id, dates, verb = 'Moved') {
    const t = st().tasks.find((x) => x.id === id);
    if (!t || (t.start === dates.start && t.end === dates.end)) return Promise.resolve(false);
    const { list, moved } = withShift([{ id, start: dates.start, end: dates.end }]);
    const when = dates.start === dates.end ? short(dates.start) : `${short(dates.start)} – ${short(dates.end)}`;
    return commit(ST().patchTasks(list), `${verb} "${t.title}" to ${when}${moved ? ` and ${moved} later task${moved === 1 ? '' : 's'}` : ''}`);
  }

  /** Gives an undated task dates: from the first free day (today, or after what it waits for), `days` long. */
  function schedule(id, days = 3) {
    const t = st().tasks.find((x) => x.id === id);
    if (!t) return Promise.resolve(false);
    const first = D().earliest(st().tasks, t);
    const start = first && first > st().today ? first : st().today;
    return setDates(id, { start, end: T.addDays(start, days - 1) }, 'Scheduled');
  }

  /** Saves a task from the editor (new or changed), moving later tasks on when its dates changed. */
  function saveTask(rec) {
    const old = rec.id && st().tasks.find((x) => x.id === rec.id);
    const label = old ? `Saved "${rec.title}"` : `Added "${rec.title}"`;
    if (!old) return commit(ST().saveTask(rec), label);
    const dated = rec.start && (rec.start !== old.start || rec.end !== old.end);
    const extra = dated ? withShift([{ id: rec.id, start: rec.start, end: rec.end }]).list.filter((c) => c.id !== rec.id) : [];
    const ops = [{ op: 'patch', collection: 'projectTasks', id: rec.id, changes: rec },
      ...extra.map(({ id, ...changes }) => ({ op: 'patch', collection: 'projectTasks', id, changes }))];
    return commit(ST().write(ops), label);
  }

  /** Adds a task at the end of a column. */
  function addTask(title, column) {
    const p = st().project;
    const order = B().inColumn(st().tasks, column).length;
    return commit(ST().saveTask({ projectId: p.id, title, column, order, priority: 'none', tags: [], checklist: [], deps: [] }), `Added "${title}"`, { toast: false });
  }

  /** Deletes a task (no question: Undo brings it back, with its links). */
  function deleteTask(id) {
    const t = st().tasks.find((x) => x.id === id);
    if (!t) return Promise.resolve(false);
    return commit(ST().removeTask(id, st().tasks), `Deleted "${t.title}"`);
  }

  /** Saves the project (settings and columns); moves are the cards of removed columns. */
  const saveProject = (p, moves) => commit(ST().saveProject(p, moves), `Saved "${p.name}"`);

  /** Deletes the project and its tasks; Undo brings them back. */
  async function deleteProject(p) {
    const yes = await UI.confirm(`Delete "${p.name}"?`, 'The project and all of its tasks are deleted. Undo (Ctrl+Z) brings them back during this visit.', 'Delete', { danger: true });
    if (!yes) return false;
    return commit(ST().removeProject(p.id), `Deleted the project "${p.name}"`);
  }

  /** Adds a project from a backup (io.read's value), and opens it. */
  async function addBundle(b, label) {
    const v = await commit(ST().addBundle(b), label);
    if (v) NS.app.open(b.project.id);
    return v;
  }

  NS.actions = { history, commit, undo, moveCard, nudge, setDates, schedule, saveTask, addTask, deleteTask, saveProject, deleteProject, addBundle };
})(typeof window !== 'undefined' ? window : globalThis);
