# SlopIsolate — handoff

On-device AI background removal. Engine in `shared/cutout/` (reusable by any app), app in `slopisolate/`,
models in `vendor/models/`, ONNX Runtime Web in `vendor/onnxruntime-web/`. Module contract: `js/CONTRACT.md`.

## Status
- The app runs end to end: sample, open, Slop Drive, queue, Keep / Remove / Clear brush edits, undo and redo,
  look (edges, background, shadow, crop), export (PNG, WebP, JPG, zip). Registry status stays **beta**.
- Tests: `node tests/run.mjs slopisolate` (engine, inference, app, sample, saved session) and
  `node tests/run.mjs mask-transfer` (node). PhotoSlop round trip: `node tests/run.mjs isolate-roundtrip`.

## Batches: one model for all, one way in, a pool (Oct 2026)
- **Why a batch looked worse.** The Model panel changed only the image on screen (`it.model = id; rerun(it)`); every
  other image kept the model it was given when it was added. Dropping several photos, seeing the first and choosing
  Quality left the rest of the batch on Fast, while photos uploaded one at a time after that choice all got Quality.
  Measured with 4 generated photos (sample + 3 scenes): batch vs one-at-a-time alpha mean difference 1.7 to 4.8 of 255
  (max 198 to 253), soft edge pixels 2 to 3 times as many, edge gradient 100 to 122 against 180. Everything else was
  checked and is the same both ways: input size per model, full resolution (no downscale; `U.decode` only shrinks the
  display bitmap over 50 MP), guided refinement and decontamination (the worker does both for every item), settings.
- **Fix.** An image has no model of its own (`it.model = null`) and runs with `S.modelOf(it)` = the app's model, read when
  its run starts. The panel sets `S.model` and `CO.process.followModel()` re-runs every image that follows it and was
  made (or is being made) with another. Only the bulk bar's Re-run model pins a model on an image. After: MAD 0, max 0.
  Saved work keeps `model` (null or pinned) and `modelUsed`; older saves restore as following the app's model.
- **One way in.** `CO.files.take(files, { source, driveId, origin })` is the only caller of `CO.process.add`: the picker,
  the drop zone and the queue sidebar (SlopDrop targets `#workspace` and `#queue`), paste (SlopDrop registers it with
  shared/intake), the sample, Open from Slop Drive (File menu and Drive) and a file another app sent (?drive=). One
  first-use gate per batch (`F.gate`, shared while open), one accept rule (`F.ACCEPT`), one batch into the pool. SlopDrop's
  `begin(files)` hands the whole drop to take() at once; `process(file)` only reports that file's progress. Shaped like
  the suite intake (accept, gate, process, after) so moving to SlopIntake.take is a swap. Removed: the drop path's own
  gate and per-file add, files.js's own paste listener (it added a paste a second time after shared/intake took it),
  the queue's own drop listener (a drop there also got the "Drop files on the highlighted area" warning).
- **Pool.** `shared/cutout/cutout.js` runs `removeBackground` calls in up to `SlopCutout.poolSize()` workers at once, each
  with its own ONNX session (no COOP/COEP, so WebAssembly is single-threaded: separate workers are the only parallelism).
  poolSize: WebGPU 2 (the GPU serialises model passes; the second worker overlaps decode, refinement and
  decontamination), WebAssembly one per two cores up to 3, 2 under 4 GB, 1 on iOS or 2 GB. `configure({ workers })`
  overrides. A separate 'edit' worker holds `createJob` jobs (the image on screen, exports), so sliders and brush strokes
  never wait behind the batch. A worker runs one model pass at a time (`exclusive` in worker.js). `io/process.js` keeps
  the app's bounded queue (`running` map of AbortControllers): remove and re-run cancel a running image (the worker
  finishes the pass, the result is dropped), a failed image does not stop the rest. Queue tiles show the phase
  (Loading, Starting, Cutting out, Edges); the busy bar shows only for a download.
- **Timings, 10 photos (0.4 to 1.6 MP) dropped at once, Fast, WebAssembly, headless Chromium on a 44-core machine:**
  before (one at a time, the drop zone waiting on each) 71.8 s, first ready 7.9 s; after: pool 1 60.5 s, pool 2 33.5 s,
  pool 3 24.9 s, pool 4 20.5 s; first ready about 6.2 s in every case. Main thread: longest stall 60 to 200 ms, a click
  handled within 1 ms. WebAssembly capped at 3 workers for memory (each holds its own session; Quality is the big one).
  Bench script: tests are in the repo; the timing script was a scratch Playwright run (drop 10, wait for all done).
- Tests: `tests/slopisolate/batch.test.html` (batch vs one at a time after a model change, pinned model kept; pool of 2:
  never more than 2 running, all finish, a click runs meanwhile, the image on screen edits while others run; a broken file
  fails alone; remove mid-run and queued), `tests/slopisolate/intake.test.html` (every route ends in one take and one add
  of the whole batch, one notice per batch, a notice shared by concurrent batches, a video follows the app's model, no
  other script calls `process.add` or listens for drop or paste).

## Manual editing (checked in a browser)
- Keep / Remove strokes: the brush cursor follows the pointer, the edit map and the result change, the view does not
  move (zoom and pan stay put), undo / redo restore exactly, Clear brush edits is one undo step, export carries the edits.
- Fixed: the pointer capture on `#stage` swallowed clicks on the empty-state buttons ("Choose images", "Try a sample"),
  so the sample button did nothing (this also broke the sample test). `ui/pointer.js` now leaves button clicks alone.
