# Slop PDF — handoff

In-browser PDF editor at `/pdf/` (pdf.js 4.10.38 for parsing/rendering, pdf-lib 1.17.1 for writing,
both vendored in `/vendor/`).

## What works (verified with Playwright e2e scripts + poppler)
- Open PDFs/images (picker, drag & drop), merge, colour-coded thumbnail grid (lazy, cached).
- Reorder by mouse drag, multi-select drag (click/shift/ctrl/marquee), Alt+arrows keyboard reorder,
  rotate, delete, duplicate, insert blank, insert from file, reverse, sort/collate, extract selection.
- Split by ranges / every N / each page, to zip (hand-written store-only zip, CRCs verified) or separate files.
- Undo/redo for all operations.
- Page view: zoom (wheel, buttons, pinch code), annotations: text, pen, highlighter, rect, ellipse,
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

## Tests
`node tests/run.mjs pdf` runs `tests/pdf/pdf.test.html` (41 tests, ~45 s, all green). The real app runs in
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
- Send page as image → PhotoSLOP opens `photoslop/?drive=` with the page (1240×1754 at 150 dpi).

## Fixed in this pass
- Radio groups with an /Opt array (pdf-lib, Acrobat) showed options "0", "1" and could not be filled;
  real labels now come from pdf-lib (`io/forms.js`).
- Touch long-press on an unselected page dragged the previously tapped page along too.
- Closed mobile panel peeked 10 px above the bottom edge; rail labels wrapped and clipped in Classic.
- Removed the dead pre-split `js/engine.js` / `js/util.js` (944/318 lines, not loaded anywhere).

## Known limitations
- Bookmarks/outlines and tagged structure are not carried over; non-WinAnsi text (CJK, emoji) in added text
  becomes "?" (standard fonts only); cMaps/standard fonts are not embedded in the offline file (only the
  Symbol/Dingbats fonts are), so CJK PDFs without embedded fonts may render with fallback glyphs offline.
- Classic 98 on phones ellipsises "Page numbers" in the bottom rail.

## Next steps
- Optional: outlines carry-over, embedding a Unicode font for added text.
- Recommended status in `shared/apps.js`: live.
