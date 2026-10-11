# Reel Remix (remix/)

Registry id `remix` (`shared/apps.js`, status `building`, group `creative`). Drop or pick clips and photos, press Remix,
and get a random edit with a chosen grid or template, a target length, a pace, a seed and an export preset. Preview it,
reshuffle, edit the Layout lane, and send it to SlopCut to fine-tune. Local only: nothing is fetched or uploaded
(`grep -rn "fetch\|XMLHttpRequest\|http" remix shared/video` finds nothing).

## Files

- `index.html`: the page (bin, preview with transport, Layout lane and cut list, options).
- `js/core.js`: state (`RM.state`), `RM.options()` (the options for the shared plan), `RM.remix()`, `RM.reshuffle()`,
  `RM.manifest(ids)`.
- `js/items.js`: the bin. Files become items (images, videos with their duration); `RM.addFiles`, `RM.removeItem`.
- `js/preview.js`: the preview player (`RM.preview`): draws the plan at time t on a canvas, play/pause/seek, no sound.
- `js/send.js`: Send to SlopCut through Slop Drive (clips and manifest stored, then `SlopHub.sendTo('slopedit', …)`).
- `js/ui.js`: the page wiring. `RM.remixNow`, `RM.reshuffleNow` are the entry points the tests use.
- `css/remix.css`: layout, light and dark tokens; the lane uses `shared/video/lane.css`.

## How it plans

Remix never copies the logic: it fills in options and calls `SlopVideo.random.plan` (see `shared/video/HANDOFF.md`).

- Layout: the base select (none, a template, a grid, or a random grid from the checked list) and the Layout lane.
- Random on: Remix draws new switch points at random (lengths from the pace, layouts from the checked grids) and
  replaces the lane with them. Random off: the lane's switches are used as they are.
- Export preset: sets the sequence size (`RM.size()`), which is the frame the layout is planned for and the size sent to
  SlopCut. Presets: Phone vertical 1080×1920, Square, Landscape 1920×1080, 4K 3840×2160, Portrait 1080×1350, and Custom.
- Seed: shown as 8 hex digits. Remix repeats the seed shown; Reshuffle draws a new one. The same seed, options and clips
  give the same edit.

## Send to SlopCut

The manifest is a Drive record of type `application/x-slop-reel+json`: `format: 'slop-reel'`, `version: 2`,
`from: 'remix'`, the clip ids in play order, and `remix`: the exact options used. SlopCut's reel loader
(`slopcut/js/io/reel.js`) runs `SE.random.plan` with those options, so the same clips give the same edit, then builds it.
SlopCut reads durations from its own import, so a clip whose length differs there can change the plan.

## Tests

`node tests/run.mjs remix` → `tests/remix/remix.test.html` (in an iframe). Adds clips through the real file input and
presses Remix: the total is within 0.01 s of the target; Reshuffle changes the seed and the cut order; the same seed gives
the same cuts; the 4K and Phone presets set the sequence size; a 1x1 then 1x3 lane switch puts one clip in the first
span and three in the second; the lane adds a switch at the playhead and deletes it; Random on draws switch points that
appear on the lane.

## Not done

Audio in the preview and in the plan (clips are silent here); transitions; export of the video file from Remix itself
(the edit goes to SlopCut, which exports); cut-outs; dragging a clip from the bin into the lane.
