// Slop Reminders: one timeline of every reminder from Calendar events, To-do tasks and custom reminders, in three groups
// (overdue, today, later). Snooze (5 minutes, 1 hour, tomorrow), dismiss, add a custom reminder, and allow browser
// notifications from a button. The list is read from the store on every change. Exposes window.SlopReminders.ui.
(function (g) {
  'use strict';
  const S = g.SlopData, T = g.SlopTime, NR = g.SlopReminders, E = g.SlopReminderEngine, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopRemindersUI = g.SlopRemindersUI || {});
  const $ = (id) => document.getElementById(id);
  const SOURCE = { event: 'Event', task: 'To-do', custom: 'Reminder' };
  const GROUPS = [['overdue', 'Overdue'], ['today', 'Today'], ['later', 'Later']];
  const state = { zone: T.deviceZone(), locale: undefined, show: 'open', timer: 0 };

  /** A row of the timeline: when, what, where it came from, and its snooze and dismiss controls. */
  function row(it, now) {
    const snoozed = it.snoozedUntil && it.snoozedUntil > now;
    const snooze = el('select', { class: 'snooze', 'aria-label': `Snooze ${it.title}`, onchange: async (e) => {
      const v = e.target.value; e.target.value = '';
      if (!v) return;
      const r = await E.snooze(it, v);
      UI.toast(r.ok ? `Snoozed until ${T.dateTimeText(NR.snoozeUntil(v, NR.now(), state.zone), state.zone, state.locale)}` : r.message);
    } }, el('option', { value: '' }, 'Snooze…'), NR.SNOOZES.map((s) => el('option', { value: s.id }, s.label)));
    return el('li', { class: `rm-row src-${it.source}${it.dismissed ? ' is-dismissed' : ''}`, 'data-key': it.key, 'data-source': it.source },
      el('div', { class: 'rm-when' }, T.dateTimeText(it.at, state.zone, state.locale), el('span', { class: 'rm-zone' }, state.zone)),
      el('div', { class: 'rm-main' }, el('b', null, it.title || 'Reminder'),
        el('span', { class: 'rm-sub' }, `${SOURCE[it.source] || 'Reminder'}${it.repeat ? ` · ${it.repeat}` : ''}${it.more ? ' · the next one' : ''}${snoozed ? ` · snoozed until ${T.timeText(it.snoozedUntil, state.zone, state.locale)}` : ''}${it.firedAt && !snoozed ? ' · shown' : ''}`)),
      el('div', { class: 'rm-acts' }, snooze,
        el('button', { type: 'button', class: 'btn small', onclick: async () => {
          const r = await E.dismiss(it);
          if (!r.ok) UI.toast(r.message || 'Could not dismiss.');
        } }, 'Dismiss')));
  }

  /** Draws the timeline: overdue, today and later, each sorted by time. */
  async function render() {
    const now = NR.now();
    const snap = await E.snapshot(now, state.zone);
    if (!snap.ok) { $('rList').replaceChildren(el('p', { class: 'msg', role: 'alert' }, snap.message)); return; }
    const today = T.todayIn(state.zone, now);
    const items = snap.value.items.filter((it) => state.show === 'all' || !it.dismissed);   // dismissed rows show only with 'Show dismissed'
    const counts = { overdue: 0, today: 0, later: 0 };   // counts open (not dismissed) reminders
    const groups = { overdue: [], today: [], later: [] };
    for (const it of items) groups[NR.group(it, today, state.zone)].push(it);
    groups.later = NR.nextOnly(groups.later);   // a repeating event shows its next occurrence once, not every week for a year
    for (const k of Object.keys(groups)) counts[k] = groups[k].filter((it) => !it.dismissed).length;
    const blocks = GROUPS.map(([k, label]) => el('section', { class: 'rm-group', 'aria-label': label },
      el('h3', { class: 'rm-h' }, `${label}`, el('span', { class: 'side-n' }, String(counts[k]))),
      groups[k].length ? el('ul', { class: 'rm-list', role: 'list' }, groups[k].map((it) => row(it, now)))
        : el('p', { class: 'empty' }, k === 'overdue' ? 'Nothing overdue.' : k === 'today' ? 'Nothing else today.' : 'Nothing later.')));
    $('rList').replaceChildren(...blocks);
    $('rPerm').textContent = permissionText();
    $('rNote').textContent = `Reminders show as pop-ups while this tab is open. They are read from events and to-do tasks, and kept in this browser.`;
  }

  function permissionText() {
    const p = E.permission();
    if (p === 'granted') return 'Browser notifications are on.';
    if (p === 'denied') return 'Browser notifications are blocked in this browser. Pop-ups still show here.';
    if (p === 'unsupported') return 'This browser has no notifications. Pop-ups still show here.';
    return 'Browser notifications are off. Pop-ups still show here.';
  }

  async function addCustom(e) {
    e.preventDefault();
    const title = $('rTitle').value.trim();
    const day = $('rDate').value, time = $('rTime').value;
    if (!title) { UI.toast('Give the reminder a name.'); return; }
    if (!T.parseDay(day) || !/^\d{2}:\d{2}$/.test(time)) { UI.toast('Pick a date and a time.'); return; }
    const at = T.dayTimeToUtc(day, time, state.zone);
    const r = await E.addCustom(title, at);
    if (!r.ok) { UI.toast(r.message || 'Could not add the reminder.'); return; }
    $('rTitle').value = '';
    UI.toast('Reminder added');
  }

  async function allowNotifications() {
    const p = await E.requestPermission();
    UI.toast(p === 'granted' ? 'Browser notifications are on' : p === 'denied' ? 'The browser blocked notifications' : 'Notifications are not available here');
    render();
  }

  function refreshSoon() { clearTimeout(state.timer); state.timer = setTimeout(render, 40); }

  async function boot() {
    const ready = await S.store.ready();
    if (!ready.ok) { $('rBoot').textContent = `Storage is not available here: ${ready.message}.`; return; }
    const st = await S.store.get('settings', 'main');
    state.locale = (st.ok && st.value && st.value.locale) || undefined;
    const now = NR.now();
    $('rDate').value = T.todayIn(state.zone, now);
    $('rTime').value = '09:00';
    $('rAdd').addEventListener('submit', addCustom);
    $('rPermBtn').addEventListener('click', allowNotifications);
    $('rShow').addEventListener('change', (e) => { state.show = e.target.checked ? 'all' : 'open'; render(); });
    S.store.subscribe(() => refreshSoon());
    E.start();
    try { if (g.SlopHub) g.SlopHub.register('reminders'); } catch (e) { /* no hub */ }
    await render();
    $('rBoot').hidden = true;
    setInterval(render, 30000);
  }

  NS.app = { boot, render };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(typeof window !== 'undefined' ? window : globalThis);
