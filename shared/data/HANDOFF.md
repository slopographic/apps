# shared/data: business records (the contract for the apps)

One source of truth for customers, products, orders, invoices, payments, accounts, the journal, settings,
stock movements, stock counts and document numbering. Browser-only, no build step, no accounts. Storage is
IndexedDB `slop-data`, one object store per collection. Nothing else may define these shapes or write the store.

## Load it (classic scripts, in this order; all of them, because modules call each other at run time)

```html
<script src="…/shared/data/money.js"></script>
<script src="…/shared/data/barcode.js"></script>
<script src="…/shared/data/schema.js"></script>
<script src="…/shared/data/store.js"></script>
<script src="…/shared/data/numbering.js"></script>
<script src="…/shared/data/ledger.js"></script>
<script src="…/shared/data/stock.js"></script>
<script src="…/shared/data/billing.js"></script>
<script src="…/shared/data/bundle-check.js"></script>
<script src="…/shared/data/export.js"></script>
```

Everything hangs off `window.SlopData`: `money`, `barcode`, `schema`, `result`, `store`, `numbering`, `ledger`,
`stock`, `billing`, `bundleCheck`, `exporter`. The Node tests load the same files in a vm context (`tests/node/data-env.mjs`).

## Result shape (every async call)

Every public async call **resolves and never rejects**: `{ ok: true, value }` or
`{ ok: false, code, message, errors? }`. `errors` is `[{ field, message }]` for validation failures.
Codes: `invalid`, `invalid_transition`, `immutable`, `posting_required`, `deleted`, `not_found`, `forbidden`,
`in_use`, `conflict`, `duplicate_source`, `unbalanced`, `insufficient_stock`, `overpayment`, `has_payments`,
`quota`, `blocked`, `unavailable` (no IndexedDB), `idb`, `aborted`.

## Money and tax (money.js)

- Amounts are **integer minor units** (cents). `$12.34` is `1234`. Never floats.
- Tax rates are **integer basis points**: `2000` = 20.00%.
- **Rounding: half away from zero** (ties go up in magnitude: 0.5 -> 1, 2.5 -> 3, -0.5 -> -1). All products use BigInt.
- Line: `net = qty * unitPrice` (exact), `tax = round(net * taxRate / 10000)`, `total = net + tax`. Prices are tax-exclusive.
- Document: `subtotal = sum(net)`, `tax = sum(line tax)` (rounded per line, then summed), `total = subtotal + tax`.
  `documentTotals(lines).byRate` gives the tax breakdown.
- `parseMinor('12.5')` -> `1250`, or `null` (never rounds typed text; too many decimals is `null`).
- `formatMinor(1234, 'USD', 'en-US')` -> `"$12.34"` via `Intl.NumberFormat` only. Settings hold `currency` and `locale`.
- Largest stored amount: `money.MAX_MINOR` (9e12).

## Collections (schema.js: `schema.def(name)`, `schema.COLLECTIONS`)

| collection | key | notes |
|---|---|---|
| `settings` | `id` ('main') | companyName, address, taxNumber, currency (USD), locale (en-US), defaultTaxRate, paymentTermsDays |
| `customers` | `id` | name*, email, phone, address, `categories[]` (tags), `stage` lead\|contacted\|customer\|lost (default lead). **Soft delete.** |
| `products` | `id` | sku* (no spaces, unique), `ean` (optional, unique, GS1 check digit), name*, price* (minor), taxRate* (bp), unit |
| `orders` | `id` | number (ORD-0001, auto), customerId*, date*, status open\|fulfilled\|cancelled, `lines[]`*, totals. Never deleted: cancel. |
| `invoices` | `id` | number (INV-0001, assigned on issue), customerId*, date*, dueDate, status draft\|issued\|paid\|void, `lines[]`, totals, orderId. **Soft delete, drafts only.** |
| `payments` | `id` | invoiceId*, amount* (> 0), date*, method cash\|bank\|card\|other. Immutable. |
| `accounts` | `code` (4 digits) | name*, type asset\|liability\|equity\|revenue\|expense. Never deleted. |
| `journal` | `id` | date*, memo, source* (unique, e.g. `invoice:<id>:issue`), `lines[{account, debit, credit}]`, reverses. Immutable. |
| `stockMovements` | `id` | productId*, location (default main), qty* (signed, non-zero), reason receipt\|sale\|adjustment\|transfer\|count\|return, date*, ref. Immutable. |
| `stockCounts` | `id` | location*, date*, `lines[{productId, expected, counted, diff}]`, status posted. Immutable. |
| `numbering` | `id` ('invoice', 'order') | prefix, pad, next. Only moves forward. |

