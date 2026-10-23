// Slop Expenses editor: a new expense (or a copy of one) is a form; Record posts it (SlopData.expenses.record). A recorded
// expense is read only, as the books are: it can be voided (its entry reversed) or copied into a new one.
(function (g) {
  'use strict';
  const S = g.SlopData, B = g.SlopBiz, UI = g.SlopUI, el = g.SlopUI.el;
  const NS = (g.SlopExpenses = g.SlopExpenses || {});
  const $ = (id) => document.getElementById(id);
  const FIELDS = { supplier: 'Supplier', date: 'Date', amount: 'Amount', tax: 'Tax', account: 'Category', currency: 'Currency' };
  const METHODS = [['bank', 'Bank transfer'], ['card', 'Card'], ['cash', 'Cash'], ['other', 'Other']];
  let taxTouched = false, cur = null;

  const today = () => S.ledger.today();
  const decimal = (minor, currency) => { const d = S.money.digits(currency); return (minor / 10 ** d).toFixed(d); };
  const say = (text, bad) => { $('eMsg').textContent = text || ''; $('eMsg').className = 'msg' + (bad ? ' bad' : text ? ' ok' : ''); };

  async function fillAccounts(selected) {
    const accts = await B.expenseAccounts();
    $('eAccount').replaceChildren(...accts.map((a) => el('option', { value: a.code, selected: a.code === selected }, `${a.code} ${a.name}`)),
      el('option', { value: '+' }, 'New category…'));
  }
  async function suppliers() {
    const r = await S.store.list('expenses');
    const names = [...new Set((r.ok ? r.value : []).map((e) => e.supplier))].sort();
    $('eSuppliers').replaceChildren(...names.map((n) => el('option', { value: n })));
  }
  /** Adds an expense account (the next free 5xxx code) named by the person, and selects it. */
  async function newCategory() {
    const name = await UI.prompt('New category', 'Name of the expense category', '', { ok: 'Add', placeholder: 'Travel' });
    if (!name || !name.trim()) { await fillAccounts(cur && cur.account); return; }
    const r = await S.store.list('accounts');
    const used = new Set((r.ok ? r.value : []).map((a) => a.code));
    let code = 5010; while (used.has(String(code)) && code < 5999) code += 10;
    const w = await S.store.put('accounts', { code: String(code), name: name.trim(), type: 'expense' });
    if (!w.ok) { UI.alert('Category not added', B.refusal(w)); await fillAccounts(); return; }
    await fillAccounts(String(code));
  }
  /** The tax from the amount and rate, until the person types a tax of their own. */
  function autoTax() {
    if (taxTouched) return;
    const amount = S.money.parseMinor($('eAmount').value, $('eCurrency').value || 'USD');
    const rate = Math.round(Number($('eRate').value || 0) * 100);
    $('eTax').value = amount == null ? '' : decimal(NS.core.taxIn(amount, rate), $('eCurrency').value || 'USD');
  }

  function setForm(on) { $('eForm').hidden = !on; $('eView').hidden = on; $('eRecord').hidden = !on; $('eVoid').hidden = true; $('eCopy').hidden = on; }

  /** A new expense: today, the settings' currency and tax rate, or the details of the expense being copied. */
  async function showNew(copyOf) {
    const s = await B.settings();
    let src = null;
    if (copyOf) { const r = await S.store.get('expenses', copyOf); src = r.ok ? r.value : null; }
    cur = null; taxTouched = !!src; setForm(true); say('');
    $('eTitle').textContent = src ? `Copy of ${src.supplier}` : 'New expense';
    $('eDate').value = today();
    $('eSupplier').value = src ? src.supplier : '';
    $('eDescription').value = src ? src.description || '' : '';
    $('eCurrency').value = src ? src.currency || s.currency : s.currency;
    $('eAmount').value = src ? decimal(src.amount, $('eCurrency').value) : '';
    $('eRate').value = String((s.defaultTaxRate || 0) / 100);
    $('eTax').value = src ? decimal(src.tax || 0, $('eCurrency').value) : '';
    $('eMethod').value = src ? src.method : 'bank';
    $('eNotes').value = src ? src.notes || '' : '';
    await Promise.all([fillAccounts(src ? src.account : undefined), suppliers()]);
    $('eSupplier').focus();
  }

  /** A recorded expense, read only. */
  async function showOne(id) {
    const [r, s, accts] = await Promise.all([S.store.get('expenses', id), B.settings(), B.expenseAccounts()]);
    if (!r.ok || !r.value) { setForm(false); $('eView').replaceChildren(el('p', { class: 'note' }, 'That expense no longer exists.')); return; }
    cur = r.value; setForm(false); say('');
    const e = cur, c = e.currency || s.currency, m = (v) => B.money(v, c, s.locale), acct = accts.find((a) => a.code === e.account);
    $('eTitle').textContent = `${e.supplier} · ${e.date}`;
    const row = (k, v) => [el('dt', null, k), el('dd', null, v)];
    $('eView').replaceChildren(el('dl', { class: 'facts' }, ...row('Supplier', e.supplier), ...row('Description', e.description || '—'),
      ...row('Category', acct ? `${acct.code} ${acct.name}` : e.account), ...row('Amount', m(e.amount)), ...row('Tax', m(e.tax || 0)),
      ...row('Without tax', m(e.amount - (e.tax || 0))), ...row('Paid by', (METHODS.find((x) => x[0] === e.method) || [, e.method])[1]),
      ...row('Status', e.status === 'void' ? 'Void (the entry is reversed)' : 'Recorded in the books'), ...row('Notes', e.notes || '—')));
    $('eVoid').hidden = e.status !== 'posted';
  }

  async function record() {
    const currency = ($('eCurrency').value || '').trim().toUpperCase();
    const amount = S.money.parseMinor($('eAmount').value, currency), tax = $('eTax').value.trim() ? S.money.parseMinor($('eTax').value, currency) : 0;
    if (amount == null || amount < 1) { say('Amount: type what was paid, like 24.00.', true); $('eAmount').focus(); return; }
    if (tax == null) { say('Tax: type an amount like 4.00, or leave it empty.', true); $('eTax').focus(); return; }
    const r = await S.expenses.record({ date: $('eDate').value, supplier: $('eSupplier').value.trim(), description: $('eDescription').value.trim() || undefined,
      account: $('eAccount').value, amount, tax, currency, method: $('eMethod').value, notes: $('eNotes').value.trim() || undefined });
    if (!r.ok) { say(B.refusal(r, { fields: FIELDS }), true); return; }
    UI.toast(`Expense from ${r.value.supplier} recorded`);
    NS.app.go(`e/${r.value.id}`);
  }

  function mount() {
    $('eRecord').addEventListener('click', record);
    $('eForm').addEventListener('submit', (ev) => { ev.preventDefault(); record(); });
    $('eVoid').addEventListener('click', async () => { if (cur) { await NS.listView.voidOne(cur); showOne(cur.id); } });
    $('eCopy').addEventListener('click', () => cur && NS.app.go(`new/${cur.id}`));
    $('eBack').addEventListener('click', () => NS.app.go('list'));
    $('eAccount').addEventListener('change', () => { if ($('eAccount').value === '+') newCategory(); });
    for (const id of ['eAmount', 'eRate', 'eCurrency']) $(id).addEventListener('input', autoTax);
    $('eTax').addEventListener('input', () => { taxTouched = $('eTax').value.trim() !== ''; });
  }

  NS.editor = { record, current: () => cur };
  NS.views = NS.views || {};
  NS.views.edit = { mount, show: (id, t) => (id ? showOne(id) : showNew(t && t.copyOf)) };
})(typeof window !== 'undefined' ? window : globalThis);
