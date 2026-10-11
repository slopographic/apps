# Reel Remix (remix/)

Registry id `remix` (`shared/apps.js`, status `building`, group `creative`). Drop or pick clips and photos, press Remix,
and get a random edit with a chosen grid or template, a target length, a pace, a seed, an export preset, a fill, per-slot
timing, locked slots and a sound. Preview it, reshuffle, edit the Layout lane, export it from the page, or send it to
SlopCut. Local only: nothing is fetched or uploaded (`grep -rn "fetch\|XMLHttpRequest\|http" remix shared/video` finds nothing).

## Files

- `index.html`: the page. Bin (left), stage (centre: canvas, transport with Play, Export and Send to SlopCut, the slot
  lock row, the Layout lane, the cut list), options (right).
- `js/core.js`: state (`RM.state`), `RM.options()` (every option of the plan), `RM.remix()`, `RM.reshuffle()`,
  `RM.manifest(ids)`, `RM.setCutFill`, `RM.replaceSlot`, `RM.toggleLock`, `RM.toggleCutLock`, `RM.setMusic`.
- `js/items.js`: the bin. Files become items (images, videos with their duration and size); `RM.addFiles`, `RM.removeItem`.
- `js/preview.js`: the preview (`RM.preview`): draws the plan at time t, fill modes, scrubbing, play, music and original sound.
- `js/drop.js`: drag and drop (see below).
- `js/export.js`: Export (`RM.exporter.run`): records the plan at the preset size, with its sound.
- `js/audio.js`: the reel's sound (`RM.audio`): music track, fade, routing for the export.
- `js/send.js`: Send to SlopCut through Slop Drive (clips and manifest stored, then `SlopHub.sendTo('slopedit', …)`).
- `js/ui.js`: the page wiring. `RM.remixNow`, `RM.reshuffleNow` are the entry points the tests use.
- `css/remix.css`: layout (the stage is the widest column; the canvas fills its width, max-height 70vh), tokens.

## How it plans

Remix never copies the logic: it fills in options and calls `SlopVideo.random.plan` (see `shared/video/HANDOFF.md`).
Every option is in `RM.options()`, so the manifest records the whole edit.

- Layout: the base select (none, a template, a grid, or a random grid from the checked list) and the Layout lane.
  Random on: Remix draws switch points. Grids are chosen by orientation: grids whose cells suit the clips' shapes (see
  `shared/video/orient.js`). Orientation is chosen per layout span (not per cut), from the whole clip set.
- Fill (Options, and per cut in the cut list): Auto (cover; blur background when the clips' orientations are mixed),
  Cover (crop), Fit (letterbox), Stretch (distort), Blur background. The per-cut choice is kept until the next Remix.
- Timing (Options): Same time (all slots switch together); Stagger (each slot starts a random offset up to "Stagger up to",
  and ends with the cut); Random length (each slot plays its own length between Min and Max, never past the cut).
  A slot keeps its clip until its own next clip. Video in cells: Play through (from the clip's start) or Random length
  (a random point in the clip). The cut list shows each slot's start and end when timing is not "Same time".
- Locks: lock a cut (the lock button in the cut list) or a slot (the slot row under the preview, for the cut at the
  playhead). Locked slots keep their clip and in point through Reshuffle and Remix; the others change. Locks are by cut
  number: a plan with fewer cuts drops the locks it cannot place.
- Audio (Options): Off; Original (each video's own sound, playing while its cut is on screen); Music (one track under the
  whole reel, fading out over the last 2 s). Music is a bin video's sound (Random picks one with the seed, so the same seed
  gives the same track), or a music file picked with "Pick music file" (kept out of the bin).
- Export preset: sets the sequence size (`RM.size()`). Presets: Phone vertical 1080×1920, Square, Landscape 1920×1080,
  4K 3840×2160, Portrait 1080×1350, and Custom.
- Seed: shown as 8 hex digits. Remix repeats the seed shown; Reshuffle draws a new one. The same seed, options and clips give
  the same edit, the same timing and the same music.

## Editing on the stage

- Drag files from the desktop anywhere on the stage: they join the bin (the Add files path).
- Drag a clip from the bin onto a slot in the preview: it replaces that slot's clip in the cut showing at the playhead.
  Drag it onto a span in the cut list: it replaces that slot's clip in that cut. The clip keeps the cut's length; a clip
  shorter than its slot holds its last frame. Replaced clips stay until the next Remix or Reshuffle, which plans again.
- Scrubbing (the playhead slider, a click or a drag on the Layout lane's track) paints the frame at once, even when paused.
  Play continues from the scrubbed time.
- Export records the plan in real time (MediaRecorder on the canvas, WebM or MP4 where the browser records it). Keep the tab
  visible. Stop export saves what has been drawn. Browsers without MediaRecorder: use Send to SlopCut.

## Send to SlopCut

The manifest is a Drive record of type `application/x-slop-reel+json`: `format: 'slop-reel'`, `version: 2`,
`from: 'remix'`, the clip ids in play order, and `remix`: the options used (including timing, locks and audio). SlopCut's
reel loader (`slopcut/js/io/reel.js`) runs `SE.random.plan` with those options, so the same clips give the same cuts.
Limits: SlopCut reads durations from its own import, so a clip whose length differs there can change the plan; manual cell
replacements are not in the manifest (SlopCut replays the plan from the options), and SlopCut does not play the music.

## Tests

`node tests/run.mjs remix` runs `tests/node/remix-orient.test.mjs` (orientation, grid choice, cell order, fill),
`tests/node/remix-edit.test.mjs` (timing, locks surviving a reshuffle, audio choice) and the browser pages
`tests/remix/remix.test.html` (the edit, presets, lane) and `tests/remix/remix-stage.test.html` (stage size, drop on the stage,
drop onto a cut, scrubbing paints a frame and Play carries on, export records a file).

## Not done

Audio in the export of Original mode follows real time (the clips play with their cut); transitions; cut-outs; per-cut
timing beyond the slot offsets; a lock on a single slot that is in a cut with a different slot count after Remix.
