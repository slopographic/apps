// The month grid: six weeks starting on Monday, up to three items a day with a "more" link to the day view. A click on an
// empty part of a day adds an event there. An event chip dragged onto another day moves to that day (all-day events
// shift their days; timed events keep their times). Exposes window.SlopCal.month.
(function (g) {
  'use strict';
  const T = g.SlopTime, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopCal = g.SlopCal || {});
  const SHOW = 3, DRAG_PX = 6;

  /** The 42 days shown for the month of anchor, and the Monday that starts the grid. */
  function gridDays(anchor) {
    const first = `${anchor.slice(0, 8)}01`;
    const start = T.addDays(first, -((T.dowOf(first) + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => T.addDays(start, i));
  }

  /** Draws the month of anchor into root. ctx: { zone, locale, items, today, open, complete, commit, newAt, dayView }. */
  function render(root, anchor, ctx) {
    const { zone, locale, items, today } = ctx;
    const days = gridDays(anchor);
    const month = anchor.slice(0, 7);
    const names = days.slice(0, 7).map((d) => el('div', { class: 'mo-dow', role: 'columnheader' }, T.dayText(d, locale, { weekday: 'short' })));
    const cells = days.map((d) => cell(d, { ...ctx, month, zone, items, today }));
    root.replaceChildren(el('div', { class: 'mo', role: 'grid', 'aria-label': 'Month' }, el('div', { class: 'mo-head', role: 'row' }, names), el('div', { class: 'mo-days' }, cells)));
  }

  function cell(day, ctx) {
    const { zone, items, today, month } = ctx;
    const list = NS.model.forDay(items, day, zone);
    const shown = list.slice(0, SHOW);
    const more = list.length - shown.length;
    const node = el('div', { class: `mo-cell${day === today ? ' is-today' : ''}${day.slice(0, 7) !== month ? ' is-other' : ''}`, 'data-day': day, role: 'gridcell' },
      el('div', { class: 'mo-num' }, String(T.parseDay(day).d)),
      shown.map((it) => NS.chip(it, { ...ctx, drag: it.kind === 'event' ? (_it, e, n) => dragToDay(e, n, it, ctx) : null }, 'mo-chip')),
      more > 0 ? el('button', { type: 'button', class: 'mo-more', onclick: (e) => { e.stopPropagation(); ctx.dayView(day); } }, `${more} more`) : null);
    node.addEventListener('click', (e) => { if (e.target === node || e.target.classList.contains('mo-num')) ctx.newAt(day, 9 * 60); });
    return node;
  }

  /** A press on a chip and a release over another day moves the event there. Short presses are clicks. */
  function dragToDay(e, node, it, ctx) {
    if (e.button !== undefined && e.button !== 0) return;
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;
    const up = (ev) => {
      node.removeEventListener('pointerup', up);
      if (!moved) return;
      node.addEventListener('click', (c) => { c.stopPropagation(); c.preventDefault(); }, { once: true, capture: true });
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      const dayEl = target && target.closest ? target.closest('[data-day]') : null;
      if (!dayEl) return;
      const n = T.dayDiff(it.startDay, dayEl.dataset.day);
      if (!n) return;
      if (it.allDay) ctx.commit(it, { startDay: T.addDays(it.startDay, n), endDay: T.addDays(it.endDay, n) });
      else {
        const change = NS.drag.compute(it, 'move', n, 0, ctx.zone);
        if (change) ctx.commit(it, change);
      }
    };
    const move = (ev) => { if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) >= DRAG_PX) moved = true; };
    node.addEventListener('pointerup', up);
    node.addEventListener('pointermove', move, { once: false });
    node.addEventListener('pointerup', () => node.removeEventListener('pointermove', move), { once: true });
  }

  NS.month = { render, gridDays };
})(typeof window !== 'undefined' ? window : globalThis);
