# shared/intake: one way in, one way out (window.SlopIntake, window.SlopOuttake)

The owner's rule: **one way only** for getting files into an app, and one way for getting them out. Every source of files
ends in `SlopIntake.take(files, { source })`, runs one pipeline, and reaches the one reader the app registered. Every
"Open in…" / "Send to" / "Save to Slop Drive" menu is made by one builder, `SlopOuttake.items`.

## Files (load in this order, before the app's own scripts)

| File | What | Pure? |
|---|---|---|
| `rules.js` | `SlopIntake.rules` (also `SlopDrop.rules`): `check(file, rules)` with the reason, `acceptAttr`, `describe` (toast words), `dragLabel`, `size`, `ext`. Moved here from shared/drop. | yes (Node tests) |
| `normalize.js` | `SlopIntake.normalize(input)` → `File[]` from a File, FileList, array, DataTransfer (drop), clipboard data (a paste, also `<img src="data:…">`), a Slop Drive record `{ id, name, type, blob }` (kept as `file.slopDrive`), a converted result `{ name, blob }`, a Blob, a data: URL, a launch file handle, or a Promise of these. `dataUrlFile`, `toFile`, `listOf`, `pool(items, n, fn)` (bounded pool). | yes |
| `pipeline.js` | `SlopIntake.createPipeline(env)`: register / spec / take, the steps below. The page's side comes in as `env`. | yes |
| `intake.js` | The page's one pipeline: the events, the first-use notice (shared/firstrun), the Add or New question (`SlopIntake.choose`, a SlopUI dialog `.si-choose`), the feedback (the drop zone's rows, else a toast). `register`, `take`, `on`, `view`, `accepts`, `acceptAttr`, and the old paste-only `attach`. | no |
| `sources.js` | The adapters: paste (one listener per page), `pick`, `fromDrive`, `launch` (?drive= and launchQueue), `fromConvert`, `sample`, `dropTarget`. | no |
| `outtake.js` | `SlopOuttake`: the one "Open in…" builder (after shared/hub.js; `SlopHub.openIn` and `SlopHub.sendMenuItems` are it). | no |

Pages: `<script>` tags for rules, normalize, pipeline, intake, sources (in that order) where the page has files coming in;
`shared/drop/panel.js` and `drop.js` after them for a drop zone; `outtake.js` right after `shared/hub.js`.
`shared/convert/load.js` loads them for the Convert dialog; `shared/offline/manifest.js` lists them for offline copies.

## The pipeline (one per `take()`; a single file is a batch of one)

1. **normalize** the source's input to Files.
2. **accept**: the spec's rules (`accept: { types, exts, noun, maxBytes, any, allowEmpty }`) or `accept(file)` → true |
   false | 'reason'; `except(file)` leaves some to the app's own path (its clipboard copies). Refusals keep their reason
   ("notes.txt is not a picture"). `route(files, batch)` → the files kept (the app hands the rest to another spec or a dialog).
3. event **`slop:intake-before`** (cancelable: `preventDefault()`, or return false from `SlopIntake.on('before', fn)`).
4. **gates, in order**: the first-use notice (`notice: { title, lines, downloads }`, once per batch whatever the source);
   the count and size limits (`limit`, `maxTotal`); **Add to <open doc> or New** when `hasOpen()` is true (one dialog,
   `labels` to word it; skipped when the source gave `mode`; `ask: ['paste', …]` limits it to some sources); the app's
   `gate(batch)` → false stops.
5. **`before(batch)`** → batch | File[] | false.
6. **process**: `process(file, ctx)` over the files, `concurrency` at once (default 1), or a whole-batch reader:
   `onAdd(files, ctx)` / `onNew(files, ctx)` for the chosen mode, `processAll(files, ctx)`. `ctx = { source, mode, at,
   index, data, batch, signal, progress(0..1), drive }` (`drive`: the Slop Drive record the file came from). A thrown
   Error is that file's reason. Event **`slop:intake-file`** after each file (`file`, `ok`, `result`, `error`).
7. **`after(results, batch)`**, the feedback (the zone's rows and toast through `SlopIntake.view(id, …)`, else a toast;
   `toast: false` for a spec that reports itself), event **`slop:intake-after`** (`files`, `results`, `summary`).

Batches for one spec run one after another (drops during a batch queue up). `take()` resolves the summary
`{ app, source, mode, added: [{ name, value, file }], skipped: [{ name, reason }], refused, cancelled }`.

## The app spec (registered once)

