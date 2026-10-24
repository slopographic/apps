# File convert: handoff

File convert (`convert/`) converts files in the browser. Nothing is uploaded: every conversion
runs on the device. Status is `building` in `shared/apps.js`.

**Scope: files only.** Conversions that are not about files (units, currency, time, number bases) do not belong
here. They are in the calculator (`calculator/`, the Convert panel). The text converters (Base64, URL encode and
decode, line endings) stay because they also take uploaded files.

## Layout

- `index.html`: the hub (generated, see "SEO pages" below). Drop zone, target picker, batch, zip.
- `<slug>/index.html`: one static page per converter, with the same tool embedded.
- `css/convert.css`: tokens on `:root`, dark by default, light via `prefers-color-scheme` or `data-theme`.
- `js/core/`: pure converters. `catalog.js` lists them; `pages.js` lists the SEO pages. `vcf.js` runs the vCard pairs and loads the Contacts vCard code (`contacts/js/core/`) into the page; `vcf-map.js` holds their header rule.
- `js/ui/`: the tool controller (`tool.js`), its markup (`markup.js`), options, batch runner and `mount.js`.
- `js/preview/`: the live preview (see below). `mount.js` is its entry point; `controller.js` debounces and runs the actions; `model.js` runs the converter for the preview; `view.js` draws the block; `diff.js` and `spec.js` hold the line diff and the limits.
- `js/io/`: file helpers, and `zip.js`, a re-export of `shared/office/zip.js` (ZIP writer and reader, shared with the other apps).

## Converters and their limits