`*` = required. Every record also carries `createdAt`, `updatedAt` (ms), `version` (starts at 1, +1 per save), and
`deletedAt` for soft-deleted records. Those are stamped by the store; callers never set them.

Default chart (`schema.DEFAULT_CHART`, seeded on first open): 1000 Cash, 1010 Bank, 1200 Accounts Receivable,
2100 Sales Tax Payable, 3000 Equity, 4000 Sales Revenue, 5000 Expenses. `schema.ACCT` has the codes.

Rules enforced by `schema.js` and `store.js`:
- Unknown fields are refused. Text is trimmed, blanks are dropped, defaults applied, and totals are always
  recomputed from `lines` (callers cannot set them).
- `prepare(name, input)` normalises and validates. `validate(name, record)` checks a stored shape (needs `id`).
- Issued invoices: `customerId`, `date`, `dueDate`, `number`, `lines`, `notes`, totals are frozen. Status moves
  only draft->issued->paid|void (issued->void). Orders: open->fulfilled|cancelled, then frozen.
- Invoice status can change only through `billing` (`store.put` refuses it otherwise).
- `journal`, `payments`, `stockMovements`, `stockCounts` are `postingOnly`: only `ledger`, `billing` and `stock` write them.
- Journal lines: each has exactly one positive side (debit or credit), whole amounts, and the entry balances.
- Stock sign rules: receipt and return add (+), sale removes (-), adjustment, count and transfer are non-zero.
- Products with stock movements cannot be deleted (`in_use`). Unique: sku, ean, invoice number, order number, journal source.

## store.js: storage

- `store.ready()` opens the DB and seeds defaults (idempotent). Other calls do this implicitly.
- `store.get(name, id, { includeDeleted? })` -> `value` record or `null`.
- `store.list(name, { index?, value? | lower?/upper?, includeDeleted?, filter?, limit? })` -> array.
  Indexes: customers `name`, `stage`, `categories` (multi-entry tag); products `sku`, `ean`, `name`;
  invoices `number`, `customerId`, `status`, `date`; payments `invoiceId`, `date`; journal `source`, `date`, `reverses`; etc.
- `store.put(name, record, { posting? })` -> saved record. `store.remove(name, id)` -> `{ id, soft }`.
- `store.transact(fn)`: `fn(tx)` runs in ONE read-write transaction over every store. `tx` has
  `get(name, id)`, `list(name, opts)`, `put`, `remove`, `allocate(seq)`, and `fail(result)`. A failed step, or
  returning a failed Result, rolls back everything. Only IndexedDB work may happen inside `fn` (no fetch, no timers).
- `store.readAll(fn)`: `fn(tx)` in one read-only transaction (same `tx.get`/`tx.list`).
- `store.subscribe(({ changes: [{collection, id, kind}], source })` -> unsubscribe. `source` is `local` or `remote`
  (other tabs, through BroadcastChannel). Fires only after a commit.
- `store.newId()` (UUID). `store.erase()` deletes the whole database (destructive; confirm in the UI).

## numbering.js

- `numbering.next('invoice')` -> `"INV-0007"` in its own transaction. `numbering.peek(name)` -> the next one.
- Inside `store.transact`, `numbering.allocate(tx, name)`. Invoices take a number when they are issued;
  orders take one on creation (`autoNumber` in the schema). The number commits or rolls back with the document, so there are no gaps.
- `format(seq, n)`, `parse('INV-0007')`, `take(seq)` are pure.

## ledger.js (double entry)

- `ledger.postJournal({ date, memo, source, lines: [{ account, debit, credit }] })` -> entry. Refuses unbalanced
  entries, unknown or non-integer amounts, and a `source` already posted (`duplicate_source`).
- `ledger.reverseJournal(id, { date?, memo? })` -> reversing entry (source `reversal:<id>`, so one reversal per entry).
  Posted entries are immutable: `store.put`/`remove` return `immutable`.
