# Slop PDF — handoff

In-browser PDF editor at `/pdf/` (pdf.js 4.10.38 for parsing/rendering, pdf-lib 1.17.1 for writing,
both vendored in `/vendor/`).

## What works (verified with Playwright e2e scripts + poppler)
- Open PDFs/images (picker, drag & drop), merge, colour-coded thumbnail grid (lazy, cached).
- Reorder by mouse drag, multi-select drag (click/shift/ctrl/marquee), Alt+arrows keyboard reorder,
  rotate, delete, duplicate, insert blank, insert from file, reverse, sort/collate, extract selection.
- Split by ranges / every N / each page, to zip (hand-written store-only zip, CRCs verified) or separate files.
- Undo/redo for all operations.
- Page view: navigation and zoom through `shared/nav` (see below), annotations: text, pen, highlighter, rect, ellipse,
  line, arrow, whiteout, highlight box, image, signature (draw/type/saved in localStorage).
  Move/resize/edit/delete. Export placement verified pixel-exact on /Rotate 90, user-rotated and
  offset-MediaBox pages.
- Page numbers, watermark, metadata (pdfinfo shows Title/Author/Keywords), AcroForm fill (text,
  checkbox, dropdown, radio) with keep-editable or flatten.
- Compress (lossless re-save; lossy JPEG rasterise), pages→PNG/JPEG (zip), images→PDF, text extraction.
- Password PDFs: RC4-128, AES-128, AES-256 (R6), with/without object streams, owner-only restricted
  files — decrypted locally (`js/io/decrypt.js`) so pdf-lib can rewrite them. Broken files show a clear error.
- Themes Pro/Light/Classic 98, shared SlopUI dialogs/menus, Slop Hub (register, ?drive= launch,
  File ▸ Open from Slop Drive, File ▸ Send to, page context menu ▸ Send page as image to).
- Code split into packages; every non-vendor file ≤ 300 lines.
- **Commands & shortcuts (SlopCmd)** (`js/ui/commands.js`): every tool, panel, page operation and menu action is
  registered with the shared `shared/commands/` package (app id `pdf`); all global keys go through it (the old
  keydown handler in `ui/input.js` is gone). `when()` guards keep keys mode-aware: letters are annotation tools
  only in page view, R / Shift+R / Del act on the selected or focused pages in the grid, arrows nudge a
  selected annotation or turn pages, everything is off while a menu is open or a field has focus.
  `organize/keys.js` keeps only the grid's listbox navigation (arrows, Home/End, Space, Enter, Alt+arrows,
  context menu). Menus show `A.key(id)` (= `SlopCmd.keyFor`), so user remaps show up. Help ▸ Search
  commands… (Mod+K, also the magnifier button in the top bar) and Help ▸ Keyboard shortcuts… (`?` opens the
  shared shortcut editor). The offline build inlines commands.css and runs the five SlopCmd scripts (B.CMD).
- **Thumbnail size** (`js/organize/zoom.js`): S/M/L presets + a continuous slider from 80 px up to the grid's
  inner width (one page per row, "fit" button), Ctrl/⌘ + wheel, two-finger pinch (touch events, cancels a
  pending long-press drag), Ctrl +/− and View ▸ Zoom in grid mode. Saved as `slop-pdf.thumbSize`; a resize
  clamps it. While zooming only CSS sizes change; rasters load once it settles (160 ms). Render cache buckets go
  up to 2800 px (JPEG above 1000 px, PNG below) with a ~190 MB byte budget, and zooming out keeps the sharper
  raster already shown.
- **True redaction** (`js/redact/`, `css/redact.css`, rail tool "Redact", page tool X):
  - Marks are box annotations of type `redact` (hatched red, movable/resizable like other boxes). Drawn with
    the Redact tool, or added by **Find & redact** (`find.js`): plain text / regex / match case and presets
    (e-mail, phone, Luhn-checked card numbers, SSN and Swedish personnummer-like IDs) over every page, using
    pdf.js text items; per-character boxes come from canvas-measured glyph widths, padded.
  - Review list in the panel (jump to / remove each mark), then **Apply redactions** behind a "permanent"
    confirm dialog (`panel.js`). `E.applyRedactions` (`apply.js`) rasterises each marked page with pdf.js
    (150/200/300 dpi, ≤ 40 MP), burns black boxes into the bitmap and replaces the page with an image-only page
    (raw Flate RGB XObject via CompressionStream; PNG fallback) of the same size and /Rotate in a new source
    file "Redacted pages.pdf". Only URI links outside the boxes are kept; form fields, comments and other
    annotations on that page are flattened/gone. User annotations touching a box are removed. Optional: blank
    the document metadata. Pages get `p.redacted` → "Redacted" badge on thumbnails and the page view.
  - Undoable while the document is open (the original file stays in memory/autosave locally); the download is
    always a fresh pdf-lib save (no incremental history). `E.build` refuses to export pending marks;
    `A.download` offers "Apply and download". On export, `/Thumb`, `/PieceInfo` and page `/Metadata` are
    stripped from every page, and when any page is redacted, each page's `/XObject` resources are pruned to the
    ones its content stream actually paints (`E.pruneXObjects`), so shared/inherited resources cannot carry a
    redacted page's content along.
  - No "keep vector text" mode is offered (content-stream rewriting was not done; image-only is the safe path).
    Invisible OCR text on redacted pages is lost too (they become pure images).

