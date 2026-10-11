# Slop Drive: handoff

Slop Drive is the local file drive that every Slopographic app shares. It is an app at `/drive/` and a shared model in `shared/hub.js`. It also includes a portable one-file backup (`shared/backup/`) and an honest hard-reload reminder (`shared/guard.js`). Nothing leaves the browser.

**Status: beta** (registered in `shared/apps.js` as `drive`, `accepts: ['*']`, so "Send to Slop Drive" appears in every app's Send to menu).

## Tests
`node tests/run.mjs drive` runs 117 tests on 13 pages, all green:

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
    - `thumbs.js`: image, SVG, PDF via `vendor/pdfjs`, video poster, dimensions.
    - `dupes.js`: size, then SHA-256; dHash for similar images.
  - `js/ui/`:
    - `shell.js`, `sidebar.js` (places, tree, storage meter, persist), `items.js` (what is visible, navigation, history).
    - View files: `view-files.js` (grid, list, compact), `view-columns.js`, `view-nodes.js`, `view-usage.js` (treemap, sunburst).
    - Interaction: `select.js` (click, Shift, Ctrl, marquee, touch), `dnd.js` (pointer drag onto any `[data-drop]`; Alt or Ctrl copies; file and folder drops from the computer; dropping a `.slop` file offers a restore).
    - Panels and dialogs: `menus.js`, `info.js` (details panel or phone sheet, previews), `quicklook.js`, `dupes-ui.js`.
    - `keys.js`, and `empty.js` (Sloppo empty states via `shared/sloppo`).
    - `list-cols.js`: the List columns (choose, reorder, resize; persisted in `S.cols`). `info-width.js`: the details panel grip, clamp and rail.
  - `js/core/tags.js`: tags live in `meta.tags` on each file, so backups and copies keep them. Sorting is per view (`S.sorts`, set through `DR.setSort`).
  - `js/app/main.js`: render and boot.
- **CSS:** `base.css` (tokens for Pro/Light/Classic 98), `views.css`, `panels.css`, `viz.css` and `mobile.css`.
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
- Text thumbnails: text files show a badge in Grid, and a preview in the info panel and Quick Look.
