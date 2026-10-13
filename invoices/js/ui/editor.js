// The invoice editor: one invoice on screen. A draft is editable and can be issued, deleted, previewed or exported. An
// issued invoice is read-only here; payments and void go through billing (dialogs and buttons below).
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInvoices = g.SlopInvoices || {});
  const U = NS.util;
  const M = g.SlopDocs.model;
  const L = g.SlopDocs.layouts;
  const UI = g.SlopUI;
  const h = U.h;
  const $ = (id) => document.getElementById(id);
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  const st = {
    id: null, number: '', status: 'draft', currency: 'USD', locale: 'en-US', defaultTaxRate: 0, paymentTermsDays: 30,
    customerId: '', date: '', dueDate: '', notes: '', lines: [], orderId: null, payments: [], paid: 0, balance: 0,
    customers: [], products: [], dirty: false, pdfSeed: 0, pdfLayout: '', company: { name: '', address: '', taxNumber: '' },
  };
  const locked = () => st.status !== 'draft';
  const isNew = () => !st.id;

  function setMsg(text, bad) {
    const m = $('eMsg');
    m.textContent = text || '';
    m.className = `msg ${bad ? 'bad' : 'ok'}`;
  }
  function setDirty(v) {
    st.dirty = v;
    if (g.SlopGuard) SlopGuard.setUnsaved('invoices-editor', v);
  }

  /** Copies a loaded context (invoice, payments, balance) into the form state. */
  function apply(c) {
    const inv = c.invoice;
    Object.assign(st, {
      id: inv.id, number: inv.number || '', status: inv.status, currency: inv.currency, customerId: inv.customerId,
      date: inv.date, dueDate: inv.dueDate || '', notes: inv.notes || '', orderId: inv.orderId || null,
      payments: c.payments, paid: c.paid, balance: c.balance, pdfSeed: inv.pdfSeed ?? L.seedOf(inv), pdfLayout: inv.pdfLayout || '',
    });
    st.lines = inv.lines.map((l) => ({ ...l }));
  }

  function resetForm(s) {
    const today = S.ledger.today();
    Object.assign(st, {
      id: null, number: '', status: 'draft', currency: s.currency, customerId: '', date: today,
      dueDate: M.addDays(today, s.paymentTermsDays), notes: '', orderId: null, payments: [], paid: 0, balance: 0, pdfSeed: L.newSeed(), pdfLayout: '',
    });
    st.lines = [M.newLine(null, s.defaultTaxRate)];
  }

  /** Opens an invoice by id, or a new draft for id null. */
  async function open(id) {
    const s = await U.settings();
    Object.assign(st, { locale: s.locale, defaultTaxRate: s.defaultTaxRate, paymentTermsDays: s.paymentTermsDays,
      company: { name: s.companyName, address: s.address, taxNumber: s.taxNumber } });
    const cs = await NS.invoices.customers();
    const ps = await NS.invoices.products();
    if (!cs.ok || !ps.ok) { setMsg(U.refusal(cs.ok ? ps : cs), true); return false; }
    st.customers = cs.value;
    st.products = ps.value;
    if (!id) resetForm(s);
    else {
      const c = await NS.context.load(id);
      if (!c.ok) { setMsg(U.refusal(c), true); return false; }
      apply(c.value);
    }
    setDirty(false);
    setMsg('');
    paintForm();
    return true;
  }

  /** Reloads the open invoice (after an action changed it). */
  async function reload() {
    if (!st.id) return;
    const c = await NS.context.load(st.id);
    if (c.ok) apply(c.value);
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
      const ps = await NS.invoices.products();
      if (ps.ok) st.products = ps.value;
      lineOpts().onProduct(i, rec);
    }, { currency: st.currency }),
    onRemove: (i) => { st.lines.splice(i, 1); setDirty(true); paintForm(); },
  });

  function paintPayments() {
    const box = $('ePayments');
    if (!st.payments.length) { box.replaceChildren(h('p', { class: 'note', text: st.status === 'issued' ? 'No payments yet.' : '' })); return; }
    box.replaceChildren(h('ul', { class: 'report' }, st.payments.map((p) => h('li', { text: `${p.date} · ${p.method} · ${U.money(p.amount, st.currency, st.locale)}${p.note ? ` · ${p.note}` : ''}` }))));
  }

  function paintActions() {
    const b = (label, fn, cls = 'btn', disabled = false, title) => h('button', { type: 'button', class: cls, text: label, onclick: fn, disabled, title });
    const out = [];
    if (isNew()) out.push(b('Random sample', () => NS.sampleActions.quick(), 'btn'));
    if (st.status === 'draft') {
      out.push(b(isNew() ? 'Save draft' : 'Save', () => save()));
      out.push(b('Issue…', issue, 'btn primary'));
      if (!isNew()) out.push(b('Delete draft…', removeDraft, 'btn danger'));
    }
    if (st.status === 'issued') {
      out.push(b('Record payment…', () => NS.paymentDialog.open(st.id, reload), 'btn primary'));
      out.push(b('Void…', voidInvoice, 'btn danger', st.payments.length > 0,
        st.payments.length ? 'Not allowed while payments exist' : 'Reverse the issue entry and void'));
    }
    if (!isNew()) {
      out.push(b('Preview / print', preview));
      out.push(b('Export PDF', () => saveThen(() => NS.preview.pdf(st.id))));
    }
    if (st.status === 'paid' || st.status === 'void') out.push(h('p', { class: 'note', text: st.status === 'paid' ? 'Paid in full. The invoice is closed.' : 'Void. The number stays used.' }));
    $('eActions').replaceChildren(...out);
  }

  function paintForm() {
    $('eTitle').textContent = st.id ? st.number || 'Draft invoice' : 'New invoice';
    const label = st.status === 'issued' && st.balance <= 0 ? 'Paid' : NS.preview.STATUS[st.status];
    const chip = $('eStatus');
    chip.textContent = label;
    chip.className = `chip ${st.status}`;
    $('tbNum').textContent = st.id ? st.number || 'No number yet' : 'New invoice';
    $('tbStatus').textContent = label;
    $('tbStatus').className = `chip ${st.status}`;
    document.querySelector('.app').dataset.docStatus = st.status;
    const sel = $('eCustomer');
    sel.replaceChildren(h('option', { value: '', text: 'Choose a customer…' }), ...st.customers.map((c) => h('option', { value: c.id, text: c.name })));
    sel.value = st.customerId || '';
    $('eDate').value = st.date;
    $('eDue').value = st.dueDate;
    $('eCurrency').value = st.currency;
    $('eNotes').value = st.notes;
    const ro = locked();
    for (const el of [sel, $('eNewCustomer'), $('eDate'), $('eDue'), $('eNotes'), $('eAddLine')]) el.disabled = ro;
    SlopDocs.lines.draw($('eLines'), st.lines, lineOpts());
    SlopDocs.lines.drawTotals($('eTotals'), st.lines, lineOpts());
    const bal = $('eBalance');
    bal.textContent = st.status === 'issued' ? `Balance due ${U.money(st.balance, st.currency, st.locale)}` : '';
    $('eOrder').replaceChildren(...(st.orderId ? ['From order: ', h('a', { href: `../orders/#o/${st.orderId}`, text: 'open the order' })] : []));
    paintPayments();
    paintActions();
    NS.page.paint();
  }

  /** Checks the form and returns the record to save, or the first problem in plain words. */
  function collect() {
    if (!st.customerId) return { error: 'Choose a customer first, or add a new one.' };
    if (!DATE.test(st.date)) return { error: 'Enter the invoice date.' };
    if (st.dueDate && !DATE.test(st.dueDate)) return { error: 'Enter the due date as a date, or leave it blank.' };
    if (!st.lines.length) return { error: 'Add at least one line.' };
    for (const [i, l] of st.lines.entries()) {
      const e = M.lineErrors(l);
      if (e.length) return { error: `Line ${i + 1}: ${e.join('; ')}.` };
    }
    return { form: { id: st.id, customerId: st.customerId, date: st.date, dueDate: st.dueDate || undefined, notes: st.notes, currency: st.currency, lines: st.lines.map(M.cleanLine), pdfSeed: st.pdfSeed, pdfLayout: st.pdfLayout } };
  }

  /** Saves the draft. Returns true on success. */
  /** The save in flight, if any. A second save waits for it, so two saves never race (a new invoice would get two drafts). */
  let inflight = null;

  function save() {
    if (inflight) return inflight.then(() => save());
    inflight = doSave().finally(() => { inflight = null; });
    return inflight;
  }

  async function doSave() {
    const c = collect();
    if (c.error) { setMsg(c.error, true); return false; }
    setMsg('Saving…');
    const created = isNew();
    const r = await NS.invoices.saveDraft(c.form);
    if (!r.ok) { setMsg(U.refusal(r), true); return false; }
    st.id = r.value.id;
    if (created) history.replaceState(null, '', `#i/${r.value.id}`);
    await reload();
    setMsg('Draft saved.');
    return true;
  }

  /** Runs fn after saving when there are changes or the invoice is new. A save in flight is waited for first. */
  async function saveThen(fn) {
    if (inflight) { setMsg('Waiting for the save to finish…'); if (!(await inflight)) return; }
    if (st.dirty || isNew()) { if (!(await save())) return; }
    return fn();
  }

  async function issue() {
    const yes = await UI.confirm('Issue invoice', 'Issue this invoice? It gets the next invoice number and is posted to the ledger. Issued invoices cannot be edited.', 'Issue');
    if (!yes) return;
    await saveThen(async () => {
      const r = await NS.invoices.issue(st.id);
      if (!r.ok) { UI.alert('Not issued', U.refusal(r)); return; }
      await reload();
      UI.toast(`${st.number} issued`);
    });
  }

  async function voidInvoice() {
    const yes = await UI.confirm('Void invoice', `Void ${st.number}? The journal entry is reversed. The number stays used.`, 'Void', { danger: true });
    if (!yes) return;
    const r = await NS.invoices.voidInvoice(st.id);
    if (!r.ok) { UI.alert('Not voided', U.refusal(r)); return; }
    await reload();
    UI.toast(`${st.number} voided`);
  }

  async function removeDraft() {
    const yes = await UI.confirm('Delete draft', 'Delete this draft? It has no number yet, so nothing else changes.', 'Delete', { danger: true });
    if (!yes) return;
    const r = await NS.invoices.removeDraft(st.id);
    if (!r.ok) { UI.alert('Not deleted', U.refusal(r)); return; }
    setDirty(false);
    NS.app.go('list');
  }

  function preview() { return saveThen(() => NS.app.go(`p/${st.id}`)); }

  /** Leaves the editor, asking first when there are unsaved changes. */
  async function back(force) {
    if (!force && st.dirty) {
      const yes = await UI.confirm('Leave without saving', 'This invoice has unsaved changes. Leave anyway?', 'Leave', { danger: true });
      if (!yes) return;
    }
    setDirty(false);
    NS.app.go('list');
  }

  function mount() {
    $('eBack').addEventListener('click', () => back());
    $('eForm').addEventListener('submit', (e) => e.preventDefault());
    $('eDate').addEventListener('input', (e) => { st.date = e.target.value; setDirty(true); });
    $('eDue').addEventListener('input', (e) => { st.dueDate = e.target.value; setDirty(true); });
    $('eNotes').addEventListener('input', (e) => { st.notes = e.target.value; setDirty(true); });
    $('eCustomer').addEventListener('change', (e) => { st.customerId = e.target.value; setDirty(true); });
    $('eNewCustomer').addEventListener('click', () => SlopDocs.customerDialog.open(async (rec) => {
      const cs = await NS.invoices.customers();
      if (cs.ok) st.customers = cs.value;
      st.customerId = rec.id;
      setDirty(true);
      paintForm();
    }));
    $('eAddLine').addEventListener('click', () => { st.lines.push(M.newLine(null, st.defaultTaxRate)); setDirty(true); paintForm(); });
    NS.page.mount();
  }

  NS.editor = {
    mount, open, save, issue, voidInvoice, removeDraft, preview, back,
    isDirty: () => st.dirty, id: () => st.id, route: () => (st.id ? `i/${st.id}` : 'new'), clean: () => setDirty(false),
    live: () => st, repaint: () => paintForm(), note: (msg) => setMsg(msg, true),
    edited: (msg) => { setDirty(true); paintForm(); setMsg(msg || '', true); },
    state: () => ({ open: !!st.id || st.lines.length > 0, status: st.status, payments: st.payments.length, dirty: st.dirty, isNew: isNew() }),
  };
  NS.views = NS.views || {};
  NS.views.edit = { mount, refresh: () => {}, onShow: (id) => open(id || null) };
})(typeof window !== 'undefined' ? window : globalThis);
