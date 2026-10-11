// .ics export and import for the calendar. Export writes every event. Import reads the file, shows a preview of what
// will be added (and what is skipped because its UID is already in the calendar, or was simplified), and writes only
// after the person confirms, in one store transaction. Exposes window.SlopCal.ics.
(function (g) {
  'use strict';
  const S = g.SlopData, I = g.SlopIcs, T = g.SlopTime, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopCal = g.SlopCal || {});
  const MAX_BYTES = 5 * 1024 * 1024, SHOW = 100;

  /** Downloads every event as slop-calendar.ics. */
  async function exportIcs() {
    const r = await g.SlopEvents.list();
    if (!r.ok) { UI.toast(r.message || 'Could not read the events.'); return; }
    const text = I.build(r.value);
    UI.download(new Blob([text], { type: 'text/calendar;charset=utf-8' }), 'slop-calendar.ics');
    UI.toast(`Exported ${r.value.length} event${r.value.length === 1 ? '' : 's'}`);
  }

  /** When an imported event happens, for the preview: the day, or the time in its zone. */
  function whenText(e, locale) {
    if (e.allDay) return e.endDay && e.endDay !== e.startDay ? `${T.dayText(e.startDay, locale)} to ${T.dayText(e.endDay, locale)}` : `${T.dayText(e.startDay, locale)}, all day`;
    return `${T.dateTimeText(e.start, e.tz, locale)} (${e.tz})`;
  }

  /** Reads the chosen .ics file. Resolves to { file, text } or null when nothing was picked or the file is too big. */
  async function pick() {
    const files = await UI.pickFiles({ accept: '.ics,text/calendar' });
    if (!files || !files.length) return null;
    const file = files[0];
    if (file.size > MAX_BYTES) { UI.toast('That file is larger than 5 MB.'); return null; }
    return { file, text: await file.text() };
  }

  /**
   * Import with a preview. zone is the viewer's zone (events with no zone in the file use it). The dialog lists what
   * will be added first. Resolves to the number of events added (0 when cancelled).
   */
  async function importIcs(zone, locale, onDone) {
    const picked = await pick();
    if (!picked) return 0;
    const parsed = I.parse(picked.text, { fallbackZone: zone });
    if (!parsed.total) { await UI.alert('Nothing to import', 'That file has no events (VEVENT blocks).'); return 0; }
    const have = await g.SlopEvents.list();
    const uids = new Set(have.ok ? have.value.map((e) => e.uid).filter(Boolean) : []);
    const fresh = parsed.events.filter((e) => !(e.uid && uids.has(e.uid)));
    const skipped = parsed.events.length - fresh.length;
    const rows = fresh.slice(0, SHOW).map((e) => el('li', { class: 'ics-row' }, el('b', null, e.title), el('span', { class: 'row-sub' },
      `${whenText(e, locale)}${e.freq && e.freq !== 'none' ? ` · repeats ${e.freq}` : ''}`)));
    const warn = parsed.warnings.slice(0, 20).map((w) => el('li', null, `${w.title || 'Event'}: ${w.message}`));
    const body = el('div', { class: 'ics-preview' },
      el('p', { class: 'sui-p', role: 'status' }, `${picked.file.name}: ${parsed.total} event${parsed.total === 1 ? '' : 's'} in the file. ` +
        `${fresh.length} will be added${skipped ? `, and ${skipped} already in this calendar (same UID) will be skipped` : ''}.`),
      fresh.length > SHOW ? el('p', { class: 'note' }, `The first ${SHOW} are listed.`) : null,
      rows.length ? el('ul', { class: 'ics-list', 'aria-label': 'Events to add' }, rows) : null,
      warn.length ? el('div', null, el('h4', { class: 'sub-t' }, 'Simplified or left out'), el('ul', { class: 'ics-warn' }, warn)) : null);
    const write = async () => {
      if (!fresh.length) return false;
      const recs = fresh.map((e) => ({ ...e }));
      const r = await S.store.transact(async (api) => {
        for (const rec of recs) {
          const w = await api.put('events', rec);
          if (!w.ok) return w;
        }
        return { ok: true, value: recs.length };
      });
      if (!r.ok) { UI.toast(r.message || 'Import failed. Nothing was added.'); return false; }
      UI.toast(`Added ${recs.length} event${recs.length === 1 ? '' : 's'}`);
      if (onDone) onDone(recs.length);
      return true;
    };
    let added = 0;
    await new Promise((res) => {
      UI.dialog({ title: 'Import calendar', body, cls: 'ics-dlg', buttons: [{ label: 'Cancel' }, { label: `Add ${fresh.length} event${fresh.length === 1 ? '' : 's'}`, primary: true, act: async () => {
        const ok = await write();
        if (ok) added = fresh.length;
        return ok ? undefined : false;
      } }], onClose: () => res() });
    });
    return added;
  }

  NS.ics = { exportIcs, importIcs };
})(typeof window !== 'undefined' ? window : globalThis);
