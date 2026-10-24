// The Repeating view: every repeating schedule (SlopList: customer and amount, how often, the next date, how many made),
// a row menu (make now, pause or resume, open the last invoice, delete), and Make due drafts. The Invoices list shows a
// notice when drafts are due (dueNotice). Drafts are made by SlopData.recurring.makeDue, in one transaction.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const R = () => S.recurring;
  const $ = (id) => document.getElementById(id);
  let list = null, names = new Map(), settings = null;

  /** The schedules, with the customers' names for the rows. */
  async function load() {
    const [s, c] = await Promise.all([S.store.list('schedules'), S.store.list('customers')]);
    names = new Map((c.ok ? c.value : []).map((x) => [x.id, x.name]));
    return s.ok ? s.value.sort((a, b) => (a.nextDate < b.nextDate ? -1 : 1)) : [];
  }

  function row(x) {
    const due = R().dueDates(x, S.ledger.today()).dates.length;
    return { title: names.get(x.customerId) || '(no customer)', amount: U.money(x.total, x.currency, settings.locale), cls: x.active ? '' : 'is-void',
      meta: [x.active ? (due ? { chip: `${due} due`, cls: 'warn' } : { chip: 'Active', cls: 'good' }) : { chip: 'Stopped', cls: 'void' },
        R().describe(x), x.active ? `next ${x.nextDate}` : null, x.endDate ? `until ${x.endDate}` : null, `${x.made || 0} made`] };
  }

  /** Makes the due drafts (all, or one schedule's), says how many, and redraws. */
  async function make(scheduleId) {
    const r = await R().makeDue(S.ledger.today(), { scheduleId });
    if (!r.ok) { UI.alert('Drafts not made', U.refusal(r)); return; }
    const n = r.value.made.length;
    UI.toast(n ? `${n} draft invoice${n === 1 ? '' : 's'} made` : 'Nothing is due yet');
    await draw();
    await dueNotice();
    if (NS.views.list) NS.views.list.refresh();
  }

  async function setActive(x, on) {
    const r = await S.store.put('schedules', { ...x, active: on });
    if (!r.ok) UI.alert('Not changed', U.refusal(r)); else draw();
  }

  async function remove(x) {
    if (!(await UI.confirm('Stop repeating', `Delete this schedule for ${names.get(x.customerId) || 'the customer'}? Invoices already made stay.`, 'Delete', { danger: true }))) return;
    const r = await S.store.remove('schedules', x.id);
    if (!r.ok) UI.alert('Not deleted', U.refusal(r)); else draw();
  }

  function menuFor(x) {
    const items = [];
    if (x.active && R().dueDates(x, S.ledger.today()).dates.length) items.push({ label: 'Make its due drafts', act: () => make(x.id) });
    items.push(x.active ? { label: 'Pause', act: () => setActive(x, false) } : { label: 'Resume', act: () => setActive(x, true) });
    if (x.lastInvoiceId) items.push({ label: 'Open the last invoice', act: () => NS.app.go(`i/${x.lastInvoiceId}`) });
    if (x.sourceInvoiceId) items.push({ label: 'Open the original invoice', act: () => NS.app.go(`i/${x.sourceInvoiceId}`) });
    items.push({ label: 'Delete…', act: () => remove(x) });
    return items;
  }

  async function draw() {
    if ($('view-repeat').hidden) return;
    settings = await U.settings();
    const all = await load();
    list.set(all);
    const due = R().due(all, S.ledger.today()).length;
    $('rMake').disabled = !due;
    $('rMake').textContent = due ? `Make due drafts (${due})` : 'Nothing due';
  }

  /** The Invoices list's notice when repeating invoices are due, with a button that makes them. */
  async function dueNotice() {
    const box = $('iDue');
    const due = R().due(await load(), S.ledger.today());
    box.hidden = !due.length;
    if (due.length) box.querySelector('span').textContent = `${due.length} repeating invoice${due.length === 1 ? ' is' : 's are'} due.`;
  }

  function mount() {
    $('rMake').addEventListener('click', () => make());
    $('iDueMake').addEventListener('click', () => make());
    list = g.SlopList.mount($('rRows'), { label: 'Repeating invoices', noun: ['schedule', 'schedules'], summary: $('rSummary'),
      empty: 'Nothing repeats yet. Open an invoice and choose Repeat… to bill it every week or month.', row, menu: menuFor,
      open: (x) => NS.app.go(`i/${x.lastInvoiceId || x.sourceInvoiceId}`) });
  }

  NS.repeat = { make, draw, dueNotice, menuFor };
  NS.views = NS.views || {};
  NS.views.repeat = { mount, refresh: draw, onShow: draw };
})(typeof window !== 'undefined' ? window : globalThis);