## Navigation and zoom (page view)
The page view uses the shared navigation engine (`shared/nav`, `SlopNav.engine.attach`), not its own wheel or pinch code.
The bindings are fixed for Slop PDF (`NAV` in `js/editor/view.js`), so the Navigation preset store does not apply here:
- Ctrl/⌘ + wheel zooms about the pointer, eased over 120 ms; a trackpad pinch (small Ctrl + wheel deltas) is immediate.
- The plain wheel scrolls the pages vertically and Shift + wheel scrolls them sideways. The engine is opened with
  `passthrough: true`, so a wheel it does not bind is left to the viewer's native scrolling.
- Ctrl/⌘ + and − zoom (eased), Ctrl/⌘ 0 fits the page width, Ctrl/⌘ 1 is 100%. The grid keeps its own keys: the engine's
  `skip` hands every key and Space to SlopCmd outside page view, so Ctrl/⌘ + in the grid still resizes thumbnails.
- Space drag and middle drag pan. Touch: two-finger pinch zooms (immediate) and two-finger drag pans. A single-finger
  drag on the empty viewer pans from `S.startPan`, which `cancelStroke` stops when a second finger lands.
- Zoom limits are 10% to 800% as the status bar shows them. The status bar is `Ed.zoom × 72/96` (1 is 75%), so the
  internal limits are `Ed.ZOOM_MIN` / `Ed.ZOOM_MAX` (0.133 to 10.67). `Ed.easing()` tells tests when an ease has landed.
- Anchoring: each eased frame keeps the page point under the pointer in place (`setRaw`). A page smaller than the
  viewer cannot scroll, so the rest of the move becomes a `left`/`top` offset on the page; the next layout clears it.
  The viewer sets `overflow-anchor: none`, so the browser does not also move the scroll.
- Phone width (≤ 900 px): the status bar is hidden, so a floating cluster (`.pv-zoomfab`, built in `Ed.init`) shows
  − / percentage / + / fit width above the bottom rail. The toolbar's zoom buttons stay in the context bar too.
- Saved view: `ui/view-state.js` saves the zoom, mode and scroll. Its listeners are on `window` in capture phase,
  because the engine stops the wheel, Space and pointer events it takes before any listener further down sees them.
  A reopened page keeps the saved zoom when the app reloads; opening a page from the grid still starts at fit (as before).

## Engine changes made for this (shared/nav)
- `engine.attach({ passthrough: true })`: an unbound wheel is not stopped (default off, so the other apps are unchanged).
- Fixed the pinch start: `touchDown` stored the midpoint in client coordinates while every later midpoint is
  host-relative, so the first pinch move jumped by the host's offset. Affects any app whose host is not at the
  window's origin (PhotoSlop, SlopVector, Slop PDF).

## Tests
`node tests/run.mjs pdf` runs `tests/pdf/pdf.test.html` (49 tests, ~120 s) and `tests/pdf/view-state.test.html`. The real app runs in
an iframe; `tests/pdf/pdf.helpers.js` (`window.PT`) boots it, makes fixture PDFs with the app's own pdf-lib,
opens them through `A.addFiles`, captures downloads and reads output back with pdf.js. Specs:
- `pdf.spec-core.js`: ranges, zip/CRC, sniffing, geometry, page ops, undo/redo/coalescing, page-number text,
  `SP.build.escapeJSON`/`toClassic`.
- `pdf.spec-export.js`: merge order/rotation/blank pages, annotation placement pixel-checked on /Rotate 90,
  user-rotated and offset-MediaBox pages, text/pen/arrow/image/stamps, metadata, forms (fill + keep
  editable, flatten), split to zip and to files, extract.
