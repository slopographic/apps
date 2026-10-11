// The calendar's config kind 'calendar' (a .slop.json file): a list of events. Times are written as the reading in the
// event's zone ("2026-10-15T14:30" with tz "Europe/Paris"), so a file is readable and the zone is never guessed. Import
// goes through validation, then one store transaction. Export reads the same shape back. Needs shared/config and SlopData.
(function (g) {
  'use strict';
  const C = g.SlopConfig, S = g.SlopData, T = g.SlopTime;
  if (!C || !C.registerKind) return;
  const F = C.F;
  const LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const COLORS = ['blue', 'green', 'amber', 'red', 'violet', 'teal', 'pink', 'grey'];

  const EVENT = F.obj({
    title: F.str({ max: 200, required: true, desc: 'what the event is called' }),
    allDay: F.bool({ desc: 'true for an all-day event; then use startDay and endDay only' }),
    startDay: F.str({ max: 10, pattern: DAY, desc: 'all-day only: first day as YYYY-MM-DD' }),
    endDay: F.str({ max: 10, pattern: DAY, desc: 'all-day only: last day as YYYY-MM-DD (inclusive)' }),
    startLocal: F.str({ max: 16, pattern: LOCAL, desc: 'timed only: start as the clock reads in tz, YYYY-MM-DDTHH:MM' }),
    endLocal: F.str({ max: 16, pattern: LOCAL, desc: 'timed only: end as the clock reads in tz, YYYY-MM-DDTHH:MM' }),
    tz: F.str({ max: 64, required: true, desc: 'IANA time zone name, such as Europe/Paris or UTC' }),
    location: F.str({ max: 200 }), notes: F.text({ max: 5000 }),
    color: F.enum(COLORS, { desc: 'colour name' }),
    kind: F.enum(['event', 'call', 'meeting']),
    freq: F.enum(['none', 'daily', 'weekly', 'monthly', 'yearly'], { desc: 'how often it repeats' }),
    until: F.str({ max: 10, pattern: DAY, desc: 'last day of a repeat, YYYY-MM-DD, optional' }),
    remind: F.int({ min: 0, max: 525600, desc: 'minutes before the start to remind, optional' }),
  });

  /** Event records to the file's shape. */
  function toConfig(ev) {
    const base = { title: ev.title, allDay: !!ev.allDay, tz: ev.tz, location: ev.location || undefined, notes: ev.notes || undefined,
      color: ev.color || 'blue', kind: ev.kind || 'event', freq: ev.freq || 'none', until: ev.until || undefined,
      remind: ev.remind === undefined ? undefined : ev.remind };
    if (ev.allDay) return { ...base, startDay: ev.startDay, endDay: ev.endDay || ev.startDay };
    const local = (ms) => { const p = T.parts(ms, ev.tz); return `${p.day}T${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`; };
    return { ...base, startLocal: local(ev.start), endLocal: local(ev.end) };
  }

  /** The file's shape to an event record (no id). Throws nothing: check() has already passed. */
  function fromConfig(e) {
    const rec = { title: e.title, allDay: !!e.allDay, tz: e.tz, location: e.location, notes: e.notes, color: e.color || 'blue',
      kind: e.kind || 'event', freq: e.freq || 'none', until: e.until, remind: e.remind };
    if (e.allDay) return { ...rec, startDay: e.startDay, endDay: e.endDay || e.startDay };
    const [sd, st] = e.startLocal.split('T'), [ed, et] = e.endLocal.split('T');
    return { ...rec, start: T.dayTimeToUtc(sd, st, e.tz), end: T.dayTimeToUtc(ed, et, e.tz) };
  }

  /** Rules the schema cannot express: real zones, real days, and an end after the start. */
  function check(data) {
    const out = [];
    (data.events || []).forEach((e, i) => {
      const at = `events[${i}]`;
      if (!T.isZone(e.tz)) out.push({ path: `${at}.tz`, message: 'is not a time zone that this browser knows' });
      if (e.allDay) {
        if (!e.startDay) out.push({ path: `${at}.startDay`, message: 'an all-day event needs startDay' });
        else if (e.endDay && e.endDay < e.startDay) out.push({ path: `${at}.endDay`, message: 'is before startDay' });
      } else if (!e.startLocal || !e.endLocal) out.push({ path: at, message: 'a timed event needs startLocal and endLocal' });
      else if (!T.parseDay(e.startLocal.slice(0, 10)) || e.endLocal < e.startLocal) out.push({ path: at, message: 'the end is before the start, or the start is not a date' });
      if (e.freq && e.freq !== 'none' && e.until && e.until < (e.startDay || (e.startLocal || '').slice(0, 10))) out.push({ path: `${at}.until`, message: 'is before the first day' });
    });
    return out;
  }

  C.registerKind('calendar', 'calendar', { fields: { events: F.list(EVENT, { max: 1000, required: true, desc: 'the events to add or export' }) } },
    /** Adds every event in one transaction. Existing events are not changed; a file adds its own copies. */
    async (data) => {
      const recs = data.events.map(fromConfig);
      const r = await S.store.transact(async (api) => {
        for (const rec of recs) {
          const w = await api.put('events', rec);
          if (!w.ok) return w;
        }
        return { ok: true, value: recs.length };
      });
      if (!r.ok) throw new Error(r.message || 'Could not add the events.');
      return { added: recs.length };
    },
    {
      label: 'Calendar events', description: 'Events with title, time, zone, repeat, reminder and place.',
      read: async () => {
        const r = await S.store.list('events');
        if (!r.ok) throw new Error(r.message);
        return { events: r.value.map(toConfig) };
      },
      check,
    });

  /** The config dialogs read these, so the calendar can export and import from its own menu. */
  g.SlopCalendarConfig = { toConfig, fromConfig, check };
})(typeof window !== 'undefined' ? window : globalThis);