- `ledger.trialBalance()` -> `{ rows: [{ code, name, type, debit, credit, balance }], debit, credit, balanced, errors }`
  as a Result. Fails with `unbalanced` (and `summary`) when the totals disagree.
- Pure: `ledger.validateEntry(entry, accounts?)`, `ledger.summarize(entries, accounts)`, `ledger.reverseLines(lines)`.

## billing.js (the only way to issue, pay or void)

- `billing.issue(invoiceId)`: draft -> issued. Numbers it, posts Dr AR total, Cr Sales Revenue subtotal, Cr Sales Tax Payable tax.
  Needs an existing customer. Zero-total invoices post nothing.
- `billing.recordPayment({ invoiceId, amount, date?, method?, note? })`: partial or full. Cash debits Cash (1000), others Bank (1010).
  Credits AR. Marks the invoice paid when nothing is due. Refuses overpayment.
- `billing.voidInvoice(invoiceId)`: issued -> void, only while there are no payments. Reverses the issue entry. The number stays used.
- Pure: `billing.invoiceLines(invoice)`, `billing.paidOn(payments)`, `billing.balanceDue(invoice, payments)`.

## stock.js

- Stock on hand is never stored. It is the sum of movements.
- `stock.onHand(productId, location?)`, `stock.levels(productId)` -> `{ location: qty }`.
- `stock.move({ productId, location, qty, reason, date?, ref?, note? })`. A negative movement that would take the
  location below zero fails with `insufficient_stock` unless `allowNegative: true`.
- `stock.transfer({ productId, from, to, qty, date?, note? })`: two movements sharing a `transfer:` ref.
- `stock.postCount({ location, date?, counts: [{ productId, counted }], notes? })`: one `count` movement per
  difference and one `stockCounts` record, in one transaction.
- `stock.lowStock(threshold)` -> `[{ productId, sku, name, onHand }]`, lowest first.
- `stock.lookupBarcode(code)` -> product or `null`. Tries the EAN (if the check digit is valid), then the SKU.
- Pure: `onHandOf`, `levelsOf`, `lowStockRows`, `countRows`.

## barcode.js

- `barcode.isValidEan(code)` (8, 12, 13 or 14 digits with a valid GS1 check digit), `barcode.checkDigit(body)`,
  `barcode.normalizeEan(text)` (strips spaces and hyphens).

## export.js and bundle-check.js

- `exporter.exportFile()` -> `{ name: 'slop-data-YYYY-MM-DD.json', blob }` (every record, deleted ones included).
  `exporter.exportBundle()` -> the plain object.
- `exporter.importBundle(objectOrJsonText)`: validates the **whole** file first (`bundleCheck.validateBundle`:
  format and version, every record against the schema, unique keys, references, balanced ledger, gapless
  invoice and order numbers with the counter past the last one). Only then does it replace every collection in
  one transaction. A bad file changes nothing; the result has `errors`.
- `bundleCheck.validateBundle(bundle)` -> `{ ok, errors: [string] }` is pure and can be used to preview a file.

## Tests

- `node tests/run.mjs data` runs `tests/node/data.test.mjs` and `tests/node/data-ledger.test.mjs` (pure logic, no storage)
  and the browser pages `tests/data/store.test.html` (IndexedDB behaviour: validation, soft delete, uniqueness,
  transactions and rollback, numbering rollback, subscribers) and `tests/data/flows.test.html` (issue, payments,
  voids, reversals, stock, counts, export and import).

## Not built yet (decide before the apps need it)

- Refunds and credit notes: a paid or part-paid invoice cannot be voided, and payments cannot be removed. A refund record is needed.
- Discounts on lines, multiple currencies on one document, fractional quantities (quantities are whole numbers).
- Revenue accounts per product (all sales credit 4000 Sales Revenue), and tax-inclusive pricing.
- Order-to-invoice conversion, due-date reminders, and aged receivables reports.
- Accounts cannot be deactivated or deleted, and there is no UI or rule for renaming them safely once used.
- Cross-tab conflict UI: the transactions serialise writes correctly, but the apps must re-read on `subscribe` events.
- Authorisation. Posting-only checks protect integrity inside the app, not against a malicious script.