| Converter | Input | Output | Limits |
|---|---|---|---|
| To PNG | JPG, WebP, BMP, GIF (first frame), SVG | PNG, optional size | GIF: first frame only. SVG is drawn at the chosen size. |
| To JPG | PNG, WebP, BMP, GIF, SVG | JPG, quality, size, background | Transparent areas take the background colour. |
| To WebP | PNG, JPG, BMP, GIF, SVG | WebP, quality, size | Needs a browser that can write WebP (Safari may not). |
| To BMP | PNG, JPG, WebP, GIF, SVG | 24-bit BMP, size, background | No transparency; files are large. |
| To ICO | any image | single-size ICO (16 to 256 px) | PNG-compressed single image; one size per file. |
| Images to PDF | PNG, JPG, WebP, BMP, GIF, SVG | one PDF | A4, Letter or fit; portrait; margins. PNG is flattened onto white. Upright JPEGs are embedded unchanged; EXIF-rotated JPEGs are redrawn upright. |
| PDF to images | PDF | PNG or JPG per page | Page range, 72/144/216 dpi. Password PDFs are refused. Pages are capped at about 40 megapixels. |
| Merge PDFs | PDF (many) | one PDF | Encrypted PDFs must be unlocked first. |
| Split PDF | PDF | one PDF with a range, or one per page (zip) | Encrypted PDFs must be unlocked first. |
| CSV to JSON | CSV | JSON array of objects (or arrays) | RFC 4180 quoting. Numbers stay text unless "numbers" is ticked and round-trips exactly. |
| JSON to CSV | JSON | CSV | Array of objects (union of keys), arrays, or one value per row. Nested values as JSON text. |
| CSV to XLSX | CSV | one-sheet XLSX | Values only (no formatting or formulas). Numbers that would lose precision are text. |
| CSV to vCard | CSV | vCard 3.0 (.vcf), one card per row | Header names are matched case-insensitively (see `js/core/vcf-map.js`). The status line lists the recognised columns. Photos are not in CSV. |
| XLSX to vCard | XLSX | vCard 3.0 (.vcf) | First sheet only; the first row holds the column names. Formulas are not calculated. |
| vCard to CSV | vCard (.vcf, 2.1, 3.0 or 4.0) | CSV: Name, First name, Last name, Organisation, Job title, E-mail, Phone, Address, Website, Note | Read by the Contacts vCard code. Photos are left out. Several values in a cell are joined with "; ". |
| vCard to XLSX | vCard | one-sheet XLSX, same columns as vCard to CSV | Values only. Photos are left out. |
| Video or audio to WAV | MP4, WebM, MOV, M4A, MP3, WAV, OGG, FLAC | 16-bit PCM WAV at 44.1 kHz, stereo or mono as the source | Decoded by the browser (`OfflineAudioContext.decodeAudioData`), so AAC needs a browser that plays it. Silent files say so. |
| Video or audio to MP3 | same as above | MP3 at 128, 192 or 320 kbps | Encoded with lamejs (`vendor/lamejs`, LGPL-3.0), loaded on first use. |
| MOV to MP4 | MOV | MP4 | Streams copied when they fit (no loss), otherwise re-encoded with H.264 and AAC. ffmpeg.wasm. |
| Video to WebM | MP4, WebM, MOV | WebM (VP8 and Vorbis) | Re-encoded. ffmpeg.wasm. |
| Video to GIF | MP4, WebM, MOV | GIF, width and frame rate chosen | ffmpeg.wasm. |
| Video frame to WebP, PNG or JPG | MP4, WebM, MOV | one picture at the chosen time | ffmpeg.wasm. |
| vCard to JSON | vCard | JSON array, one object per contact | Field names follow the Contacts model (fn, name, emails, phones, adr, org, title, url, note). Photos are left out. |
| Markdown to HTML | Markdown | HTML page or fragment | No tables, nested lists or footnotes. Raw HTML is escaped (shown as text). |
| HTML to text | HTML | plain text | Visible text only; scripts and styles removed. |
| Base64 encode / decode | any / text | .base64.txt / original bytes | Decode detects PNG, JPG, PDF and other signatures to pick the extension. |
| URL encode / decode | text | text | Encode everything by default, or keep URL punctuation. A bad % sequence is reported. |
| Line endings | text | text | LF, CRLF or CR. |
| SIE to XLSX | SIE (.se, .si; types 1, 2, 3, 4, 4I) | XLSX: Info, Vouchers, Accounts, Balances, Periods | Read by `shared/finance/sie.js` (SIE 4C/4B format; PC8 = CP437, or UTF-8 / Windows-1252 when a program wrote those). Checksum (#KSUMMA) checked. Amounts are numbers, dates are dates. |
| SIE to CSV | SIE | CSV, one row per transaction line (balances per account when the file has no vouchers) | Separator comma, semicolon (then a decimal comma) or tab; UTF-8 with a BOM. #BTRANS lines are listed with a note and not counted. |
| Bank statement to CSV / XLSX (`bank-to-csv`, `bank-to-xlsx`) | OFX/QFX 1.x and 2.x, QIF, camt.053 (also 052/054), MT940 | CSV, or XLSX with Transactions and Statement sheets | Readers in `shared/finance/`. Money out is negative. Pending camt entries are listed but not counted. OFX has no opening balance; QIF has no currency. |
| 3D models (`core/threed.js`) | OBJ (+MTL), STL, PLY, glTF (+.bin, pictures), GLB, 3MF, DAE, FBX | STL (binary/ASCII), OBJ (+MTL, PNG textures), GLB, glTF (embedded), PLY (binary/ASCII), USDZ | Shared 3D I/O module (`shared/3d-io/`). Companion files (`with` kinds) are matched by name and never converted alone. Options: units, scale, up axis, merge, encoding, materials, animations. The status line names what the format dropped. Compressed glTF loads Draco/meshopt/Basis from the cdn (SHA-256 checked, first-use notice). The preview draws input and output in 3D (`js/preview/model3d.js`). |

Browser support: anything the browser cannot decode or encode (for example WebP output in some Safari versions) reports a plain error on that file; the rest of the batch still runs.

## Finance files

`js/core/finance.js` holds the four finance conversions (`FINANCE`, spread into `CONVERSIONS`) and `js/core/finance-pages.js`
their six pages (`FINANCE_PAGES`, spread into `PAGES`; category Finance). The readers, the shared model and the tables are
in `shared/finance/` (one module per format, `index.js` sniffs and dispatches, `tables.js` makes the rows); the XLSX writer
is `shared/sheets/write.js` (several sheets, bold header, number and date formats). `detect.js` asks
`shared/finance/index.js` `sniffFinance` first, so a finance file named .txt, .xml, .csv or .dat is recognised by content.
The preview decodes finance files before it shows them and shows the converter's own table (`result.preview`) for XLSX.
Tests: `tests/convert/finance.test.html`, `tests/node/finance-*.test.mjs`, samples in `tests/finance/fixtures/`.

## SEO pages

- `convert/js/core/pages.js` holds one entry per page (slug, title, description, h1, copy, FAQ, the
  conversion and the accepted kinds). The pages were written from it once; they are plain static HTML, edited by hand.
- Every converter page has: a unique title, meta description, one `h1`, a canonical link, Open Graph
  tags, `SoftwareApplication` JSON-LD, the working tool (`data-convert-root`), a FAQ, and a link list
  to the other converters.
- `sitemap.xml` (site root) lists the hub and every converter page. `robots.txt` allows crawling and names the sitemap.

**Rule:** when you add a page, add its entry to `convert/js/core/pages.js`, create `convert/<slug>/index.html`
(copy an existing page and change the head, h1, copy and `data-preset`/`data-from`), and add its URL to
`sitemap.xml`. `tests/convert/seo.test.html` fails if a page in `pages.js` is missing from the sitemap, its
file is missing, or its h1, canonical or JSON-LD is wrong.

## Live preview

Every converter page and the hub's converter card has a preview block below the tool:

```html
<section class="cv-pv-wrap" aria-label="Live preview" data-convert-preview></section>
...
<script type="module" src="../../convert/js/preview/mount.js"></script>
```

`js/preview/mount.js` loads after `js/ui/mount.js` and attaches to the root's `ConvertTool` (`root.convertTool`). The tool emits `cv:change` on its root whenever files,
typed text, the target or an option changes. The preview debounces that by 150 ms and drops stale results.

- **Before and after panels.** Pictures show the original and the converted picture with file size and pixel size
  (read from the drawn image). PDF inputs and outputs show page 1 at 72 dpi. Text, CSV, JSON, Base64, URL and
  line-ending conversions show the input and the output as text, with changed lines marked where the line
  structure matches (`LINE_DIFF` in `spec.js`: line endings and URL encode/decode).
- **Typed text.** Text converters have an input box. Typed text is one item named `pasted.<kind>`
  (`ConvertTool.setText`), so Convert and Download handle it like a file. A file as input disables the box.
- **Errors** from the converter show in the after panel in place (`role="alert"`).
- **Actions.** Copy (text, or a picture as PNG where the browser allows it), Download (the whole conversion, one
  file or a zip), and Swap for reversible text conversions (`REVERSE` in `spec.js`). Swap moves the output into
  the input and switches the page to the reverse conversion (`ConvertTool.swapText`).
- **Limits.** Text larger than 256 KB shows its first part, and the note says so. Pictures larger than 12 MB are
  drawn at 1200 px wide. PDF previews render page 1 only, and `pdf-to-images` and `split-pdf` run page 1 unless a
  page range is typed. Whenever a preview ran only part of the job, Download, Copy and Swap run the full conversion.

**Rule:** when you add a converter with a page, give the page the block and the script above. Keep the block out of the page's text and metadata. `tests/convert/preview.test.html`
covers PNG to JPG and JSON to CSV.

**Not done here:** `service-worker.js` has a precache list of convert files. The `js/preview/` files are not in it
yet, so offline use of the preview needs them added there (that file is owned elsewhere).

## Tests

`node tests/run.mjs convert` runs `tests/convert/*.test.html`:

- `image.test.html`: PNG to JPG (JPEG bytes, same size, background fill, resize), BMP and ICO headers, EXIF orientation, kind detection.
- `pdf.test.html`: image to PDF page count (`/Type /Page` count) and `%PDF` header, A4/Letter, merge, extract, split, PDF to PNG and JPG.
- `data.test.html`: CSV to JSON round trip, JSON to CSV, XLSX parts, Base64 round trip, URL, line endings, Markdown, HTML to text.
- `seo.test.html`: sitemap, robots, each page's h1, canonical, JSON-LD and embedded tool.
- `ui.test.html`: target picker validity, preset limits, keyboard drop zone, labels, safe file names.
- `preview.test.html`: the preview shows the PNG to JPG output and follows a new input; the JSON to CSV preview updates as text is typed and shows invalid JSON in place.

## Adding a converter

1. Write a pure function in `convert/js/core/` (no DOM unless it needs canvas).
2. Add an entry to `CONVERSIONS` in `convert/js/core/catalog.js` with `from` kinds, `options` and `run`.
3. Add a test to `tests/convert/`.
4. If it deserves a page, add it to `pages.js`, create the page and add it to `sitemap.xml`.


## Video engine (ffmpeg.wasm)

`convert/js/core/ffmpeg-engine.js` runs ffmpeg in the browser. The JavaScript is vendored in `vendor/ffmpeg` (MIT). The core (about 30 MB of WebAssembly, GPL-2.0-or-later) is loaded from jsDelivr on first use, pinned to `CORE_VERSION`. One job runs at a time; a runtime error restarts the engine and retries once. WebM audio is Vorbis: the Opus encoder in this build fails with video. Inputs over 400 MB are refused.
