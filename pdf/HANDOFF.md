# Slop PDF — handoff

In-browser PDF editor at `/pdf/` (pdf.js 4.10.38 for parsing/rendering, pdf-lib 1.17.1 for writing,
both vendored in `/vendor/`). Nothing is committed; the main session commits.

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

## Unfinished / not yet verified
- `tests/pdf/pdf.test.html` (SlopTest unit tests, required by the lead) is NOT written yet.
- Offline single-file download (`js/io/build.js`, File ▸ Download app) is implemented but NOT yet
  tested from file:// with the network blocked, nor the identical-rebuild check.
- Mobile (390px) layout and touch drag/pinch not yet tested or screenshotted; themes not yet visually reviewed
  in Light/Classic after the CSS split.
- Hub integration (Send to / Drive / ?drive=) written but untested.
- IndexedDB autosave/restore written but untested.
- One e2e check in t3 (watermark text extraction order on rotated page) needs its assertion relaxed — the
  rendering itself is correct (verified by image).
- Known limitations: bookmarks/outlines and tagged structure are not carried over; non-WinAnsi text
  (CJK, emoji) in added text becomes "?" (standard fonts only); cMaps/standard fonts are not embedded in the
  offline file (only the Symbol/Dingbats fonts are).

## Next steps
1. Write `tests/pdf/pdf.test.html` (+ helper .js ≤ 300 lines): load `pdf/js/core/*`, `io/*`, `ui/sheet.js`
   with pdf-lib, then test `U.parseRanges`, `U.makeZip`/`crc32`, `E.ops.*`, `E.commit/undo/redo`,
   `E.pageNumberText`, `E.build` output reloaded with pdf.js (order/rotation), `E.annotViewRect`/`toPage`,
   `SP.build.escapeJSON`/`toClassic`. Run `node tests/run.mjs pdf`.
2. Test the offline build (download, open from file:// with routes blocked, rebuild and byte-compare).
3. Mobile viewport + theme screenshots; fix anything ugly.

## How to test
E2E scripts live outside the repo in the session scratchpad (`pdf-tests/`: `t1_organize.js`,
`t2_edit.js`, `t3_tools.js`, `t4_forms_pw.js`, fixtures via `mkfx.py`). They expect the static server at
http://localhost:8125/ (`npx http-server . -p 8125 -s -c-1`). Results at handoff: t1 30/30, t2 32/32,
t3 19/20 (assertion issue above), t4 20/20, zero console errors.
