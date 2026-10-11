# Slop Ledger (ledger/)

A double-entry ledger on the shared store: chart of accounts, manual journal entries, the general ledger, the trial
balance, reversals, and exchange rates. Browser only, local only. All rules live in `shared/data` (`ledger.js`,
`fx.js`, `schema.js`); this app only checks typed input early and shows the message.

## What works
- **Journal**: a manual entry with a date, memo, currency and two or more lines. Each line has one debit or one
  credit. Live totals show the balance while you type. A line with no account, a line with both or neither side, fewer
  than two lines, or unbalanced totals is refused with a message, and nothing is posted (`Not posted. Debits (…) and credits (…) do not balance…`).
- **Foreign currency**: enter the amounts in the entry's currency. The shared module converts at the stored rate on the
  entry date and keeps the original amounts. Posted entries show the original and the base amount side by side.
- **Reverse**: each posted entry has a Reverse button (also in its right-click menu). The reversal is a new entry
  dated today, at the same rate for a foreign entry. An entry can be reversed once.
- **General ledger**: every line of one account in date order, with the running balance on its normal side.
- **Trial balance**: base-currency totals per account, the check that debits equal credits, and the foreign totals in
  their own currencies (not added to the base). A failed check is shown, with the summary rows.
- **Accounts**: add an account (four-digit code, name, type) and rename it. Refuses an existing code.
- **Rates**: add a manual rate (1 foreign = rate base, on a date). Optional ECB update: off until the "Allow online
  rate updates" box is ticked (the `rates` consent category), then one button fetches today's reference rates through
  `shared/data/rates-ecb.js`. The network request lives in shared code, not in this app.
- **CSV**: the trial balance and the journal download as CSV (plain decimal amounts, one row per journal line).
- SlopCmd commands, right-click menus on journal entries and accounts, SlopHub registration, SlopGuard, 390 px layout.

## Limits
- Posted entries cannot be edited or deleted; correct them with a reversal and a new entry.
- Realised and unrealised exchange gains and losses are not booked (the shared model does not have them yet).
- A foreign entry needs a rate on or before its date; there is no cross-rate through a third currency.
- Rate rows cannot be changed or removed; a correction is a new dated row.
- Accounts cannot be deleted or deactivated, and their type cannot change once added.
- Entries from other modules (for example invoices) appear in the journal and can be reversed here, but are not edited here.
- Amounts in CSV are plain decimals in the base or entry currency; no locale formatting.
- Tests: `node tests/run.mjs ledger` (tests/ledger/ledger.test.html).
