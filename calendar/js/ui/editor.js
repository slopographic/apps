// The event editor: a SlopUI dialog for a new or existing event. It shows the time in the viewer's zone and in the event's
// own zone as you type, links a CRM customer and a call, meeting or event kind, and sets the repeat and the reminder.
// Saving validates first, and a bad form keeps the dialog open. Exposes window.SlopCal.editor.
(function (g) {
  'use strict';
  const S = g.SlopData, T = g.SlopTime, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopCal = g.SlopCal || {});
  const FALLBACK_ZONES = ['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Dubai', 'Asia/Kolkata', 'Asia/Tokyo', 'Australia/Sydney'];
  const pad = (n) => String(n).padStart(2, '0');
  const plusHour = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); const t = (h + 1) % 24; return `${pad(t)}:${pad(m)}`; };

  /** The zones offered: every zone Intl knows, or a short list where it cannot say. Always includes the given ones. */
  function zoneChoices(...extra) {
    let all = FALLBACK_ZONES;
    try { if (Intl.supportedValuesOf) all = Intl.supportedValuesOf('timeZone'); } catch (e) { /* use the short list */ }
    return [...new Set([...extra.filter(Boolean), ...all])];
  }

  /** A select with options [{ v, label }]. */
  const select = (id, opts, value, label) => el('label', { class: 'field' }, el('span', null, label),
    el('select', { id, 'aria-label': label }, opts.map((o) => el('option', { value: o.v, selected: String(o.v) === String(value) }, o.label))));
  const input = (id, type, value, label, extra = {}) => el('label', { class: 'field' }, el('span', null, label),
    el('input', { id, type, value: value ?? '', 'aria-label': label, ...extra }));

  /**
   * Opens the editor. opts: { event (a stored record, to edit), day (YYYY-MM-DD for a new one), minutes (start time of a
   * new one, from midnight), customerId, kind, title, zone (viewer's zone), onSaved(record), onRemoved(id) }.
   */
  async function open(opts = {}) {
    const zone = opts.zone || T.deviceZone();
    const base = opts.event ? g.SlopEvents.toForm(opts.event) : defaults(opts, zone);
    const cust = await S.store.list('customers');
    const customers = cust.ok ? cust.value.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))) : [];
    const f = { ...base };
    const note = el('p', { class: 'note ev-zones', id: 'evZones', role: 'status' });
    const refresh = () => { read(); note.textContent = zoneLine(f, zone); };
    const body = el('form', { class: 'ev-form', id: 'evForm', onsubmit: (e) => e.preventDefault(), onchange: refresh, oninput: refresh },
      input('evTitle', 'text', f.title, 'Title', { maxlength: 200, required: true, autofocus: true }),
      el('label', { class: 'field check' }, el('input', { id: 'evAllDay', type: 'checkbox', checked: !!f.allDay, 'aria-label': 'All day' }), el('span', null, 'All day')),
      el('div', { class: 'ev-row' }, input('evDate', 'date', f.date, 'Start date'), input('evStart', 'time', f.startTime, 'Start time'),
        input('evEndDate', 'date', f.endDate, 'End date'), input('evEnd', 'time', f.endTime, 'End time')),
      select('evTz', zoneChoices(f.tz, zone).map((z) => ({ v: z, label: z })), f.tz, 'Time zone of this event'),
      note,
      el('div', { class: 'ev-row' }, select('evKind', [{ v: 'event', label: 'Event' }, { v: 'call', label: 'Call' }, { v: 'meeting', label: 'Meeting' }], f.kind, 'Kind'),
        select('evColor', g.SlopEvents.COLORS.map((c) => ({ v: c, label: c })), f.color, 'Colour')),
      select('evCustomer', [{ v: '', label: 'No customer' }, ...customers.map((c) => ({ v: c.id, label: c.name }))], f.customerId, 'Customer'),
      el('div', { class: 'ev-row' }, select('evRepeat', [{ v: 'none', label: 'Does not repeat' }, { v: 'daily', label: 'Every day' }, { v: 'weekly', label: 'Every week' }, { v: 'monthly', label: 'Every month' }, { v: 'yearly', label: 'Every year' }], f.freq, 'Repeat'),
        input('evUntil', 'date', f.until, 'Repeat until (optional)')),
      el('div', { class: 'ev-row' }, select('evRemind', g.SlopEvents.REMINDERS.map((r) => ({ v: r.v, label: r.label })), f.remind, 'Reminder')),
      input('evLoc', 'text', f.location, 'Location', { maxlength: 200 }),
      el('label', { class: 'field' }, el('span', null, 'Notes'), el('textarea', { id: 'evNotes', rows: 3, maxlength: 5000, 'aria-label': 'Notes' }, f.notes)));
    /** Copies the form's current values into f (and the title suggestion for a call to a customer). */
    function read() {
      const v = (id) => body.querySelector(`#${id}`);
      f.title = v('evTitle').value;
      f.allDay = v('evAllDay').checked;
      f.date = v('evDate').value; f.endDate = v('evEndDate').value || f.date;
      f.startTime = v('evStart').value; f.endTime = v('evEnd').value;
      f.tz = v('evTz').value; f.kind = v('evKind').value; f.color = v('evColor').value;
      f.customerId = v('evCustomer').value; f.freq = v('evRepeat').value; f.until = v('evUntil').value;
      f.remind = v('evRemind').value; f.location = v('evLoc').value; f.notes = v('evNotes').value;
    }
    const titleInput = body.querySelector('#evTitle');
    body.querySelector('#evCustomer').addEventListener('change', () => {
      const c = customers.find((x) => x.id === body.querySelector('#evCustomer').value);
      if (c && !titleInput.value.trim()) titleInput.value = `${f.kind === 'meeting' ? 'Meeting' : 'Call'} ${c.name}`;
      refresh();
    });
    body.querySelector('#evNotes').value = f.notes || '';
    refresh();
    const save = async () => {
      read();
      const res = g.SlopEvents.fromForm(f, opts.event || null);
      if (!res.ok) { UI.toast(res.error); return false; }
      const r = await g.SlopEvents.save(res.value);
      if (!r.ok) { UI.toast(r.message || 'Could not save the event.'); return false; }
      if (opts.onSaved) opts.onSaved(r.value);
      return true;
    };
    const remove = async () => {
      if (!opts.event) return true;
      const yes = await UI.confirm('Delete this event?', opts.event.freq && opts.event.freq !== 'none' ? 'The whole repeating series is deleted.' : 'This cannot be undone.', 'Delete', { danger: true });
      if (!yes) return false;
      const r = await g.SlopEvents.remove(opts.event.id);
      if (!r.ok) { UI.toast(r.message); return false; }
      if (opts.onRemoved) opts.onRemoved(opts.event.id);
      return true;
    };
    const buttons = [{ label: 'Cancel' }];
    if (opts.event) buttons.push({ label: 'Delete', danger: true, act: remove });
    buttons.push({ label: 'Save', primary: true, act: async () => (await save()) ? undefined : false });
    const d = UI.dialog({ title: opts.event ? 'Edit event' : 'New event', body, buttons, cls: 'ev-dlg', dismissable: true });
    return d;
  }

  /** A new event's defaults: the day and time asked for, an hour long, in the viewer's zone. */
  function defaults(opts, zone) {
    const day = opts.day || T.todayIn(zone);
    const mins = opts.minutes === undefined ? 9 * 60 : opts.minutes;
    const startTime = `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
    return {
      title: opts.title || '', allDay: false, date: day, endDate: day, startTime, endTime: plusHour(startTime), tz: zone,
      location: '', notes: '', color: 'blue', kind: opts.kind || 'event', freq: 'none', until: '', remind: '', customerId: opts.customerId || '',
    };
  }

  /** Both readings of the start in one line: the viewer's zone and the event's zone. */
  function zoneLine(f, viewer) {
    if (f.allDay || !T.parseDay(f.date) || !/^\d{2}:\d{2}$/.test(f.startTime || '') || !T.isZone(f.tz)) return f.allDay ? 'All day. Times do not apply.' : '';
    const at = T.dayTimeToUtc(f.date, f.startTime, f.tz);
    const mine = `${T.timeText(at, viewer)} in ${viewer}`;
    if (f.tz === viewer) return `${mine}.`;
    return `Starts ${T.timeText(at, f.tz)} in ${f.tz} (${T.zoneLabel(at, f.tz)}), which is ${mine}.`;
  }

  NS.editor = { open, defaults, zoneLine, zoneChoices };
})(typeof window !== 'undefined' ? window : globalThis);
