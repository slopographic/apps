/* Slop Contacts app: the three-column layout on the shared customer records. Letter headers in order, a new contact
 * in its letter section and in the CRM view, the orders and invoices of a customer, the 390 px layout with no
 * horizontal scroll, and the keyboard (arrows, Enter, Cmd+N, Delete asks first). The app runs in a same-origin iframe
 * and reads the same IndexedDB as the test page. */
(function () {
  'use strict';
  const { describe, it, expect, sleep, waitFor } = SlopTest;

  /** Loads a page into a frame and waits until its app is ready. */
  async function load(frameId, path, readyCheck) {
    const fr = document.getElementById(frameId);
    fr.src = 'about:blank';
    await waitFor(() => fr.contentWindow && fr.contentWindow.location.href === 'about:blank', { timeout: 5000 });
    fr.src = path;
    await waitFor(() => fr.contentWindow && fr.contentWindow.location.pathname.endsWith(path.replace(/^\.\.\/\.\.\//, '/').split('?')[0].replace(/^\//, '/').replace(/^\/\.\.\/\.\.\//, '/')) && readyCheck(fr.contentWindow), { timeout: 30000 });
    return fr.contentWindow;
  }
  /** Boots Slop Contacts after the store has the records. */
  const boot = (frameId = 'app') => load(frameId, '../../contacts/index.html', (w) => w.SlopContacts && w.SlopContacts.ready && w.SlopContacts.state.ready);
  const $ = (win, sel) => win.document.querySelector(sel);
  const $$ = (win, sel) => [...win.document.querySelectorAll(sel)];
  const letters = (win) => $$(win, '#rows .letter').map((h) => h.textContent);
  const rowNames = (win) => $$(win, '#rows .row-name').map((n) => n.textContent);
  const sectionOf = (win, letter) => {
    const h = $$(win, '#rows .letter').find((x) => x.textContent === letter);
    return h ? [...h.parentElement.querySelectorAll('.row-name')].map((n) => n.textContent) : [];
  };
  const rowFor = (win, name) => $$(win, '#rows .row').find((r) => r.querySelector('.row-name').textContent === name);
  const dialogButton = (win, label) => $$(win, '.sui-dlg button').find((b) => b.textContent.trim() === label);
  const stored = (id) => window.SlopData.store.get('customers', id).then((r) => r.value);
  const uniq = (s) => `${s}-${Math.random().toString(36).slice(2, 7)}`;

  describe('letters and rows', () => {
    it('the letter headers appear in order, # last, and each contact is under its letter', async () => {
      await CT.resetCustomers();
      const p = uniq('L');
      await CT.seed([{ name: 'Zoe Adams', id: 'lt-z' }, { name: 'Adam Smith', id: 'lt-a' }, { name: 'Émile Zola', id: 'lt-e' },
        { name: 'Bob Ray', id: 'lt-b' }, { name: '1 Hour Taxi', id: 'lt-n' }, { name: 'Ann Lee', id: 'lt-a2' }].map((r) => ({ ...r, name: r.name })));
      const win = await boot();
      expect(letters(win)).toEqual(['A', 'B', 'E', 'Z', '#']);
      expect(sectionOf(win, 'A')).toEqual(['Adam Smith', 'Ann Lee']);
      expect(sectionOf(win, 'E')).toEqual(['Émile Zola']);
      expect(sectionOf(win, '#')).toEqual(['1 Hour Taxi']);
      expect(p).toBeTruthy();
    });

    it('the list shows one line per contact: the company, or the stage when there is no company', async () => {
      await CT.resetCustomers();
      await CT.seed([{ id: 'sb-1', name: 'Sub Acme', company: 'Acme Ltd' }, { id: 'sb-2', name: 'Sub Plain', stage: 'customer' }]);
      const win = await boot();
      expect(rowFor(win, 'Sub Acme').querySelector('.row-sub').textContent).toBe('Acme Ltd');
      expect(rowFor(win, 'Sub Plain').querySelector('.row-sub').textContent).toBe('Customer');
    });

    it('a new contact appears in its letter section and in the CRM view', async () => {
      await CT.resetCustomers();
      const win = await boot();
      $(win, '#btnNew').click();
      await waitFor(() => dialogButton(win, 'Create'));
      $(win, '.quick-form input[aria-label="Name"]').value = 'Mira Quill';
      $(win, '.quick-form input[aria-label="Phone"]').value = '+44 20 7946 0000';
      $(win, '.quick-form input[aria-label="Company"]').value = 'Quill Co';
      dialogButton(win, 'Create').click();
      await waitFor(() => sectionOf(win, 'M').includes('Mira Quill'));
      expect(sectionOf(win, 'M')).toEqual(['Mira Quill']);
      const saved = (await window.SlopData.store.list('customers')).value.find((c) => c.name === 'Mira Quill');
      expect(saved.company).toBe('Quill Co');
      expect(saved.phone).toBe('+44 20 7946 0000');
      expect(saved.phoneLabel).toBe('mobile');

      const crm = await load('app2', '../../crm/index.html#customers', (w) => w.SlopCrm && w.SlopCrm.app && w.document.getElementById('cRows'));
      await waitFor(() => $$(crm, '#cRows .row-open b').some((b) => b.textContent === 'Mira Quill'), { timeout: 10000 });
      expect($$(crm, '#cRows .row-open b').map((b) => b.textContent)).toContain('Mira Quill');
    });
  });

  describe('orders and invoices', () => {
    it('the card lists the orders and invoices of this customer from the shared collections, with links', async () => {
      await CT.resetCustomers();
      const [cust] = await CT.seed([{ name: 'Ivy Order', id: 'ord-ivy' }]);
      const store = window.SlopData.store;
      const o = await store.put('orders', { customerId: cust.id, date: '2026-10-01', status: 'open', currency: 'USD',
        lines: [{ description: 'Widget', qty: 2, unitPrice: 1250, taxRate: 0 }] });
      const i = await store.put('invoices', { customerId: cust.id, date: '2026-10-02', status: 'draft', currency: 'USD',
        lines: [{ description: 'Widget', qty: 1, unitPrice: 500, taxRate: 0 }] });
      expect(o.ok).toBeTruthy();
      expect(i.ok).toBeTruthy();
      const win = await boot();
      rowFor(win, 'Ivy Order').click();
      await waitFor(() => $(win, '#cardHistory .docs'), { timeout: 8000 });
      const text = $(win, '#cardHistory').textContent;
      expect(text).toContain(o.value.number);
      expect(text).toContain('Draft invoice');
      expect($(win, `#cardHistory a[href="../orders/#o/${o.value.id}"]`)).toBeTruthy();
      expect($(win, `#cardHistory a[href="../invoices/#i/${i.value.id}"]`)).toBeTruthy();
      expect(text).toContain('$25.00');
    });

    it('a contact with no orders says so', async () => {
      await CT.resetCustomers();
      await CT.seed([{ name: 'Nia None', id: 'ord-none' }]);
      const win = await boot();
      rowFor(win, 'Nia None').click();
      await waitFor(() => $(win, '#cardHistory .muted'), { timeout: 8000 });
      expect($(win, '#cardHistory').textContent).toContain('No orders for this contact yet.');
    });
  });

  describe('layout and keyboard', () => {
    it('at 390 px the list is the screen, the card opens as a full page, and nothing scrolls sideways', async () => {
      await CT.resetCustomers();
      await CT.seed([{ name: 'Phone Page', id: 'mob-1' }, { name: 'Other One', id: 'mob-2' }]);
      const win = await boot();
      const fr = document.getElementById('app');
      fr.style.width = '390px';
      fr.style.height = '780px';
      await sleep(250);
      const doc = win.document;
      expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(doc.documentElement.clientWidth);
      expect(win.getComputedStyle($(win, '#card')).display).toBe('none');
      expect($(win, '#rows').getBoundingClientRect().width).toBeGreaterThan(300);
      expect(win.getComputedStyle($(win, '.back')).display).toBe('none');
      rowFor(win, 'Phone Page').click();
      await waitFor(() => win.getComputedStyle($(win, '#card')).display !== 'none', { timeout: 5000 });
      await sleep(60);
      expect($(win, '#card').getBoundingClientRect().width).toBeCloseTo(390, 0);
      expect(win.getComputedStyle($(win, '.back')).display).not.toBe('none');
      expect(doc.documentElement.scrollWidth).toBeLessThanOrEqual(doc.documentElement.clientWidth);
      $(win, '.card-bar .back').click();
      await sleep(40);
      expect(win.getComputedStyle($(win, '#card')).display).toBe('none');
      fr.style.width = '1280px';
      fr.style.height = '760px';
    });

    it('arrow keys move through the list, Enter opens the card, and Delete asks before it removes', async () => {
      await CT.resetCustomers();
      await CT.seed([{ name: 'Key Anna', id: 'k-1' }, { name: 'Key Bea', id: 'k-2' }, { name: 'Key Cal', id: 'k-3' }]);
      const win = await boot();
      $(win, '#rows').focus();
      win.document.activeElement.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await sleep(40);
      win.document.activeElement.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      await sleep(40);
      expect(win.SlopContacts.state.open).toBe('k-2');
      expect($$(win, '#rows .row.is-focus')[0].dataset.id).toBe('k-2');
      win.document.activeElement.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await sleep(40);
      expect($(win, '#cardBody .card-name').textContent).toBe('Key Bea');
      win.document.activeElement.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      await waitFor(() => dialogButton(win, 'Delete'));
      dialogButton(win, 'Cancel').click();
      await sleep(80);
      expect((await stored('k-2')).id).toBe('k-2');
      win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      await waitFor(() => dialogButton(win, 'Delete'));
      dialogButton(win, 'Delete').click();
      await waitFor(async () => !(await stored('k-2')), { timeout: 8000 });
      expect(await stored('k-2')).toBeFalsy();
      await waitFor(() => !rowNames(win).includes('Key Bea'), { timeout: 5000 });
    });

    it('Cmd+N opens the quick form for a new contact', async () => {
      const win = await boot();
      win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true }));
      await waitFor(() => $(win, '.quick-form'), { timeout: 3000 });
      expect($(win, '.quick-form')).toBeTruthy();
      dialogButton(win, 'Cancel').click();
    });
  });
})();