```js
SlopIntake.register({
  id: 'myapp',                       // take() without `to` goes to the page's main spec (main: false for a part)
  accept: { types: ['image/*'], exts: ['.heic'], noun: 'a picture' },
  driveAccept: ['image/*'],          // the Drive picker's types (default: accept.types)
  notice: { title, lines, downloads },   // optional first-use notice
  hasOpen: () => doc.open, openName: () => doc.name, labels: { add: 'Add to current', new: 'Create new' },
  process: async (file, ctx) => addItem(file, ctx.mode),   // or onAdd / onNew / processAll
  after: (results, batch) => {}, concurrency: 1,
  paste: true, first: false, toast: true,
});
```

Parts of an app with files of their own (a watermark logo, brushes, a backup, a macro's test PDF) are specs of their own
(`main: false, paste: false`), reached with `SlopIntake.pick({ to: 'myapp.logo' })`.

## Sources (every one calls take)

| Source | Call | `source` |
|---|---|---|
| a drop on the app's zone / targets (with the zone UI, outlines, rows) | `SlopDrop.attach(zone, { intake: 'myapp', targets, mode?(e), data?(e), files?(dt, e) })` | drop |
| the zone's Choose files | (the zone) | picker |
| File ▸ Open, Ctrl+O, Insert from file, an "Open…" button | `SlopIntake.pick({ to, mode, data, multiple, accept })` | picker |
| a drop on a plain area (no zone UI) | `SlopIntake.dropTarget(el, { to, mode?(e), data?(e) })` | drop |
| a paste | automatic: the first spec (paste ≠ false) that takes the file | paste |
| Open from Slop Drive | `SlopIntake.fromDrive({ to, mode, title })` | drive |
| ?drive=<id> (another app's Send to… / Open in…), PWA `launchQueue` (manifest `file_handlers`) | `SlopIntake.launch({ to, mode })` once the app is ready | launch |
| the Convert dialog's results handed back | `SlopIntake.fromConvert(outputs, { to, mode })` | convert |
| Try it with a sample | `SlopIntake.sample(files or fn, { to, mode })`, or the zone's `sample` option | sample |
| code (tests, an app API) | `SlopIntake.take(files, { to })` | api |

## Extension points

- Events on `document`: `slop:intake-before` (cancelable), `slop:intake-file`, `slop:intake-after`; detail `{ app,
  source, mode, files, … }`. `SlopIntake.on('before' | 'file' | 'after', fn, { app })` → off. Shared features (Workflows'
  "Add to a workflow", recent files, Sloppo) listen here without touching apps.
- `SlopIntake.view(id, { begin, refuse, row, end })`: a feedback view for a spec (SlopDrop registers its zone).

## SlopDrop on top (shared/drop)

`SlopDrop.attach(zone, o)` is the drop zone UI and the drop, Choose files and sample source. With `o.intake` it is the UI of
a registered spec. Without it (the apps not migrated yet) it registers a spec from `o` (`accept`, `process(file, progress,
ctx)`, `begin`, `done`, `limit`, `paste`), so the old callers work unchanged and already go through the pipeline.
`SlopIntake.attach({ accept, hasOpen, openName, onAdd, onNew, first })` (paste only) is a spec too.
`SlopDropChoice.ask` asks the same intake question; `SlopDropChoice.zones` are the drop places that give a drop its mode.

## One way out: SlopOuttake (outtake.js)

```js
SlopOuttake.items({ get: () => blob, name: 'x.png', type: 'image/png', from: 'myapp', verb: 'Open in', folder: true })
SlopOuttake.menu(buttonOrPoint, o); SlopOuttake.button(o, { label: 'Open in…' }); SlopOuttake.send('upscale', o)
SlopOuttake.handover({ from: 'cutout', to: 'photoslop', types: ['image/*'], replaces: true, label: 'Send to PhotoSlop as a layer', run: async (ctx) => { … } })
SlopOuttake.extend((ctx) => [{ label: 'Add to a workflow…', act }])
```

Items, in order: the app's registered handovers (richer, and `replaces` the plain item of that target), every registry app
that takes the type (`SlopHub.appsAccepting`; the file goes to Slop Drive and the target opens on ?drive=<id>, where its
`SlopIntake.launch` takes it), the shared features' items (`extend`, and `slop:outtake` listeners with `phase: 'items'` →
`detail.add(item)`), then "Save to Slop Drive…". Slop Workflows comes in one way: when the page has `shared/ops/entry.js`
(loaded after outtake.js), its `SlopWorkflowEntry.menuItems` gives "Run a workflow…" and "Add to a workflow…", and the
plain "Open in Slop Workflows" (the registry says it takes images and PDFs) is left out so it is not listed twice.
`items(o)` gives no separators (menus that do not draw them); `menu()` and `button()` add them. After a file went out: `slop:outtake` with `phase: 'sent'` (`from, to,
type, name, id`). `SlopHub.openIn(o)` is `items`; `SlopHub.sendMenuItems(getBlob, name, type, { folder })` is `items`
with the verb "Send to". Use the same items for the toolbar button, the More menu and the context menus.

## Rule 4 (tools/one-way.mjs, run by tools/check-rules.mjs)

In the apps listed in `STRICT` (in tools/one-way.mjs: every folder in the Migrated list below), app code may not add a
`drop` or `paste` listener, call `pickFiles`, make a file input, read ?drive= (`consumeLaunch`) or `launchQueue`, call
`pickFromDrive`, or build an "Open in"/"Send to" list by hand. A line that must stay (a tab dragged to a new place, text
pasted into a field) says why with an `// intake-ok: …` comment. When an app below is migrated, add its folder to
`STRICT`.

## Migrated (every entry point through take; duplicates deleted)

- **Slop PDF** (`pdf/js/ui/drop.js` spec `pdf`; parts `pdf.image` (paste-image.js), `pdf.logo` (watermark-panel.js),
  `pdf.images-to-pdf` (exports.js), `pdf.macro-test` (macro/ui.js)): drop on the stage / tab strip / a split pane (mode
  and data from the drop's place), the zone and Choose files, File ▸ Open, Insert pages from file (mode add, data.at),
  a pane's "Open a file", Open from Slop Drive, ?drive= launch, the Convert dialog's PDFs (`A.openConverted` →
  fromConvert), paste (a picture onto the page or a new PDF; any other file to `pdf`). Files PDF does not open go to
  the Convert dialog (`route`). Add to current or Create new is the intake's question (SlopDropChoice.ask is gone from
  PDF). Out: File ▸ Send to and the page's Send page as image use SlopHub.sendMenuItems (the builder).
- **PhotoSlop** (`photoslop/js/app/intake.js`, spec `photoslop`; parts `photoslop.brushes`, `photoslop.logo`,
  `photoslop.layer-pictures` (io/config.js), `photoslop.fx-preset` (layers/fx-preset-picker.js)): Open…, Place Image as
  Layer…, the tab bar's Open…, a drop (its zone gives the mode), a picture dragged from a web page, a paste (asks Add or
  New), Open/Place from Slop Drive, ?drive= launch, the welcome sample. The app's own `onPaste` is only its clipboard.
  `photoslop/classic/` (the classic Paint edition, its own page) is not migrated: see the list below.
