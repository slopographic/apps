# Slop Cutout — handoff

On-device AI background removal. Engine in `shared/cutout/` (reusable by any app), app in `cutout/`
(in progress), models in `vendor/models/`, ONNX Runtime Web in `vendor/onnxruntime-web/`.

## Status
- Step 1 done: engine (`shared/cutout/`), models, tests `tests/cutout/engine*`, `tests/cutout/inference*`.
- Step 2 (the app) in progress.