- `pdf.spec-io.js`: RC4-128/AES-128/AES-256/owner-only fixtures (`tests/pdf/fixtures/`, made with pypdf;
  user password `slop`), wrong/cancelled password, broken files, autosave to IndexedDB + restore after reload,
  autosave off, Slop Hub (Send to items, Send page as image → Drive + `?drive=`, open from Drive picker,
  launch with `?drive=`), offline build (self-contained, byte-identical rebuild, boots and exports).
- `pdf.spec-redact.js`: presets/regex/Luhn, match boxes on a rotated page, apply on a 3-page file (secret
  e-mail, text, form field and drawn box gone from pdf.js text extraction AND from every decoded stream/string;
  untouched pages keep text; rotation/size kept; metadata gone; link outside kept; black pixels), shared
  XObject resources not leaking, confirm dialog, download prompt and undo.
- `pdf.spec-cmds.js`: registered ids/keys, mode-aware dispatch (R rotate, Shift+R, Mod+Z, T/X tools, Esc), menu
  key labels follow remaps, palette and shortcut editor open.
- `pdf.spec-thumbs.js`: presets + slider up to one page per row, clamping, localStorage, sharp raster at full
  width, Ctrl+wheel and pinch (synthetic TouchEvents).
Cross-realm gotcha: arrays/typed arrays passed into the iframe's pdf-lib/pdf.js must be made with
`PT.win.Array`/`PT.win.Uint8Array`.

## Verified by hand (Playwright scripts, not in the repo)
- Offline file: File ▸ Download app, opened from file:// in an offline context with every non-file request
  aborted: zero requests, zero console errors, sample loads, export validates, `SP.build.make()` inside it
  reproduces the downloaded file byte-for-byte. The offline file has no Slop Hub (Drive belongs to the site's
  origin), so Drive/Send to menu items are hidden there.
- Mobile 390×844 with touch: no horizontal page scroll (rail and page toolbar scroll inside themselves), tap
  selects, long-press drag reorders, two-finger pinch zooms the page view, bottom sheet panel opens/closes.
- Themes Pro/Light/Classic 98 screenshotted on desktop and mobile.
- Send page as image → PhotoSlop opens `photoslop/?drive=` with the page (1240×1754 at 150 dpi).

## Fixed in this pass
- Radio groups with an /Opt array (pdf-lib, Acrobat) showed options "0", "1" and could not be filled;
  real labels now come from pdf-lib (`io/forms.js`).
- Touch long-press on an unselected page dragged the previously tapped page along too.
- Closed mobile panel peeked 10 px above the bottom edge; rail labels wrapped and clipped in Classic.
- Removed the dead pre-split `js/engine.js` / `js/util.js` (944/318 lines, not loaded anywhere).

## Blank-page / lost-edits investigation (owner report: "adding stuff renders a blank white page") — IN PROGRESS
Stopped early (usage limits). **No app code changed yet.** Findings so far:
- Repro harness (scratch, not in repo): drives the real app in Playwright (sample-like 3-page all-green
  fixture so any white = blank), takes CDP screenshots every ~57 ms (fastest achievable headless; the
  `--use-angle=swiftshader` launch flags make screenshots ~380 ms, so leave them off) plus an in-page
  per-rAF DOM probe (does `.pv-canvas` hold the current page's bitmap; SVG annot count vs model; empty
  thumbnails in view). Covered: text, pen, rect, highlighter, whiteout, image, signature, move, resize,
  delete, undo/redo, zoom (buttons, Ctrl+wheel, fit), rotate, next/prev page, grid, thumb size L/S,
  grid rotate/duplicate/move/undo, back to page.
- Result at 1280x800 headless: **no white frames and no lost annotations** in page view for any annotation
  edit, undo/redo, zoom or rotate (white fraction stays ≤ 0.007; annotations present in every frame after
  each commit). The architecture already matches the target for annotations: `editor/view.js` renders
  pdf.js into an offscreen canvas and copies it in only when complete; annotations are an SVG overlay
  (`ui/sheet.js` `V.paintAnnots`); the raster key (`file:page:formKey@zoom`) does not change on annotation
  edits; zoom CSS-stretches the old bitmap until the sharp one lands; no pdf-lib reload while editing.
