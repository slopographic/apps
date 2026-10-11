# SlopLabel: handoff

Status: **incomplete, not shippable yet.** The engine layer (model, barcodes, variables, data sources, renderers, PDF/ZPL/EPL/TSPL export, ZPL import, offline builder, templates) is written. There is **no UI, no `index.html`, no CSS and no tests**, and none of the code has been run in a browser. Expect syntax and runtime bugs on first load.

## Layout (classic scripts with top-level globals; every file is under 300 lines)
Load the scripts in this order: core → barcode → vars → render → print → io → templates → ui.

| File | Lines | What it does |
|---|---|---|
| js/core/units.js | 38 | mm/in/dots/pt conversion, `num`, `fmtLen`, `clamp`, `round`, `uid`, `escHTML` |
| js/core/stocks.js | 67 | `STOCKS` library (thermal rolls, Avery Letter/A4, Herma A4), `stockOf`, `sheetPositions` |
| js/core/model.js | 168 | `newDoc`, `applyStock`, `setOrientation`, `makeObject`, `History` (snapshot undo/redo), align/distribute/reorder/group, `parseProject`/`normalizeDoc` |
| js/barcode/symbols.js | 122 | `SYMBOLOGIES`, `gs1Check` (mod 10), UPC-E expansion, Code 39 mod 43, GS1 AI table, `parseGS1`, `gs1Raw`, `gs1FromRaw` |
| js/barcode/code128.js | 124 | Own Code 128 auto-subset encoder (`code128Encode`, `code128Widths`), `normalizeBarcode` (validation with readable errors, auto check digits) |
| js/barcode/geometry.js | 144 | `barcodeGeometry(obj, value, dpi)`: mm rects and HR text (EAN/UPC guard layout, ITF-14 bearers). 2D codes and the other linear codes use `bwipjs.raw` |
| js/vars/vars.js | 149 | Variables (prompt, counter, date with offsets, formula, fixed), `formatDate`, `interpolate` with `{Name\|filter:arg}`, `makeResolver`, `recordAt`, `checkPrompts` |
| js/vars/sources.js | 154 | `parseCSV` (RFC 4180, auto delimiter), `parseJSONSource`, `readZip` (DecompressionStream deflate-raw), `readXLSX` (shared strings, inline strings, date styles), `loadDataFile` |
| js/render/text.js | 128 | Fonts (sans/cond/serif/mono, mapped to PDF base-14), `measureMM`, `layoutText` (wrap, align, auto-shrink, para `**bold**`/`_italic_`) |
| js/render/scene.js | 102 | `buildScene`/`buildItem`: objects become a primitive display list in mm; also rotation matrices, anchored auto-size and `syncAutoSize` |
| js/render/canvas.js | 134 | `drawItems`, `renderLabelCanvas`, `toMono` (threshold/dither), `rasterizeItem` (1-bit for ^GFA), image cache |
| js/render/svg.js | 48 | `labelSVG` |
| js/print/job.js | 56 | `buildJob` (records, range, quantity column, identical copies, counters), `layoutPages` (sheet start position), `previewResolver` |
| js/print/html.js | 55 | `pageCSS` (exact `@page size: Wmm Hmm`), `printHTML` (vector SVG or 1-bit bitmap), `printViaIframe` |
| js/print/pdf.js | 176 | Hand-written PDF 1.4: exact MediaBox, vector bars, base-14 text with Tz width matching, JPEG passthrough, RGB+SMask, /BM Difference inverse, raster fallback for non-WinAnsi text |
| js/print/zplgfx.js | 86 | ^GFA with Zebra ASCII compression (encode and decode), :Z64: decode, ^FH escaping, bits to PNG |
| js/print/zpl.js | 136 | `buildZPL`: ^A0 text, native barcodes (Code 128 via explicit `>9 >: >; >5 >6 >7 >8` from our own encoder), ^GB/^GE/^GD, ^FR inverse, ^GFA images, ^PQ for copies, ~SD ^PR ^MN ^MT ^PO |
| js/print/epl.js | 92 | `buildTSPL`, `buildEPL`: native text, barcodes and boxes, with bitmap fallback; returns bytes |
| js/io/zplimport.js | 201 | `importZPL` (async): ^FO ^FT ^LH ^PW ^LL ^CF ^A ^FB ^FD ^FH ^FR ^FN (becomes a prompt var) ^SN (becomes a counter) ^BY, all main barcode commands, ^GB ^GE ^GC ^GD ^GF |
| js/io/files.js | 63 | `addImageAsset`, `projectBlob`, IndexedDB autosave (`autosave`/`loadAutosave`), `encodeDocHash`/`decodeDocHash` (CompressionStream deflate-raw, base64url) |
| js/io/offline.js | 67 | `buildOfflineHTML(sources)` (function replacers, `</script` and `<!--` escaping, `#app-src` JSON; large exact-inline files are stored as null), `extractOfflineSources`, `collectOfflineSources`, `downloadOfflineApp` |
| js/templates/gallery.js | 117 | `TEMPLATES`: shipping 4×6, product EAN-13, SSCC pallet, asset QR, name badge, Avery 5160 address merge |

