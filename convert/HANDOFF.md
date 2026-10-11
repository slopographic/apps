# Slop Convert: handoff

Slop Convert (`convert/`) converts files in the browser. Nothing is uploaded: every conversion
runs on the device. Status is `building` in `shared/apps.js`.

## Layout

- `index.html`: the hub (generated, see "SEO pages" below). Drop zone, target picker, batch, zip, units.
- `<slug>/index.html`: one static page per converter, with the same tool embedded.
- `css/convert.css`: tokens on `:root`, dark by default, light via `prefers-color-scheme` or `data-theme`.
- `js/core/`: pure converters. `catalog.js` lists them; `pages.js` lists the SEO pages.
- `js/ui/`: the tool controller (`tool.js`), its markup (`markup.js`), options, batch runner, units widget and `mount.js`.
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
| Markdown to HTML | Markdown | HTML page or fragment | No tables, nested lists or footnotes. Raw HTML is escaped (shown as text). |
| HTML to text | HTML | plain text | Visible text only; scripts and styles removed. |
| Base64 encode / decode | any / text | .base64.txt / original bytes | Decode detects PNG, JPG, PDF and other signatures to pick the extension. |
| URL encode / decode | text | text | Encode everything by default, or keep URL punctuation. A bad % sequence is reported. |
| Line endings | text | text | LF, CRLF or CR. |
| Unit converter | numbers | numbers | Length, weight, time, data size, temperature. Exact when the answer terminates; otherwise rounded to 12 places and marked ≈. |

Browser support: anything the browser cannot decode or encode (for example WebP output in some Safari versions) reports a plain error on that file; the rest of the batch still runs.

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

## Tests

`node tests/run.mjs convert` runs `tests/convert/*.test.html`:

- `image.test.html`: PNG to JPG (JPEG bytes, same size, background fill, resize), BMP and ICO headers, EXIF orientation, kind detection.
- `pdf.test.html`: image to PDF page count (`/Type /Page` count) and `%PDF` header, A4/Letter, merge, extract, split, PDF to PNG and JPG.
- `data.test.html`: CSV to JSON round trip, JSON to CSV, XLSX parts, Base64 round trip, URL, line endings, Markdown, HTML to text.
- `units.test.html`: exact conversions and the approximate flag.
- `seo.test.html`: sitemap, robots, each page's h1, canonical, JSON-LD and embedded tool.
- `ui.test.html`: target picker validity, preset limits, keyboard drop zone, labels, safe file names.

## Adding a converter

1. Write a pure function in `convert/js/core/` (no DOM unless it needs canvas).
2. Add an entry to `CONVERSIONS` in `convert/js/core/catalog.js` with `from` kinds, `options` and `run`.
3. Add a test to `tests/convert/`.
4. If it deserves a page, add it to `pages.js`, create the page and add it to `sitemap.xml`.