- Real defects found:
  1. **Page switch shows the PREVIOUS page's bitmap** (stretched to the new page size) for ~150 ms until the
     new render lands (`Ed.show` → `layout(true)` → `scheduleRaster`; view.js ~line 81-104). 9/7 frames on
     next/prev. Fix: on page change, immediately paint the cached thumbnail raster for the new page
     (`E.thumbURL` cache) into the canvas, or hide the stale canvas behind a page-coloured placeholder.
  2. **First open of page view**: `.pv-page` is `background:#fff` with an empty canvas until pdf.js
     finishes (2 frames) — white flash. Same fix as 1 (seed from thumbnail cache).
  3. **Grid**: a newly created thumbnail element (duplicate, thumb size change re-bucket) has an empty
     `<img>` for 2-3 frames even when the raster is cached (`V.loadRaster` waits on a promise + async
     decode). Fix: synchronous cache lookup in `E.thumbURL` (return url directly when resolved) and
     `img.decode()` before swapping; keep the old src until the new one decodes.
  4. Latency (dispatch → next frame): nudge ~10-13 ms, prop change ~11-12 ms, add ~16-20 ms, undo 11-70 ms
     (undo cost is `O.render()` of the whole grid + `JSON.parse` snapshot; could skip grid render while in
     page view and re-render lazily).
- Not reproduced: the owner's "blank page after adding stuff". Candidates still to check: real-GPU
  browsers with high devicePixelRatio (16 MP cap in `S.renderRaster` → large canvas copies), form-field
  PDFs (`E.formKey` is in the raster key, so every form edit re-renders — and `renderToCanvas` on a form
  PDF re-renders, which is the only key that changes during editing), and mobile Safari canvas memory
  limits (a canvas over the limit renders white). Test with the sample PDF (it has a form) next.
- Next steps, in order: (a) re-run the repro with the sample PDF and with form fields filled;
  (b) fix 1-3 above; (c) add `tests/pdf/pdf.spec-render.js` sampling canvas pixels per rAF during
  edit/zoom/undo/page switch (assert non-blank and annotation SVG nodes present), keep placement tests green;
  (d) smoke-test desktop + 390x844.

## Offline build note
Site-only scripts in `index.html` (fonts.css, `shared/guard.js`) carry `data-offline="strip"` so the offline
file stays self-contained; the guard/backup cannot work from file:// anyway.

## Known limitations
- Bookmarks/outlines and tagged structure are not carried over; non-WinAnsi text (CJK, emoji) in added text
  becomes "?" (standard fonts only); cMaps/standard fonts are not embedded in the offline file (only the
  Symbol/Dingbats fonts are), so CJK PDFs without embedded fonts may render with fallback glyphs offline.
- Classic 98 on phones ellipsises "Page numbers" in the bottom rail.

## Next steps
- Optional: outlines carry-over, embedding a Unicode font for added text.
- Recommended status in `shared/apps.js`: live.

## Slop Drive (shared storage)

- **Save (Ctrl+S)** builds the PDF and writes it back to the Drive file the document came from (`A.driveId`, set when a Drive file opens into an empty document, cleared by Close all and Try the sample). The first save asks for a folder. Without the hub or offline, Ctrl+S downloads as before; `File ▸ Download PDF` is unchanged (no shortcut now).
- Open from Drive, `?drive=` launch and `register('pdf')` as before.
- `pdf.spec-nav.js`: Ctrl+wheel zooms about the pointer (eased, the document point stays under the pointer), the plain
  wheel is left to the viewer, Shift+wheel scrolls sideways, 10% and 800% limits, Ctrl/⌘ 0 fits the width, and the zoom
  comes back after a reload.

## Undo/redo, saved edits and text highlight
- **History** (`js/core/history.js`): every change is one `E.commit(label, fn, coalesce)`. It records the difference
  between the document before and after (page objects by id, page order, meta/stamps/forms) as a command with
  `do()` and `undo()`. Cap 300. `H.useStack(key)` swaps the stacks, so a tab adapter can give each tab its own history.
  No-op commits make no step.
- **Saved edits** (`js/io/edit-log.js`): each logged file's applied commands go to IndexedDB (`U.idb`, key
  `edits/<sha256 of the original bytes>`), restricted to that file's pages. The original bytes are never stored.
  File ids are `f<first 16 hex of the fingerprint>` and page ids `<fileId>.<index>`, so a reopened file lines up.
  Opening a file with a saved log asks Replay or Discard (`L.offer`, called at the end of `A.addFiles`).
  Not logged: sample, image-made PDFs, restored autosave files, the Redacted file, and a second copy of a file in one
  session. Apply redactions drops the file's log (its pages cannot be replayed).
- **Text highlight** (`js/editor/texthl.js`): tool `texthl` (key U). Lines and per-glyph boxes come from pdf.js
  `getTextContent`; the annotation keeps its quads in `pts` (four per line) and exports as filled multiply quads.
- Tests: `tests/pdf/pdf.spec-history.js`. Fixtures carry a unique creation date (pdf-lib dates have one-second
  resolution, and identical files would share a saved log).
