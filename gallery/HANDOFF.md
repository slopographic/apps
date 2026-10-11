# Slop Gallery: handoff

A photo library that runs entirely in the browser. Classic scripts, no build step, no network. Open `gallery/index.html`.

## What works (tested)

Run `node tests/run.mjs gallery`: 42 checks in `tests/gallery/` (library and I/O page, and an app page that boots the real UI in an iframe).

- **Import.** Files (picker), a folder dropped on the window (recursive via `webkitGetAsEntry`), a folder via `showDirectoryPicker` where the browser has it (Chromium), and one file from Slop Drive (`SlopHub.pickFromDrive`). Originals are stored as-is. Thumbnails are JPEG with the long edge at most 320 px, and EXIF orientation is applied by hand.
- **Storage.** IndexedDB, database `slop-gallery`. Why not OPFS: photos are stored as Blobs, IndexedDB writes are transactional (a restore lands whole or not at all), indexes on SHA and date serve duplicate and timeline queries, and Slop Drive already uses it. OPFS would need a worker for fast sync access and would split the metadata across two places.
- **Metadata.** EXIF `DateTimeOriginal` (then `DateTimeDigitized`, then `DateTime`), orientation, Make and Model, read from the JPEG APP1 segment by hand. Falls back to `lastModified`. Width and height are the upright size. EXIF has no time zone, so it is read as local time.
- **Duplicates.** Import skips bytes the library already has, by SHA-256 (`crypto.subtle`). The "Keep exact duplicates" checkbox keeps them on purpose. The Duplicates dialog keeps one copy per group (oldest by default, or the one you pick) and removes the rest after confirmation.
- **Timeline.** Months, newest first, with a sticky month header. A virtual list renders only the visible rows (the test asserts fewer than 160 tiles in the DOM for 5,000 photos). Arrow keys move between tiles, Enter opens, Space selects.
- **Albums.** Create, rename, delete. Adding a photo links its id and never copies the bytes (tested).
- **Favourites, likes and tags.** Liked, disliked and free-text tags live on the photo record. Photos from Slop Drive also have them written to their Drive record under `meta.gallery`, so the tags travel with the Drive file.
- **Sort mode (swipe deck).** Up likes and moves on. Down dislikes and moves on. Left goes back with no tag. Right skips ahead with no tag. The queue is the timeline's visible list when the deck opens (or the selection). Key rules are in `js/core/sort.js` and tested.
- **Filters.** Name, year, month, camera, favourites, album, and tag (liked only, disliked only, untagged only).
- **Viewer.** Full screen, arrows, Fit or 100%, info panel, like and dislike (L and D), remove (Delete, after confirmation), slideshow at 3, 5 or 10 seconds.
- **Export.** One photo downloads as its original file. Several photos download as one store-only zip (`js/io/zip.js`, CRC-32 checked on read). The whole library backs up to one zip with a manifest, originals and thumbnails. Restore validates the manifest and every SHA-256 before writing, then writes in one transaction.
- **Right-click menus** on photos, albums, month headers and the empty grid (SlopCtx and SlopUI).
- **SlopCmd commands** for the main actions (`js/ui/commands.js`).
- **Layout.** Checked at 390 px: no horizontal page scroll. The side panel becomes a drawer behind the Filters button.

## Test hook

`?db=<name>` (or `window.SLOP_GALLERY_DB`) picks the database name. The tests use it so they never touch a real library.

## What is missing

- **Face and object recognition** are not built. They would need a local model (for example ONNX or WebGPU), which is a separate piece of work.
- **HEIC and RAW** files are refused, because Chromium cannot decode them here. They are reported as "could not be read" and not stored.
- **Videos** are not supported.
- **Editing** (crop, rotate on disk, adjust) is not built. Viewer and deck are read-only apart from tags.
- **Similar, not identical, photos** are not grouped. Duplicates are exact bytes only.
- **Zip64** is not supported. The zip and backup writers refuse archives over 4 GB.
- **Drive tags** flow one way, into the Drive record, for photos that came from Drive. Changes made in Slop Drive's own UI are not read back.
- **Drive import** takes one file at a time.
- **Folder import** via `showDirectoryPicker` is Chromium only. Dropping a folder works wherever the browser exposes `webkitGetAsEntry`.
- **No screenshot** exists yet for the home page card (`assets/shots/gallery.jpg`). The catalog falls back to a generated tile.

## Next steps

1. Decode HEIC through a local WebAssembly decoder, if the licence allows it.
2. Add a local model for face and object tags, with the results written to the photo's `tags`.
3. Move thumbnail generation to a worker, so large imports do not block the page.
4. Add a "similar photos" view based on a perceptual hash, next to the exact-match view.
5. Read Drive tag edits back into the gallery.

## Files

- `index.html`, `css/gallery.css`, `css/viewer.css`
- `js/io/`: `hash.js`, `exif.js`, `zip.js`, `source.js`, `backup.js`, `export.js`
- `js/core/`: `db.js`, `thumb.js`, `library.js`, `import.js`, `query.js`, `sort.js`, `urls.js`
- `js/ui/`: `state.js`, `vlist.js`, `rows.js`, `timeline.js`, `viewer.js`, `sortmode.js`, `actions.js`, `albums.js`, `dupes.js`, `menus.js`, `commands.js`, `sidebar.js`, `main.js`
- Tests: `tests/gallery/` (`gallery.test.html`, `app.test.html`, `helpers.js`, `spec-io.js`, `spec-core.js`, `spec-app.js`)
