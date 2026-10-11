# Fonts and "Get more": handoff

Two things ship together: a bundled set of open-licence fonts that every editing app can use offline, and an
opt-in "Get more" that downloads third-party font packs. Both feed one shared font picker.

## Files

| Path | Role |
| --- | --- |
| `shared/fonts/library/` | Bundled WOFF2 faces, one `LICENSE` per family (SIL OFL 1.1 text), and `index.json` (family, style, weight, file, licence, source URL). About 4.1 MB. |
| `shared/fonts/picker.js` | `window.SlopFonts`: lists families, loads a family with `FontFace`, and `attach(select)` fills a `<select>` and adds the Get more button. |
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
```
