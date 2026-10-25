// Slop Calendar: the panel on the right (the suite rule, shared/frame/HANDOFF.md: SlopFrame, shared/frame/frame.js and
// panel.js). The calendar is the view; the panel shows the chosen day (its events and to-dos, each opens in the editor),
// the display choices (To-dos, the time zone, the split's panes: the toolbar's old controls, moved in with their ids) and
// the calendar file (Import .ics, Export .ics, Config), with New event, the main button, at its foot. Prev, Today, Next
// and the views stay in the toolbar. On a phone the panel is a bottom sheet whose closed state still shows New event.
// Exposes window.SlopCal.panel: mount() at boot, paint(ctx, day) after each render (ui/app.js).
(function (g) {
  'use strict';
  const NS = (g.SlopCal = g.SlopCal || {}), T = g.SlopTime;
  const $ = (id) => document.getElementById(id);
  let p = null;

  function mount() {
    if (!g.SlopFrame || p) return null;
    const side = $('cSide');
    const frame = g.SlopFrame.mount($('cBody'), { view: $('main'), panel: side, panelLabel: 'Day', storageKey: 'calendar',
      button: '.toolbar', phoneButton: false, phone: '(max-width: 640px)', width: 290, min: 240, max: 440 });
    p = g.SlopFrame.panel(side, { title: 'Day' });
    for (const id of ['cTasks', 'cZone']) $(id).closest('label').classList.add('sf-field');
    p.footer([{ el: $('cNew'), primary: true }], { more: 'Day' });
    NS.panel.frame = frame;
    // the panel reaches the window's bottom from where the calendar starts (under the menu bar and the toolbar)
    const top = () => document.documentElement.style.setProperty('--cal-top', Math.max(0, Math.round($('cBody').getBoundingClientRect().top + g.scrollY)) + 'px');
    top();
    if (g.ResizeObserver) new g.ResizeObserver(top).observe(document.querySelector('.toolbar'));
    return frame;
  }

  /** The panel for the day the view is on: its items (from the view's ctx), the display choices and the file actions. */
  function paint(ctx, day) {
    if (!p) return;
    const list = NS.model.forDay(ctx.items || [], day, ctx.zone).map((it) => ({
      name: it.title || '(no title)',
      meta: [it.allDay ? 'All day' : T.timeText(it.start, ctx.zone, ctx.locale), it.kind === 'task' ? 'To-do' : it.eventKind, it.location].filter(Boolean).join(' · '),
      open: () => ctx.open(it),
    }));
    p.setTitle(T.dayText(day, ctx.locale, { weekday: 'long', day: 'numeric', month: 'long' }));
    p.render([
      { key: 'day', title: day === ctx.today ? 'Today' : 'On this day', list, empty: 'Nothing on this day. New event adds one.' },
      { key: 'show', title: 'Show', settings: [$('cTasks').closest('label'), $('cZone').closest('label'), $('cSplit')] },
      { key: 'file', title: 'Calendar file', actions: [{ el: $('cImport') }, { el: $('cExport') }, { el: $('cConfig') }] },
    ]);
  }

  NS.panel = { mount, paint };
})(typeof window !== 'undefined' ? window : globalThis);
