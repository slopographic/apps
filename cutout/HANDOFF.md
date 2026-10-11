# Slop Cutout — handoff

On-device AI background removal. Engine in `shared/cutout/` (reusable by any app), app in `cutout/`
(half-built), models in `vendor/models/`, ONNX Runtime Web 1.30.0 in `vendor/onnxruntime-web/`.
Registry status must stay **building** until the app UI is finished.

## Done (step 1: engine, tested)
- `shared/cutout/cutout.js` (`window.SlopCutout`): `removeBackground(input, opts) → { mask, cutout (ImageData), base, width, height, jobId, timings, toBlob() }`,
  `finish(jobId, settings, edit)`, `createJob(input, base)`, `release`, `load(model, onProgress)`, `cached()`, `info()`,
  `configure({ backend: 'auto'|'wasm', workerUrl, vendor, models, sources })`, `maskToImageData`, `toBlob`. API doc at the top of the file.
- `shared/cutout/worker.js`: classic worker; WebGPU (JSEP build) when a hardware adapter exists, else wasm-only build;
  `numThreads = 1`, no proxy (no COOP/COEP needed). WebGPU run errors or NaN output fall back to wasm automatically.
  Software adapters (SwiftShader) are skipped: WebGPU is untested on real GPUs here.
- `shared/cutout/loader.js`: download with progress, sha256 check, Cache API (IndexedDB fallback) cache.
- `shared/cutout/pipeline.js` + `refine.js`: area/bilinear resize, tensor normalize, min-max, box blur, matte
  (threshold/softness), brush-edit apply, feather, bbox, compose, colour guided-filter upsample (work res ≤ 1024,
  memory O(full mask)), edge-colour decontamination, `finish()`.
- `shared/cutout/models.js`: Fast = U²-Netp (4.6 MB), Quality = IS-Net general, weight-only int8 (46.5 MB),
  Portrait = MODNet (25.9 MB). All Apache-2.0; sources, conversions and sha256 in `vendor/models/README.md`;
  rebuild script `vendor/models/tools/convert.py` (deterministic). MaxPool ceil_mode rewritten (bit-identical) for WebGPU.
- Tests (all green): `node tests/run.mjs cutout` → engine 32 (pipeline math, refine, worker RPC), inference Fast 5,
  inference Quality+Portrait 2 (real wasm inference on synthetic shapes).
- Headless Chromium wasm timings (4 cores, load avg ~23 from other agents, so pessimistic): Fast 320² ≈ 5–6 s
  infer, Portrait 672×512 ≈ 4.5–5.5 s, Quality 1024² ≈ 45–70 s; post-processing 640×480 ≈ 0.8 s. Native ORT
  single-thread on the same box: u2netp 1.1–2.2 s, IS-Net 4–7 s.

## Half-done (step 2: the app) — NOT working yet
- Written: `cutout/index.html` (loads all planned scripts), `css/base.css`, `css/workspace.css`, `css/panel.css`,
  `css/themes.css`, `js/core/util.js`, `js/core/state.js`, `js/core/brush.js` (tile-based stroke + undo swap).
- Missing (referenced by index.html, so the page currently throws): `js/core/history.js`, `js/render/compose.js`,
  `js/render/view.js`, `js/io/{zip,process,files,sample,export}.js`, `js/ui/{kit,panel,panel-look,queue,ctxbar,pointer,menus,commands,main}.js`.

## Next steps, in order
1. history.js (per-item undo: `{kind:'stroke'}` via `CO.brush.swap`, `{kind:'look', before, after}`).
2. process.js: sequential queue calling `SlopCutout.removeBackground(file, { model, keep: isActive, ...item.s })`,
   store `item.base`; `CO.active = { item, jobId, bitmap, rgba, cutout canvas, mask }`; on select use
   `createJob(file, base)` + `finish`; debounce settings → `finish(jobId, item.s, item.edit)`; live brush preview on
   the dirty rect with `P.matte` + `P.applyEdit` on the main thread, full `finish` at stroke end.
3. compose.js (bg transparent/colour/blur/image/gradient, shadow via ctx.shadow*, crop to subject + padding) and
   view.js (zoom/pan, result / before-after split / mask modes, checkerboard).
4. UI: panel (model picker with cached sizes, edge sliders, look, export with "No watermarks, ever"), queue,
   ctxbar (pan/keep/remove, size, hardness), pointer (brush, pinch, split drag), menus (themes, Send to, Open from
   Slop Drive, ?drive= via `SlopHub.consumeLaunch`), `SlopHub.register('cutout')`, SlopCmd commands (guard `window.SlopCmd?.`).
5. export.js (PNG/WebP/JPG with bg colour at full res), zip.js (store-only) for batch, sample.js (Sloppo on a busy bg).
6. Tests: brush, export dimensions, UI smoke (desktop + 390×844), then flip status to beta.

## PhotoSLOP integration (planned)
Menu Layer ▸ "Remove background": include `shared/cutout/cutout.js`, call
`SlopCutout.removeBackground(layerCanvas, { model, onProgress })` and write `r.mask` (Uint8, w×h) into the layer's
mask (white = keep); optionally replace pixels with `r.cutout` for decontaminated edges. Show progress for the
one-time model download.
