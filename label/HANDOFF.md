# SlopLabel: handoff

Status: **beta.** The designer works end to end in the browser: design, data merge, print, PDF/ZPL/EPL/TSPL/PNG/SVG export, ZPL import and preview, print-form links, Slop Hub, offline single-file build. Tests: `node tests/run.mjs label` gives 62 passing, with no console errors. Not yet checked on real printer hardware (see Known risks).

## Layout (classic scripts with top-level globals; every file is under 300 lines)
`index.html` loads the scripts in this order: `../shared/slopui.js`, `../shared/apps.js`, `../shared/hub.js`, `../shared/commands/*.js` (all five parts listed, so the offline build inlines them), `../vendor/bwip-js/bwip-js-min.js`, then core → barcode → vars → render → print → io → templates → ui. Keep the exact tag forms `<link rel="stylesheet" href="…">` and `<script src="…"></script>`, because the offline builder's regexes match them. No CDN, no web fonts.

### Engine (`js/`)
| File | What it does |
|---|---|
| core/units.js | mm/in/dots/pt conversion, `num`, `fmtLen`, `clamp`, `round`, `uid`, `escHTML` |
| core/stocks.js | `STOCKS` library (thermal rolls, Avery Letter/A4, Herma A4), `stockOf`, `sheetPositions` |
| core/model.js | `newDoc`, `applyStock`, `setOrientation`, `makeObject`, `History` (snapshot undo/redo with coalescing), align/distribute/reorder/group, `parseProject`/`normalizeDoc` |
| barcode/symbols.js | `SYMBOLOGIES`, `gs1Check`, UPC-E expansion, Code 39 mod 43, GS1 AI table, `parseGS1`, `gs1Raw`, `gs1FromRaw` |
| barcode/code128.js | Code 128 auto-subset encoder, `normalizeBarcode` (readable errors, automatic check digits) |
| barcode/geometry.js | `barcodeGeometry`: mm rects and HR text. Most linear and all 2D codes go through `bwipjs.raw` |
| vars/vars.js | Variables (prompt, counter, date, formula, fixed), `formatDate`, `interpolate` with `{Name\|filter:arg}`, `makeResolver`, `checkPrompts` |
| vars/sources.js | `parseCSV`, `parseJSONSource`, `readZip`, `readXLSX`, `loadDataFile` |
| render/text.js, scene.js, canvas.js, svg.js | Fonts and layout, the shared display list (`buildScene`), canvas/SVG backends, 1-bit rasterising |
| print/job.js, html.js, pdf.js | Jobs (records, quantity column, copies, sheet start), `@page` print HTML, hand-written PDF 1.4 |
| print/zplgfx.js, zpl.js, epl.js | ^GFA compression, ZPL II, EPL2, TSPL |
| io/zplimport.js, files.js, offline.js | ZPL → document, projects/autosave/form-link hashing, offline single-file builder |
| templates/gallery.js | 6 starter templates (shipping 4×6, product EAN-13, SSCC pallet, asset QR, badge, Avery 5160 merge) |

### UI (`js/ui/`)
| File | What it does |
|---|---|
| app.js | `App` state, `commit`/`editSel`/`undo`/`redo`/`setDoc`, selection, `refresh` (one frame later; `App.stale` makes `itemOf`/`boxOf` rebuild the scene when they are called before then), status bar, theme, dock |
| view.js | Canvas viewport (screen = pan + mm × zoom), label/grid/margins, selection handles, smart guides, rulers |
| interact.js | `TOOLS`, hit testing, move/resize (grid snap, smart guides, Alt disables), click or drag to create, image placing, marquee, pan (Space, middle button, Hand, one finger on empty canvas), wheel and pinch zoom |
| commands.js | Every tool and menu action registered with the shared command palette (`shared/commands`, `SlopCmd`): Ctrl/⌘+K search, all shortcuts rebindable (Help ▸ Keyboard shortcuts…, stored in `slop.keys.label`). `K(id)` gives menu key labels; `updateKeyTitles` refreshes tooltips after a rebind. Nothing runs from the keyboard in print-form mode |
| keys.js | Space-to-pan (held), clipboard (internal copy/paste, pasted images/text/ZPL), align/order/group/rotate/lock commands, context menu |
| props.js, props-types.js | Properties panel: form helpers, label properties, geometry, per-type sections, the "{ } Insert field" menu |
| panels.js | Dock tabs: Properties, Objects (list with hide/lock), Variables (plus preview values for prompts), Data (table, quantity column) |
| dialogs.js | Label setup (stock picker, size, printer settings), variable editor (live preview, renames references), template gallery, About |
| datadlg.js | Data import (CSV/TSV/JSON/xlsx file or paste) and column → field mapping |
| export.js | `jobScenes`, project open/save, `openFiles` (dispatch by type), PNG/SVG/PDF/ZPL quick export, ZPL import dialog, `zplPreviewCanvas` |
| printdlg.js | Prompt values, Print dialog (records, quantity, copies, sheet start, page preview, all outputs), ZPL preview dialog |
| form.js | Print-form mode (`#form=` + `encodeDocHash`) and "Share print form link…" |
| hub.js | `SlopHub.register('label')`, `consumeLaunch` (image → placed; CSV/xlsx → data; .sloplabel/.zpl → opened), Slop Drive pickers, File → Send to (PDF to Slop PDF; PNG to PhotoSLOP and Slop Vector). Hidden under `file:` and in the offline build |
| menus.js | Menu bar: File, Edit, Insert, Object, Data, View (themes), Help |
| boot.js | Toolbox, chrome wiring, drag and drop, boot order (form link → autosave → starter template → hub launch), adds `body.ready` |

