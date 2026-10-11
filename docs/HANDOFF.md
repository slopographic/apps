# Slop Docs: handoff

**Status: building.** There is no app UI yet (no `docs/index.html`). The shared office layer, the Drive New menu, the fonts and the layout engine are done. The editor, rendering, import/export and PDF are not started.

## Done
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

## Next steps, in order
1. Write layout tests: widows/orphans, keepNext, table header repeat, "Page X of Y", TOC and floats. Fix whatever they find.
2. Render: `render/` should draw each page as one SVG in pt units, with one `<text>` per frag and per-character x positions, so the screen matches the PDF exactly. Virtualise pages that are off-screen.
3. Editor model in `model/ops.js`: positions are `{ story, path, off }`. Blocks stay immutable (copy the path you change). Add undo snapshots, the editing ops, the hidden textarea for input and IME, hit-testing from line frags, and the caret and selection.
4. UI (`docs/index.html`, following the pdf/ patterns): menubar and toolbar, rulers, sidebar, status bar, SlopCmd, SlopHub (`?drive=`, Ctrl+S saves back), guard, IndexedDB autosave, templates, and a 390×844 layout.
5. Import/export: DOCX and ODT (with `shared/office`), MD, HTML and TXT. Write the PDF with your own writer (subset TTF with `subsetTTF`, ToUnicode, links, outline from `headings`). Add the @page print CSS and an offline build.
6. Parity test: compare the PDF to the layout lines and page count with vendor/pdfjs.
