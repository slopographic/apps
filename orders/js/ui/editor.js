// The order editor: one order on screen. Owns the form state (customer, date, notes, lines), saves through
// SlopOrders.orders, and shows the actions that the current status allows. Lines are drawn by SlopOrders.lines.
(function (g) {
  'use strict';
  const NS = (g.SlopOrders = g.SlopOrders || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const UI = g.SlopUI;
  const S = g.SlopData;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  const DIRTY_KEY = 'orders-editor';
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  const st = {
    id: null, number: '', status: 'draft', currency: 'USD', locale: 'en-US', defaultTaxRate: 0,
    customerId: '', date: '', notes: '', lines: [], invoiceId: null, invoiceNumber: '',
    customers: [], products: [], dirty: false,
  };
  const isNew = () => !st.id;
  const locked = () => st.status === 'fulfilled' || st.status === 'cancelled';

  function setMsg(text, bad) {
    const m = $('eMsg');
    m.textContent = text || '';
    m.className = `msg ${bad ? 'bad' : 'ok'}`;
  }
  function setDirty(v) {
    st.dirty = v;
    if (g.SlopGuard) SlopGuard.setUnsaved(DIRTY_KEY, v);
  }

  /** Copies a stored order into the form state. */
  async function applyRecord(rec) {
    Object.assign(st, {
      id: rec.id, number: rec.number || '', status: rec.status, currency: rec.currency,
      customerId: rec.customerId, date: rec.date, notes: rec.notes || '', invoiceId: rec.invoiceId || null,
    });
    st.lines = rec.lines.map((l) => ({ ...l }));
    st.invoiceNumber = '';
    if (st.invoiceId) {
      const inv = await S.store.get('invoices', st.invoiceId);
      st.invoiceNumber = inv.ok && inv.value ? (inv.value.number || 'draft') : '';
    }
  }

  function resetForm(s) {
    Object.assign(st, {
      id: null, number: '', status: 'draft', currency: s.currency, customerId: '', date: S.ledger.today(), notes: '',
      invoiceId: null, invoiceNumber: '',
    });
    st.lines = [M.newLine(null, s.defaultTaxRate)];
  }

  /** Opens an order by id, or a new one for id null. Loads the customer and product lists first. */
  async function open(id) {
    const s = await U.settings();
    st.locale = s.locale;
    st.defaultTaxRate = s.defaultTaxRate;
    const cs = await NS.orders.customers();
    const ps = await NS.orders.products();
    if (!cs.ok || !ps.ok) { setMsg(U.refusal(cs.ok ? ps : cs), true); return false; }
    st.customers = cs.value;
    st.products = ps.value;
    if (!id) resetForm(s);
    else {
      const r = await NS.orders.get(id);
      if (!r.ok || !r.value) { setMsg(r.ok ? 'That order no longer exists.' : U.refusal(r), true); return false; }
      await applyRecord(r.value);
    }
    setDirty(false);
    setMsg('');
    paintForm();
    return true;
  }

  /** Reloads the open order from the store (after an action changed it). */
  async function reload() {
    if (!st.id) return;
    const r = await NS.orders.get(st.id);
    if (r.ok && r.value) await applyRecord(r.value);
    setDirty(false);
    paintForm();
  }

  const lineOpts = () => ({
    products: st.products, currency: st.currency, locale: st.locale, readOnly: locked(),
    onEdit: (i, patch) => { st.lines[i] = { ...st.lines[i], ...patch }; setDirty(true); SlopDocs.lines.drawTotals($('eTotals'), st.lines, lineOpts()); },
    onProduct: (i, p) => {
      const cur = st.lines[i];
      if (p) {
        const n = M.newLine(p, st.defaultTaxRate);
        st.lines[i] = { ...cur, productId: n.productId, sku: n.sku, description: n.description, unitPrice: n.unitPrice, taxRate: n.taxRate };
      } else st.lines[i] = { ...cur, productId: undefined, sku: undefined };
      setDirty(true);
      paintForm();
    },
    onNewProduct: (i) => SlopDocs.productDialog.open(async (rec) => {
      const ps = await NS.orders.products();
      if (ps.ok) st.products = ps.value;
      lineOpts().onProduct(i, rec);
    }, { currency: st.currency }),
    onRemove: (i) => { st.lines.splice(i, 1); setDirty(true); paintForm(); },
  });

  function paintCustomers() {
    const sel = $('eCustomer');
    sel.replaceChildren(h('option', { value: '', text: 'Choose a customer…' }),
      ...st.customers.map((c) => h('option', { value: c.id, text: c.name })));
    sel.value = st.customerId || '';
  }

  function paintInvoice() {
    const box = $('eInvoice');
    box.replaceChildren();
    if (!st.invoiceId) return;
    box.append('Invoice: ', h('a', { href: `../invoices/#i/${st.invoiceId}`, text: st.invoiceNumber || 'draft' }));
  }

  function paintActions() {
    const box = $('eActions');
    const b = (label, fn, cls = 'btn') => h('button', { type: 'button', class: cls, text: label, onclick: fn });
    const out = [];
    if (st.status === 'draft') {
      out.push(b(isNew() ? 'Save draft' : 'Save', () => save()), b('Confirm order', confirm, 'btn primary'));
      if (!isNew()) out.push(b('Cancel order', cancel, 'btn danger'));
    }
    if (st.status === 'open') {
      out.push(b('Save changes', () => save()), b('Fulfil…', fulfil, 'btn primary'), b('Cancel order', cancel, 'btn danger'));
    }
    if ((st.status === 'open' || st.status === 'fulfilled') && !st.invoiceId) out.push(b('Convert to invoice', convert));
    if (st.status === 'fulfilled') out.push(h('p', { class: 'note', text: 'Fulfilled: stock has been taken out and the order is closed.' }));
    if (st.status === 'cancelled') out.push(h('p', { class: 'note', text: 'Cancelled orders cannot be changed.' }));
    box.replaceChildren(...out);
  }

  /** Fills every control from the state. Called after any change that redraws the form. */
  function paintForm() {
    $('eTitle').textContent = st.id ? st.number : 'New order';
    const chip = $('eStatus');
    chip.textContent = M.STATUS_LABEL[st.status] || st.status;
    chip.className = `chip ${st.status}`;
    paintCustomers();
    $('eDate').value = st.date;
    $('eCurrency').value = st.currency;
    $('eNotes').value = st.notes;
    const ro = locked();
    for (const el of [$('eCustomer'), $('eNewCustomer'), $('eDate'), $('eNotes'), $('eAddLine')]) el.disabled = ro;
    SlopDocs.lines.draw($('eLines'), st.lines, lineOpts());
    SlopDocs.lines.drawTotals($('eTotals'), st.lines, lineOpts());
    paintInvoice();
    paintActions();
  }

  /** Checks the form and returns the record to save, or the first problem in plain words. */
  function collect() {
    if (!st.customerId) return { error: 'Choose a customer first, or add a new one.' };
    if (!DATE.test(st.date)) return { error: 'Enter the order date.' };
    if (!st.lines.length) return { error: 'Add at least one line.' };
    for (const [i, l] of st.lines.entries()) {
      const e = M.lineErrors(l);
      if (e.length) return { error: `Line ${i + 1}: ${e.join('; ')}.` };
    }
    return { form: { id: st.id, customerId: st.customerId, date: st.date, notes: st.notes, currency: st.currency, lines: st.lines.map(M.cleanLine) } };
  }

  /** Saves the form. A new order is a draft; an existing one keeps its status. */
  async function save() {
    const c = collect();
    if (c.error) { setMsg(c.error, true); return false; }
    const r = await NS.orders.save(c.form);
    if (!r.ok) { setMsg(U.refusal(r), true); return false; }
    const created = !st.id;
    await applyRecord(r.value);
    setDirty(false);
    if (created) history.replaceState(null, '', `#o/${r.value.id}`);
    paintForm();
    setMsg(`${created ? 'Created' : 'Saved'} ${r.value.number}.`);
    return true;
  }

  /** Saves first when there are changes (or it is new), so an action always acts on what is on screen. */
  async function saveIfNeeded() {
    return !st.dirty && st.id ? true : save();
  }

  async function confirm() {
    if (!(await saveIfNeeded())) return;
    const r = await NS.actions.confirmId(st.id);
    if (!r.ok) { setMsg(U.refusal(r), true); return; }
    await reload();
    setMsg(`${st.number} is confirmed.`);
    UI.toast(`${st.number} confirmed`);
  }

  async function fulfil() {
    const yes = await UI.confirm('Fulfil order', `Fulfil ${st.number}? Stock on its product lines is taken out of the main location.`, 'Fulfil');
    if (!yes || !(await saveIfNeeded())) return;
    const r = await NS.fulfil.fulfil(st.id);
    if (!r.ok) { UI.alert('Not fulfilled', U.refusal(r)); return; }
    await reload();
    setMsg(`${st.number} is fulfilled. Stock is updated.`);
    UI.toast(`${st.number} fulfilled`);
  }

  async function cancel() {
    if (isNew()) return back(true);
    const yes = await UI.confirm('Cancel order', `Cancel ${st.number}? A cancelled order cannot be changed.`, 'Cancel order', { danger: true });
    if (!yes) return;
    const r = await NS.actions.cancelId(st.id);
    if (!r.ok) { UI.alert('Not cancelled', U.refusal(r)); return; }
    await reload();
    setMsg(`${st.number} is cancelled.`);
    UI.toast(`${st.number} cancelled`);
  }

  async function convert() {
    if (!(await saveIfNeeded())) return;
    const r = await NS.actions.convertId(st.id);
    if (!r.ok) { UI.alert('Not converted', U.refusal(r)); return; }
    await reload();
    setMsg('Invoice draft created. The order keeps a link to it.');
    UI.toast('Invoice draft created. The order keeps a link to it.');
  }

  /** Leaves the editor. Asks first when there are unsaved changes (unless force). */
  async function back(force) {
    if (!force && st.dirty) {
      const yes = await UI.confirm('Leave without saving', 'This order has unsaved changes. Leave anyway?', 'Leave', { danger: true });
      if (!yes) return;
    }
    setDirty(false);
    NS.app.go('list');
  }

  function mount() {
    $('eBack').addEventListener('click', () => back());
    $('eForm').addEventListener('submit', (e) => e.preventDefault());
    $('eDate').addEventListener('input', (e) => { st.date = e.target.value; setDirty(true); });
    $('eNotes').addEventListener('input', (e) => { st.notes = e.target.value; setDirty(true); });
    $('eCustomer').addEventListener('change', (e) => { st.customerId = e.target.value; setDirty(true); });
    $('eNewCustomer').addEventListener('click', () => SlopDocs.customerDialog.open(async (rec) => {
      const cs = await NS.orders.customers();
      if (cs.ok) st.customers = cs.value;
      st.customerId = rec.id;
      setDirty(true);
      paintForm();
    }));
    $('eAddLine').addEventListener('click', () => { st.lines.push(M.newLine(null, st.defaultTaxRate)); setDirty(true); paintForm(); });
  }

  NS.editor = {
    mount, open, save, confirm, fulfil, cancel, convert, back,
    isDirty: () => st.dirty,
    id: () => st.id,
    route: () => (st.id ? `o/${st.id}` : 'new'),
    clean: () => setDirty(false),
    state: () => ({ open: !!st.id || st.lines.length > 0, status: st.status, invoiceId: st.invoiceId, dirty: st.dirty, isNew: isNew() }),
  };
  NS.views = NS.views || {};
  NS.views.edit = { mount, refresh: () => {}, onShow: (id) => open(id || null) };
})(typeof window !== 'undefined' ? window : globalThis);
