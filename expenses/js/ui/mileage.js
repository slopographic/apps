// Slop Expenses: Mileage… records a mileage claim as an expense: the date, the route (there and back or one way), the
// distance in kilometres or miles at a rate per unit, and why. The amount is worked out as it is typed (core/mileage.js);
// the rate and the unit are remembered for next time (localStorage, through try/catch). Paid by: other (claimed back).
(function (g) {
  'use strict';
  const S = g.SlopData, B = g.SlopBiz, UI = g.SlopUI, el = UI.el;
  const NS = (g.SlopExpenses = g.SlopExpenses || {});
  const KEY = 'slop-expenses.mileage';
  const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
  const remember = (o) => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) { /* not kept: the defaults come back */ } };

  /** The category to start with: one named for travel or mileage, else the first expense account. */
  async function categories() {
    const accts = await B.expenseAccounts();
    const pick = accts.find((a) => /mileage|travel|car|vehicle|resor|bil/i.test(a.name)) || accts[0];
    return { accts, pick: pick ? pick.code : '5000' };
  }

  async function open() {
    const s = await B.settings(), last = saved(), { accts, pick } = await categories();
    const unit = UI.select([['km', 'Kilometres'], ['mi', 'Miles']], last.unit || (/^en-(US|GB)$/i.test(s.locale) ? 'mi' : 'km'));
    const f = {
      date: el('input', { type: 'date', value: S.ledger.today() }), from: el('input', { maxlength: 100, placeholder: 'Office' }),
      to: el('input', { maxlength: 100, placeholder: 'Client' }), back: el('input', { type: 'checkbox', checked: !!last.roundTrip }),
      distance: el('input', { inputmode: 'decimal', placeholder: '42' }), rate: el('input', { inputmode: 'decimal', value: last.rate || '0.45' }),
      purpose: el('input', { maxlength: 120, placeholder: 'Client visit' }), cat: UI.select(accts.map((a) => [a.code, `${a.code} ${a.name}`]), pick),
    };
    const total = el('p', { class: 'sheet-total' }, el('span', null, 'To claim'), el('b', null, '—'));
    const msg = el('p', { class: 'msg bad', role: 'status' });
    /** The distance as entered (doubled for there and back), the rate per unit and the amount; null parts while not valid. */
    const figures = () => {
      const one = NS.mileage.parseDistance(f.distance.value), rate = Number(String(f.rate.value).trim().replace(',', '.'));
      const distance = one === null ? null : f.back.checked ? one * 2 : one;
      const rateMinor = Number.isFinite(rate) && rate > 0 && rate < 100 ? rate * 100 : null;
      return { distance, rateMinor, amount: distance !== null && rateMinor !== null ? NS.mileage.amount(distance, rateMinor) : null };
    };
    const update = () => { const x = figures(); total.querySelector('b').textContent = x.amount !== null ? B.money(x.amount, s.currency, s.locale) : '—'; };
    for (const k of ['distance', 'rate', 'back']) f[k].addEventListener('input', update);
    f.back.addEventListener('change', update);
    unit.addEventListener('change', update);
    const body = el('div', { class: 'mileage-dialog' }, UI.field('Date', f.date), UI.field('From', f.from), UI.field('To', f.to),
      el('label', { class: 'check' }, f.back, ' There and back (the distance counts twice)'),
      UI.field('Distance, one way', f.distance), UI.field('Unit', unit), UI.field(`Rate per unit (${s.currency})`, f.rate),
      UI.field('Purpose', f.purpose), UI.field('Category', f.cat), total, msg);
    update();
    UI.dialog({
      title: 'Mileage claim', body,
      buttons: [{ label: 'Cancel' }, { label: 'Record claim', primary: true, act: async () => {
        const x = figures();
        if (x.distance === null) { msg.textContent = 'Distance: type the kilometres or miles, like 42.'; return false; }
        if (x.rateMinor === null) { msg.textContent = 'Rate: type the amount per unit, like 0.45.'; return false; }
        const u = unit.value;
        const r = await S.expenses.record({ date: f.date.value, supplier: 'Mileage', account: f.cat.value, amount: x.amount, tax: 0, currency: s.currency, method: 'other',
          description: NS.mileage.describe({ from: f.from.value.trim(), to: f.to.value.trim(), roundTrip: f.back.checked, distance: x.distance, unit: u, rateText: f.rate.value.trim(), purpose: f.purpose.value.trim() }) });
        if (!r.ok) { msg.textContent = B.refusal(r); return false; }
        remember({ rate: f.rate.value.trim(), unit: u, roundTrip: f.back.checked });
        UI.toast(`Mileage claim of ${B.money(x.amount, s.currency, s.locale)} recorded`);
        NS.app.go(`e/${r.value.id}`);
        return undefined;
      } }],
    });
    setTimeout(() => f.from.focus(), 30);
  }

  function mount() { document.getElementById('xMileage').addEventListener('click', open); }

  NS.mileageDialog = { open, mount };
})(typeof window !== 'undefined' ? window : globalThis);
