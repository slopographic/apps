# Slop Docs: handoff

**Status: building, first working version.** You can type, format, save to Slop Drive, reopen with `?drive=<id>`, and export DOCX, Markdown and text. PDF is not started. The registry status in `shared/apps.js` stays `building`.

## What works now
- **Editing** (`docs/js/ui/input.js`, `actions.js`, `docs/js/model/ops.js`):
  - Typing goes through a hidden `<textarea id="ime">`, so IME, mobile keyboards and spell check work.
  - Enter splits paragraphs. Enter at the end of a heading starts Normal text. Backspace and Delete join paragraphs. Backspace on an empty list item removes the list first. Surrogate pairs (emoji) delete as one.
  - Arrows, with Shift to extend and Ctrl or Alt for words. Home and End work per visual line; Ctrl+Home and Ctrl+End work per document. Up and Down keep the goal x. PageUp and PageDown move 20 lines.
  - Mouse and touch: click, drag, shift-click, double-click for a word, triple-click for a paragraph.
  - Select all, cut, copy and paste as plain text (paste splits lines into paragraphs).
  - Undo and redo. Typing and deleting coalesce for 1.5 s; replacing a selection is its own step. Undo is not recorded for list definitions, which is harmless.
- **Formatting** (`toolbar.js`, `menus.js`, `commands.js`):
  - Bold, italic, underline, strike (menu only).
  - Font family (the 8 built-in families) and size, with stepping.
  - Paragraph style: Normal, Title, Heading 1 to 3, Quote, Code.
  - Alignment: left, centre, right, justify.
  - Bulleted and numbered lists (toggle).
  - Clear formatting.
  - At a collapsed caret, marks go to the next typed text.
  - Keyboard: Ctrl+B/I/U, Ctrl+Z, Ctrl+Shift+Z or Ctrl+Y, Ctrl+A, Ctrl+S, Ctrl+K palette, and Ctrl+Shift+L or 7 for lists. These are SlopCmd commands. The fallback in `input.js` handles the basics without SlopCmd.
- **Rendering:** `layoutDoc` output drawn as absolutely placed spans in one `div` per page, with rules and shading from the layout's items. Caret, selection and hit-testing use the same line boxes. Headers, footers and lists are drawn from layout items. Tables are drawn but not editable.
- **Storage** (`files.js`):
  - `?drive=<id>` launch uses `SlopHub.consumeLaunch`. A zero-byte `.sdoc` from Drive's New menu opens as a blank document.
  - File ▸ Open from Slop Drive uses `SlopHub.pickFromDrive`. It accepts `.sdoc`, `.docx`, `.md`, `.txt` and `.html`.
  - Save and Ctrl+S write the `.sdoc` JSON back to the same record with `SlopHub.update`, which keeps the folder, star and trash state. `put` with an existing id would move the file to the root, so it is not used.
  - The first save of a new document asks for a folder (`saveToDrive`).
  - A DOCX, Markdown or text file opened from Drive becomes a new `.sdoc` on save. The original file is never overwritten.
  - Autosave to IndexedDB `slop-docs` (store `drafts`) about 1.2 s after each change, for both untitled and Drive documents. A newer draft is restored on the next launch.
  - Send to: `SlopHub.sendMenuItems` with a DOCX export, in File ▸ Send to.
  - `SlopHub.register('docs')` runs on boot. `apps.js` was left unchanged: the Docs entry already lists its `accepts` and `creates`.
- **Export** (`docs/js/io/docx.js`, `sdoc.js`):
  - DOCX via `shared/office`: paragraphs, runs, bullets and numbers, alignment, indents, spacing, shading, tables (with spans), page size and margins, and Word's built-in heading, title, quote and code styles (`styles.xml`).
  - Markdown, plain text, and the raw `.sdoc`.
  - Checked: python-docx reads the export (text, styles, bold and italic, list, table, page size). LibreOffice converts it to PDF.
- **Import:**
  - DOCX: paragraphs, runs (bold, italic, underline, strike, size, colour, font, sup and sub), styles by name, lists by numbering format, tables, page size and margins.
  - Markdown: headings, lists, quotes, code blocks, bold, italic, underline and code spans.
  - Text: one paragraph per line. HTML: text only.
