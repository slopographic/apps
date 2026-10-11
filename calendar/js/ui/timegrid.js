// The week and day time grid: an all-day strip, hour lines, timed blocks in columns, a now line on today, and a click on
// an empty slot to add an event there. Blocks move and resize through drag.js. Days are the viewer's days. Exposes
// window.SlopCal.timegrid.
(function (g) {
  'use strict';
  const T = g.SlopTime, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopCal = g.SlopCal || {});
  const HOUR = 48;   // pixels per hour
  const HOURS = 24;

  /** Draws the grid for days (YYYY-MM-DD) into root. ctx: { zone, locale, items, today, open, complete, commit, newAt }. */
  function render(root, days, ctx) {
    const { zone, locale, items, today } = ctx;
    const allDay = items.filter((it) => it.allDay);
    const timed = items.filter((it) => !it.allDay);
    const head = el('div', { class: 'tg-head', style: `--cols:${days.length}` }, el('div', { class: 'tg-gut' }),
      days.map((d) => el('div', { class: `tg-dh${d === today ? ' is-today' : ''}`, 'data-day': d },
        T.dayText(d, locale, { weekday: 'short', day: 'numeric', month: 'short' }))));
    const strip = el('div', { class: 'tg-allday', style: `--cols:${days.length}` }, el('div', { class: 'tg-gut' }, 'All day'),
      days.map((d) => el('div', { class: 'tg-ad', 'data-day': d }, NS.model.forDay(allDay, d, zone).map((it) => NS.chip(it, ctx)))));
    const labels = el('div', { class: 'tg-gut tg-hours', style: `height:${HOURS * HOUR}px` },
      Array.from({ length: HOURS }, (_, h) => el('span', { class: 'tg-hour', style: `top:${h * HOUR}px` },
        T.timeText(Date.UTC(2026, 0, 1, h, 0), 'UTC', locale))));
    const cols = days.map((d) => column(d, timed, ctx));
    const body = el('div', { class: 'tg-body', style: `--cols:${days.length}` }, labels, cols);
    root.replaceChildren(el('div', { class: 'tg', role: 'region', 'aria-label': 'Time grid' }, head, strip, el('div', { class: 'tg-scroll' }, body)));
    const now = root.querySelector('.tg-col.is-today');
    if (now) {
      const line = el('div', { class: 'tg-now', 'aria-hidden': 'true' });
      now.append(line);
      placeNow(line, zone);
    }
  }

  function placeNow(line, zone) {
    const day = line.parentElement.dataset.day;
    const start = T.startOfDay(day, zone), len = T.startOfDay(T.addDays(day, 1), zone) - start;
    line.style.top = `${((Date.now() - start) / len) * HOURS * HOUR}px`;
  }

  /** One day column: hour lines (CSS), timed blocks laid out side by side, and a click to add at that time. */
  function column(day, timed, ctx) {
    const { zone } = ctx;
    const s = T.startOfDay(day, zone), e = T.startOfDay(T.addDays(day, 1), zone), len = e - s;
    const wrapped = NS.model.forDay(timed, day, zone).map((it) => ({ start: Math.max(it.start, s), end: Math.min(it.end, e), it }));
    const laid = NS.columns(wrapped);
    const col = el('div', { class: `tg-col${day === ctx.today ? ' is-today' : ''}`, 'data-day': day, style: `height:${HOURS * HOUR}px` });
    col.addEventListener('click', (ev) => {
      if (ev.target !== col) return;
      const mins = Math.floor((ev.offsetY / HOUR) * 60 / 30) * 30;
      ctx.newAt(day, mins);
    });
    for (const { item, col: c, cols } of laid) {
      const it = item.it;
      const top = ((item.start - s) / len) * HOURS * HOUR;
      const h = Math.max(18, ((item.end - item.start) / len) * HOURS * HOUR);
      const block = NS.chip(it, { ...ctx, drag: it.kind === 'event' ? (_item, ev, node) => startDrag(ev, node, it, 'move', ctx) : null }, 'tg-block');
      Object.assign(block.style, { top: `${top}px`, height: `${h}px`, left: `${(c / cols) * 100}%`, width: `calc(${100 / cols}% - 3px)` });
      if (it.kind === 'event') {
        const handle = el('div', { class: 'rz', 'aria-hidden': 'true' });
        handle.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); startDrag(ev, block, it, 'resize', ctx); });
        block.append(handle);
      }
      col.append(block);
    }
    return col;
  }

  function startDrag(ev, node, it, mode, ctx) {
    NS.drag.begin(ev, node, it, mode, {
      pxPerHour: HOUR, zone: ctx.zone,
      onClick: () => ctx.open(it),
      onCommit: (change) => ctx.commit(it, change),
    });
  }

  NS.timegrid = { render, HOUR };
})(typeof window !== 'undefined' ? window : globalThis);
