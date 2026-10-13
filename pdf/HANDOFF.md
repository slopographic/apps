# Slop PDF — handoff

In-browser PDF editor at `/pdf/` (pdf.js 5.7.284 for parsing/rendering, pdf-lib 1.17.1 for writing,
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
- Zoom limits are 25% to 800% as the status bar shows them. The status bar is `Ed.zoom × 72/96` (1 is 75%), so the
  internal limits are `Ed.ZOOM_MIN` / `Ed.ZOOM_MAX` (0.333 to 10.67). The pointer arithmetic is `editor/zoom-math.js`
  (`SlopPdfZoom`, shared by the page view and `tests/node/pdf-zoom.test.mjs`); the anchor is the page under the pointer. `Ed.easing()` tells tests when an ease has landed.
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

## Page layouts, lazy pages and Extract assets
- **Layouts** (`editor/view.js`, `view-rows.js`): continuous scroll (default), Single page and Two pages side by side, from
  View ▸ Page layout or the commands `view.continuous|single|two`. The choice is kept in `slop-pdf.pageLayout` (try/catch).
  The page in view (most of its area in the viewer, the middle on a tie, the last page at the end) is the active page;
  the page indicator, the properties panel and the grid selection follow it. A press on another page makes it active
  first, so the tools act on the page under the pointer. Previous/next and the page commands scroll to the page.
- **Pages** (`editor/view-pages.js`): one element per page with its own raster and annotation SVG. An
  IntersectionObserver (one viewport margin) rasters only the pages near the view and gives the raster back when they
  leave; the active page is never released. Renders run one at a time, active page first. The overlay and the text box
  move to the active page's element; they are not moved on every layout, so a text box keeps its focus.
- **Extract assets** (File ▸ Extract assets…, `ui/assets.js`): `io/assets-scan.js` reads the images and fonts of the
  pages still in the document with pdf-lib (pdf.js does not expose the stored stream or the object reference of an
  image or font, so it cannot give the JPEG bytes). `io/assets-model.js` is pure (classification, PNG predictors, pixels,
  list rows, zip order; `tests/node/pdf-assets.test.mjs`). `io/assets-save.js`: DCTDecode images as stored (JPEG), other
  8-bit images decoded and encoded as PNG through a canvas, fonts as the embedded file (FontFile/2/3). Skipped items
  (JPEG 2000, JBIG2, CCITT, CMYK, 1-bit, other filters) are listed with the reason. Output: one zip through
  `shared/office/zip.js` (loaded on demand; offline it falls back to the app's store-only zip) or one file each, or
  Slop Drive in a folder named after the PDF (`SlopHub.appSubfolderId('pdf', name)`, "PDF assets" without a name).
  Not listed: inline images in content streams.

## Find, Replace, text selection, Edit text, page actions (this pass)
- **Find (Ctrl+F)** (`js/find/`): `bar.js` (query, Match case, Whole word, "3 of 12", Next/Previous with Enter/Shift+Enter,
  the result list behind List, Escape closes). `search.js` runs the same locator as Replace text (`macro/text.js`,
  `T.find`), so the count, the highlights and the replacements agree; `paint.js` draws one SVG rect per match box in
  each page's layer (current match stronger). Pure helpers (`step`, `label`, `context`) are in `search.js`
  (`tests/node/pdf-find.test.mjs`). Matches inside one text item are highlighted by measured glyph widths; a match whose
  position is not exact is still counted and highlighted but is not replaced.
- **Replace all** (`js/find/replace-ui.js`, `replace.js`): the dialog lists every match with a checkbox (page, the text
  around it). Replace checked writes each replacement as a white whiteout over the old run plus the new text in the
  standard font, one undo step each (edit log included). Geometry is `M.coverPlan` in `macro/ops-edit.js`, shared with
  the Replace text macro (pdf-lib path). Unplaceable matches are listed as not replaced.
- **Selectable text** (`js/editor/textlayer.js`): pdf.js `TextLayer` per rasterised page, in the page layer under the
  annotations and over the find highlights; `--scale-factor` must be the zoom or the spans are misplaced. The select tool
  lets a press on a span select text (no pan); the annotation SVG has `pointer-events: none` (its marks keep theirs).
- **Edit text (Ctrl+E)** (`js/editor/edit-text.js`): click a run, type, Enter applies (Escape cancels). The old run is
  covered and the new text drawn at the same baseline, size and bold/italic, in the standard font of its family. The
  colour is the darkest ink in the run on the rendered page. The info line names the font and "embedded"/"not embedded".
  NOT DONE: reusing an embedded font for the new text, and "Use a font file…": pdf-lib needs `@pdf-lib/fontkit` to embed
  TTF/OTF, which is not vendored (`vendor/` was out of scope), so the new text is always a standard font.
- **Page actions** (`js/ui/page-acts.js`, `organize/grid.js`): each thumbnail has rotate left/right, open, duplicate,
  move up, move down, extract this page, delete; the focused thumbnail's buttons are in the Tab order. Each is one undo
  step. The current page has a border on its thumbnail and its canvas (`css/page-acts.css`).
- **Zoom**: the zoom keeps the point under the anchor (workspace centre for the buttons, pointer for Ctrl+wheel). A
  regression test (`tests/pdf/pdf.spec-pages.js`) checks the anchor at 60% to 300% in continuous, single and two-page
  layouts. Drifting to the left was not reproduced. Pan: drag empty space, Space+drag, middle drag, scrollbars.
- Tests: `tests/pdf/find.test.html`, `replace.test.html`, `edit.test.html`, `pages.test.html`;
  `tests/node/pdf-find.test.mjs`. Offline build lists and `pdf/css/find.css`, `page-acts.css` updated.
- **Document tabs** (`js/ui/doc-tabs.js`, `js/io/doc-state.js`): every open document is a tab of the shared strip
  (`shared/doctabs`, unchanged). The editor still works on the globals `E.files`/`E.assets`/`E.state`; a tab's record
  (`SP.docs.make`) takes them over when the tab is shown and keeps them when it is left (`swapIn`/`swapOut`): files, state,
  view (`A.viewNow`/`A.applyView`: tool, mode, page, zoom, layout, scroll), file name, undo stack (`H.useStack` keyed by the
  record id) and edit log (`SP.editLog.flush` before and after the swap). A stored tab is only its saved form until it is
  shown (`D.load` reads the files with pdf.js into its own maps; no live state is touched). A file already open in another
  tab gets a random id and is not logged (`E.fileIdTaken`), so the edit log and thumbnail cache keys never collide.
  `A.driveId` is a view of the open tab's Drive link; rename goes through the strip (`SP.tabs.rename`), which keeps the tab,
  the top-bar name and a Drive-linked file in step. Storage: the strip's own (`slop.doctabs.pdf.v1`, IndexedDB `slop-doctabs`);
  `session` in IndexedDB is a mirror of the open document without file bytes (the tests and the old readers use it).
  Autosave off stores nothing (`serialize` throws, the strip keeps no content) and deletes the stored tabs.
- **Drops** (`js/ui/drop.js`, SlopDrop with the empty page's zone `#pdfDrop`; the targets are the stage and the tab strip,
  so the outlines and "Drop to add N files" label show over them, not the whole window): on the strip each file opens in a new tab; a PDF already
  open in a tab asks first. On the document (or anywhere else while one is open) the pages are added at a position the
  person picks (start, end or after page N) as one `addFiles` commit (one undo step); a PDF already in the document asks
  first. With no document open a drop just opens the files. While a file opens or a tab loads, the strip and its keys are
  locked (`html.is-locked`) so the pages cannot land in another tab.
- **Convert** (`shared/convert/dialog.js`, `targets.js`, `dialog.css`; `window.SlopConvert.open({ file, drive })`): the
  toolbar button and File ▸ Convert… pass the open document (as a PDF, edits included). The targets are the converters of
  `convert/js/core/catalog.js` that take every open file (`targetsFor`); PDF to PNG and PDF to JPG are the one "PDF to
  images" converter with the format set, and PDF to text is added in `targets.js` (no converter in convert/js yet; no
  PDF to HTML). Merge needs two files: "Add files…" in the dialog picks more. Options are the converter's own. Results:
  Download, Download all as ZIP, and Save to Slop Drive when the document is linked. Not in the offline file (the module
  script is `data-offline="strip"`; the button and menu item are hidden there).
- **Still to do**: the service worker precache does not list the new files yet (run `node tools/pwa-precache.mjs` and
  bump VERSION, see below); a PDF to HTML target; Drive open into a tab from the strip (only File ▸ Open from Slop Drive).
- Tests: `tests/pdf/tabs.test.html` (two tabs and their state, strip drop and its duplicate prompt, page drop with the
  position and undo, reload, the Convert button); `tests/convert/dialog.test.html` (targets for a PDF, PNG, PDF to text,
  a second file for Merge). `pdf.spec-history.js` now takes the home stack key from `H.stackKey()` (the key of a tab).
- After any change to script or CSS lists, run `node tools/pwa-precache.mjs` and bump VERSION in `service-worker.js`
  (the new files are not in the precache until it is run).

## Drop choice, drop routing, layers, sidebar dock
- **Drops on the open document** (`js/ui/drop.js`): `SlopDropChoice.ask` (shared/drop/choice.js, the PhotoSlop dialog)
  offers Add to current (the position dialog, then one undo step) or Create new (each file in a new tab). Cancel adds nothing.
  No document open: the files open as before. A drop on the tab strip still opens new tabs.
- **Files the app cannot open** (`js/ui/drop.js`, `notice`): PDF, PNG, JPEG, WebP, GIF and BMP open; SVG is offered Convert to PDF
  (`A.convertFiles`, the Convert dialog with the file, Images to PDF among its targets); every other type is named in a dialog
  and the status line ("Not supported"). CSV, TXT, MD, HTML, JSON, XLSX, DOCX, ODT, ODS and PPTX have no PDF converter.
- **Layers** (`js/core/layers.js`, `js/editor/layers-ops.js`, `js/tools/layers-panel.js`): each annotation is a layer item; the
  page's annots array is the stack. `hidden` (not drawn in the page view or thumbnails, not exported, a hidden redaction mark
  is not burned in) and `locked` (drawn and exported, but not moved, resized, edited, nudged, deleted or given new props) are
  flags on the item. Move up/down reorders the stack. Each change is one undoable step. Duplicate and paste clear both flags.
  Not done: renaming a layer, drag-to-reorder, grouping, layers for stamps (page numbers, watermark) or form fields.
