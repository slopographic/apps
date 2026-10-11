# Slop Contacts: handoff

Status: **building** (kept in shared/apps.js). Slop Contacts is an address book over the shared customer records
(SlopData `customers`, see shared/data/HANDOFF.md). The same customers are the CRM's and Orders' customers. There is
no separate contact store and no autosave draft: each change is written to the shared store at once. Nothing is
uploaded.

## Layout
- **Wide (960 px and up): three columns.** Left: Library (All Contacts, Recent), Groups (the categories, with counts;
  drag contacts onto one to add them), Pipeline (Lead, Contacted, Customer, Lost, with counts). Middle: a search field,
  the count, then the list under letter headers (A to Z, # last). Each row has an avatar (photo or initials), the name,
  and one line: the company, or the stage when there is no company. Right: the card.
- **The card, read:** a large avatar, the name, company and title; rows for phone, e-mail and address (each with its
  label: mobile, work, home, other), birthday and website; the groups as chips; Notes (the plain notes); Pipeline
  (stage picker and next follow-up date, saved at once); Orders and Invoices (read from the shared `orders` and
  `invoices` collections, with links to `../orders/#o/<id>` and `../invoices/#i/<id>`); Activity (dated notes, with a
  form to add one); Duplicate and Delete at the foot.
- **The card, edit:** Edit turns the card into a form in place (photo, name, company, department, title, phones,
  e-mails, addresses each with a label, birthday, website, groups, notes). Save writes it; Cancel asks first when
  something changed.
- **390 px (below 960):** the list is the screen. A contact opens the card as a full page with a back button. Groups
  open as a sheet from the ☰ button at the top of the list. The top bar keeps New, Import and Export. A test checks there
  is no horizontal scroll.
- **Style:** the system font, generous spacing, subtle separators, one accent (the Slopographic lime). Light and dark
  follow the system setting (`prefers-color-scheme`); `data-theme="light"` or `"dark"` on `<html>` overrides it.

## Files
- `index.html`: the page and the script order.
- `css/contacts.css` (tokens, shell, the three columns and the 390 px rules), `css/contacts-list.css` (groups, list,
  search, bulk bar), `css/contacts-card.css` (the card and the edit form), `css/contacts-ui.css` (the SlopUI dialogs).
- `js/core/` (pure, no DOM, under `SlopContacts.*`):
  - `text.js`, `model.js` (the contact shape the codecs use; `stage` and `followUp` pass through when set), `photo.js`,
    `phone.js`, `vcard-read.js`, `vcard-write.js`, `csv-read.js`, `csv-write.js`, `dedupe.js`, `bulk.js`, `zip.js`,
    `format.js` (the `.scontacts` JSON and the export table).
  - `customer-map.js`: a customer record to a contact and back. See "The shared record" below.
  - `activity.js`: splits a customer's notes into plain notes and dated notes (`[YYYY-MM-DD] text` lines), and joins them.
- `js/app/`:
  - `state.js`: the screen state (`SlopContacts.state`, S). `setList()` writes the difference unless `{ write: false }`.
  - `records.js`: the link to SlopData. Loads the customers, writes each list change as one transaction (changed
    contacts are put over the stored record, removed ones are soft-deleted), runs writes one after another, and reloads
    when another tab or app changes a customer while nothing is pending.
  - `list.js` (the middle column), `select.js` (click, Shift and Cmd click, select mode, arrows, Enter, Space, drag, the
    bulk bar, `remove()` with the confirm dialog), `groups.js` (the left column and the sheet).
  - `card.js` (chooses the card view), `card-read.js`, `card-edit.js`, `new-contact.js` (the quick form: name, phone,
    e-mail, company).
  - `io-dialogs.js` (import and export), `tools-dialogs.js` (duplicates, clean up, find and replace, add or remove a
    group, default country code), `photo-ui.js` (picking a photo, the avatar markup).
  - `keys.js` (Cmd+N, Cmd+F, Cmd+A, Delete and Backspace asking first, Escape), `commands.js` (SlopCmd commands and
    `data-cmd`), `main.js` (boot, and a `.scontacts` handed over from Slop Drive is imported).

## The shared record
- The list holds contacts (the codec model). `customer-map.js` is the only place that maps them to records:
  - `name` is the display name (the contact's full name). A vCard N field is split on the last word on export.
  - `phone`, `email`, `address` with `phoneLabel`, `emailLabel`, `addressLabel` are the first value of each kind. The
    rest are in `phones`, `emails`, `addresses` as `{ label, value }`. The first values are the ones other apps read.
  - `company`, `department`, `title`, `website`, `birthday`, `photo`, `notes`, `categories` (the groups), `stage`,
    `followUp`. `contactId` and any other field the screen does not show are kept on the record when a contact is saved.
  - Labels: mobile, work, home, other, or any text. Codec types map to labels (CELL to mobile, WORK, HOME, OTHER).
- Notes: the record's `notes` text holds the plain notes, then dated lines `[YYYY-MM-DD] text`. The card's Activity
  is those dated lines; Notes is the rest. The same format as Slop CRM.
- The contacts and the CRM show the same records. A contact added here appears in the CRM's Customers at once, and
  the other way round.

## Import and export
- **Import** (the toolbar, or the command palette): vCard, CSV and `.scontacts` files are read through the existing codecs and
  added as customers, each with a new id. Exact duplicates merge at once. A `.scontacts` handed over from Slop Drive
  (`?drive=`) is imported the same way.
- **Export**: vCard 3.0, one vCard per contact (zip), Google CSV, Outlook CSV, or `.scontacts`. The scope is the
  selection when there is one, otherwise every contact. Downloads only; nothing is saved to Slop Drive by this app.
- `.scontacts` stays a file format for import and export. It is not the storage any more.

## Actions
- New contact (the quick form, Cmd+N). Duplicate (a copy under a new id, opened in the form). Delete (a SlopUI dialog;
  Delete and Backspace ask too).
- Selection: a click opens the contact; Cmd or Ctrl click adds or removes a row; Shift click selects the range; Select
  mode makes every click a toggle (for touch). The bulk bar: add to group, set stage, delete, done.
- Drag a row (or a selection) onto a group in the left column to add it to that group.
- Keyboard: arrows move through the list and open each contact; Enter opens the card; Space toggles a row; Escape clears
  the selection, then closes the card or the sheet; Cmd+F searches; Cmd+A selects every shown contact (in the list).

## Tests
- `node tests/run.mjs contacts`: `tests/contacts/app.test.html` (the codec specs: vCard, CSV, duplicates, photos; and
  the app specs `contacts.spec-app.js` and `contacts.spec-card.js` on the real page and the shared store).
- `contacts.spec-app.js`: letter headers in order with # last; a row's second line; a new contact in its letter section
  and in the CRM's Customers; the orders and invoices of a customer from the shared collections with links; a contact
  with no orders; the 390 px layout (no horizontal scroll, list first, full-page card with back); arrows, Enter, Delete
  asking first; Cmd+N.
- `contacts.spec-card.js`: edit in place (CRM-only fields kept); Cancel asks; stage and follow-up saved at once; a dated
  note in Activity with the plain notes kept; shift, Cmd click and the bulk stage; drag onto a group; duplicate; a vCard
  import becomes customer records (labelled phones and e-mails, birthday, groups).
- Replaced in this change: `contacts.spec-app.js` (old Drive save and reopen, autosave draft, export to Drive, and the
  panel layout) and `contacts.spec-panel.js` (removed; its behaviour is in the card specs). The codec specs are unchanged.
- The shared `shared/data` schema gained the contact fields; the data tests were not run in this change.

## Known limits
- **Structured names are not kept**: a vCard N field becomes the display name. Name prefixes, middle names and
  suffixes are dropped on import. Export splits the name on its last word.
- **Addresses are one line**: the codec model flattens whitespace, so a line break in an address becomes a space when a
  contact is saved from here. Other apps' addresses keep their line breaks until a contact is saved.
- **Department and URL** are kept on the record (`department`, `website`); the vCard ADR parts beyond the street text
  are joined into one line.
- **Photos**: JPEG and PNG only; a photo picked in the form is at most 256 px. A link photo is kept as text and shows as
  initials. Photos are stored in the customer record. A photo over about 290 KB (390,000 characters as a data URI) is not kept
  when the contact is saved, and a value over another record limit (notes 5,000 characters, 10 phones, 10 e-mails, 10
  addresses, 20 groups) is cut, so one large contact cannot stop a whole import or bulk change.
- **Labels**: a custom Apple label becomes its letters as one type (for example `DADMAIL`) and shows lower case.
- **Outlook CSV** has fixed slots (see the codec); extra values are not written.
- **No undo** for bulk changes or deletes (deletes are soft in the store, so the CRM keeps the record out of view).
- **Rendering**: every row is in the DOM; fine for a few thousand contacts.
- **Two tabs** writing at once: each write is a transaction, but a change made in another tab while this tab has a write
  pending is picked up on the next reload, not at once.
- **Not verified in the real apps**: exported files were not imported into iOS, Android, Google Contacts or Outlook here.

## Not done
- Undo and redo for bulk changes.
- Sort options and column choice; a per-field merge chooser; "keep these two separate" for duplicates.
- Contacts import from Google or Outlook accounts (files only).
- `view-state.js` in `js/app/` is left from an earlier design (it refers to `storage.js`, which is gone) and is not loaded
  by the page. It should be deleted or rewritten when the place-keeping for this layout is built.
