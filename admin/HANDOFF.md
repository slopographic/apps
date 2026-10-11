# Slop Admin (admin/)

The local admin area: company profile, numbering sequences, tax rates in use, data overview, full backup and
restore, storage status, and reset. Browser only, local only. Rules come from `shared/data` (`schema.js`, `store.js`,
`bundle-check.js`, `export.js`) and `shared/pwa.js` (the storage message).

## What works
- **Company**: name, tax number, address, default currency (must be a listed ISO code), locale (a language tag), and the
  default tax rate as a percentage (stored in basis points, so 7.5 is 750). A currency change is refused once any
  journal entry exists, and the message says why.
- **Numbering**: invoice and order sequences with prefix, digits and next number. A live preview shows the next number.
  The next number can only move forward (the schema refuses a lower one); numbers already issued are never reused.
- **Tax rates**: the rates that products use, with how many products carry each one, and the default for new lines.
- **Data**: live and deleted record counts for every collection.
- **Backup**: downloads the full bundle (every record, deleted ones included) as `slop-data-YYYY-MM-DD.json`.
- **Restore**: reads the chosen file and checks the whole bundle first. A broken or non-JSON file is refused with its
  first error and nothing is changed. A good file asks for confirmation, then replaces every collection in one
  transaction.
- **Reset**: a SlopUI dialog. Typing `RESET` is required; the full backup downloads first, and only then is the
  database erased and the defaults seeded again. Anything other than the typed word changes nothing.
- **Storage**: space used and quota (`navigator.storage.estimate`), the browser's answer on keeping data, the message
  from `SlopPWA.persistMessage`, and a button to ask the browser to keep the data.
- SlopCmd commands, SlopHub registration, SlopGuard, 390 px layout.

## Limits
- There is no separate tax-rate table in the shared model. Rates belong to products (set in Slop Inventory), so this
  tab lists them and cannot add or change one.
- The product catalogue is kept in Slop Inventory. This app links to it and does not copy it.
- A change to the prefix or digits affects new numbers only.
- Restore replaces everything; there is no merge. Backups from version 1 (with a `currency` setting) are refused by the
  shared bundle check.
- Reset cannot tell whether the browser blocked the download; the erase happens after the download is started.
- Admin has no row lists, so there are no row context menus here; its actions are buttons and commands.
- Tests: `node tests/run.mjs admin` (tests/admin/admin.test.html).