CSS (`css/`): themes.css (tokens for Pro, Light and Classic 98, mapped onto `--sui-*`), layout.css, panels.css, classic.css, mobile.css (≤760 px: tools along the bottom, panels in a slide-up sheet opened with ☰).

## Tests
`tests/label/sloplabel.test.html` loads the app in two same-origin iframes (1280 px and 390 px) and reaches its globals with `win.eval`:
- engine.test.js: units, check digits, Code 128 values (`ABC123` gives `[104,33,34,35,17,18,19,67,106]`), barcode validation, GS1, variables, CSV, JSON, and xlsx (generated by a small zip writer in the test).
- output.test.js: Avery 5160 positions, sheet start offsets, `pageCSS`, jobs, History, scene errors, ZPL snapshot and round trip, ^PQ merging, ^FH escaping, ^GFA, ZPL import (^FN/^SN/GS1/QR), GS1 DataMatrix, EPL/TSPL, PDF xref offsets and resources, projects, form-link hashes, offline builder escaping.
- ui.test.js: creating objects with each tool by synthetic pointer events, smart-guide snap, move/resize/marquee/delete/undo, wheel zoom, properties panel edits, align/rotate/group/order, clipboard.
- commands.test.js: commands registered for every tool and menu action, tool keys through SlopCmd and rebinding (tooltips follow), zoom keys, Ctrl+K palette and toolbar button, Help entries and the shortcut editor, offline manifest includes the palette.
- ui-flows.test.js: CSV import through the mapping dialog, variable editor, print dialog outputs (PDF/ZPL/EPL/TSPL/PNG captured), sheet layout, ZPL preview, templates, themes, label setup, opening files, Slop Hub Send to, menus, form-link mode, phone layout.

Verified by hand in this round:
- Every symbology (0° and 90°), rendered to PNG, decodes with zxing-cpp (`pip install zxing-cpp`). So does the round trip through ZPL export → import → render (including ^GFA graphics).
- `pdfinfo` reports 288 × 432 pt for 4×6 and Letter for Avery 5160, with no syntax errors. `pdffonts` lists the base-14 fonts.
- The offline file (`File → Download app`) boots from `file://` and can rebuild itself.
- Screenshots in all three themes at desktop size and at 390×844.

Engine bugs fixed this round: literal U+2028/2029 in an offline.js regex (syntax error); PDF font/image resource names lost their `/`; 2D geometry dropped `gs1`, which broke GS1 DataMatrix ZPL; ZPL import of ITF-14 drew a second bearer; the offline builder inserted its JSON at the first `</body>`, which can sit inside inlined code; templates anchored right-aligned text off the label.

## Known risks / next steps
- Not tested on hardware: ZPL GS1 DataMatrix (`^BX…,_` with `_1`), the QR ^BQ origin offset, ITF bearer ^GB, and the TSPL/EPL bitmap polarity (assumes 0 = black).
- UPC-E, GS1 QR, rotated QR and rectangular Data Matrix go to ZPL as ^GFA graphics. They decode fine, but output is larger. ^B9 needs checking against a printer before it is used.
- Direct printing to a printer (Zebra Browser Print / WebUSB) is not implemented. The print dialog explains the workaround.
- Text is edited in the Properties panel (double-click or Enter focuses it). There is no on-canvas text editing yet.
- Rotation is in 90° steps only (thermal printers rotate fonts and barcodes in 90° steps).
- NiceLabel `.nlbl` import is deliberately skipped.