- Fixed: a stroke end ran the full refresh twice (history push and a direct call). Now one.
- Cost: the full result (`SlopCutout.finish`, with colour decontamination) takes several seconds at 1200×900,
  mostly `P.decontaminate`. During a stroke the picture follows the brush through `CO.process.live` (main thread,
  matte + brush only); the full result arrives after the stroke. Speeding up decontaminate is the next engine task.

## PhotoSlop integration (Isolate Subject, and back)
- PhotoSlop: `photoslop/js/io/isolate.js`. Layer ▸ Isolate Subject… and the layer right-click item put the layer's
  pixels in Slop Drive with `meta: { requestId, intent: 'mask' }` and open SlopIsolate on it (`SlopHub.sendTo`).
  The tab remembers `requestId → { docId, layerId, x, y, hadMask }` in memory.
- SlopIsolate: the file gets `item.request`. **Send back to PhotoSlop** (`#btnSendBack`, or More ▸ Send mask back)
  emits `slopisolate:mask` {requestId, w, h, mask} on the Slop Hub bus. PhotoSlop applies it to that layer as a layer
  mask (alpha = how much shows, one history step "Isolate Subject") and answers `photoslop:mask-ack`.
- A layer that already has a mask asks first (before anything is sent). The mask is never added as a new layer.
- **Send to PhotoSlop as a new layer** (More ▸ …): `slopisolate:layer` {requestId, blob, name} is added as a layer
  named "Cut-out" at the source layer's position (`photoslop:layer-ack`).
- No reply within 3 s: the mask is saved to Slop Drive as a grey PNG; the cut-out opens in a new PhotoSlop tab.
- Mask transfer helpers: `shared/cutout/mask-transfer.js` (`SlopMaskTransfer`: fromAlpha, toAlpha, toGrey,
  fromGrey, applyAlpha). Covered by `tests/node/mask-transfer.test.mjs`.

## Not done / next
- Decontaminate speed (see above); a live preview that includes it.
- The send path uses the bus, so it needs the PhotoSlop tab open in the same browser profile to apply the mask
  directly; otherwise the Drive fallback applies.

## Video, Drive, bulk, Open in, saved work
- **Video** (`js/video/`): up to 30 s (10 s on phones), frames scaled to 720p; the matte runs per frame at 384 px on the long
  side, in the worker, and is smoothed over time (`smooth.js`, weight 0.35, first frame kept as it is). MP4/MOV is decoded
  with WebCodecs using Slop Cut's demuxer (`slopcut/js/media/demux.js`, loaded on demand); other formats use a `<video>`
  element and seeks. Player on the stage: Play, scrub, Cut-out / Original, Cancel. Export: WebM with alpha
  (VP9 `alpha: 'keep'`, our EBML writer) or a PNG-frame zip when the browser cannot encode alpha (the UI says so);
  MP4 on a chosen background colour (H.264 or VP9). Unverified here: WebM with alpha (headless Chromium lacks alpha 'keep').
- **Drive** (`js/io/drive.js`): processed items are saved into the Drive folder "Slop Isolate": images as
  `-original`, `-mask.png`, `-result.png`; videos as `-original` and `-matte.mp4`, results on export. Open from Drive: images and videos.
- **Bulk** (`js/ui/bulk.js`): Ctrl/Cmd-click, Shift-click, Ctrl+A in the queue. With 2+ selected, the bar applies look,
  clear brush edits, re-run a model, export, or remove, one progress bar. Videos are skipped by those actions.
- **Open in** (`js/ui/openin.js`): PhotoSlop (`CO.send.layer`), Slop Vector (cut-out PNG), Slop Cut (video, as a colour
  + matte MP4 pair in Drive). The mask is not made a PhotoSlop layer mask in one step (it goes through `send.js`).
- **Right-drag brush resize** (Keep/Remove): across = size, down = hardness, live readout; a drag never opens the menu.
  Maths in `shared/brush/resize.js`; PhotoSlop still has its own copy (`photoslop/js/core/brush-resize.js`).
- **Live brush**: `CO.process.live(it, rect)` updates the matte and cut-out on the main thread every stroke step; the
  view tints the removed part. Test: `tests/slopisolate/live.test.html`.
- **Saved work** (`js/ui/view-state.js`, SlopSession, IndexedDB): finished images (file, model, look, edits, base mask) and
  finished videos (file and matte) come back without running the model. Unfinished items are not saved and not restarted.
  Settings and brush edits apply to the image on screen, or to the selection in bulk. Toolbar button "Clear saved work".
  Test: `tests/slopisolate/persist.test.html`.
- Tests: `tests/node/slopisolate-smooth.test.mjs`; `tests/slopisolate/video.test.html` (2-second generated MP4: frames, model
  per frame, cancel, WebM or PNG export, MP4 background); `live.test.html`; `persist.test.html`.

## Phone layout (SlopSheet)
Under 900 px the settings panel (`#props`) is a bottom sheet: `CO.sheet = SlopSheet.attach(...)` in `js/ui/menus.js`
(`shared/ui/sheet.js`, see `shared/ui/HANDOFF.md`). The panel button (and View ▸ panel, `act.panel`) opens and closes it; the
shared ×, Escape, a tap outside and a swipe down close it. Before this the CSS had a `.sheet-open` sheet that nothing ever
opened, so the settings were out of reach on a phone; that CSS and the unused `.sheet-grip` are gone. On a wide screen the
button still hides the panel (`no-panel`). Test: `tests/slopisolate/phone-sheet.test.html`.
