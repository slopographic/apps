# Slop Invoices: handoff

Invoices from scratch or from an order: gapless numbers on issue, a posted ledger entry, payments, void while unpaid,
overdue balances, a printable invoice and a one-page PDF. Browser only, no build step, no network. Every record goes
through `SlopData`: drafts through `SlopData.store`; issue, payments and void through `SlopData.billing` (each writes the
journal in the same transaction); conversion from an order through `SlopData.billing.invoiceFromOrder`; backups through
`SlopData.exporter`. Money is integer minor units. The PDF uses the vendored pdf-lib.

## Files

- `index.html`: the page (Invoices list, Invoice editor, Print, Data). Loads `shared/data`, `shared/docs`, the core,
  the UI and `vendor/pdf-lib/pdf-lib.min.js`.
- `css/invoices.css`: tokens, rows, form, line cards, the printable sheet, and `@media print` (only the sheet prints).
- `js/core/util.js`: refusals in plain words, settings (company, terms, currency), money, the DOM builder.
- `js/core/invoices.js`: list with status and overdue, outstanding per customer and currency, customers, products,
  get with payments, save draft, remove draft, issue, record payment, void.
- `js/core/context.js`: one invoice for printing and PDF (customer, payments, balance, tax by rate, company block).
- `js/core/pdf.js`: the one-page A4 PDF with Helvetica (pdf-lib), up to 30 lines.
- `js/ui/list.js`: list, outstanding panel, row menu, "From an order…".
- `js/ui/editor.js`: one invoice: customer, dates, notes, lines, totals, payments, and the actions for its status.
- `js/ui/payment-dialog.js`: record a payment (amount defaults to the balance).
- `js/ui/preview.js`: the printable sheet, and the PDF download.
- `js/ui/print.js`: the Print view (browser print dialog, PDF, back).
- `js/ui/app.js`, `commands.js`, `data.js`: boot and routes (`#list`, `#new`, `#i/<id>`, `#p/<id>`, `#data`), SlopCmd
  commands, backup and restore.
- Shared with orders, in `shared/docs/`: `model.js`, `lines.js`, `customer-dialog.js`.

## What works

- Draft: customer, invoice date, due date (defaults to the date plus the payment terms), notes, lines. Save draft.
- Issue: confirmation, then `billing.issue`. The invoice gets the next number (INV-0001, gapless) and a journal entry:
  receivables for the total, sales revenue for the subtotal, sales tax payable for the tax. The entry balances.
- Payments: amount (defaults to the balance), date, method (bank, cash, card, other), note. Partial payments allowed. An
  amount above the balance is refused. The last payment marks the invoice paid.
- Void: only an issued invoice with no payments. The issue entry is reversed; the number stays used. Refused with
  payments (the button is disabled, and the data layer refuses the call too).
- Status list: draft, issued, paid, void, and overdue (issued, balance due, due date before today), overdue rows
  highlighted. Balances are computed from the payments; nothing is stored twice.
- Owed by customer: issued balances per customer and currency, with the overdue part.
- From an order: a dialog lists confirmed or fulfilled orders with no invoice and creates the draft (lines copied, the
  order keeps its link).
- Preview / print: the Print view shows the invoice sheet with the number, dates, customer, lines, discounts, tax by
  rate, total, paid and balance due. Print opens the browser's print dialog, and print CSS hides the app chrome.
- PDF: one A4 page with the same content. Export from the editor, the list menu or the Print view.
- Data: full backup download and validated restore. SlopCmd commands, SlopGuard, SlopHub registration.

## Data written

- `invoices` (drafts, issue, status changes made by billing only, `orderId`), `payments` (through billing only),
  `journal` (through billing only: issue, payment, void reversal), `customers` (inline adds). The invoice number comes
  from the `invoice` sequence, taken at issue.

## Limits

- No refunds or credit notes. A paid or part-paid invoice cannot be voided, and payments cannot be removed.
- Currency: new invoices take the base currency. The UI has no currency choice. (The data layer supports a foreign
  currency through rates; the UI does not offer it yet.) No realised exchange gain or loss.
- The PDF holds one page: up to 30 lines. More lines are refused with that reason; print the sheet instead (the
  browser splits it across pages). The PDF font is Helvetica, so characters outside Latin text become "?".
- Overdue is judged on the local date when the list is drawn. There are no reminders and no aged-receivables report.
- Payment methods are the four in the data layer.
- The editor does not redraw under you when the same invoice changes in another tab; the list does.
- Restore replaces every record, including the ledger; the confirmation says so.

## Tests

- `node tests/run.mjs invoices` runs `tests/invoices/invoices.test.html`: gapless numbers (a removed draft takes none),
  the issue entry (AR 29.00, revenue 25.00, tax 4.00) balancing and the trial balance balanced, drafts not posted, a
  draft editable and an issued invoice not, payments reducing the balance and marking it paid, an overpayment refused,
  void refused after a payment, void before a payment reversing the entry and keeping the number, overdue and the
  outstanding balance per customer, an order invoiced through the data layer, the printable preview listing the number,
  customer, lines and total, the PDF having one page, and a PDF with 31 lines refused.
