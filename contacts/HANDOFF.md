# Slop Contacts: handoff

Status: **building** (kept in shared/apps.js). The core works end to end in the browser: import, duplicates,
bulk clean-up, groups, editing, Drive save and reopen, autosaved draft, and every export. It is fully local.
Several things are deliberately simple or missing (see "Not done" and "Known limits").

## Files
- `index.html`, `css/contacts.css` (tokens, page layout, top bar, 390 px stacking), `css/contacts-ui.css` (rows, selection bar, editor and review dialogs).
- `js/core/` (pure functions, no DOM, all under `SlopContacts.*`):
  - `text.js`: escapes, 75-octet folding (never splits a UTF-8 character), quoted-printable decoding, tidy.
  - `model.js`: the contact shape, `normalise()` (the only cleaner), birthday rules, FN fallback, `sameContent`.
  - `phone.js`: E.164 with a default country code (`toE164`), duplicate keys (phone digits, e-mail, name plus organisation).
  - `vcard-read.js`: vCard 2.1, 3.0 and 4.0 (folding, QP, escapes, several TEL/EMAIL/ADR with TYPE, Apple `itemN.X-ABLabel`, CATEGORIES as groups).
  - `vcard-write.js`: vCard 3.0 for iOS and Android (CRLF, every line at most 75 octets, N and FN always, escapes, BDAY as YYYY-MM-DD). Also writes NOTE, URL and UID so that a read gives the same data back.
  - `csv-read.js`: RFC 4180 with quoted line breaks; header mapping for Google, Outlook, Apple-style and generic headers; delimiter sniffing (comma, semicolon, tab).
  - `csv-write.js`: Google Contacts layout and Outlook layout, with a BOM.
  - `dedupe.js`: candidate groups (union-find, so chains join up), exact-copy detection, `mergeGroup`, `applyMerges`, `autoMergeExact`.
  - `bulk.js`: clean-up (trim, title case with particles, E.164, lowercase e-mail, remove empty), find and replace, add or remove group, delete.
  - `zip.js`: a small stored-zip writer with CRC-32 (written for this app; shares no code with cutout).
  - `format.js`: the `.scontacts` JSON (`format: "slop-contacts"`, `version: 1`) and the export table (vCard, vCard per contact in a zip, Google CSV, Outlook CSV).
- `js/store/drafts.js`: autosave draft in IndexedDB (`slop-contacts-drafts`), written 0.6 s after a change. Per viewer only.
- `js/app/`: `state.js` (state and events), `list.js` (group sidebar with counts, rows, search, selection), `editor.js` (contact dialog), `io-dialogs.js` (import, export), `tools-dialogs.js` (duplicates, clean up, find and replace, groups, delete, country code), `storage.js` (Drive open, save, launch), `commands.js` (SlopCmd registry and `data-cmd`), `main.js` (boot).

## How it works
- **Import** (toolbar Import, or Mod+I): vCard and CSV merge into the list. Ids that clash (a repeated UID) are renamed. Exact duplicates merge at once and a dialog reports the counts. A `.scontacts` file imported this way also merges.
- **Save**: `.scontacts` in Slop Drive (`from: 'contacts'`). First save asks for a folder; later saves overwrite the same record. A zero-byte `.scontacts` opens as a blank list that saves back to itself. Opening a vCard or CSV record gives an unsaved import, so Drive never gets a different format under a `.scontacts` name.
- **Launch order**: `?drive=<id>`, then the autosave draft, then a blank list. Drafts are not written until launch has finished, so an empty start cannot erase a draft.
- **Export**: each format downloads and is saved to the Drive root. Scope is the selection when there is one, otherwise all contacts.
- **Bulk actions** act on the selection when there is one, otherwise on every contact, and say so in the dialog.
- **Commands**: every main action is a SlopCmd command (`file.*`, `import.files`, `export.*`, `contacts.*`, `groups.*`, `settings.country`, `view.search`). Toolbar buttons use `data-cmd`, so they go through SlopCmd when it is loaded.
- **Layout**: at 390 px the groups stack above the list and the top bar wraps. A test checks there is no horizontal page scroll.

