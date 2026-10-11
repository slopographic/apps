// Random sample documents for Slop Invoices and Slop Orders. Pure: SlopDocs.samples.plan(seed, env) draws a plan from one
// seeded generator (the same mulberry32 and FNV-1a as shared/templates/rng.js, repeated here because these are classic
// scripts). The same seed and the same environment always give the same plan. No storage, no Math.random in plan().
// The plan is saved by samples-run.js through the app's own functions, so every rule of the data layer still applies.
// Money is integer minor units; tax rates and discounts are basis points (SlopDocs.model rules). Classic script.
(function (g) {
  'use strict';
  const NS = (g.SlopDocs = g.SlopDocs || {});
  const M = NS.model;
  const samples = (NS.samples = NS.samples || {});

  const MAX_DOCS = 50, MAX_LINES = 6, MAX_QTY = 12, MAX_SEED = 40;
  const TAX_RATES = [0, 500, 700, 1000, 2000];         // 0%, 5%, 7%, 10%, 20%
  const DISCOUNTS = [500, 1000, 1500, 2000, 2500];     // 5% to 25% off the line net
  const ADJ = ['Birch', 'Harbor', 'Copper', 'Granite', 'Maple', 'Juniper', 'Ember', 'Northwind', 'Slate', 'Willow', 'Quarry', 'Atlas', 'Cedar', 'Lumen', 'Kestrel', 'Orchard'];
  const NOUN = ['Studio', 'Works', 'Supply', 'Labs', 'Goods', 'Trading', 'Industries', 'Design', 'Press', 'Foundry', 'Stationers', 'Garden'];
  const FIRST = ['Mara', 'Jonas', 'Priya', 'Tomas', 'Ines', 'Kofi', 'Lena', 'Oscar', 'Yuki', 'Dara', 'Felix', 'Noor'];
  const LAST = ['Okafor', 'Lindqvist', 'Shah', 'Moreau', 'Varga', 'Tanaka', 'Brennan', 'Adeyemi', 'Costa', 'Hale'];
  const MAT = ['Brass', 'Oak', 'Linen', 'Ceramic', 'Steel', 'Canvas', 'Wool', 'Glass', 'Rubber', 'Paper'];
  const ITEM = ['hinge', 'bracket', 'tray', 'lamp', 'notebook', 'bottle', 'rope', 'mug', 'kit', 'crate', 'stool', 'basket'];
  const NOTES = ['Sample record for testing. Safe to delete.', 'Random sample: no real customer.', 'Net 30, sent by e-mail.',
    'Please leave at the side door.', 'Call before delivery.', 'Gift wrap requested.'];

  /** A 32-bit hash of any string (FNV-1a, then a final avalanche). Same as shared/templates/rng.js. */
  function hashSeed(text) {
    let h = 0x811c9dc5;
    const s = String(text);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  }

  /** A generator seeded from a string: next() in [0, 1), int(lo, hi) inclusive, pick(list), chance(p). */
  function rng(seed) {
    let a = hashSeed(seed);
    const next = () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {
      next,
      int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
      pick: (list) => list[Math.floor(next() * list.length)],
      chance: (p) => next() < p,
    };
  }

  /** A new seed: six characters of base 36. The caller may pass rand (Math.random by default). */
  const newSeed = (rand = Math.random) => Math.floor(rand() * 36 ** 6).toString(36).padStart(6, '0');

  const pad = (n, w) => String(n).padStart(w, '0');
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
  /** A catalogue price in minor units, 1.00 to 250.00 in steps of 0.50. */
  const randomPrice = (r) => r.int(2, 500) * 50;
  /** Whole days between two ISO dates (UTC arithmetic on the calendar, no clock). */
  const utcDay = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const dayCount = (from, to) => Math.round((utcDay(to) - utcDay(from)) / 86400000);

  /** A customer record for the customers collection (a sample, so it can be deleted with the others). */
  function customerRecord(r) {
    const first = r.pick(FIRST), last = r.pick(LAST);
    const company = `${r.pick(ADJ)} ${r.pick(NOUN)}`;
    const asCompany = r.chance(0.6);
    const name = asCompany ? company : `${first} ${last}`;
    const phone = `+1 555 ${r.int(100, 999)} ${r.int(1000, 9999)}`;
    return { name, email: `${slug(name)}@example.test`, phone, stage: 'customer', sample: true };
  }

  /** A product record. The SKU is the first SMP-nnn that the catalogue does not use (taken is updated). */
  function productRecord(r, taken) {
    const name = `${r.pick(MAT)} ${r.pick(ITEM)}`;
    const price = randomPrice(r);
    const taxRate = r.pick(TAX_RATES);
    let n = 1;
    while (taken.has(`SMP-${pad(n, 3)}`)) n++;
    const sku = `SMP-${pad(n, 3)}`;
    taken.add(sku);
    return { sku, name, price, taxRate, unit: 'each', sample: true };
  }

  /** Why the options are not usable, or null. Checked before anything is saved. */
  function checkOptions(o) {
    if (!Number.isInteger(o.count) || o.count < 1 || o.count > MAX_DOCS) return `Documents must be a whole number from 1 to ${MAX_DOCS}`;
    if (String(o.seed ?? '').length > MAX_SEED) return `The seed can be ${MAX_SEED} characters at most`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(o.to || '')) return 'Enter both dates of the range';
    if (o.from > o.to) return 'The range starts after it ends';
    if (dayCount(o.from, o.to) > 3650) return 'The date range can be ten years at most';
    if (!/^[A-Z]{3}$/.test(o.currency || '')) return 'Choose a currency';
    return null;
  }

  /**
   * One sample document as a plan (no ids yet). env: { kind: 'invoice' | 'order', currency, base, from, to, paymentTermsDays,
   * missing: { customers, products }, customers: [{ id, name }], products: [{ id, sku, name, price, taxRate }], skus: Set }.
   * Returns { seed, customerId | newCustomer, newProducts: [record], lines: [line], date, dueDate?, notes, currency } or { error }.
   * A line's ref is { id } for a catalogue product, { n } for newProducts[n], or null for a custom line.
   */
  function plan(seed, env) {
    const r = rng(String(seed));
    const customers = env.customers || [];
    const u = r.next();   // the customer draw comes first, whatever the list holds
    const out = { seed: String(seed), customerId: null, newCustomer: null, newProducts: [], lines: [], date: '', dueDate: undefined, notes: '', currency: env.currency };
    if (customers.length) out.customerId = customers[Math.floor(u * customers.length)].id;
    else if (env.missing && env.missing.customers) out.newCustomer = customerRecord(r);
    else return { error: 'There are no customers yet. Add one, or turn on "Create missing customers".' };

    out.date = M.addDays(env.from, r.int(0, dayCount(env.from, env.to)));
    if (env.kind === 'invoice') out.dueDate = M.addDays(out.date, env.paymentTermsDays);
    out.notes = r.pick(NOTES);

    const pool = (env.products || []).map((p) => ({ ref: { id: p.id }, sku: p.sku, name: p.name, price: p.price, taxRate: p.taxRate }));
    const sameCurrency = env.currency === env.base;
    const taken = new Set(env.skus || []);
    const lineCount = r.int(1, MAX_LINES);
    for (let i = 0; i < lineCount; i++) {
      if (!pool.length && env.missing && env.missing.products) {
        const rec = productRecord(r, taken);
        out.newProducts.push(rec);
        pool.push({ ref: { n: out.newProducts.length - 1 }, sku: rec.sku, name: rec.name, price: rec.price, taxRate: rec.taxRate });
      }
      const custom = `${r.pick(MAT)} ${r.pick(ITEM)}`;
      const unit = randomPrice(r);
      const rate = r.pick(TAX_RATES);
      const qty = r.int(1, MAX_QTY);
      const discount = r.chance(0.25) ? r.pick(DISCOUNTS) : 0;
      const p = pool.length ? r.pick(pool) : null;
      // A catalogue price is used only in the base currency: the prices of another currency are drawn fresh.
      const line = p
        ? { ref: p.ref, sku: p.sku, description: p.name, qty, unitPrice: sameCurrency ? p.price : unit, taxRate: p.taxRate }
        : { ref: null, description: custom, qty, unitPrice: unit, taxRate: rate };
      if (discount) line.discount = discount;
      out.lines.push(line);
    }
    return out;
  }

  Object.assign(samples, { MAX_DOCS, MAX_LINES, MAX_QTY, TAX_RATES, DISCOUNTS, hashSeed, rng, newSeed, checkOptions, plan, dayCount, randomPrice, customerRecord, productRecord });
  samples.normalizeSeed = (s, rand) => String(s ?? '').trim().slice(0, MAX_SEED) || newSeed(rand);
})(typeof window !== 'undefined' ? window : globalThis);
