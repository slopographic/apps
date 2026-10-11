# shared/faces: on-device face detection (opt-in)

Face detection for Slop Drive and Slop Gallery. It finds where the faces are in a picture, so Drive can show a face
count and Gallery can group photos by how many faces they show. **There is no identity matching, no face recognition
and no names.** It runs on this device, nothing is uploaded, and it is **off by default**.

## The model

- **YuNet** face detector (OpenCV Zoo), file `face_detection_yunet_2023mar.onnx`, 232 589 bytes.
- **Licence: MIT** (copyright Shiqi Yu, 2020). The text is in `vendor/face/LICENSE`.
- **Source:** the Hugging Face repository `opencv/face_detection_yunet` (revision `3cc26e7f`), the same bytes as the
  OpenCV Zoo file. The sha256 is `8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4`, which is also the
  checksum `@arkyc/vision` (MIT, npm) records for it.
- **Where it lives:** `vendor/face/`. The app loads it from the site itself; nothing is fetched from a CDN at run time.
  Details, the decoder notes and the removal steps are in `vendor/face/README.md`.
- **Runtime:** ONNX Runtime Web from `vendor/onnxruntime-web/` (the WebAssembly build, one thread, no proxy). No other
  runtime is needed.
- **Checked:** the model is loaded only after its sha256 matches (`MODEL.sha256` in `index.js`). A different file is refused.

## The opt-in

- **The setting:** one stored value, `faces.detect`, in `SlopProfile` (localStorage `slop-profile`, see
  `shared/profile/HANDOFF.md`). `SlopFaces.enabled()` reads it at each call, so a change in another tab applies at once.
- **Off until the person turns it on.** While off, `SlopFaces.detect()` returns `[]` and loads nothing, and
  `analyse()` returns `null` and stores nothing.
- **Turn it on in two places:**
  1. **Profile** (`settings/`, "Profile and settings"): the switch "Find faces on this device" is shown in the Drive
     section and in the Gallery section. Both are the same stored value (`SLOP_APP_SHARED` in
     `shared/profile/app-options.js`); changing one updates the other.
  2. **The first-use dialog** (`consent.js`, SlopUI): it opens the first time a person asks for faces while the setting
     is off (Drive: Find faces; Gallery: the People view, once). "Turn on" saves the setting and carries on. "Not now"
     changes nothing. A link opens Profile at that app's section.
- **The wording** is in `copy.js` (`SLOP_FACES_COPY`). The dialog and the Profile page both read it.
- **Turning it off** stops everything at once: `detect` and `analyse` do nothing, the Gallery scan stops after the photo
  in hand, the People groups and the face boxes disappear, and `setEnabled(false)` frees the model.

## Files

| File | What |
|---|---|
| `decode.js` | Pure maths, no DOM: `decodeYunet` (raw outputs to boxes in source pixels), `filterBoxes` (score threshold, greedy overlap suppression, cap), `iou`, `scaleFor`. |
| `cache.js` | Results in IndexedDB `slop-faces` (store `results`). Keyed `scope:id`; a row counts only for the stamp and model it was made for. Falls back to memory. |
| `index.js` | `window.SlopFaces`: the opt-in, the model loader (checksum, ONNX Runtime), `detect`, `analyse`, `status`, `onChange`. |
| `consent.js` | The first-use dialog (`askOptIn(appId)`). |
| `overlay.js` | `drawBoxes(previewEl, faces)`: boxes in the picture's pixels, drawn inside a SlopPreview so they follow zoom and pan. |
| `copy.js` | The wording, shared by the dialog and Profile. |

Load order (classic scripts): `profile.js`, `copy.js`, `app-options.js`, `decode.js`, `cache.js`, `index.js`, `consent.js`,
`overlay.js`. Drive and Gallery load them in that order in their `index.html`.

## The API

```js
SlopFaces.enabled()                       // the opt-in (false by default)
SlopFaces.setEnabled(true)                // { ok } or { ok: false, error }; saves through SlopProfile
SlopFaces.status()                        // 'off' | 'idle' | 'loading' | 'ready' | 'unavailable'
await SlopFaces.detect(source)            // [{ x, y, w, h, score }] in the source's pixels; [] when off or on any failure
await SlopFaces.analyse('drive', id, stamp, blob)   // { w, h, faces, cached } or null (off, unreadable, model failed)
await SlopFaces.cache.get('drive', id, stamp) / .put / .all(scope) / .remove / .clear
SlopFaces.drawBoxes(previewEl, faces)     // returns a function that removes the boxes
await SlopFaces.askOptIn('drive')         // the dialog; resolves true when detection is on afterwards
SlopFaces.onChange(fn)                    // when the setting changes (this tab, or the storage event from another)
```

Stamps: Drive uses the file's `modified` time (`DR.faceStamp`); Gallery uses the photo's SHA-256. A changed picture is
checked again. A new model (a new `MODEL.id`) makes every stored result stale.

## Tests

- `tests/node/faces-drive-gallery.test.mjs` (named so that both `drive` and `gallery` runs include it): the box
  maths (score threshold, overlap suppression, caps, YuNet decoding with a synthetic output), and the opt-in gate (off:
  `detect` returns `[]` and the model is never touched; the setting is one stored value; turning it off stops it).
- `tests/drive/faces.test.html`: Drive with a stubbed detector. The count is stored per file id and modified time; the
  details panel shows "2 faces" and a Find faces action; Quick look draws two boxes; an edited file is checked again.
- `tests/drive/faces-optin.test.html`: the dialog on first use (wording, the Profile link, "Not now" changes nothing),
  "Turn on" carries on, turning it off stops detection, and the Profile page's two switches stay in step.
- `tests/gallery/faces.test.html`: Gallery with a stubbed detector (the picture's width sets its faces): the background
  scan, the One face / Two or more / No faces groups, the People headings and count, the viewer's boxes, and that turning
  it off stops the scan and hides the groups.

The real model was run once outside the test suite (headless Chromium, the upstream "largest selfie" photo): it found
52 faces at score 0.6 with overlap suppression at 0.3. The Python reference decoder of the same ONNX file found 55, and
the top boxes match within a few pixels. The gap comes from the downscale filter, not the decoder.

## Limits and what to know

- Detection runs on the page's main thread (about 150 to 250 ms per picture at 640 px in WebAssembly, on this machine).
  The Gallery scan yields between pictures. A Worker would be the next step if it stutters on large libraries.
- Only raster pictures the browser can decode (`createImageBitmap`) are checked. SVG and most HEIC files are skipped.
- The face model is not in the service worker's precache list (that list is generated from the pages by
  `tools/pwa-precache.mjs`). It is fetched on first use, from the site.
- Results are derived data. They live in IndexedDB `slop-faces`, not in the Gallery backup or the Drive file record.
  The shared backup does include the `slop-faces` database, because it includes every database in the origin.
- The detector finds faces; it does not know who they are. Nothing here stores a face template or identity.

## Removing it

1. Turn the setting off (Profile). Nothing loads while it is off.
2. Delete `vendor/face/`.
3. Delete `shared/faces/`, and remove the `faces` entry from `shared/profile/app-options.js` and `SLOP_APP_SHARED`.
4. Remove the face scripts from `drive/index.html` and `gallery/index.html`, `js/ui/faces.js` (Drive), the `DR.isFaceable`
   references in `drive/js/ui/info.js`, `menus.js` and `quicklook.js`, and `gallery/js/core/people.js`,
   `gallery/js/ui/people.js`, `gallery/css/people.css` and the People bar, nav button and `view-state` view.
5. Delete the IndexedDB database `slop-faces` (or clear this site's data).
