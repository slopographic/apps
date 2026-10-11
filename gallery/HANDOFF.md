# Slop Gallery: handoff

A photo library that runs entirely in the browser. Classic scripts, no build step, no network. Open `gallery/index.html`.

## What works (tested)

Run `node tests/run.mjs gallery`: 56 checks in `tests/gallery/` (library and I/O page, an app page that boots the real UI in an iframe, and `reel.test.html`, which runs the gallery and SlopEdit in iframes for Make reel).

## Make reel (Gallery to SlopEdit)

Select two or more photos, then **Make reel**: the toolbar button (shown while something is selected), the Actions menu, the right-click menu on a selected photo, or "Make reel from selection" in the command palette. The dialog sets:

- **Template:** Random edit (default), Single photo, Split screen, Grid, 9:16 reel. The 9:16 reel also sets the aspect to 9:16.
- **Target length:** 5 to 600 seconds (under 5 s is refused, and the dialog stays open with the reason).
- **Pace:** slow, medium or fast. **Aspect:** 16:9, 9:16 or 1:1 (the sizes SlopEdit knows).
- **Order:** oldest first (default), newest first, or selection order.
- **Cut out subjects first:** runs each photo through Slop Cutout's engine (`shared/cutout/cutout.js`, loaded on first use) with the Fast model, as it is.

The hand-off (`ui/reel.js` `run()`, `io/reel-drive.js`):

1. A Slop Drive folder named `Reel YYYY-MM-DD HH.MM`.
2. One Drive file per photo, with its original bytes and name, in play order.
3. With the cut-out option, each photo's PNG with alpha is stored as `<name> (cutout).png` in the same folder. A progress dialog shows the stage. **Cancel** (or Escape) removes every record and the folder the reel wrote. A photo that cannot be cut out is left out of the overlays and listed at the end.
4. The manifest, `<folder>.reel.json`, type `application/x-slop-reel+json`.
5. SlopEdit opens in a new tab with `?drive=<manifest id>`. The tab is opened inside the click, so pop-up blockers allow it. If no tab can be opened, this tab navigates.

**Manifest (format `slop-reel`, version 1):**

```json
{
  "format": "slop-reel", "version": 1, "created": "2026-10-11T12:05:00.000Z", "from": "gallery",
  "template": "random | single | split | grid | reel",
  "length": 30, "pace": "slow | medium | fast", "aspect": "16:9 | 9:16 | 1:1",
  "order": "oldest | newest | selection",
  "files": ["<drive id of photo 1>", "<drive id of photo 2>"],
  "overlays": [{ "id": "<drive id of a cut-out PNG>", "of": "<drive id of its photo>" }]
}
```

`files` are in play order. `overlays` may be empty.

**SlopEdit side** (`slopedit/js/io/reel.js`, reached from `io/session.js` when the launch record is a manifest):

- Asks before replacing an open project, then starts a new project.
- Imports the files one at a time, so the bin lists them in the manifest's order.
- Maps the template (`single` → single, `split` → split-h, `grid` → grid2, `reel` → reel, `random` → one slot) and calls `SE.random.plan` and `SE.random.build` with the manifest's length, pace and aspect. It uses the templates' `SE.templates.get`, `SE.layout.fit` and `SE.layout.ensureTrack`.
- Puts each cut-out on the track above the template's slots, over the beat after its photo's (the photo's own beat for the last one), in the slot the photo used. This placement rule is in `overlayClips()` and is a choice to revisit.
- Without `SE.random` (for example, the random edit removed), it appends the photos to the timeline in order.

**Limits:** photos only, because the gallery has no video. Cut-outs use the Fast model, so the mask is only as good as the model on that photo. The cut-outs are written to Drive one at a time, so the full-resolution PNGs are not all in memory at once.

- **Import.** Files (picker), a folder dropped on the window (recursive via `webkitGetAsEntry`), a folder via `showDirectoryPicker` where the browser has it (Chromium), and one file from Slop Drive (`SlopHub.pickFromDrive`). Originals are stored as-is. Thumbnails are JPEG with the long edge at most 320 px, and EXIF orientation is applied by hand.
- **Storage.** IndexedDB, database `slop-gallery`. Why not OPFS: photos are stored as Blobs, IndexedDB writes are transactional (a restore lands whole or not at all), indexes on SHA and date serve duplicate and timeline queries, and Slop Drive already uses it. OPFS would need a worker for fast sync access and would split the metadata across two places.
- **Metadata.** EXIF `DateTimeOriginal` (then `DateTimeDigitized`, then `DateTime`), orientation, Make and Model, read from the JPEG APP1 segment by hand. Falls back to `lastModified`. Width and height are the upright size. EXIF has no time zone, so it is read as local time.
- **Duplicates.** Import skips bytes the library already has, by SHA-256 (`crypto.subtle`). The "Keep exact duplicates" checkbox keeps them on purpose. The Duplicates dialog keeps one copy per group (oldest by default, or the one you pick) and removes the rest after confirmation.
- **Timeline.** Months, newest first, with a sticky month header. A virtual list renders only the visible rows (the test asserts fewer than 160 tiles in the DOM for 5,000 photos). Arrow keys move between tiles, Enter opens, Space selects.
- **Albums.** Create, rename, delete. Adding a photo links its id and never copies the bytes (tested).
- **Favourites, likes and tags.** Liked, disliked and free-text tags live on the photo record. Photos from Slop Drive also have them written to their Drive record under `meta.gallery`, so the tags travel with the Drive file.
- **Sort mode (swipe deck).** Up likes and moves on. Down dislikes and moves on. Left goes back with no tag. Right skips ahead with no tag. Enter (or any letter or number) opens a tag field under the photo: Enter adds the tag(s), comma-separated, and moves on; Escape cancels. The queue is the timeline's visible list when the deck opens (or the selection). Key rules are in `js/core/sort.js` and tested.
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
- `js/io/`: `hash.js`, `exif.js`, `zip.js`, `source.js`, `backup.js`, `export.js`, `reel-cutout.js`, `reel-drive.js`
- `js/core/`: `db.js`, `thumb.js`, `library.js`, `import.js`, `query.js`, `sort.js`, `urls.js`, `reel.js` (reel spec, validation, manifest)
- `js/ui/`: `state.js`, `vlist.js`, `rows.js`, `timeline.js`, `viewer.js`, `sortmode.js`, `actions.js`, `albums.js`, `dupes.js`, `menus.js`, `commands.js`, `sidebar.js`, `reel.js` (Make reel dialog and run), `main.js`
- Tests: `tests/gallery/` (`gallery.test.html`, `app.test.html`, `reel.test.html`, `helpers.js`, `spec-io.js`, `spec-core.js`, `spec-app.js`, `spec-reel.js`)