Vendored: `/vendor/bwip-js/` holds bwip-js 4.11.4 `bwip-js-min.js` (1,112,458 bytes, MIT `LICENSE`), plus `LICENSE.INCONSOLATA` (SIL OFL, for the embedded font) and `README.txt`. `bwipjs.raw()` was probed in Node and works for every listed symbology. `pip install zxing-cpp` is installed in this container for decode tests.

## Not done (next steps, in order)
1. **`label/index.html`.** Copy the head tags from `/fluid/index.html` (title "SlopLabel — Slopographic", canonical `/label/`, og:image). Script order: `../shared/slopui.js`, `../shared/apps.js`, `../shared/hub.js`, `../vendor/bwip-js/bwip-js-min.js`, then the files above, then the ui files. Use the exact tag forms `<link rel="stylesheet" href="…">` and `<script src="…"></script>`, because the offline builder's regexes match them.
2. **`label/css/*.css`.** Pro, Light and Classic 98 themes. Copy the token approach from `/vector/vector.css`, map the `--sui-*` variables, and keep each file under 300 lines.
3. **`js/ui/*`.** Planned split:
   - app.js: state, commit/history, selection, theme, autosave
   - view.js: canvas viewport, rulers, grid, handles, smart guides
   - interact.js: tools, drag/resize/create, pan/zoom, keyboard shortcuts
   - menus.js
   - props.js: properties panel
   - panels.js: objects, variables, data
   - dialogs.js: label setup with the stock picker, variable editor, data import with column mapping
   - printdlg.js: print dialog, PDF/ZPL/EPL/TSPL/PNG export, ZPL preview via `importZPL` and then render, plus the "direct printing needs a helper" note
   - form.js: print-form mode, opened by `#form=` + `encodeDocHash`
   - hub.js integration: `SlopHub.register('label')`; `consumeLaunch()` places an image or loads a CSV as data; add "Insert image from Slop Drive…" and "Data from Slop Drive…"; add File → Send to ▸ (PDF to Slop PDF; PNG to PhotoSLOP/Slop Vector). Hide Send to under `file:`.
4. **Tests.** Add `tests/label/sloplabel.test.html` with helper .js files, each under 300 lines, using the iframe plus eval-Proxy pattern from `tests/paint/photoslop.test.html`. Cover:
   - check digits
   - Code 128 values (`ABC123` gives `[104,33,34,35,17,18,19,67,106]`)
   - units
   - variables
   - CSV
   - xlsx (generate the fixture with a small zip writer in the test)
   - ZPL snapshot and round trip
   - `pageCSS`
   - PDF xref offsets
   - Avery 5160 positions (first slot `{x: 4.7625, y: 12.7}`, pitch 69.85 × 25.4 mm, 30 slots)
   - History
   - offline builder escaping
5. **Verification.**
   - Decode PNG renders with zxing-cpp.
   - Run `pdfinfo` to check the page size (4×6 in should be 288 × 432 pt).
   - Take Playwright screenshots in every theme and on mobile.

## Known risks and unverified points
- No file has been executed yet, so expect typos.
- ZPL GS1 DataMatrix (`^BX…,_` with `_1`) and QR (^BQ origin offset) are from memory and have not been checked on hardware.
- The TSPL/EPL bitmap bit polarity is inverted on the assumption that 0 = black there.
- NiceLabel `.nlbl` import is deliberately skipped (format not parseable reliably).

## How to test (once the UI and tests exist)
`node tests/run.mjs label`. A static server is at http://localhost:8125/label/.