- **Random templates** (`ui/random.js`, `ui/templates.js`, generator in `shared/templates/`):
  - File ▸ New ▸ Random template, the toolbar's Random button, or the palette. The dialog draws the first page of a seeded design with the page renderer (`R.pageEl`). Click it to see it full size.
  - The seed is shown and can be typed. Enter regenerates from it. Reshuffle draws a new seed.
  - Use this template opens the design as a new, unsaved document. Save as template keeps it in File ▸ New ▸ My templates. It is stored in IndexedDB (`slop-docs` v2, store `templates`) and in Slop Drive as `<name>.sdoc-template` in a root folder "Templates".
- **Phones:** on screens under 700 px the page is fitted to the width (zoom 35% to 100%). The top bar and toolbar fit at 390 px with no page-level scroll.

## Known gaps (not built yet)
- **PDF export:** not started. It is the next major item. The layout already gives the lines and page count it needs.
- **Tables:** shown and exported, but the caret cannot enter a cell or insert tables. A click inside a table moves the caret to the nearest body paragraph.
- **Images:** imported DOCX images are dropped. Images cannot be inserted, and none are exported.
- **Headers, footers, page numbers, footnotes, TOC, comments:** the layout supports them, but there is no UI and DOCX import and export skip them.
- **ODT:** the registry `accepts` lists `application/vnd.oasis.opendocument.text`, but Docs does not open ODT yet. Opening one shows "cannot open". The lead may want to drop it from the accepts list.
- **Rendering:** every page is rebuilt from the layout on each change. Pages are not virtualised, so long documents will get slow. The plan asked for SVG pages; spans are used for now.
- **Save as:** only Save exists. The first save picks a folder, and saving a copy elsewhere is not built.
- **Print:** `@media print` CSS is in place. It has not been checked against a real print.
- **Offline single-file build:** not done.
- **Other UI:** no rulers, sidebar, templates, zoom beyond four presets, or word-count dialog.
- **Touch:** no selection handles. Touch uses tap and double-tap only.

## Files (all under 300 lines)
Positions are `{ b, o }`: the index of a top-level paragraph in `doc.blocks` and an offset into its text. The plan's `{ story, path, off }` is for table cells, which are not editable yet.

- `docs/index.html`, `docs/css/app.css`.
- `docs/js/bridge.js` (module): exposes `window.SlopDocEngine` (`M`, `S`, `O`, `F`, `SD`, `DX`, `layoutDoc`, …) for the classic UI.
- `docs/js/ui/` (classic scripts, loaded with `defer` in this order):
  - `state.js`: `window.SlopDocs`, the open document, selection, undo and events. Events: `layout`, `sel`, `change`, `doc`, `view`, `ready`.
  - `render.js`: page drawing, caret, selection, hit-testing and vertical moves (`SlopDocs.R`).
  - `actions.js`: every text action (`SlopDocs.A`).
  - `input.js`: keyboard, IME, pointer and clipboard.
  - `toolbar.js`: toolbar and status bar.
  - `files.js`: Drive, drafts, export and the URL.
  - `menus.js`: the File, Edit, Format and Help menus.
  - `commands.js`: SlopCmd registrations.
  - `main.js`: boot.
- `docs/js/model/ops.js`: pure editing operations on blocks, copy-on-write.
- `docs/js/io/sdoc.js`: `.sdoc`, text and Markdown.
- `docs/js/io/docx.js`: DOCX export and import.
- `docs/js/ui/random.js`: the Random template dialog. `docs/js/ui/templates.js`: My templates (IndexedDB and Slop Drive). `docs/css/random.css`.
- `shared/templates/`: the generator (see its `HANDOFF.md`). Bridge exposes it as `SlopDocEngine.TPL`.

## Tests
- `node --test shared/templates/generate.test.mjs`: 7 Node tests for the generator. Same seed, same JSON. Every document validates against the Docs schema and `normalizeDoc` leaves it unchanged. Style choices stay in their lists. The validator rejects a broken document.
- `tests/docs/templates.test.html` (in `node tests/run.mjs docs`): Random template opens the preview, the menu, Reshuffle, Enter to regenerate, full-size preview, Use this template (header text), Save as template and reload, and the Drive copy.

## Tests (`node tests/run.mjs docs`, 58 tests before templates, all green)
- `tests/docs/app.test.html`: runs the real page in an iframe.
  - Boot and the untitled draft.
  - Typing, Enter, Backspace, arrows, selection and undo.
  - Paste.
  - Formatting from the toolbar, keys, the File menu and the palette.
  - Ctrl+S.
  - Save to Drive keeps the folder. Reopen with `?drive=` restores text and formatting. Drafts are restored.
  - Markdown from Drive opens as a new document.
  - Phone-width fit.
  - Each describe clears `slop-docs` in `beforeEach`.
