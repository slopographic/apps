# Slop CRM (crm/)

Customers, a pipeline board, dated notes, follow-ups, and each customer's orders and invoices. Browser only, local only.
All data is the shared business store (`shared/data/HANDOFF.md`): the `customers` collection, with `contactId` and
`followUp` added to its schema. Orders and invoices are read from their shared collections, never copied.

## What works
- **Pipeline**: one column per stage (lead, contacted, customer, lost). Drag a card to a column, use its Move button,
  right-click it, or press the Menu key on a focused card. Each move is saved at once and redraws the board.
- **Customers tab**: search by name, email, phone or address; filter by stage and category; row menu (Open, Edit,
  Move to, Delete). Delete is a soft delete behind a SlopUI confirmation.
- **Bulk actions**: tick rows (or select all shown) to change stage, add or remove a category, set a follow-up
  date, export CSV, or delete. Selection is held in `SlopCrm.selection` and pruned when customers disappear.
- **Two panes** (min-width 960 px): the list stays left and the detail panel is sticky on the right. Below that the
  detail is a full page with Back.
- **Detail panel**: contact details (mailto and tel links), stage, follow-up date, categories (comma separated),
  dated notes (newest first), orders and invoices with their status and totals.
- **Follow-ups tab**: customers with a follow-up date, overdue first, then today, then later. Done clears the date.
- **Import from Slop Contacts**: reads the newest `.scontacts` list from Slop Drive through SlopHub. Each contact
  becomes a lead with its name, first email and phone, address, groups as categories and note. A contact whose id
  is already on a customer (live or deleted) is skipped. The import is one transaction.
- SlopCmd commands, right-click and Menu-key menus, SlopHub registration, SlopGuard (via the shared script), 390 px layout.

## Storage format
- Notes are one text field in the shared model, so each note is a line `[YYYY-MM-DD] text`. A line without a date
  continues the note above it. An imported contact note has no date and shows as "Earlier".

## Limits
- Notes are append-only: there is no edit or delete for a single note yet.
- One follow-up date per customer.
- Contacts import is one-way and only creates customers. Later edits in Slop Contacts do not update a linked customer,
  and a deleted linked customer is never re-imported.
- Uniqueness of `contactId` is checked when the import is planned, not by a store index. Two tabs importing at the same
  moment could both add the same contact.
- Drag and drop needs a mouse or a stylus with HTML5 drag support; on touch, use the Move button.
- No duplicate detection by email or phone.
- Orders and invoices are read-only here (they are made in their own apps).
- Tests: `node tests/run.mjs crm` (tests/crm/crm.test.html).
