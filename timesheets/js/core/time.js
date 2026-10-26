// Slop Timesheets, the pure parts: typed durations, periods, the list filter, the totals and the CSV. No DOM, no storage.
// Classic script; exposes window.SlopTimesheets.core (and module.exports for the Node tests).
(function (g) {
  'use strict';
  const pad = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const day = (s) => new Date(`${s}T00:00:00Z`);

  /** Minutes from typed text, or null: "1:30", "1.5" or "1,5" (hours), "90m", "2h", "2h 15m", "2 h 15 min". 1 to 1440. */
  function parseDuration(text) {
    const t = String(text ?? '').trim().toLowerCase().replace(',', '.');
    let m = null, x;
    if ((x = /^(\d{1,2}):([0-5]\d)$/.exec(t))) m = Number(x[1]) * 60 + Number(x[2]);
    else if ((x = /^(\d{1,2}(?:\.\d{1,2})?)\s*(?:h|hr|hrs|hours?)?$/.exec(t))) m = Math.round(Number(x[1]) * 60);
    else if ((x = /^(\d{1,4})\s*(?:m|min|mins|minutes?)$/.exec(t))) m = Number(x[1]);
    else if ((x = /^(\d{1,2})\s*(?:h|hr|hrs|hours?)\s*(\d{1,2})\s*(?:m|min|mins|minutes?)?$/.exec(t))) m = Number(x[1]) * 60 + Number(x[2]);
    return m !== null && m >= 1 && m <= 1440 ? m : null;
  }

  /** Minutes as "1:30" (hours and minutes). */
  const hm = (min) => `${Math.floor(min / 60)}:${pad(min % 60)}`;

  /** The first and last day (inclusive, YYYY-MM-DD) of a period around today: week (Monday to Sunday), last week, month,
   *  last month. Null for 'all'. */
  function periodRange(period, today) {
    const t = day(today);
    if (period === 'week' || period === 'lastweek') {
      const mon = new Date(t);
      mon.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) - (period === 'lastweek' ? 7 : 0));
      const sun = new Date(mon);
      sun.setUTCDate(mon.getUTCDate() + 6);
      return [iso(mon), iso(sun)];
    }
    if (period === 'month' || period === 'lastmonth') {
      const y = t.getUTCFullYear(), m = t.getUTCMonth() - (period === 'lastmonth' ? 1 : 0);
      return [iso(new Date(Date.UTC(y, m, 1))), iso(new Date(Date.UTC(y, m + 1, 0)))];
    }
    return null;
  }

  /** The rows that match: period, customerId ('' = any), state (all, open = billable and not billed, billed, internal =
   *  not billable) and search (description, project, customer name). Rows carry state and customerName. Newest first. */
  function filter(rows, { period = 'all', customerId = '', state = 'all', search = '' } = {}, today = '') {
    const range = periodRange(period, today), q = String(search).trim().toLowerCase();
    return rows.filter((r) => (!range || (r.date >= range[0] && r.date <= range[1]))
      && (!customerId || r.customerId === customerId) && (state === 'all' || r.state === state)
      && (!q || [r.description, r.project, r.customerName].some((s) => String(s || '').toLowerCase().includes(q))))
      .sort((a, b) => (a.date === b.date ? (b.createdAt || 0) - (a.createdAt || 0) : a.date < b.date ? 1 : -1));
  }

  /** Totals of rows: count, minutes, billable minutes, and the billable amount per currency ({ USD: 12000 }). amountOf(row)
   *  prices one row (SlopData.timesheets.amountOf). */
  function summary(rows, amountOf) {
    const out = { count: rows.length, minutes: 0, billableMinutes: 0, amounts: {} };
    for (const r of rows) {
      out.minutes += r.minutes;
      if (!r.billable) continue;
      out.billableMinutes += r.minutes;
      out.amounts[r.currency] = (out.amounts[r.currency] || 0) + amountOf(r);
    }
    return out;
  }

  const cell = (v) => { const s = String(v ?? ''); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

  /** CSV of rows, oldest first: date, customer, project, description, hours (decimal), h:mm, rate, amount, currency, state.
   *  plain(minor, currency) is the plain money text (SlopData.money.plainMinor). */
  function csv(rows, amountOf, plain) {
    const head = ['Date', 'Customer', 'Project', 'Description', 'Hours', 'Time', 'Rate', 'Amount', 'Currency', 'Billable', 'State'];   // i18n-ignore: CSV columns, a file format for other programs
    const lines = rows.slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)).map((r) => [
      r.date, r.customerName || '', r.project || '', r.description, (r.minutes / 60).toFixed(2), hm(r.minutes),
      plain(r.rate || 0, r.currency), plain(r.billable ? amountOf(r) : 0, r.currency), r.currency || '', r.billable ? 'yes' : 'no', r.state,
    ].map(cell).join(','));
    return [head.join(','), ...lines].join('\r\n') + '\r\n';
  }

  const api = { parseDuration, hm, periodRange, filter, summary, csv };
  const NS = (g.SlopTimesheets = g.SlopTimesheets || {});
  NS.core = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
