# Slop Drive: handoff

Slop Drive is the local file drive that every Slopographic app shares. It is an app at `/drive/` and a shared model in `shared/hub.js`. It also includes a portable one-file backup (`shared/backup/`) and an honest hard-reload reminder (`shared/guard.js`). Nothing leaves the browser.

**Status: beta** (registered in `shared/apps.js` as `drive`, `accepts: ['*']`, so "Send to Slop Drive" appears in every app's Send to menu).

## Tests
`node tests/run.mjs drive` runs 208 tests on 24 pages, plus the Node file `tests/node/faces-drive-gallery.test.mjs`, all green at the time of the face detection change. The table lists the main pages.

| Page | What it covers |
|---|---|
| `model.test.html` | v1 to v2 migration, normalising records from an old cached hub, folders, path, move/rename, blob replace, trash and `inTrash`, `touch`, remove/clear, the old API surface, `sendTo` with a folder or an existing id |
| `app-ops.test.html` | the app: new folder, breadcrumbs, tree, unique names, upload with folder paths, move (and refusing a folder into itself), `dropOn` (crumbs, root, star), deep copy and duplicate, cut/paste, trash and restore rules, delete forever, empty Trash, Recent/Starred/search/kind filter, folder zip, Open with (`?drive=`) |
| `app-ui.test.html` | Grid thumbnails, List header sorting, Compact, the 1–6 keys, Columns, Nodes (collapse, zoom, pointer-drag a node onto a folder), squarified treemap maths, treemap drill-in, sunburst, click/Ctrl/Shift selection, marquee, arrow keys, drag onto a breadcrumb, Quick Look (image, text, PDF pages), the info panel with dimensions, shortcuts, the context menu, the duplicate finder |
| `backup.test.html` | zip round trip (stored and deflated), the codec (Blob, File, typed arrays, Map/Set/Date/RegExp, NaN, -0, BigInt, `$` keys), export, replace, merge, rejecting non-backups, the dialog |
| `guard.test.html` | Ctrl+Shift+R, Ctrl+F5 and Cmd+Shift+R are caught (plain Ctrl+R is not), the dialog text and buttons, Export backup, Reload anyway, "Don't show again", the `beforeunload` prompt only while work is unsaved, pages with a foreign `window.SlopUI` (the homepage), the folder-aware picker, `saveToDrive` |
| `commands.test.html` | the command list, registering with SlopCmd (a stub), handing shortcuts over, the files provider |
| `newmenu.test.html` | the New ▸ submenu (toolbar and right-click), creating `Untitled document.sdoc` etc. in the open folder, unique names, opening in the creating app |
| `mobile.test.html` | 390×844: no sideways scroll in any view, drawer, tap to open, details sheet, long-press menu |
| `panel.test.html` | details panel width: 260 px to 60% clamp, rail under 300 px, arrow keys and Home/End on the grip, drag, double-click reset, stored width across a reload |
| `sort.test.html` | each sort key ascending and descending with folders first, default directions, header and Alt+S menu arrows, a sort per view, kept across a reload |
| `tags.test.html` | add (lowercase, unique, modified date kept), remove, the details panel chips, tags across a reload, sidebar tag counts and the drive-wide tag filter, the Tags column |
| `columns.test.html` | list columns: header menu, drag to reorder, edge and keyboard resize (min clamp), order and widths across a reload, reset |
| `columns-view.test.html` | Columns view: the `.col-pv` preview is the last column and shows the selected file, one preview at a time, arrow keys, the preview image still loads after the info panel is open and the view re-renders, a folder selection removes it |
| `faces.test.html` | Face detection with a stubbed detector: Find faces stores the count per file id and modified time, the details panel shows "2 faces" and a Find faces action, Quick look draws one box per face, an edited file is checked again |
| `faces-optin.test.html` | The opt-in: the dialog on first use (wording, the Profile link), Not now changes nothing, Turn on carries on, turning it off stops detection, the two Profile switches (Drive and Gallery sections) stay in step |
| `thumbs.test.html` | a PNG thumbnail kept in IndexedDB, a text card with its first line, a CSV card with its header, a Slop document's first paragraph, a cache hit that does not regenerate, a changed modified time that does, a removed file's cache entry gone, a broken file that still gets a card with the list rendering, a `.s3d` thumbnail and live 3D preview (orbit, wheel zoom, reset; skipped with a console note without WebGL) |
| `audio-player.test.html` | a WAV's full waveform (1000 peaks), a click on the waveform seeks and moves the playhead, Space plays and pauses, arrows seek 5 s, speed and volume, the mini bar keeps playing after Quick look closes and Stop ends it, Next through the list, an undecodable MP3 names its format |

The shared frame `tests/drive/frame.html` loads the bare kit. `?db=` sets the Drive database name and `?foreign=1` mimics the homepage. Helpers are in `tests/drive/util.js`.

## Shared model (`shared/hub.js`, `window.SlopHub`)
- **Database:** IndexedDB `slop-drive`, version 2. Tests can override the name with `window.SLOP_DRIVE_DB`.
  - Store `files`: `{ id, name, type, size, from, time, modified, opened, folderId, starred, trashedAt, meta, blob }`.
  - Store `folders`: `{ id, name, parentId, time, modified, starred, trashedAt }`.
  - `null` folderId/parentId means the root.
- **Migration:** the v1 to v2 upgrade adds `folders` and rewrites v1 records with the defaults. Every read also runs `normFile`/`normFolder`, so records written later by an old cached hub still work.
- **Unchanged API:** `put`, `get`, `list`, `remove`, `clear`, `sendTo`, `sendMenuItems`, `consumeLaunch`, `pickFromDrive`, `register`, `on`, `emit`, `appsAccepting`, `self`.
  - `list()` now hides trashed files by default. It takes `{ accept, folderId, trashed: false|true|'any' }`.
- **New:**
  - Files: `update(id, patch)` and `touch(id)`.
  - Folders: `createFolder(name, parentId)`, `getFolder`, `listFolders({ parentId })`, `updateFolder`, `removeFolder`, `folderPath(id)`, `inTrash(item, folderMap)`.
  - Pickers and saving: `pickFolder()` and `saveToDrive(blob, name)`.
  - Helpers: `fmtSize`, `loadScript`, `driveTx`.
  - `sendTo(app, blob, name, { folderId, id })`. With `id`, it opens an existing file without making a copy.
  - `sendMenuItems(getBlob, name, type, { folder: true })` adds "Save to Slop Drive…", which asks for a folder.
- **Change events:** every change emits `drive:put|update|remove|folder|clear` plus a generic `drive:change` on the BroadcastChannel. The Drive app listens and refreshes.
- **Pickers:** `shared/drive/picker.js` (`SlopDrivePicker.pickFile` / `pickFolder`) is loaded on first use. It shows breadcrumbs, folders and a search across all folders. It keeps the old `.hub-grid` / `.hub-item` classes and injects its own CSS. I did not edit `slopui.*`.

## Backup (`shared/backup/`)
- **Entry point:** `index.js` (`window.SlopBackup`) is the small helper any page can include. It loads the rest on demand:
  - `exportNow()`
  - `importFile(file, { mode: 'merge'|'replace' })`
  - `openDialog()`
  - `kit()`: SlopUI, loaded beside a foreign `window.SlopUI` if the page has one.
- **Format:** `slopographic-backup-YYYY-MM-DD.slop` is a stored ZIP containing:
  - `manifest.json`
  - `local.json`: every localStorage key.
  - `idb.json`: every database from `indexedDB.databases()`, including `slop-drive`. Each entry has its schema, indexes, keys and values.
  - `blobs/<n>`: binary values, kept out of the JSON. No base64.
- **Codec:** `codec.js` handles the structured-clone types.
- **Merge** means the backup wins on a conflict and things that exist only on this device are kept.
- **Replace** clears localStorage and every store in the backup before writing.
- **Restore rules:**
  - Missing stores are created only when that does not lower an app's version.
  - Otherwise the store is reported as skipped.
  - A blocked upgrade (another tab is open) fails after 6 s with a clear message.
- **Limits:** a ZIP is limited to 4 GB (no Zip64). Databases that are not in the backup are left alone, even with Replace.

## Guard (`shared/guard.js`, `window.SlopGuard`)
- **Keys:** Ctrl+Shift+R, Cmd+Shift+R, Ctrl+F5 and Shift+F5 are prevented and open the dialog: [Export backup] [Reload anyway] [Cancel], plus "Don't show this again". That choice is stored in localStorage `slop-guard-off`.
- **Export backup** keeps the dialog open so people can reload afterwards.
- **Unsaved work:** apps call `SlopGuard.setUnsaved(key, true|false)`. `beforeunload` asks only while some key is set.
- **Overridable for tests:** `SlopGuard.reload`.
- **Fallback:** it uses `window.confirm` if the kit cannot load.

## Drive app (`drive/`)
- **Scripts:** classic scripts that share `window.DR`. Load order is set in `index.html`.
  - `js/core/`:
    - `util.js`: state `DR.S`, prefs, icons.
    - `kinds.js`
    - `store.js`: in-memory mirror and tree helpers.
    - `ops.js`: new folder, rename, move, copy, star, trash, restore, purge, empty Trash.
    - `io.js`: upload, drop folders, zip download, Open with.
    - `thumbs.js`: the thumbnail queue (one job at a time), memory and IndexedDB lookups, `DR.thumb`. See "Thumbnails" below.
    - `thumb-cache.js`, `thumb-make.js` (one generator per kind), `thumb-card.js` (the typed card), `render3d.js` (Slop 3D sources, loaded on demand), `pdf.js` (vendored PDF.js), `csv.js` (CSV/TSV reader).
    - `player.js`: the one audio player (`DR.player`), owning its object URL.
    - `dupes.js`: size, then SHA-256; dHash for similar images.
  - `js/ui/`:
    - `shell.js`, `sidebar.js` (places, tree, storage meter, persist), `items.js` (what is visible, navigation, history).
    - View files: `view-files.js` (grid, list, compact), `view-columns.js`, `view-nodes.js`, `view-usage.js` (treemap, sunburst).
    - Interaction: `select.js` (click, Shift, Ctrl, marquee, touch), `dnd.js` (pointer drag onto any `[data-drop]`; Alt or Ctrl copies; file and folder drops from the computer; dropping a `.slop` file offers a restore).
    - Panels and dialogs: `menus.js`, `info.js` (details panel or phone sheet, previews), `quicklook.js`, `dupes-ui.js`.
    - Previews: `preview-kinds.js` (text, CSV table, card), `preview-3d.js` (live 3D view), `audio-view.js` (player with waveform), `mini-player.js` (bar at the bottom while audio plays).
    - `keys.js`, and `empty.js` (Sloppo empty states via `shared/sloppo`).
    - `list-cols.js`: the List columns (choose, reorder, resize; persisted in `S.cols`). `info-width.js`: the details panel grip, clamp and rail.
  - `js/core/tags.js`: tags live in `meta.tags` on each file, so backups and copies keep them. Sorting is per view (`S.sorts`, set through `DR.setSort`).
  - `js/app/main.js`: render and boot.
- **CSS:** `base.css` (tokens for Pro/Light/Classic 98), `views.css`, `panels.css`, `viz.css`, `mobile.css` and `preview.css` (thumbnails in icon slots, 3D view, CSV table, audio player, mini bar).
- **Item keys:** `d:<folderId>` and `f:<fileId>`.
- **Views:** Columns, Nodes and Usage show the folder tree. In Recent, Starred, Trash and search they fall back to List (`DR.viewNow()`).
- **Trash model:**
  - Trashing a folder marks only the folder. Its contents are hidden through `inTrash`.
  - Restoring goes back to the old folder, or to the root if that folder is gone or still in the Trash.
  - Delete forever removes a folder's whole subtree.
- **Launch:** `?drive=<id>` reveals that file. This is what "Send to Slop Drive" uses.
- **Storage:** the meter uses `navigator.storage.estimate()`. `persist()` is requested after the first upload and from the sidebar and the More menu.
- **Shortcuts:** see `DR.SHORTCUTS` or press `?` in the app.

## New ▸ documents (`js/ui/newdoc.js`)
- `DR.creatables()` lists every `SLOP_APPS` app with `creates: [{ label, ext, mime }]` (Docs, Tables, Slides).
- The toolbar New button and the right-click menu (empty space, or a folder) have a "New ▸" submenu.
  `DR.createNew(c | appId, folder)` puts an empty blob of that mime named `Untitled <label>.<ext>`
  (made unique) into the folder and opens it with `SlopHub.sendTo(app, null, name, { id })`.
  Apps treat a zero-byte native file as a new blank document.
- `DR.appsFor` lists the creating app first for its own native type, even if `accepts` leaves it out.
- Commands `drive.new.<appId>` ("New document (Slop Docs)" …) are in the palette.

## Command palette (SlopCmd)
- `js/ui/commands.js` describes every action as a command (`DR.commands()`, ids `drive.*`, groups File, Edit, Go, View, Tools and Help). Each command has default keys.
- When `window.SlopCmd` exists, `DR.wireCommands()` does the following:
  - calls `init({ app: 'drive' })` and `register(...)`;
  - adds a "Files" palette provider (`addProvider` or `provider`, whichever exists) that reveals matching files and folders;
  - shows the ⌘K button in the top bar.
- While SlopCmd is active it owns the shortcuts, so they can be rebound. `keys.js` then handles only arrows, Home/End, Enter, Space and Escape. Without SlopCmd, `keys.js` falls back to its own map.
- Menus read key labels through `DR.keyLabel(id)`, which calls `SlopCmd.keyFor`.
- More ▸ "Search commands…" and Help ▸ "Keyboard shortcuts…" use `SlopCmd.open` / `openKeymap`.
- `index.html` already includes `../shared/commands/commands.css` and `commands.js`. They return 404 until that package lands, and the app works without them.

## Ideas not done
- Undo for move and rename (the Trash already covers deletes).
- Sharing a folder as a link is impossible by design, since everything is local.
- A virtualised list for drives with tens of thousands of files. Rendering is chunked now, so it stays usable.

## Thumbnails (`js/core/thumbs.js` and friends)
- **Where:** every file gets one in Grid, the List's icon column, the Columns preview column (via its preview), the details panel and duplicates. Folders keep their glyph.
- **Kinds:**
  - Images (PNG, JPG, WebP, GIF, BMP, AVIF and so on): scaled down to 320 px. SVG is rasterised.
  - PDF: page 1 with the vendored PDF.js (under 60 MB).
  - Video: a frame one second in (the last frame of a shorter clip).
  - Audio (under 80 MB): a waveform from decoded samples (OfflineAudioContext). It keeps 1000 peaks, which the player uses as its full waveform.
  - `.s3d`: rendered offscreen with the Slop 3D renderer and camera (default perspective view, framed on the scene). Without WebGL it is a "3D" card.
  - Slop documents (`.sdoc`, `.stab`, `.sslide`, `.sinv`; JSON, under 20 MB): a card with the first paragraph, slide text, or the first sheet's first cells, in the app's colour.
  - Text and code: a card with the first lines. CSV and TSV: a card with the header and the first rows.
  - Everything else, and anything that fails: a typed card with the extension, size and kind. Failures are logged once as a `console.warn`. A new, empty file gets its card without a warning.
- **Not done:** Slop Docs, Tables and Slides are not rendered page by page. Their apps are DOM-bound and cannot be loaded without a worker, so the cards show the first text instead.
- **Cache:** IndexedDB database `slop-drive-thumbs` (store `thumbs`, key = file id), record `{ id, modified, ver, blob, info }`. A record is used only while `modified` and `ver` match. `ver` is `VER` in `thumbs.js`: bump it when a generator changes. Records of removed files are pruned on every refresh. The database is left out of backups (`shared/backup/core.js`), since it is made again on demand.
- **Queue:** one job at a time, through a chained promise. Cache reads run in the same queue, and `DR.thumb` never rejects.
- **Stats** for tests and debugging: `DR.thumbStats` `{ made, cached }`. `DR.thumbReset()` forgets the in-memory promises only.

## Previews (Quick look and the details panel)
- Images and PDFs: the shared viewer (`SlopPreview`), as before.
- `.s3d`: a live 3D view. Drag to orbit, Shift- or right-drag to pan, wheel to zoom, Reset view. Each view owns a WebGL context: at most 4 are live, and contexts of views that left the page are released by a one-second sweep.
- Audio: the player (`audio-view.js`) with the full waveform. Click or drag to seek. Play/pause, back and forward 10 s, previous and next file in the list, speed (0.5× to 2×), volume and the time. Space plays or pauses and the arrows seek 5 s while the player has focus. The shared engine (`core/player.js`) keeps the sound going when Quick look or the panel closes. The mini bar at the bottom shows the file with play/pause, previous, next and Stop. Playing a file moves on to the next audio file in the list when one ends.
  - Formats are whatever the browser decodes. Tested here: WAV. A file the browser cannot play shows a message naming its format (for example "cannot play MP3 audio").
- Video: native controls. Text and code: the start of the file in a scrollable block (4 KB in the panel, 400 KB in Quick look).
- CSV and TSV: a table of the first 200 rows, from the first 256 KB, with the header row sticky.
- Anything else: its card at full size, with the size and type. The open-in options are in the panel's actions and in Quick look.

## Limits
- Thumbnails of files over the size limits (PDF 60 MB, audio 80 MB, documents 20 MB) are cards, not pictures.
- The 3D view and thumbnails need WebGL. Without it, the 3D view explains why, and a `.s3d` thumbnail is a card. Only `.s3d` is handled; `.glb`, `.gltf` and `.obj` are still plain files.
- Audio waveforms are decoded in the browser, so a format it cannot decode has no waveform, but it still plays when the browser can play it.
- Each generator change needs `VER` bumped in `thumbs.js`, or old cached thumbnails stay.

## Face detection (opt-in, `shared/faces/`)
- **Off by default.** Find faces (Actions, right-click, or the details panel) for raster pictures; the first use opens the
  explanation dialog (`SlopFaces.askOptIn('drive')`), and Profile has the same switch. The model, its licence and how to
  remove it are in `shared/faces/HANDOFF.md` and `vendor/face/README.md`.
- **Details panel:** a "Faces" row for pictures when the setting is on: the count, or "Not checked yet".
- **Quick look:** the face boxes are drawn over the picture (`SlopFaces.drawBoxes`) when the setting is on and the picture has been checked.
- **Results:** `SlopFaces.analyse('drive', file id, file modified time, blob)`, kept in IndexedDB `slop-faces`. An edited file is checked again.
- **Code:** `js/ui/faces.js` (`DR.isFaceable`, `DR.faceStamp`, `DR.facesOf`, `DR.findFaces`, `DR.faceOverlayFor`). `info.js`, `menus.js` and `quicklook.js` call it.
- **No identity:** the detector only finds faces. Nothing is named or matched.