## Tests
- `node tests/run.mjs contacts`: `tests/contacts/app.test.html` (49 tests): vCard 3.0 folding and escapes, vCard 2.1 quoted-printable, Apple labels, CRLF and 75-octet export, import(export(x)) equals x (plus a byte-identical second export), CSV Google, Outlook and Apple headers, CSV export headers, duplicates by phone, e-mail and name plus organisation, chained groups, exact auto-merge, merge keeps every phone and e-mail, E.164 with a chosen country, bulk fixes, Drive save and reopen by `?drive=`, a vCard record opening as an unsaved import, autosave draft and restore, export saved to Drive, group filter, editor save, and the 390 px layout.
- Checked by hand, not in the suite: the duplicate, clean-up, find and replace, export and delete dialogs ran in a real page with no errors; the zip entries extract to the right bytes (`unzip -p`).
- Local-only check: `grep -ri "fetch\|XMLHttpRequest\|http" contacts/ --include=*.js --include=*.html --include=*.css` finds nothing.

## Known limits
- **Outlook CSV has fixed slots**: one business and one home phone (plus a second business or home phone), one mobile, one other, one pager, one business fax, one home fax, three e-mails, one business and one home address (and one other). Extra values beyond the slots are not written. The Outlook importer reads the same slots.
- **Apple CSV**: there is no official Apple CSV. The importer accepts header styles such as `Phone (mobile)` and `Email (home)`, and the generic fallback. Treat Apple CSV as best effort.
- **Custom Apple labels** (for example `_$!<...>!$_` outside the built-in set, or a label like "Dad mail") become one type made of their letters and digits (`DADMAIL`). The original text is not kept.
- **vCard 4.0** is read for the common properties (`tel:` values, `PREF` ignored, `VOICE` ignored). KIND, MEMBER, GENDER, PHOTO and RELATED are dropped.
- **Duplicates without a default country code**: `07700 900123` and `+44 7700 900123` do not match. Set the country code (Clean up or Default country code) and they do. Name plus organisation needs an exact match after case and spacing are ignored, so "Bob" and "Robert" do not match.
- **Merge** picks each scalar field from the richest contact (the one with the most filled fields), then from the others. Phones, e-mails, addresses and groups are unions. A repeated phone keeps its international form. There is no per-field chooser.
- **Title case** is a heuristic. Words already in mixed case (McDonald, iPhone) are kept, ALL CAPS and lower case are title-cased, and particles in the middle of a name stay lower case. Unusual names may need a manual edit.
- **E.164** removes the trunk 0 and adds the country code. A number that already starts with the country code and is long enough is taken as international. Numbers that are not valid for their country are not checked.
- **No undo** for bulk changes or deletes. A save overwrites the Drive record, so use Save to Drive as… (a new record) before a large change if you may want the old list back.
- **Export zip** uses stored (uncompressed) entries.
- **Drive**: exports go to the Drive root; the first save of the list asks for a folder.
- **Rendering**: every row is in the DOM. Fine for a few thousand contacts; there is no virtual list.
- **Keyboard**: the list has no arrow-key navigation yet. Checkboxes, buttons and the palette all work.
- **Not verified in the real apps**: exported files were not imported into iOS, Android, Google Contacts or Outlook here. The formats follow the specs and the header names those services use, but a real import is still needed.

## Not done
- Undo and redo for bulk actions.
- Per-field merge chooser, and "keep these two separate" memory for duplicates.
- Photos, custom fields, vCard 4 KIND and MEMBER (group objects).
- Sort, column choice, and arrow-key navigation in the list.
- Contact import from Google or Outlook by account (only files are read).
- Offline single-file build (`contacts/` loads its scripts from its own folders; tables/ is the same).
