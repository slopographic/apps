# SlopIsolate — handoff

On-device AI background removal. Engine in `shared/cutout/` (reusable by any app), app in `slopisolate/`,
models in `vendor/models/`, ONNX Runtime Web in `vendor/onnxruntime-web/`. Module contract: `js/CONTRACT.md`.

## Status
- The app runs end to end: sample, open, Slop Drive, queue, Keep / Remove / Clear brush edits, undo and redo,
  look (edges, background, shadow, crop), export (PNG, WebP, JPG, zip). Registry status stays **beta**.
- Tests: `node tests/run.mjs slopisolate` (engine, inference, app, sample, saved session) and
  `node tests/run.mjs mask-transfer` (node). PhotoSlop round trip: `node tests/run.mjs isolate-roundtrip`.

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
