# ONNX Runtime Web (vendored)

Microsoft **onnxruntime-web 1.30.0** from npm (https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.30.0.tgz),
MIT — see `LICENSE`. Files are copied unchanged from the package's `dist/`.

| File | What |
|---|---|
| `ort.min.mjs` + `ort-wasm-simd-threaded.jsep.mjs` / `.jsep.wasm` | full build: WebGPU (JSEP) and WebAssembly CPU backends |
| `ort.wasm.min.mjs` + `ort-wasm-simd-threaded.mjs` / `.wasm` | WebAssembly-only build (half the download), used when WebGPU is unavailable |

The `.mjs` files are ES modules (load with `import()`). Slopographic is served without COOP/COEP
headers, so there is no `SharedArrayBuffer`: always set `ort.env.wasm.numThreads = 1` (the
"threaded" wasm runs single-threaded then) and `ort.env.wasm.proxy = false`. See
`shared/cutout/worker.js` for a working setup that also caches the wasm in the Cache API.
