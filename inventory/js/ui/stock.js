// Stock view: one product at a time. Levels per location, the movement history, and four forms (receive, sell,
// adjust, transfer). Every form calls the stock rules through NS.stockOps; a refusal is shown in plain words.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const { h } = U;
  const $ = (id) => document.getElementById(id);
  let productId = null;
  let products = [];

  const onHandAt = async (id, loc) => { const r = await S.stock.onHand(id, loc); return r.ok ? r.value : '?'; };

  function say(text, bad) {
    const m = $('sMsg');
    m.textContent = text;
    m.className = `msg ${bad ? 'bad' : 'ok'}`;
  }

  /** Runs one stock action and reports it. ok(r) gives the success line; a refusal shows its plain reason. */
  async function act(promise, okText) {
    const r = await promise;
    if (!r.ok) { say(U.refusal(r), true); return false; }
    say(await okText(r));
    return true;
  }

  async function fillProducts() {
    const r = await S.store.list('products');
    products = r.ok ? r.value.slice().sort((a, b) => a.name.localeCompare(b.name)) : [];
    if (!products.some((p) => p.id === productId)) productId = products.length ? products[0].id : null;
    $('sProduct').replaceChildren(...products.map((p) => h('option', { value: p.id, selected: p.id === productId }, `${p.name} (${p.sku})`)));
    $('sProduct').disabled = !products.length;
  }

  /** Every location name in use, for the datalists. */
  async function fillLocations() {
    const m = await S.store.list('stockMovements');
    const names = new Set(['main', 'back']);
    if (m.ok) for (const x of m.value) names.add(x.location);
    $('locations').replaceChildren(...[...names].sort().map((n) => h('option', { value: n })));
  }

  async function draw() {
    const st = NS.state.settings || { currency: 'USD', locale: 'en-US' };
    const p = products.find((x) => x.id === productId);
    $('sTitle').textContent = p ? `${p.name} (${p.sku})` : 'No products yet';
    if (!p) { $('sLevels').replaceChildren(h('li', { class: 'empty', text: 'Add a product in the Products tab first.' })); $('sHistory').replaceChildren(); $('sTotal').textContent = ''; return; }
    const lv = await S.stock.levels(p.id);
    const levels = lv.ok ? Object.entries(lv.value).sort(([a], [b]) => a.localeCompare(b)) : [];
    const total = levels.reduce((s, [, q]) => s + q, 0);
    $('sLevels').replaceChildren(...(levels.length ? levels : [['main', 0]]).map(([loc, q]) =>
      h('li', null, h('span', { text: loc }), h('b', { class: 'num', text: `${q} ${p.unit || 'each'}` }))));
    $('sTotal').textContent = `Total on hand ${total} ${p.unit || 'each'} · value ${U.money(S.money.mulDiv(total, p.price, 1), st.currency, st.locale)} at price`;
    const hist = await S.store.list('stockMovements', { index: 'productId', value: p.id });
    const moves = hist.ok ? hist.value.slice().sort((a, b) => b.createdAt - a.createdAt) : [];
    $('sHistory').replaceChildren(...(moves.length ? moves : []).map((m) => h('li', { class: m.qty < 0 ? 'out' : 'in' },
      h('span', { class: 'mono', text: m.date }),
      h('span', { text: `${m.reason} · ${m.location}` }),
      h('b', { class: 'num', text: m.qty > 0 ? `+${m.qty}` : String(m.qty) }),
      m.ref ? h('span', { class: 'sub mono', text: m.ref.length > 28 ? `${m.ref.slice(0, 26)}…` : m.ref } ) : null)));
    if (!moves.length) $('sHistory').replaceChildren(h('li', { class: 'empty', text: 'No movements yet.' }));
  }

  async function refresh() {
    await fillProducts();
    await fillLocations();
    await draw();
  }

  function mount() {
    $('sProduct').addEventListener('change', (e) => { productId = e.target.value; say(''); draw(); });
    $('fReceive').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!productId) return say('Choose a product first.', true);
      const loc = U.cleanLocation($('rLoc').value);
      const qty = U.wholeOf($('rQty').value);
      const note = $('rNote').value.trim() || undefined;
      if (await act(NS.stockOps.receive({ productId, location: loc, qty, note }), async () => `Received ${qty} at ${loc}. On hand there: ${await onHandAt(productId, loc)}.`)) $('rQty').value = '';
    });
    $('fSell').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!productId) return say('Choose a product first.', true);
      const loc = U.cleanLocation($('sellLoc').value);
      const qty = U.wholeOf($('sellQty').value);
      const allowNegative = $('sellNeg').checked;
      if (await act(NS.stockOps.sell({ productId, location: loc, qty, allowNegative }), async () => `Sold ${qty} from ${loc}. On hand there: ${await onHandAt(productId, loc)}.`)) $('sellQty').value = '';
    });
    $('fAdjust').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!productId) return say('Choose a product first.', true);
      const loc = U.cleanLocation($('adjLoc').value);
      const qty = U.wholeOf($('adjQty').value);
      const allowNegative = $('adjNeg').checked;
      if (await act(NS.stockOps.adjust({ productId, location: loc, qty, allowNegative }), async () => `Adjusted by ${qty > 0 ? '+' : ''}${qty} at ${loc}. On hand there: ${await onHandAt(productId, loc)}.`)) $('adjQty').value = '';
    });
    $('fTransfer').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!productId) return say('Choose a product first.', true);
      const from = U.cleanLocation($('trFrom').value);
      const to = U.cleanLocation($('trTo').value);
      const qty = U.wholeOf($('trQty').value);
      await act(NS.stockOps.transfer({ productId, from, to, qty }), async () => `Moved ${qty} from ${from} to ${to}.`);
    });
  }

  /** A small dialog for the command palette: pick a product, a quantity and a location, then act. */
  function quick(kind) {
    S.store.list('products').then((r) => {
      const list = (r.ok ? r.value : []).slice().sort((a, b) => a.name.localeCompare(b.name));
      if (!list.length) return UI.alert('No products', 'Add a product first.');
      const pick = h('select', { class: 'sui-input' }, list.map((p) => h('option', { value: p.id, selected: p.id === productId }, `${p.name} (${p.sku})`)));
      const qty = h('input', { class: 'sui-input', type: 'number', min: 1, step: 1, value: 1 });
      const from = h('input', { class: 'sui-input', type: 'text', value: 'main', list: 'locations' });
      const to = h('input', { class: 'sui-input', type: 'text', value: 'back', list: 'locations' });
      const fields = [U.h('label', { class: 'frow' }, 'Product', pick), U.h('label', { class: 'frow' }, 'Quantity', qty)];
      if (kind === 'transfer') fields.push(U.h('label', { class: 'frow' }, 'From', from), U.h('label', { class: 'frow' }, 'To', to));
      else fields.push(U.h('label', { class: 'frow' }, 'Location', from));
      const titles = { receive: 'Receive stock', sell: 'Sell stock', adjust: 'Adjust stock', transfer: 'Transfer stock' };
      const run = async () => {
        const id = pick.value;
        const n = U.wholeOf(qty.value);
        if (kind === 'receive') return act(NS.stockOps.receive({ productId: id, location: from.value, qty: n }), async () => `Received ${n}.`);
        if (kind === 'sell') return act(NS.stockOps.sell({ productId: id, location: from.value, qty: n }), async () => `Sold ${n}.`);
        if (kind === 'adjust') return act(NS.stockOps.adjust({ productId: id, location: from.value, qty: n }), async () => `Adjusted by ${n}.`);
        return act(NS.stockOps.transfer({ productId: id, from: from.value, to: to.value, qty: n }), async () => `Moved ${n}.`);
      };
      UI.dialog({ title: titles[kind] || 'Stock', body: U.h('div', null, fields), buttons: [{ label: 'Cancel' }, { label: 'Apply', primary: true, act: run }] });
    });
  }

  NS.stockView = { select: (id) => { productId = id; }, quick };
  NS.views = NS.views || {};
  NS.views.stock = { mount, refresh, onShow: (arg) => { if (arg) productId = arg; return refresh(); } };
})(typeof window !== 'undefined' ? window : globalThis);