- **Sidebar dock** (`js/ui/dock.js`, `css/dock.css`): sections under the tool panel (`#props .pp-dock`). Layers starts open,
  History starts collapsed; open state is kept for the session only. The tool panels themselves are not collapsible.
- **History** (`js/tools/history-panel.js`, `H.steps()` and `H.goTo(n)` in `core/history.js`): applied steps oldest first, then
  undone steps greyed; a click goes to that state by undo or redo.
- Tests: `tests/pdf/pdf.spec-drop.js`, `pdf.spec-layers.js`, `pdf.spec-sidebar.js` (in `pdf.test.html`).

## Slop Drive: originals, saved copies and versions (`io/drive-docs.js`, `io/doc-changes.js`, `ui/versions.js`)
- **The original is kept at once.** Opening a PDF (drop, File ▸ Open, Add pages, Open from Drive into an empty document)
  stores its untouched bytes as a Drive file before anything else happens. An encrypted PDF is stored encrypted. The
  original is never written again. Images opened as pages are not stored (no original file exists for them).
- **Duplicates are linked, not copied.** The SHA-256 of the bytes (`SP.editLog.fingerprint`) finds a Drive PDF with the same
  bytes: sizes are compared first, and each PDF's hash is cached in its record (`meta.sha256`). A plain PDF another app put
  in Drive is adopted as the original. An edited copy links back to its original, so opening it finds the same document.