- **File convert** (`convert/js/ui/tool.js`: one spec per tool, `convert` for the page's; the Convert dialog's tool is
  `main: false, paste: false` and unregisters when the dialog closes): the zone, Choose files, paste, the sample, the
  dialog's own files, `addFiles` (now a take), ?drive= / launch (mount.js). Out: the results' Open in… is
  `SlopOuttake.button` (shared/convert/results.js).
- **Slop Gallery** (`gallery/js/ui/main.js` spec `gallery`; part `gallery.backup`): a drop of files or folders
  (SlopDrop.folders), Import (Ctrl+O), Import a folder, Import from Slop Drive, ?drive= launch, paste, the sample. Each
  photo is one `G.actions.importOne` (a duplicate is skipped with its reason). Out: SlopHub.sendMenuItems.
- **SlopIsolate** (`slopisolate/js/io/files.js`, spec `cutout`): see its section below (in is done, out is to do).
- **Slop Resize** (`resize/js/app/main.js` spec `resize`): a drop on the column or the zone, Choose files, Open
  (Ctrl+O), Open from Slop Drive, ?drive= launch, paste, the sample. Out: Send to Slop Upscale is `SlopOuttake.send`.
- **Slop Press** (`press/js/io/intake.js`, spec `press`): a drop on the stage or the zone (a picture goes into the frame
  under the drop point), the zone's Choose files, File ▸ Open (Ctrl+O, mode `new`: opens as a document), File ▸ Place
  (Ctrl+D) and Place Image into Frame (mode `add`, `data.frame`), Open and Place from Slop Drive, ?drive= launch and
  launchQueue (mode `new`), a pasted picture. A .slpress always opens; one from Slop Drive stays linked (Save writes back).
  The app's own paste listener is only its clipboard (items copied in Press) and pasted text. Out: File ▸ Send to is
  `SlopOuttake.items` twice (the PDF with Workflows; the page PNG, apps only) and Press's own Save to Slop Drive.
  `tests/intake/press.test.html`.
