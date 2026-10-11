# Slop Orders: handoff

Customers, products and orders with stock, fulfilment and one-click conversion to an invoice. Browser only, no build
step, no network. Every record goes through `SlopData` (see `shared/data/HANDOFF.md`): `SlopData.store` for orders and
customers, `SlopData.stock` for fulfilment, `SlopData.billing.invoiceFromOrder` for conversion, `SlopData.exporter` for
backups. Money is integer minor units; the line maths is `SlopDocs.model` and `SlopData.money`.

## Files

- `index.html`: the page (Orders list, Order editor, Data). Loads `shared/data`, `shared/docs`, the core and the UI.
- `css/orders.css`: tokens (dark by default, `data-theme="light"`), order rows, form, line cards. Works at 390 px.
- `js/core/util.js`: refusals in plain words, settings, money formatting, the DOM builder.
- `js/core/orders.js`: list with status filter and search, customers, products, save, status change, cancel.
- `js/core/fulfil.js`: fulfilment through `SlopData.stock`.
- `js/core/actions.js`: confirm, convert, fulfil and cancel by id (shared by the list menu and the editor).
- `js/ui/list.js`: the list, row menu (right-click or Menu key).
- `js/ui/editor.js`: one order: customer, date, notes, lines, totals, the actions for its status.
- `js/ui/app.js`, `commands.js`, `data.js`: boot and routes (`#list`, `#new`, `#o/<id>`, `#data`), SlopCmd commands,
  backup and restore.
- Shared with invoices, in `shared/docs/`: `model.js` (percent and money text, line totals, `addDays`, status names),
  `lines.js` (line cards and totals box), `customer-dialog.js` (New customer).

## What works

- Orders: draft, then confirmed, then fulfilled or cancelled. Only the transitions the data layer allows are offered.
  A draft is saved with "Save draft"; "Confirm order" makes it confirmed.
- Lines: product (from the catalogue, with SKU and price; or a custom line), description, quantity, unit price, tax %,
  discount %. Tax and discount are typed as percentages. Totals: subtotal, tax by rate, total.
- Customers: pick from the customers collection, or "New customer" inside the order (stored as a customer).
- Fulfil: checks stock first (main location). Then one `sale` movement per product line, with the order number as the
  reference, and the order becomes fulfilled. Not enough stock refuses and changes nothing.
- Convert to invoice: one click. The invoice draft gets the lines, customer, currency and notes; the due date is the
  order date plus the payment terms. The order keeps its link ("Invoice: draft" or the number). A second convert is
  refused.
- List: search (number, customer, notes), status filter, newest first. Right-click (or Menu key) on a row: Open, Confirm,
  Fulfil, Cancel, Convert, Open invoice, as the status allows.
- Data: full backup download, and restore through the validated import (a bad file changes nothing).
- SlopCmd commands (Ctrl+K), SlopGuard (unsaved edits warn before leaving), SlopHub registration.

## Data written

- `orders` (create, edit while draft or confirmed, status changes, `invoiceId`), `customers` (inline adds),
  `stockMovements` (only through `SlopData.stock`: `sale` on fulfil, `return` when a fulfil is undone), `invoices`
  (drafts from conversion only). The order number comes from the `order` sequence.

## Limits

- The data layer's statuses are draft, open, fulfilled, cancelled. The `open` status is shown as "Confirmed".
- Fulfil takes stock from the `main` location only. It runs as one stock movement per line, not in a single
  transaction. Stock is checked first, and if a later step still fails the earlier movements are undone with `return`
  movements (the history keeps both sides).
- Quantities are whole numbers. Discounts are per line, as a percentage of the line net. Prices are tax-exclusive.
- The line currency is the order's currency (the base currency). No per-order currency choice in the UI.
- The editor does not redraw under you when the same order changes in another tab; the list does.
- No delete: cancel instead (the data layer's rule).
- Customers are chosen from the list; there is no customer editor here (use the invoices app or the data import).

## Tests

- `node tests/run.mjs orders` runs `tests/orders/orders.test.html`: totals with tax on two lines (34.99), the discount
  before tax, gapless order numbers, the editor's text parsers, the status path (draft, confirmed, fulfilled, no way
  back), fulfil taking stock out, fulfil refused with no stock and no change, convert copying the lines and linking
  both records, the second convert refused, a draft refused for conversion, and the list filter and search.
