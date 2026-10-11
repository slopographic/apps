# Slop Tables: handoff

Status: **building** (kept in shared/apps.js). The first working version exists: a grid UI on the engine,
with native storage in Slop Drive, CSV and XLSX export. ODS, print/PDF, charts, pivots, conditional
formats, validation, sort/filter, find and comments are not built yet (see "Missing").

## Files
- `index.html`, `css/tables.css`: the page (top bar, formula bar, grid, sheet tabs, status bar). Dark by default, `data-theme="light"` for light.
- `js/engine/`, `js/fn/`, `js/fmt/`: the engine (unchanged in this pass).
- `js/io/native.js`: `.stab` JSON (`toNative`, `fromNative`, `toBlob`, `fromBlob`). Cells keep their input: formula text (`f`), or typed value (`v`, `e` for errors), plus a style id into a style table. Computed values are not stored; they recalc on open.
- `js/io/csv.js`: `toCsv(sheet)` (displayed text, CRLF, quoting) and `parseCsv(text, delim)`.
- `js/io/xlsx.js`: `toXlsx(wb)` → Blob, built with shared/office `zip.js` and `xml.js`. Writes values, formulas with cached values, bold/italic, number formats (custom ones registered), column widths, row heights, hidden rows and columns, merges, freeze panes, sheet view selection and global names.
- `js/ui/state.js`: shared state `S` (workbook, active sheet, selection `{r, c, er, ec}`, edit, file), `redraw()` (rAF-coalesced repaint) and `changed()` (dirty + events).
- `js/ui/layout.js`: `Axis` (offset ↔ index with sparse overrides, binary search) and `axesFor(sheet)`.
- `js/ui/grid.js`: the virtualised renderer. Only visible cells, column and row headers and the selection are in the DOM. Frozen rows and columns use the same `metrics()` as hit-testing. `ensureVisible`, `placeEditor`.
- `js/ui/pointer.js`: click, drag, Shift+click, double-click to edit, header selection, header-edge resize, corner selects all.
- `js/ui/keys.js`: arrows (Ctrl jumps to data edges, Shift extends), Home/End, PageUp/PageDown, Enter/Tab (Shift reverses), F2, Delete/Backspace, typing starts an edit.
- `js/ui/nav.js`: `moveTo`, `jumpEdge` (Excel rules).
- `js/ui/editor.js`: in-cell editor and formula bar, sharing one `S.edit`. Enter/Shift+Enter, Tab/Shift+Tab, Escape, Up/Down (when not a formula) commit; blur commits.
- `js/ui/actions.js`: style patches, clear, copy/cut/paste (formulas shifted), freeze, select all, selection stats, clipboard events.
- `js/ui/history.js`: undo/redo by workbook snapshots (native JSON + active sheet + selection), up to 200 steps. `transact(fn)` records one step if anything changed; `beginStep`/`commitStep` for drags.
- `js/ui/sheets.js`: tabs: switch, add, rename (double-click or menu), delete, right-click menu.
- `js/ui/chrome.js`: toolbar state, name box (type `B7` or `A1:C9` to jump), formula bar sync, status (Count, Sum, Average), save state, document title.
- `js/ui/commands.js`: every command (id, title, group, keys, `when`). Registered with SlopCmd (palette and remappable keys, ⌘K button). Without SlopCmd, `runShortcut` handles the Ctrl/⌘ keys. The menus (File, Edit, Format, View, Sheets, Help) are built from the same list.
- `js/ui/storage.js`: open and save through SlopHub (see "Storage"), CSV import, downloads, `launch()`.
- `js/ui/drafts.js`: autosave draft in IndexedDB (`slop-tables-drafts`), written 0.6 s after a change, restored on a plain start.
- `js/ui/main.js`: boot and the test API `window.SlopTables` (`type`, `setCell`, `value`, `text`, `el`, `select`, `flush`, `save`, `csv`, `xlsx`, `native`, `command`, `undo`/`redo`, `ready`).
- `js/ui/numfmt.js`: number format presets (the engine's fmt/ codes).

## Storage and Slop Drive
- Native type: `.stab`, mime `application/x-slop-table`. This is the `creates` entry in shared/apps.js, which Drive's New ▸ menu uses. (The brief said `.stables`; the registry says `.stab`, so `.stab` is used.)
- Launch: `?drive=<id>` opens that record. A zero-byte `.stab` (New ▸ Spreadsheet in Drive) opens as a blank workbook that saves back to the same id. A `text/csv` or `.tsv` record opens as an unsaved import, so its Drive record is never overwritten with `.stab` data. An unknown id opens a blank workbook. XLSX/ODS records show "not supported yet" (no import yet).
- Save: with a Drive id, `SlopHub.put(blob, { id, name, folderId, from: 'tables' })`. On the first save, `SlopHub.pickFolder` picks a folder, then `put`. (Same behaviour as `saveToDrive`, but it allows the test to stub the folder choice.) The URL gets `?drive=<id>`. Without SlopHub (offline), Save downloads the `.stab`.
- `SlopHub.register('tables')` on launch. `SlopGuard.setUnsaved('tables', dirty)` keeps the reload warning honest.
- Draft: a plain start with an unsaved draft restores it (toast "Restored your unsaved workbook").

## Tests
- `node tests/run.mjs tables`: `tests/tables/app.test.html` (37 tests: boot, formulas, keyboard editing, styles and undo, layout and virtualisation, freeze panes, sheets, Drive save and reopen, zero-byte .stab, CSV in Drive, unknown id, autosave draft, CSV export text, XLSX package, native round trip) plus the engine's 11 tests. All green.
- Helpers in `tests/tables/tables.helpers.js`. The app runs in same-origin iframes, so the real Slop Drive and draft stores are used. Only the folder picker is stubbed.

## Known limits in this pass
- Import: XLSX and ODS are not read yet. CSV is read as a Drive record. TSV is read when pasted.
- Export: CSV exports the active sheet, as displayed. XLSX writes no charts, conditional formats, validation or comments. Newer functions (LET, LAMBDA, dynamic arrays) are written without the `_xlfn.` prefix, and spilled cells are written as plain values. ODS and print/PDF are not built.
- Editing: a click on another cell while typing a formula does not insert a reference (no point mode). Arrow keys in a formula edit move the caret. There is no fill handle and no autofit on double-click of a header edge.
- Structure: no insert or delete of rows and columns (the engine has `adjustForStructure` but no `Workbook.insertRows`).
- Not done: charts, pivots, conditional formats, data validation, sort and filter, find, comments, fill colour and text colour, merge commands in the UI (the model and XLSX export support merges), zoom.
- Layout: a phone (390 px) has no page scroll, but the menus and toolbar scroll sideways inside the top bar. Sheet scroll positions are not remembered between sheets. Text does not spill into empty neighbours.
- Undo covers edits, styles, paste, sheet operations, freeze and resize. Sheet selection and scroll are not undo steps.

## Next steps, in order
1. Import XLSX and ODS (readZip/readText from shared/office, then `sheet.xml` and `content.xml` into the workbook; styles for bold, italic and number formats).
2. Point mode in formulas, and fill handle and autofit.
3. Insert and delete rows and columns (`Workbook.insertRows` / `deleteRows`: move cell keys, row and column props, merges, then `calc.dirtyAll()`).
4. Sort, filter and find; conditional formats; validation; comments.
5. ODS export and print/PDF with page setup (a print preview that matches the print output).
6. Charts (SVG) and the pivot builder.
7. The offline single-file build (`tables/` modules are plain ES, so a small bundler can inline them), then SlopCmd palette and keymap tests.