- **SlopLabel** (`label/js/ui/intake.js`, spec `label`; parts `label.replace` (Replace image…), `label.configs` (Configs ▸
  Import…), `label.zpl-text` (Import ZPL ▸ Open file…)): a drop on the app (a picture on the stage lands where it was
  dropped), the strip's Choose files, File ▸ Open (Ctrl+O), Insert image (mode `image`, `data.props`), Import CSV / Excel
  / JSON (mode `data`), Open project / Insert image / Data from Slop Drive, ?drive= launch and launchQueue, a pasted
  picture. Otherwise `openFiles` decides from the file; a project from Slop Drive stays linked. The accept rules now take
  text, JSON and spreadsheet types (a dropped .csv or .json was refused before). The app's paste listener is only its
  clipboard, ZPL and text. Out: File ▸ Send to is `SlopOuttake.items` for the PDF and the PNG.
  `tests/intake/label.test.html`.
- **Slop Upscale** (`upscale/js/app/main.js`, spec `upscale`, `limit: 1`): Open, the zone and its Choose files, a drop
  on the stage, a paste (new), Open from Slop Drive (the result keeps the Drive link), ?drive= launch and launchQueue, the
  sample, and `SlopUpscale.controller.open` (now a take). The first-use notice is the spec's `notice` (once per batch,
  whichever source); `open()` is only the reader. `drive.js` lost its own picker and `output.js` its record opener.
  `tests/intake/upscale.test.html`.

PWA: `manifest.webmanifest` has `file_handlers` for these five; the files reach `SlopIntake.launch` through launchQueue.

## Tests

- `node --test tests/node/intake-pipeline.test.mjs`: normalize, accept and reasons, gate order, notice once per batch,
  Add or New, route/before/after hooks, the bounded pool, events, specs, queueing, the view.
- `tests/node/drop.test.mjs`, `tests/node/drop-rules.test.mjs`: SlopDrop on the pipeline, the rules.
- `tests/node/check-rules.test.mjs`: rule 4.
- `tests/intake/sources.test.html`: every source ends in the same process() with the same events; the notice once per
  batch whichever source; the gates. `tests/intake/intake.test.html`: the old paste API. `tests/intake/outtake.test.html`:
  the outbound builder. `tests/intake/resize.test.html`, `photoslop.test.html`, `pdf.test.html`: the reference apps,
  every way in reaches the same reader with the same events, one notice per batch, the parts of their own. `tests/pwa/manifest.test.html`: the file handlers.

## How to migrate an app (mechanical)

1. Register the spec once at boot (`SlopIntake.register`), with the reader the app already has as `process` (or
   `onAdd`/`onNew` when it reads a batch). Put "is something open" in `hasOpen`/`openName`.
2. `SlopDrop.attach(zone, { intake: id, …the zone's look… })`; drop the zone's `accept`/`process`.
3. Replace every entry point in the list below: `SlopUI.pickFiles` / file inputs → `SlopIntake.pick({ to, mode })`;
   `SlopHub.pickFromDrive` → `SlopIntake.fromDrive`; `consumeLaunch` → `SlopIntake.launch` (once ready); own drop and
   paste listeners → the zone, `SlopIntake.dropTarget`, or nothing (paste is automatic); `SlopIntake.attach` → the spec.
4. Delete what is left over (record → File helpers, the second "add files" path).
5. Out: hand-made "Open in"/"Send to" lists → `SlopOuttake.items` / `menu` / `button`; app-specific handovers →
   `SlopOuttake.handover`.
6. Add the folder to `STRICT` in `tools/one-way.mjs` and run `node tools/check-rules.mjs --all`; add the app to a
   `tests/intake/<app>.test.html` like resize's.

## Still to migrate (found by grepping; tick as done)

### slopisolate: in is migrated (spec 'cutout', `slopisolate/js/io/files.js`); out is still to do

