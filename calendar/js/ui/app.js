// Slop Calendar boot: opens the shared store, keeps the period, view, viewer zone and task layer, draws the chosen view
// from the model, and redraws when the store changes (this tab or another). On a phone the week and day views show the
// agenda. Starts the reminder engine so due reminders pop up while this tab is open. Exposes window.SlopCal.app.
(function (g) {
  'use strict';
  const S = g.SlopData, T = g.SlopTime, NS = (g.SlopCal = g.SlopCal || {}), UI = g.SlopUI, el = UI.el;
  const $ = (id) => document.getElementById(id);
  const KEY = { zone: 'slop-calendar.zone', tasks: 'slop-calendar.tasks', view: 'slop-calendar.view' };
  const VIEWS = ['month', 'week', 'day', 'agenda'];
  const NARROW = g.matchMedia ? g.matchMedia('(max-width: 640px)') : null;
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch (e) { return d; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: the setting lasts this visit */ } };
  let timer = 0;
  const state = { view: 'month', anchor: '', zone: T.deviceZone(), showTasks: true, locale: undefined, today: '', seq: 0 };
  NS.state = state;

  const narrow = () => !!(NARROW && NARROW.matches);
  /** The view drawn: on a phone the week and day views show the agenda. */
  const effective = () => (narrow() && (state.view === 'week' || state.view === 'day') ? 'agenda' : state.view);

  /** First and last viewer day for the view. */
  function rangeOf(view) {
    if (view === 'month') { const days = NS.month.gridDays(state.anchor); return [days[0], days[41]]; }
    if (view === 'week') { const s = T.weekStart(state.anchor); return [s, T.addDays(s, 6)]; }
    if (view === 'day') return [state.anchor, state.anchor];
    return [state.anchor, T.addDays(state.anchor, NS.agenda.SPAN - 1)];
  }

  function titleOf(view) {
    const loc = state.locale;
    if (view === 'month') return T.dayText(state.anchor, loc, { month: 'long', year: 'numeric' });
    if (view === 'week') { const [a, b] = rangeOf('week'); return `${T.dayText(a, loc, { day: 'numeric', month: 'short' })} – ${T.dayText(b, loc, { day: 'numeric', month: 'short', year: 'numeric' })}`; }
    if (view === 'day') return T.dayText(state.anchor, loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return `Next ${NS.agenda.SPAN} days from ${T.dayText(state.anchor, loc, { day: 'numeric', month: 'short' })}`;
  }

  /** Opens an item: an event in the editor, a task in To-do. */
  function open(it) {
    if (it.kind === 'task') { location.href = `../todo/?task=${encodeURIComponent(it.id)}`; return; }
    NS.editor.open({ event: it.rec, zone: state.zone });
  }

  async function complete(it) {
    const r = await g.SlopTaskStore.complete(it.id);
    if (!r.ok) UI.toast(r.message || 'Could not update the task.');
  }

  async function commit(it, change) {
    const r = await g.SlopEvents.patch(it.id, change);
    if (!r.ok) UI.toast(r.message || 'Could not move the event.');
  }

  function newAt(day, minutes) { NS.editor.open({ day, minutes, zone: state.zone }); }

  /** Draws the current view and the controls. */
  async function render() {
    const seq = ++state.seq;
    state.today = T.todayIn(state.zone);
    const view = effective();
    const [a, b] = rangeOf(view);
    const r = await NS.model.load(a, b, state.zone, { showTasks: state.showTasks });
    if (seq !== state.seq) return;
    const root = $('cView');
    if (!r.ok) { root.replaceChildren(el('p', { class: 'msg', role: 'alert' }, r.message || 'Could not read the calendar.')); return; }
    const ctx = { zone: state.zone, locale: state.locale, items: r.value, today: state.today, open, complete, commit, newAt,
      dayView: (d) => setView('day', d) };
    if (view === 'month') NS.month.render(root, state.anchor, ctx);
    else if (view === 'week') NS.timegrid.render(root, Array.from({ length: 7 }, (_, i) => T.addDays(a, i)), ctx);
    else if (view === 'day') NS.timegrid.render(root, [state.anchor], ctx);
    else NS.agenda.render(root, state.anchor, ctx);
    $('cTitle').textContent = titleOf(view);
    for (const btn of document.querySelectorAll('[data-view]')) {
      const on = btn.dataset.view === state.view;
      btn.setAttribute('aria-pressed', String(on));
      btn.hidden = narrow() && (btn.dataset.view === 'week' || btn.dataset.view === 'day');
    }
    $('cTasks').checked = state.showTasks;
    $('cNote').textContent = `Times are in ${state.zone}${T.zoneLabel(Date.now(), state.zone) ? ` (${T.zoneLabel(Date.now(), state.zone)})` : ''}. Events show their own zone too.`;
  }
  const refreshSoon = () => { clearTimeout(timer); timer = setTimeout(render, 40); };

  /** Moves the period: a month, a week, a day or the agenda span. dir is -1 or 1. */
  function step(dir) {
    const v = effective();
    const days = v === 'month' ? null : v === 'week' ? 7 : v === 'day' ? 1 : NS.agenda.SPAN;
    if (v === 'month') state.anchor = `${T.addDays(state.anchor.slice(0, 8) + '01', dir > 0 ? 32 : -1).slice(0, 8)}01`;
    else state.anchor = T.addDays(state.anchor, dir * days);
    return render();
  }

  function setView(view, day) {
    if (!VIEWS.includes(view)) return;
    state.view = view;
    if (day) state.anchor = day;
    put(KEY.view, view);
    return render();
  }

  function goToday() { state.anchor = T.todayIn(state.zone); return render(); }

  function setZone(zone) {
    if (!T.isZone(zone)) return;
    state.zone = zone;
    put(KEY.zone, zone);
    return render();
  }

  function toggleTasks(on) {
    state.showTasks = on === undefined ? !state.showTasks : !!on;
    put(KEY.tasks, state.showTasks ? '1' : '0');
    return render();
  }

  /** The zone list: every zone the browser knows, with the viewer's zone first. */
  function fillZones() {
    const sel = $('cZone');
    sel.replaceChildren(...NS.editor.zoneChoices(state.zone).map((z) => el('option', { value: z, selected: z === state.zone }, z)));
  }

  async function importIcs() {
    const n = await NS.ics.importIcs(state.zone, state.locale, () => refreshSoon());
    if (n) refreshSoon();
  }

  function configMenu(e) {
    const items = g.SlopConfigDialog ? g.SlopConfigDialog.menuItems({ app: 'calendar' }) : [];
    const r = e.currentTarget.getBoundingClientRect();
    UI.menu(items, r.left, r.bottom + 4);
  }

  function wire() {
    for (const btn of document.querySelectorAll('[data-view]')) btn.addEventListener('click', () => setView(btn.dataset.view));
    $('cPrev').addEventListener('click', () => step(-1));
    $('cNext').addEventListener('click', () => step(1));
    $('cToday').addEventListener('click', goToday);
    $('cNew').addEventListener('click', () => newAt(state.anchor, 9 * 60));
    $('cTasks').addEventListener('change', (e) => toggleTasks(e.target.checked));
    $('cZone').addEventListener('change', (e) => setZone(e.target.value));
    $('cExport').addEventListener('click', () => NS.ics.exportIcs());
    $('cImport').addEventListener('click', importIcs);
    $('cConfig').addEventListener('click', configMenu);
    if (NARROW && NARROW.addEventListener) NARROW.addEventListener('change', () => render());
    addEventListener('hashchange', () => { const h = location.hash.slice(1); if (VIEWS.includes(h)) setView(h); });
  }

  async function boot() {
    const ready = await S.store.ready();
    if (!ready.ok) { $('cBoot').textContent = `Storage is not available here: ${ready.message}.`; return; }
    const st = await S.store.get('settings', 'main');
    state.locale = (st.ok && st.value && st.value.locale) || undefined;
    const zone = get(KEY.zone, '');
    if (T.isZone(zone)) state.zone = zone;
    state.showTasks = get(KEY.tasks, '1') !== '0';
    const v = location.hash.slice(1) || get(KEY.view, narrow() ? 'agenda' : 'month');
    state.view = VIEWS.includes(v) ? v : 'month';
    state.anchor = T.todayIn(state.zone);
    fillZones();
    wire();
    NS.commands.init();
    S.store.subscribe(() => refreshSoon());
    if (g.SlopReminderEngine) g.SlopReminderEngine.start();
    try { if (g.SlopHub) g.SlopHub.register('calendar'); } catch (e) { /* no hub: the app still works */ }
    await render();
    $('cBoot').hidden = true;
  }

  NS.app = { boot, render, step, setView, goToday, toggleTasks, setZone, newAt, importIcs, open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
