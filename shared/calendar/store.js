// Calendar events in the shared store ('events'). fromForm turns the editor's values into a record (times are instants
// in the event's own zone, all-day events keep days), toForm does the reverse for editing, and save and remove go
// through SlopData.store. Exposes window.SlopEvents. Needs SlopData, tz.js and rrule.js.
(function (g) {
  'use strict';
  const S = g.SlopData, T = g.SlopTime, RR = g.SlopRecur;
  const NS = (g.SlopEvents = g.SlopEvents || {});
  const COLORS = ['blue', 'green', 'amber', 'red', 'violet', 'teal', 'pink', 'grey'];
  const KINDS = ['event', 'call', 'meeting'];
  const REMINDERS = [{ v: '', label: 'No reminder' }, { v: 0, label: 'At the time' }, { v: 5, label: '5 minutes before' }, { v: 15, label: '15 minutes before' }, { v: 60, label: '1 hour before' }, { v: 1440, label: '1 day before' }];
  const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

  /**
   * Turns the editor's values into a record for the store. form: { title, allDay, date, endDate, startTime, endTime, tz,
   * location, notes, color, kind, freq, until, remind, customerId }. Returns { ok, value } or { ok: false, error }.
   */
  function fromForm(form, existing = null) {
    const title = String(form.title || '').trim();
    if (!title) return { ok: false, error: 'Give the event a title.' };
    const tz = form.tz || T.deviceZone();
    if (!T.isZone(tz)) return { ok: false, error: 'That time zone is not known.' };
    if (!T.parseDay(form.date)) return { ok: false, error: 'Pick a start date.' };
    const endDate = form.endDate || form.date;
    if (!T.parseDay(endDate)) return { ok: false, error: 'Pick an end date.' };
    const rec = {
      ...(existing ? { id: existing.id } : {}), title, allDay: !!form.allDay, tz,
      location: form.location || undefined, notes: form.notes || undefined,
      color: COLORS.includes(form.color) ? form.color : 'blue', kind: KINDS.includes(form.kind) ? form.kind : 'event',
      freq: RR.FREQS.includes(form.freq) ? form.freq : 'none',
      until: form.until && RR.FREQS.includes(form.freq) ? form.until : undefined,
      remind: form.remind === '' || form.remind === undefined || form.remind === null ? undefined : Number(form.remind),
      customerId: form.customerId || undefined,
    };
    if (rec.until && !T.parseDay(rec.until)) return { ok: false, error: 'The repeat end date is not a date.' };
    if (rec.until && rec.until < form.date) return { ok: false, error: 'The repeat end date is before the start.' };
    if (rec.allDay) {
      if (endDate < form.date) return { ok: false, error: 'The end date is before the start date.' };
      rec.startDay = form.date;
      rec.endDay = endDate;
      rec.start = undefined;
      rec.end = undefined;
    } else {
      if (!HHMM.test(form.startTime || '') || !HHMM.test(form.endTime || '')) return { ok: false, error: 'Use times as HH:MM.' };
      rec.start = T.dayTimeToUtc(form.date, form.startTime, tz);
      rec.end = T.dayTimeToUtc(endDate, form.endTime, tz);
      if (rec.end <= rec.start) return { ok: false, error: 'The end must be after the start.' };
      rec.startDay = undefined;
      rec.endDay = undefined;
    }
    return { ok: true, value: rec };
  }

  /** The editor's values for a stored event, read in the event's own zone. */
  function toForm(ev) {
    const f = { title: ev.title, allDay: !!ev.allDay, tz: ev.tz, location: ev.location || '', notes: ev.notes || '', color: ev.color || 'blue',
      kind: ev.kind || 'event', freq: ev.freq || 'none', until: ev.until || '', remind: ev.remind === undefined ? '' : ev.remind, customerId: ev.customerId || '' };
    if (ev.allDay) { f.date = ev.startDay; f.endDate = ev.endDay || ev.startDay; f.startTime = '09:00'; f.endTime = '10:00'; return f; }
    const a = T.parts(ev.start, ev.tz), b = T.parts(ev.end, ev.tz);
    const hm = (p) => `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`;
    return { ...f, date: a.day, endDate: b.day, startTime: hm(a), endTime: hm(b) };
  }

  /** All events, live. */
  async function list() {
    return S.store.list('events');
  }

  /** Creates or updates an event. Updates keep the stored record's fields that the editor does not set. */
  async function save(record) {
    if (!record.id) return S.store.put('events', record);
    const cur = await S.store.get('events', record.id);
    if (!cur.ok) return cur;
    if (!cur.value) return { ok: false, code: 'not_found', message: 'That event no longer exists.' };
    return S.store.put('events', { ...cur.value, ...record, uid: cur.value.uid, createdAt: undefined });
  }

  /** Changes a few fields of an event (for drag and resize, and colour). */
  async function patch(id, changes) {
    const cur = await S.store.get('events', id);
    if (!cur.ok) return cur;
    if (!cur.value) return { ok: false, code: 'not_found', message: 'That event no longer exists.' };
    return S.store.put('events', { ...cur.value, ...changes });
  }

  /** Deletes an event. Its reminder rows stay until they are cleared by a reminder scan. */
  function remove(id) { return S.store.remove('events', id); }

  /** Events linked to one customer. */
  function forCustomer(customerId) {
    return S.store.list('events', { index: 'customerId', value: customerId });
  }

  NS.COLORS = COLORS;
  NS.KINDS = KINDS;
  NS.REMINDERS = REMINDERS;
  NS.fromForm = fromForm;
  NS.toForm = toForm;
  NS.list = list;
  NS.save = save;
  NS.patch = patch;
  NS.remove = remove;
  NS.forCustomer = forCustomer;
})(typeof window !== 'undefined' ? window : globalThis);