- **Save** (File ▸ Save to Slop Drive, Ctrl+S) writes two more Drive files beside the original: the edited PDF (`meta.pdf`
  role `edited`) and `<name>.changes.json` (role `changes`). Later saves update those two; the original is not overwritten.
  Behaviour change: Save used to write back to the Drive file the document came from, which is now the untouched original.
- **Change list** (`slop-pdf-changes`, version 1, `io/doc-changes.js`): `original` and `edited` (name, sha256, size),
  `layers` (each page's annotations as numbers, booleans, short strings and number lists, with the hidden and locked
  flags), and `log` (the edit-log records of the open document: the commands that replay on the original, assets as data
  URLs). Replaying `log` on the original gives the edited document (checked in `pdf.spec-drive-docs.js`).
  The change list does not contain the original bytes.
- **File ▸ Versions**: Open the original; Open the edited copy (a new tab, linked to the original, no new Drive copy); Open the
  original with the saved changes (replays `log` on it); Revert to the original (asks first; drops the edits in this tab and
  the device's saved edits for that file; the saved edited copy stays in Drive); Download the change list (JSON).
- **Without Slop Drive** (offline file, no hub, or a storage error) nothing is written. The document opens and works here,
  and a message says it is kept on this device only. File ▸ "Save opened PDFs to Slop Drive" (`slop-pdf.driveAutosave`)
  turns the automatic save off; Save and Versions still work once a document is in Drive.
- **Limits.** A document built from several files is linked to its first file; the other files are stored as their own
  originals. The offline file has no Drive, so none of this runs there.
- Tests: `tests/pdf/pdf.spec-drive-docs.js`.

## Fonts (`ui/fonts.js`, the shared panel)
- File ▸ Fonts…, the top-bar "Aa" button and the command palette ("Fonts…"). It opens the shared Fonts panel
  (`shared/fonts/panel.js`, `SlopFonts.openPanel`) and can be reopened at any time.
- The panel is given the families the open file embeds as a subset, and the standard ones. A family in the file as a
  full embed needs no answer and is not listed. If nothing is listed, a notice says the document has no subset fonts.
- The panel shows each family's status: built in (a standard name), bundled, downloaded, your own file, or missing.
  A missing family offers Download from the library (only when `shared/library` lists it; nothing downloads before the
  confirmation), Drop your own font… (stored on this device), and Use the closest font instead.
- A closest font chosen there is kept on each open file that uses the family (`f.fontMap`). The first-edit prompt
  (`editor/font-check.js`, through `SlopFontCheck.ask`, now a shim over the same panel) skips a family that has an answer and
  still asks for any missing family that has none.
- Tests: `tests/pdf/pdf.spec-fonts-dialog.js`.

## Export as (`ui/export-menu.js`, `shared/convert/pdf-office.js`, `pdf-pptx.js`, `pdf-layout.js`)
- File ▸ Export as ▸ Word, Excel, PowerPoint, PNG, JPG, or Other formats… (the Convert dialog with that target chosen).
  The three new targets live in `convert/js/core/catalog.js`, so the Convert app offers them too.
- **PDF to Word (DOCX)**: text-based. `pdf-layout.js` groups the text into lines and cells (a gap of a fifth of the text
  height starts a cell); consecutive lines with the same column starts become a Word table, other lines are paragraphs.
  The page size is Letter or A4, whichever is closer. Images, drawings, colours and fonts are not kept. A page with no text
  layer gets a line saying so.
- **PDF to Excel (XLSX)**: one sheet. Each page starts with a "Page n" row; each line goes into the column its text starts
  in (columns are the text start positions of the page). Values that round-trip as numbers are numbers. No formulas,
  formats or images.
- **PDF to PowerPoint (PPTX)**: one slide per page, the page drawn as a picture at 144 dpi, fitted to 16:9. The text is not
  editable in the deck. Not yet checked in Microsoft PowerPoint.
- **Limit (documented)**: pdf.js joins text on one baseline into a single item (the vendored pdf.js 5.7 has no option to stop
  this). The gap rule only splits cells that pdf.js gives as separate items. So a table row whose cells share a baseline and
  font comes out as one cell ("Item Qty Price"), and tables are recognised only where the cells are positioned apart. The
  table logic is tested on lines with separate cells (`tests/pdf/pdf.spec-office.js`).
- **PDF to text** reads through the same `pdf-layout.js`.
- Each target's fidelity is its `note`, shown in the dialog.
- Tests: `tests/pdf/pdf.spec-office.js`.

## Still to do
- The service worker precache does not list the new files until `node tools/pwa-precache.mjs` runs and VERSION is bumped.
- Tables are found from text alignment only: no ruled-line detection, no merged cells.
- Scanned pages are marked, not OCR'd, in Word and Excel (PowerPoint keeps them as pictures).