- `tests/docs/ops.test.html`: editing ops, marks, lists, words, `.sdoc` and Markdown.
- `tests/docs/export.test.html`: DOCX zip and `word/document.xml`, page setup, a hand-written Word file, a non-Word zip rejected, and round trips.
- `tests/docs/layout.test.html`: the layout smoke test (unchanged).
- Drive is unchanged and still green: `node tests/run.mjs drive` gives 73 passed across 8 pages.
- Not automated: the first-save folder picker (it is a dialog), the real IME composition path, and touch.

## Next steps, in order
1. PDF export. Use the layout lines and the subset TTF fonts (`fonts/ttf.js`). Add ToUnicode, links and the outline from `headings`, and check that PDF line breaks match the layout.
2. Table editing: caret in cells, insert and delete rows and columns, and cell formatting.
3. Images: insert from the Drive picker, drop, and paste. Write them to DOCX and PDF.
4. Headers, footers and page numbers: a UI for them, then import and export.
5. Virtualise pages off screen, and move the page render to SVG per the original plan.
6. Offline single-file build.
7. Rulers and a sidebar, then the templates.
8. Layout tests from the earlier list still open: widows and orphans, keepNext, table header repeat, TOC, floats, footnotes.

## Engine (already done, unchanged in this pass)

- **shared/office/** (`zip.js`, `xml.js`, `units.js`, `README.md`) with 8 tests in `tests/office/office.test.html`. Tables and Slides depend on this API; keep it stable.
- **Drive New ▸ menu:** `drive/js/ui/newdoc.js`. It is described in `drive/HANDOFF.md` and tested in `tests/drive/newmenu.test.html`.
  - Docs must treat a **zero-byte `.sdoc`** opened with `?drive=<id>` as a new blank document and save back to that same id.
- **Fonts:** `shared/fonts/<family>/ttf/` holds static TrueType copies with an OFL.txt in each folder.
  - Families: Carlito (Calibri metrics), Arimo (Arial), Tinos (Times), Caladea (Cambria), Cousine (Courier), Inter Tight, Archivo, JetBrains Mono. Each has Regular, Bold, Italic and BoldItalic.
  - Coverage is Latin, Greek and Cyrillic. The GSUB, GPOS and kern tables are removed, so the advance widths are the whole truth. Screen, measurement and PDF all use the same bytes.
  - To rebuild them, use fontTools: instance the variable fonts at wght 400/700 (Archivo also at wdth 100), then subset. The script is not in the repo; it was a scratch `mkfonts.py`.
- **Engine (`docs/js/`, ES modules):**
  - `fonts/ttf.js`: TTF parser (cmap 4/12, hmtx, metrics) and a subsetter that keeps glyph ids (for a PDF CIDFontType2 with Identity encoding).
  - `fonts/registry.js`: the font families and Word-name aliases, `loadFace` (FontFace registration plus parsing), `textWidth` and `vmetrics`.
  - `model/doc.js`: the schema. It is documented at the top of the file, including the .sdoc JSON, `normalizeDoc` and `wordCount`.
  - `model/styles.js`: the built-in styles, the style cascade, and bullet/number list definitions with labels.
  - `layout/atoms.js` and `layout/lines.js`: measured atoms, greedy line breaking, tabs (left, right, center, decimal; dot leaders), alignment, justification, super/subscript, inline images and float atoms.
  - `layout/para.js`: per-paragraph layout with a cache.
  - `layout/numbering.js`: list labels and footnote numbers.
  - `layout/blocks.js`: emits page items and handles static flow (cells, headers and footers).
  - `layout/table.js`: column widths, cell spans and vertical merges, padding, vertical alignment, shading and borders.
  - `layout/paginate.js`: page breaks, keep with next, keep lines together, widow/orphan control, floats, table rows with repeating header rows, and footnote space.
  - `layout/index.js`: `layoutDoc(doc)` returns `{ pages, headings, W, H }`. It also handles headers and footers (different first page, page and pages fields), footnotes, and a two-pass table of contents.
- **Tests:** `tests/docs/layout.test.html` has 1 smoke test (pagination stays inside the body box).

## Half-done or untested
- `layout/paginate.js`: only the basic paragraph flow has been run.
  - Floats (lines ~88-95 and 128-133), tables (`placeTable`), the TOC passes (`layout/index.js` ~70-80), footnotes and header/footer fields have not been exercised.
  - Write tests for each of these first.
- `layout/lines.js`: a paragraph that ends with '\n' gets an empty trailing line through `needsTrailingLine`, and that path is unverified.
