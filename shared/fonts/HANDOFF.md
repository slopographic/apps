# Fonts and "Get more": handoff

Two things ship together: a bundled set of open-licence fonts that every editing app can use offline, and an
opt-in "Get more" that downloads third-party font packs. Both feed one shared font picker.

## Files

| Path | Role |
| --- | --- |
| `shared/fonts/library/` | Bundled WOFF2 faces, one `LICENSE` per family (SIL OFL 1.1 text), and `index.json` (family, style, weight, file, licence, source URL). About 4.1 MB. |
| `shared/fonts/picker.js` | `window.SlopFonts`: lists families, loads a family with `FontFace`, and `attach(select)` fills a `<select>` and adds the Get more button. |
| `shared/fonts/catalog.js` | `window.SlopFontCatalog`: every family the app can use (bundled from `index.json`, plus installed packs and the person's own files), faces by weight and style, PostScript name parsing, the closest bundled family, and `addUserFile` (a font file the person owns). |
| `shared/fonts/missing.js` | `window.SlopFontCheck.ask(needs, uses)`: the asset prompt for a font that is not installed (download from the library, drop a file, or use the closest font). |
| `vendor/fontkit/fontkit.min.js` | `@pdf-lib/fontkit` 1.1.1 (MIT), bundled for browsers and loaded on first use by `SlopFontCatalog.fontkit()`. pdf-lib needs this build: fontkit 2.x has a different subset API. |
| `shared/library/packs.json` | The one config file for packs: the allowed download hosts and the pack list (empty today). |
| `shared/library/manifest.js` | Pack rules and the SHA-256 and size check (`window.SlopLibraryManifest`, also `module.exports` for Node tests). |
| `shared/library/store.js` | IndexedDB store `slop-library` (`window.SlopLibraryStore`). |
| `shared/library/get-more.js` | The Get more dialog (`window.SlopLibrary`). |
| `tests/node/font-library.test.mjs` | Manifest, hash, licence, and bundled-font checks. |
| `tests/shared/font-library.test.html` | Browser test: bundled families in the picker, licence shown before any download (network mocked). |

## Bundled fonts

Twelve families, Latin and Latin Extended subsets, outlines unmodified, from the Google Fonts repository
(`https://github.com/google/fonts/tree/main/ofl/<family>`): Inter, Roboto, Open Sans, Lato, Montserrat,
Playfair Display, Merriweather, Oswald, Source Sans 3, Nunito, Raleway, Space Mono. Variable files where the
family has them. Every family folder holds its OFL `LICENSE`. Nothing is loaded from a CDN at run time.

To rebuild: download each file from `https://raw.githubusercontent.com/google/fonts/main/ofl/<dir>/`, subset to
Latin and Latin Extended with `fontTools` (`subset.Subsetter`, `flavor = "woff2"`), write the entries to
`index.json` with a `category` (`sans`, `serif` or `mono`), and keep the family names equal to the `BUNDLED` list
in `picker.js` (the Node test checks this).

## Fonts for every app: the catalogue, the asset prompt, your own files

One font list: `index.json` (bundled) plus the installed packs in IndexedDB. Nothing else lists families.

- **Missing fonts.** An app that is about to edit text with a font it does not have calls
  `SlopFontCheck.ask(needs, uses)` with `needs = [{ family, closest, pack }]`. The prompt names each family and offers
  three answers: **Download from the library** (opens Get more on that pack's confirmation; nothing downloads until the
  person confirms there, and it needs the pack in `packs.json`), **Drop your own file…** (or drop it on the row), and
  **Use the closest font instead** (`SlopFontCatalog.closestFamily`: Source Sans 3 for sans, Merriweather for serif,
  Space Mono for mono). `ask` resolves a `Map` of family to `{ family, how }`, or `null` when the person cancels the edit.
- **Your own files.** `SlopFontCatalog.addUserFile(file)` reads a TTF, OTF or WOFF with fontkit and stores it in
  IndexedDB like a pack (`kind: 'font'`, `licence: 'user'`, id `user-<family>-<sha8>`). Once stored it appears in every
  font picker. WOFF2 is refused for files you add: fontkit cannot subset it, so a PDF could not embed it.
- **Embedding.** A face is embedded in a saved PDF only as TTF, OTF or WOFF. A bundled family therefore names its
  embeddable copy in `index.json` (`"pdf"`): Source Sans 3, Merriweather and Space Mono today (Regular, Latin subsets,
  instanced from the Google Fonts variable files with fontTools). Bundled WOFF2 faces remain the screen copies.
- **Barlow.** `packs.json` lists "Barlow and Barlow Condensed": eight static TTFs from `google/fonts` (`main` branch),
  each with its SHA-256. A file that changes upstream is refused and nothing is stored.

## Rules for "Get more"

1. **Downloads happen only on click.** Opening the dialog reads `packs.json` and nothing else. A pack downloads
   only after its Download button and then the confirmation button. The confirmation shows the licence and size
   and the hosts. Nothing downloads on load, on a timer, or when a font is picked.
2. **Hosts.** A pack file must be `https://` on a host in `packs.json` `hosts`. The list today is
   `raw.githubusercontent.com` and `cdn.jsdelivr.net`. Exact host match only (no wildcard, no sub-domains). A
   redirect that ends on another host is refused. Add a host here only after review, and only for a project that
   publishes its font files openly.
3. **Licences.** A pack declares one of `OFL-1.1`, `Apache-2.0`, `MIT`, `CC0-1.0`. Anything else is dropped before
   the dialog shows it.
4. **Files.** Only font files (`.woff2`, `.woff`, `.ttf`, `.otf`). Each entry needs its exact byte `size` and its
   lowercase `sha256`. Every file is verified before anything is stored; a pack is written in one IndexedDB
   transaction or not at all. Requests carry no credentials.
5. **Storage.** IndexedDB `slop-library` only (`packs` and `files` stores). Nothing goes into localStorage.
   Remove a pack from the same dialog.

Adding a pack: list it in `packs.json`. Each file's `sha256` is the digest of the exact bytes at its URL. Compute it
with `sha256sum`, and set `size` to the byte count. Set the pack `size` to the sum of its file sizes.

```json
{ "id": "example-sans", "name": "Example Sans", "licence": "OFL-1.1", "licenceUrl": "https://openfontlicense.org",
  "description": "Regular and Bold.", "size": 123456,
  "files": [ { "name": "ExampleSans-Regular.woff2", "url": "https://raw.githubusercontent.com/<owner>/<repo>/<ref>/ExampleSans-Regular.woff2",
               "size": 60000, "sha256": "<64 hex>", "family": "Example Sans", "weight": "400", "style": "normal" } ] }
```

With no packs listed, the picker button reads "Get more (no packs listed)" and the dialog says so.

## Where the picker is used

- **Slop PDF**: the asset check before the first text edit of a document (`pdf/js/editor/font-check.js`). New text is set
  in an installed family (or the answer given), never in the document's own subset. The offline single-file build keeps
  the standard fonts only, because its shared font scripts are stripped.
- **PhotoSlop**: type layer font (`js/type/props.js`).
- **SlopVector**: control bar, Character panel and the Type menu (`js/ui/binds.js` `fontSel`, `js/ui/menus.js`).
- **SlopLabel**: text Family and barcode text font (`js/ui/props-types.js` `familySelect`). Library families render
  on screen. PDF and ZPL output use the Sans base-14 faces because the library faces are not embedded there.
- **Slop Docs and Slop Slides: not wired.** Their layout engines measure and embed TrueType bytes (`.ttf`) and
  cannot use WOFF2 faces. Wiring them needs TTF copies of the families (about 8 MB more) or a WOFF2 decoder.
  Decide that before adding them to the picker.

## Offline builds and the service worker

- The picker tag carries `data-offline="strip"`. The single-file offline build drops it, and each app keeps its
  plain font list there.
- `tools/pwa-precache.mjs` now lists the picker, the library scripts, `index.json`, `packs.json` and every bundled
  file. Run `node tools/pwa-precache.mjs` and bump `VERSION` in `service-worker.js` to refresh the precache. This
  handoff does not edit `service-worker.js`.

## Tests

```
node tests/run.mjs font-library        # Node tests and the browser test page
node tests/run.mjs pdf.test            # includes the PDF edit-text font tests (tests/pdf/pdf.spec-edit-fonts.js)
```