In (done, after wip/isolate-batch): every route is a source of the intake and the spec's reader (`processAll`) hands the
whole batch to `CO.files.take` at once, which keeps the app's one first-use gate (`F.gate`) and its one add
(`CO.process.add`); the accept rules are `F.ACCEPT`. Open (`CO.files.open` → `SlopIntake.pick`), the sample
(`SlopIntake.sample`), Open from Slop Drive (`SlopIntake.fromDrive`, both menus), ?drive= (`SlopIntake.launch`; a file
PhotoSlop sent keeps its origin and request), the drop zone on #workspace and #queue (`SlopDrop.attach({ intake:
'cutout' })`), paste. `slopisolate/` is in rule 4's STRICT list. `tests/slopisolate/intake.test.html` checks it.
Out: three overlapping menus become one `SlopOuttake.items({ from: 'cutout', type: 'image/png', … })` used by the toolbar
"Open in…", More ▸ Send to and the context menu: `slopisolate/js/ui/openin.js` (a hand-kept list of PhotoSlop and Slop
Vector; Slop Upscale is missing), More ▸ "Send to" (`menus.js`, sendMenuItems), and "Send cut-out to PhotoSlop as a new
layer". Its two richer handovers are `SlopOuttake.handover`s:
- `{ from: 'cutout', to: 'photoslop', replaces: true, label: 'Send to PhotoSlop as a layer (with its mask)' }`
  (the layer round trip in `slopisolate/js/io/send.js` and `photoslop/js/io/isolate.js`);
- `{ from: 'cutout', to: 'slopedit', types: ['video/*'], replaces: true, label: 'Send to SlopCut as a colour + matte pair' }`.

### 3d

- [ ] file input: `3d/js/app/configio.js:28`
- [ ] pickFiles: `3d/js/app/files.js:93`
- [ ] pickFiles: `3d/js/app/files.js:97`
- [ ] Drive picker: `3d/js/app/files.js:103`
- [ ] ?drive= launch: `3d/js/app/files.js:114`
- [ ] drop listener: `3d/js/app/outliner.js:100`

### admin

- [ ] file input: `admin/index.html:134`

### ai

- [ ] ?drive= launch: `ai/js/app/main.js:24`
- [ ] drop listener: `ai/js/ui/chat.js:29`
- [ ] pickFiles: `ai/js/ui/chat.js:52`
- [ ] Drive picker: `ai/js/ui/chat.js:53`
- [ ] pickFiles: `ai/js/ui/chatlist.js:80`
- [ ] out: Open in/Send to label: `ai/js/ui/ctxmenu.js:23`
- [ ] Drive picker: `ai/js/ui/drive.js:21`
- [ ] out: sendTo: `ai/js/ui/launcher.js:11`
- [ ] pickFiles: `ai/js/ui/launcher.js:15`
- [ ] out: sendTo: `ai/js/ui/launcher.js:17`
- [ ] out: Open in/Send to label: `ai/js/ui/launcher.js:22`
- [ ] Drive picker: `ai/js/ui/launcher.js:23`
- [ ] out: Open in/Send to label: `ai/js/ui/launcher.js:23`
- [ ] file input: `ai/js/ui/models.js:112`
- [ ] out: Open in/Send to label: `ai/js/ui/workspace.js:104`

### aitools

- [ ] drop listener: `aitools/denoise/denoise.js:47`
- [ ] file input: `aitools/denoise/index.html:21`
- [ ] file input: `aitools/ocr/index.html:23`
- [ ] drop listener: `aitools/ocr/ocr.js:73`
- [ ] file input: `aitools/portrait/index.html:21`
- [ ] drop listener: `aitools/portrait/portrait.js:67`
- [ ] file input: `aitools/speech/index.html:24`
- [ ] drop listener: `aitools/speech/speech.js:71`
- [ ] file input: `aitools/tags/index.html:21`
- [ ] drop listener: `aitools/tags/tags.js:84`

### calendar

- [ ] pickFiles: `calendar/js/ui/ics-ui.js:29`
- [ ] SlopDrop.attach: `calendar/js/ui/ics-ui.js:39`

### checksum

- [ ] file input: `checksum/index.html:42`
- [ ] drop listener: `checksum/js/checksum.js:81`

### clean

- [ ] pickFiles: `clean/js/app/main.js:82`
- [ ] drop listener: `clean/js/app/main.js:91`
- [ ] ?drive= launch: `clean/js/app/main.js:103`

### code

- [ ] Drive picker: `code/js/main.js:14`
- [ ] ?drive= launch: `code/js/main.js:94`
- [ ] drop listener: `code/js/tree.js:53`
- [ ] hub listener: `code/js/tree.js:61`
- [ ] out: Open in/Send to label: `code/js/viewers.js:75`
- [ ] out: sendTo: `code/js/viewers.js:80`

### contacts

- [ ] SlopDrop.attach: `contacts/js/app/drop-import.js:32`
- [ ] drop listener: `contacts/js/app/groups.js:67`
- [ ] pickFiles: `contacts/js/app/io-dialogs.js:31`
- [ ] ?drive= launch: `contacts/js/app/main.js:14`
- [ ] pickFiles: `contacts/js/app/photo-ui.js:60`

### crm

- [ ] pickFiles: `crm/js/ui/form-parts.js:69`

### docs

- [ ] Drive picker: `docs/js/ui/files.js:93`
- [ ] out: sendMenuItems: `docs/js/ui/files.js:157`
- [ ] paste listener: `docs/js/ui/input.js:62`
- [ ] ?drive= launch: `docs/js/ui/main.js:47`
- [ ] out: Open in/Send to label: `docs/js/ui/menus.js:35`

### drive

- [ ] hub listener: `drive/js/app/main.js:51`
- [ ] ?drive= launch: `drive/js/app/main.js:62`
- [ ] file input: `drive/js/core/io.js:40`
- [ ] out: sendTo: `drive/js/core/io.js:116`
- [ ] SlopDrop.attach: `drive/js/ui/dnd.js:95`
- [ ] out: Open in/Send to label: `drive/js/ui/info.js:39`
- [ ] out: Open in/Send to label: `drive/js/ui/info.js:40`
- [ ] out: Open in/Send to label: `drive/js/ui/menus.js:63`
- [ ] out: sendTo: `drive/js/ui/newdoc.js:29`
- [ ] out: Open in/Send to label: `drive/js/ui/quicklook.js:21`

### effects

- [ ] pickFiles: `effects/js/app/io.js:27`
- [ ] Drive picker: `effects/js/app/io.js:39`
- [ ] pickFiles: `effects/js/app/io.js:53`
- [ ] Drive picker: `effects/js/app/io.js:133`

### eml

- [ ] pickFiles: `eml/js/actions.js:17`
- [ ] out: Open in/Send to label: `eml/js/commands.js:29`
- [ ] out: sendTo: `eml/js/export-ui.js:49`
- [ ] out: Open in/Send to label: `eml/js/export-ui.js:71`
- [ ] out: Open in/Send to label: `eml/js/export-ui.js:110`
- [ ] out: sendMenuItems: `eml/js/export-ui.js:122`
- [ ] SlopDrop.attach: `eml/js/main.js:37`
- [ ] ?drive= launch: `eml/js/main.js:64`
- [ ] out: Open in/Send to label: `eml/js/side.js:26`
- [ ] out: Open in/Send to label: `eml/js/side.js:39`
- [ ] out: Open in/Send to label: `eml/js/side.js:63`

### expenses

- [ ] file input: `expenses/index.html:88`

### hex

- [ ] pickFiles: `hex/js/actions.js:114`
- [ ] out: Open in/Send to label: `hex/js/actions.js:119`
- [ ] SlopDrop.attach: `hex/js/main.js:34`
- [ ] ?drive= launch: `hex/js/main.js:69`

### html2pdf

- [ ] file input: `html2pdf/index.html:42`
- [ ] file input: `html2pdf/index.html:54`
- [ ] drop listener: `html2pdf/js/app.js:107`

### img3d

- [ ] file input: `img3d/index.html:45`
- [ ] out: sendTo: `img3d/js/app/export.js:75`
- [ ] drop listener: `img3d/js/app/main.js:169`
- [ ] Drive picker: `img3d/js/app/main.js:172`
- [ ] ?drive= launch: `img3d/js/app/main.js:194`

### inventory

- [ ] file input: `inventory/index.html:228`
- [ ] file input: `inventory/js/ui/import.js:22`

### invoices

- [ ] file input: `invoices/index.html:177`
- [ ] out: Open in/Send to label: `invoices/js/ui/reminder.js:23`

### ledger

- [ ] file input: `ledger/index.html:88`
- [ ] file input: `ledger/index.html:180`

### music

- [ ] ?drive= launch: `music/js/app/main.js:38`
- [ ] pickFiles: `music/js/ui/library.js:100`
- [ ] pickFiles: `music/js/ui/library.js:101`
- [ ] SlopDrop.attach: `music/js/ui/library.js:104`
- [ ] Drive picker: `music/js/ui/playlists.js:117`

### notes

- [ ] pickFiles: `notes/js/blocks.js:78`
- [ ] paste listener: `notes/js/editor.js:97`

### ocr

- [ ] file input: `ocr/index.html:51`
- [ ] SlopDrop.attach: `ocr/js/app.js:191`

### orders

- [ ] file input: `orders/index.html:130`

### paste

- [ ] pickFiles: `paste/js/actions.js:74`
- [ ] paste listener: `paste/js/main.js:20`

### photoslop

- [ ] Drive picker: `photoslop/classic/hub.js:22`
- [ ] ?drive= launch: `photoslop/classic/hub.js:37`
- [ ] file input: `photoslop/classic/index.html:140`
- [ ] drop listener: `photoslop/classic/paint/17-files.js:59`
- [ ] paste listener: `photoslop/classic/paint/17-files.js:65`
- [ ] file input: `photoslop/index.html:93`

### projects

- [ ] pickFiles: `projects/js/ui/files.js:39`
- [ ] SlopDrop.attach: `projects/js/ui/files.js:56`

### purchases

- [ ] file input: `purchases/index.html:121`

### qr

- [ ] file input: `qr/js/panel-design.js:52`
- [ ] drop listener: `qr/js/panel-design.js:61`
- [ ] Drive picker: `qr/js/save.js:43`

### quotes

- [ ] file input: `quotes/index.html:121`

### remix

- [ ] file input: `remix/index.html:55`
- [ ] file input: `remix/index.html:123`
- [ ] drop listener: `remix/js/drop.js:40`
- [ ] drop listener: `remix/js/drop.js:56`
- [ ] out: sendTo: `remix/js/send.js:21`
- [ ] drop listener: `remix/js/ui.js:54`
- [ ] SlopDrop.attach: `remix/js/ui.js:131`

### serials

- [ ] file input: `serials/index.html:45`
- [ ] drop listener: `serials/js/app.js:180`

### shared/backup

- [ ] pickFiles: `shared/backup/central-ui.js:85`
- [ ] pickFiles: `shared/backup/ui.js:41`

### shared/biz

- [ ] out: sendTo: `shared/biz/address-label.js:32`

### shared/buffer

- [ ] drop listener: `shared/buffer/buffer.js:68`

### shared/commands

- [ ] pickFiles: `shared/commands/recorder.js:79`

### shared/config

- [ ] pickFiles: `shared/config/dialog.js:24`
- [ ] SlopDrop.attach: `shared/config/dialog.js:36`
- [ ] drop listener: `shared/config/dialog.js:139`
- [ ] Drive picker: `shared/config/io.js:88`

### shared/convert

- [ ] out: Open in/Send to label: `shared/convert/load.js:52`
- [ ] out: Open in/Send to label: `shared/convert/results.js:50`

### shared/doctabs

- [ ] Drive picker: `shared/doctabs/drive.js:57`
- [ ] drop listener: `shared/doctabs/tabs.js:84`

### shared/fonts

- [ ] file input: `shared/fonts/panel.js:71`
- [ ] file input: `shared/fonts/panel.js:139`
- [ ] drop listener: `shared/fonts/panel.js:146`

### shared/guides

- [ ] pickFiles: `shared/guides/panel-tabs.js:100`

### shared/hub.js

- [ ] out: sendTo: `shared/hub.js:174`
- [ ] out: Open in/Send to label: `shared/hub.js:185`
- [ ] ?drive= launch: `shared/hub.js:187`
- [ ] ?drive= launch: `shared/hub.js:188`

### shared/i18n

- [ ] out: Open in/Send to label: `shared/i18n/strings.js:32`

### shared/ops

- [ ] out: sendTo: `shared/ops/entry.js:29`

### shared/presets

- [ ] hub listener: `shared/presets/store.js:52`
- [ ] file input: `shared/presets/ui.js:37`

### shared/preview

- [ ] out: Open in/Send to label: `shared/preview/chrome.js:95`

### shared/seo

- [ ] out: Open in/Send to label: `shared/seo/guides/creative-2.mjs:74`
- [ ] out: Open in/Send to label: `shared/seo/guides/documents-2.mjs:118`

### shared/slopui.js

- [ ] pickFiles: `shared/slopui.js:249`
- [ ] file input: `shared/slopui.js:251`

### shared/sync

- [ ] file input: `shared/sync/ui.js:97`

### shared/tour

- [ ] out: Open in/Send to label: `shared/tour/tours/img3d.js:11`

### sheetview

- [ ] pickFiles: `sheetview/js/main.js:38`
- [ ] pickFiles: `sheetview/js/main.js:39`
- [ ] ?drive= launch: `sheetview/js/main.js:45`
- [ ] out: sendTo: `sheetview/js/main.js:63`
- [ ] SlopDrop.attach: `sheetview/js/main.js:156`

### shell

- [ ] out: Open in/Send to label: `shell/switcher.js:38`

### signature

- [ ] file input: `signature/js/form.js:36`

### slides

- [ ] out: Open in/Send to label: `slides/js/ui/commands.js:42`
- [ ] out: Open in/Send to label: `slides/js/ui/ctxmenu.js:39`
- [ ] SlopDrop.attach: `slides/js/ui/file-drop.js:15`
- [ ] Drive picker: `slides/js/ui/files.js:36`
- [ ] ?drive= launch: `slides/js/ui/main.js:24`
- [ ] pickFiles: `slides/js/ui/ops.js:38`
- [ ] drop listener: `slides/js/ui/sorter-drag.js:42`
- [ ] pickFiles: `slides/js/ui/templates-dialog.js:106`
- [ ] Drive picker: `slides/js/ui/templates-dialog.js:117`

### slopcut

- [ ] hub listener: `slopcut/js/io/cutout.js:50`
- [ ] pickFiles: `slopcut/js/io/project.js:55`
- [ ] ?drive= launch: `slopcut/js/io/session.js:53`
- [ ] drop listener: `slopcut/js/render/cells.js:81`
- [ ] out: sendTo: `slopcut/js/render/preview.js:102`
- [ ] out: Open in/Send to label: `slopcut/js/timeline/menu.js:23`
- [ ] drop listener: `slopcut/js/timeline/menu.js:146`
- [ ] out: Open in/Send to label: `slopcut/js/timeline/order.js:2`
- [ ] out: Open in/Send to label: `slopcut/js/timeline/order.js:33`
- [ ] pickFiles: `slopcut/js/ui/app.js:45`
- [ ] Drive picker: `slopcut/js/ui/app.js:48`
- [ ] drop listener: `slopcut/js/ui/app.js:107`
- [ ] SlopDrop.attach: `slopcut/js/ui/app.js:117`
- [ ] drop listener: `slopcut/js/ui/templates-panel.js:59`
- [ ] drop listener: `slopcut/js/ui/templates-panel.js:97`
- [ ] pickFiles: `slopcut/js/watermark/panel.js:22`


### slopvector

- [ ] pickFiles: `slopvector/js/io/files.js:50`
- [ ] SlopDrop.attach: `slopvector/js/io/files.js:56`
- [ ] Drive picker: `slopvector/js/io/hub.js:53`
- [ ] Drive picker: `slopvector/js/io/hub.js:57`
- [ ] out: sendMenuItems: `slopvector/js/io/hub.js:89`
- [ ] out: sendMenuItems: `slopvector/js/io/hub.js:90`
- [ ] out: sendTo: `slopvector/js/io/hub.js:98`
- [ ] ?drive= launch: `slopvector/js/io/hub.js:105`
- [ ] paste listener: `slopvector/js/tools/keys.js:109`
- [ ] out: Open in/Send to label: `slopvector/js/ui/actions.js:78`
- [ ] out: Open in/Send to label: `slopvector/js/ui/menus.js:22`
- [ ] out: Open in/Send to label: `slopvector/js/ui/props.js:118`

### sorter

- [ ] file input: `sorter/index.html:45`
- [ ] file input: `sorter/index.html:46`
- [ ] SlopDrop.attach: `sorter/js/app.js:112`

### tables

- [ ] paste listener: `tables/js/ui/actions.js:121`
- [ ] Drive picker: `tables/js/ui/storage.js:68`
- [ ] pickFiles: `tables/js/ui/storage.js:86`
- [ ] ?drive= launch: `tables/js/ui/storage.js:137`
- [ ] pickFiles: `tables/js/ui/templates.js:174`
- [ ] Drive picker: `tables/js/ui/templates.js:180`

### transcribe

- [ ] file input: `transcribe/index.html:54`
- [ ] SlopDrop.attach: `transcribe/js/app.js:101`

### watermark (pictures done; the logo is left to the watermark panel rewrite, wip/watermark-all)

- [x] pictures: spec `watermark` (`watermark/js/main.js`): a drop, the zone, Open pictures… (`SlopIntake.pick`; the
  page's hidden `#wm-open` input is gone), a paste, ?drive= launch (the page now loads shared/hub.js, so another app's
  Open in Slop Watermark reaches it) and launchQueue, the sample. `tests/intake/watermark.test.html`.
- [ ] file input: the logo's Upload logo… (`#wm-logo-file` in `watermark/index.html`, read by `watermark/js/settings.js`)
  → a part `watermark.logo` (`main: false, paste: false`) and `SlopIntake.pick({ to: 'watermark.logo' })`; then add
  `watermark/` to STRICT.

### workflows

- [ ] ?drive= launch: `workflows/js/ui/app.js:27`
- [ ] pickFiles: `workflows/js/ui/library.js:105`
- [ ] out: sendMenuItems: `workflows/js/ui/run.js:104`
- [ ] out: Open in/Send to label: `workflows/js/ui/run.js:104`
- [ ] SlopDrop.attach: `workflows/js/ui/run.js:158`
- [ ] drop listener: `workflows/js/ui/steps.js:145`

