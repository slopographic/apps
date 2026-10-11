# SlopCut — handoff

In-browser video editor at `/slopcut/` (registry id `slopedit`). Premiere/DaVinci-lite: media bin, multi-track
timeline, real-time preview, transitions, titles, colour, audio mixing, WebCodecs export. Nothing is uploaded.
No SharedArrayBuffer, no ffmpeg.wasm (GitHub Pages cannot send COOP/COEP headers).

## What works
1. **Media bin** (`js/ui/bin.js`, `js/media/*`): import video/audio/images by picker (Ctrl+I), drag and drop anywhere,
   File ▸ Import from Slop Drive, `?drive=<id>` launch. Thumbnails (filmstrip), duration, waveform peaks, sound
   detection (decodeAudioData). Blobs live in IndexedDB `slopedit` › `media`; the first import into an empty project
   sets the sequence size and puts the clips on the timeline. Rename, remove, download original, save to Drive.
2. **Timeline** (`js/timeline/*`, model in `js/core/*`): video tracks (V1 bottom) and audio tracks, add/rename/delete
   tracks, hide/mute/solo/lock. Drag from bin or Effects tab, move across tracks (overwrite semantics), trim
   (normal, ripple with the B tool or Ctrl-drag), razor (C), split at playhead (S / Shift+S all tracks), Q/W ripple
   trim to playhead, ripple delete, snapping (N) to clip edges/markers/playhead, zoom (wheel+Ctrl, pinch, slider,
   `\` fit), scrub in the ruler, J/K/L shuttle (±1/2/4/8×), markers lane (M, drag, rename), in/out (I/O),
   clipboard, nudge, linked audio/video (Ctrl+L), undo/redo (snapshot history, drags are one step), fades handles,
   transition length handles, volume rubber band with keyframes (Ctrl/Alt-click), context menus.
3. **Preview** (`js/render/*`): Canvas2D compositor (`compositor.js`) with fit, position, scale, rotation, opacity,
   crop, fades; colour grade on the GPU (`grade.js`, WebGL, with a Canvas2D filter fallback). Video comes from a
   `<video>` pool (`vpool.js`) synced to the WebAudio clock (`player.js` + `audiomix.js`). Safe-area overlay ('),
   half-quality toggle, level meter, on-canvas move/scale/rotate handles (`preview-input.js`).
4. **Effects**: transitions (cross dissolve, dip to black/white, wipe, slide, push), titles (fonts, size, colour,
   outline, box, bold/italic/shadow, align, animations fade/slide/pop/typewriter/rise), colour mattes, brightness/
   contrast/saturation/temperature + looks, speed (10–1600 %, later clips ripple), video fades, audio volume,
   keyframes and fades. Effects tab supports click-to-apply and drag onto the timeline.
5. **Export** (`js/io/encode.js`, `js/ui/export-dialog.js`): WebCodecs VideoEncoder/AudioEncoder → MP4 (mp4-muxer)
   or WebM (webm-muxer). MP4 tries H.264 (level picked from size/fps) then VP9/AV1; audio AAC then Opus. Size is a
   frame preset (Phone 1080×1920, Square, Landscape 1920×1080, 4K, Portrait 4:5) or custom width and height; the chosen size
   becomes the sequence size. 24–60 fps, quality presets, whole sequence or in/out, progress with Cancel, result
   dialog with preview, Download, Save to Slop Drive. Frames come from `js/media/frames.js`: a hand-written MP4
   demuxer (`demux.js`) + VideoDecoder (frame-exact), falling back to seeking a private `<video>` (rVFC).
   Without WebCodecs: real-time WebM via MediaRecorder (`recorder.js`). GIF (`gif.js`, median-cut palette, LZW,
   ≤15 s). Snapshot frame to PNG (Shift+E), Send frame to PhotoSlop. `.slopedit` project files = store-only zip
   (`core/zip.js`) with project.json + media (`io/project.js`). Autosave of the project to IndexedDB (`io/session.js`).
6. **Polish**: themes Pro/Light/Classic 98 (`--sui-*` tokens), phone layout ≤760 px (monitor on top, bottom tabs
   Media/Effects/Inspector/Timeline, + buttons on bin items), sample project generated on the device
   (`io/synth.js`, `io/sample.js`), File ▸ Download app (offline .html, `io/build.js`), every action is a SlopCmd
   command (`js/ui/commands.js`; Help ▸ Search commands ⌘K, Keyboard shortcuts). `cmd-fallback.js` is a small
   built-in dispatcher/palette used only if SlopCmd is missing.

## Templates and random edit

**Templates** (`shared/video/templates.js` and `grid.js` data, `js/core/layout.js` operations, `js/ui/templates-panel.js`): a Templates tab
in the bin (Shift+G, or Sequence ▸ Templates panel). Eight layouts, each a list of regions (fractions of the frame):
Single, Split horizontal, Split vertical, Picture-in-picture (main plus a corner, layered), Grid 2×2 (4), Grid 3×3 (9),
Three-up, Vertical 9:16 reel (sets a 9:16 frame, two stacked), and Custom grid… (columns and rows, 1 to 4 each, equal cells; the id is `grid-RxC`, rows × columns, so 1x3 is three columns). Clips go to the monitor as transforms (fitted, letterboxed
into the region) and to the timeline as slots: slot i is video track V(i+1) (linked sound on A(i+1)), all starting at the
same time for the layout's length (the shortest selected clip, capped by the template's default length).
- Apply: select clips on the timeline (Ctrl/Shift-click for several) and pick a template; with no clips selected, the media
  picked in the bin (Ctrl/Shift-click) is added at the playhead. Clips beyond the slot count stay on the timeline.
- Re-flow: with a layout on, choosing another template keeps the clips and re-flows them (extra clips leave the layout).
- Slots in the panel: drag a clip from the chips into a slot, drag a filled slot onto another to swap, or use the per-slot
  selects (choose a clip, swap with a slot, free the slot). Clear layout keeps the clips.
- Project field `layout = { tpl, start, dur, slots[] }`. Undo covers every step.

**Random edit** (the pure plan and seed are `shared/video/random-edit.js` and `seed.js`; `js/core/random-edit.js` writes the plan into the project; `js/ui/random-dialog.js`): Shift+R or Sequence ▸ Random edit…
- Options: target length (1–600 s), pace (fast 0.6–1.4 s cuts, medium 1.5–3 s, slow 3–6 s), frame size (a preset; sets the
  sequence size), layout (none = one clip after another; a template or grid = beats of n simultaneous cuts, one per slot; Random grid from the list draws one grid by seed). Random switch points change the layout over time (see the Layout lane below).
- Clips: the bin items picked, else every ready video and still image. Shorter sources are skipped (under 0.2 s).
- Seed: mulberry32, shown as 8 hex digits in the dialog, the status line and the Templates tab. Any text typed as the seed is
  hashed. The same seed, options and clips always give the same cuts (`SE.random.plan` is pure). Reshuffle draws a new seed;
  Sequence ▸ Reshuffle random edit (no shortcut) rebuilds with the last options and a new seed.
- The random edit is ordinary timeline clips (video or still, plus linked sound). Build replaces the timeline clips in one
  undo step. `project.random` records seed, target, pace, aspect, template, cut count and length.
- Clips are drawn from a shuffled deck: no clip repeats until every clip has been used (when there are enough clips).

Limits: cuts are straight cuts (no transitions; `shared/motion` transitions are CSS-slide keyframes, not compositor
transitions, so they are not used); no audio ducking; no beat detection; each cut keeps its own sound, so sound changes
abruptly at cuts; templates fit by contain (letterbox, no crop); the random build ignores track locks and replaces every
timeline clip; with fewer clips than slots, clips repeat inside one cut; drag works between panel chips and slots only
(timeline clips cannot be dragged into a slot from the monitor).
`io/reel.js` (Slop Gallery reels) calls `SE.random.plan` / `build` and `SE.layout`: keep those signatures.

## Layout lane, presets and the shared core

- The shared video core (layout geometry, presets, grids, templates, the segment model, the pure plan and the lane widget)
  is in `shared/video/` with its own HANDOFF. This app keeps the project operations: `js/core/layout.js` (single layout),
  `js/core/lane.js` (switches), `js/core/random-edit.js` (writes a plan into the project).
- **Layout lane** (Templates tab, under the layouts): switches `{ start, layout }` are kept in `project.segments`. Choose a
  layout and press "Switch at playhead"; drag a marker to move it (snaps to 0.1 s); select it and press Delete (or the
  Delete switch button) to remove it; arrow keys nudge the selected one (Shift for 1 s). Each change is one undo step.
  Each band holds one layout until the next switch. `applyLane` refits every video clip to the slot region of the layout
  active at its start: a clip on track V(i+1) takes slot i, and a clip past that layout's slot count is left alone.
- The single-layout path is unchanged: a layout from the Templates tab (`project.layout`) works as before when there are
  no switches.
- Random edit: Layout is none, a template, or Random grid from the list (1x2, 2x2, 1x3, 2x3, 3x3). "Switch layouts at random
  points" draws the switch points over the checked grids. The options (size, layouts, switches) are kept in `project.random`,
  so Reshuffle keeps them.
- Export: the Size list is the presets plus Custom width and height. Export first applies the chosen size to the sequence, so
  the layout and the file use the same frame.
- Timeline: the middle mouse button drags the timeline (horizontally and vertically) and does not select or move clips;
  left-drag is unchanged. Test: "a middle-button drag changes the timeline scroll position and does not move a clip".
- Reel Remix sends a manifest with a `remix` object of the same plan options; `io/reel.js` replays it with `SE.random.plan`.

## Keyframes and the random effect layer

- **Keyframes** (`js/core/anim.js`, inspector section "Animation" in `js/ui/insp-anim.js`): `clip.anim = { x, y, scale, rot,
  opacity }`, each a `shared/motion/track` of `{ t, value, ease }` (t in seconds from the clip start). X, Y and rotation keys
  add to the clip's own transform; scale and opacity keys multiply it, so the neutral key is 0 / 0 / 1 / 0 / 1 and a key past
  the last one holds its value. Easing per key (linear, ease in, ease out, ease in-out: the segment that starts at the key).
  Key at playhead (one key per property, at its current value), drag a diamond along its track, click the lane to move the
  playhead, edit value/time/easing of the selected key, delete it. Animate-in presets (fade in, slide from left/right/top/bottom,
  zoom in) write keys over the first 0.5 s. Reset keyframes clears them.
- The compositor (`js/render/compositor.js`) reads keys through `SE.anim.combine` for layers, the monitor overlay and the
  hit-test (`CMP.bounds(p, c, t)`); export and preview use the same `CMP.render`, so both show them.
- **Random effect layer**: a clip of kind `effect` on a video track (Timeline ▸ Add random effect layer, Effects tab, or
  `tl.effect` in the palette). It applies to the tracks below its own track; put it above the clips it should affect.
  `fx = { seed, every, intensity, types }`: `every` is the change interval (0 = one effect for the whole layer), `intensity`
  0–100 %, `types` the enabled effects of grain, colour shift, glitch, zoom pulse and vignette. Each cut draws one effect
  with `SlopVideo.seed` (`js/core/fx-random.js`, pure: the same seed, cut and settings always give the same pick). Drawing
  (`js/render/fx-draw.js`) works on a copy of the frame drawn so far; grain and glitch use the seed and the time.
  New layers get a random seed; New seed reshuffles; Reset effect restores the defaults (seed 1, all five, 60 %, every 1 s).
- **Reset all** (`clip.reset`) restores a clip's transform, crop, colour, fades, transition, volume, keyframes and effect
  settings to their defaults. It keeps media, timing, speed, title text, colour matte colour and links.
- Colour shift uses `ctx.filter`; where the browser has none it is skipped (the other effects still draw).
- Tests: `tests/node/slopcut-core.test.mjs` (interpolation, easing, presets, seeded pick); `tests/slopcut/slopedit.spec-anim.js`
  (adds, moves, edits and resets a key in the inspector; presets; Reset all; the effect layer's pixels, seed rule and reset; a
  decoded MP4 export that has a key and a vignette).

## Clip masks

A clip can have one mask (`clip.mask`, `null` when none). It is saved with the project and each change is one undo
step (`SE.change`; slider drags coalesce per field). The mask is in clip space: project pixels from the clip's centre at
scale 1, so it moves, scales and rotates with the clip (keyframed masks are not done).

- **Shapes:** rectangle, ellipse, rounded rectangle (`r`), or a path of anchors with bezier handles (`pts`: `x, y` plus
  handle offsets `ix, iy` in and `ox, oy` out). Freehand strokes are simplified (Ramer–Douglas–Peucker) to anchors with no handles.
- **Fields:** `feather` (px, soft edge, 0–500), `expand` (px, + grows / − shrinks), `invert` (keep outside instead).
- **Geometry** (`js/core/mask.js`, no DOM): `ops` (outline), `flatten`, `inside`, `dist`, `covered` (expansion applied
  as distance to the outline, then invert), `bounds`, `clean` (sanitises loaded values), `simplify`.
- **Raster** (`js/render/mask-draw.js`): the compositor (`compositor.js`, `drawLayer`) draws a masked clip into a scratch
  layer, then keeps the covered pixels (destination-in). Coverage is the shape with a canvas stroke for expansion and a
  blur for feather. Preview, snapshot, export, GIF and the recorder all call the same compositor, so they match.
- **Monitor** (`js/render/mask-view.js` draws the outline and handles; `js/render/mask-input.js` is the pointer side):
  the selected clip's mask outline shows in the monitor (dashed when inverted). Edit shape shows handles: corners resize
  (opposite corner fixed), the round handle sets the corner radius, path anchors and handles drag, and dragging inside
  moves the mask. Draw tools (`SE.maskInput.setTool`, Clip ▸ Mask ▸ Freehand / Bezier path): freehand drags a path; pen
  clicks anchors (drag for a curve), closes on the first point, on double-click or Enter; Esc cancels. A new mask opens
  in edit mode.
- **UI:** Inspector ▸ Mask (shape, centre, size, radius, feather, expansion, Keep inside / outside, Edit shape, Remove);
  Clip menu ▸ Mask and the timeline clip context menu ▸ Mask (`SE.maskMenu()`); commands `mask.add.rect|ellipse|rrect`,
  `mask.draw.free|pen`, `mask.remove`, `mask.invert`, `mask.edit` (SlopCmd, rebindable).
- **Limits:** no keyframes on masks; no mask on effect layers, audio or nested clips; a path needs three points; the
  raster feather is a canvas blur (its profile is not the geometric one that `covered` uses, which ignores feather).
- **Tests:** `tests/node/slopcut-mask.test.mjs` (geometry, expansion, invert, clean, simplify) and
  `tests/slopcut/slopedit.spec-mask.js` (a mask changes the frame pixels, feather and expansion pixels, one undo step per
  change, saved with the project, the inspector section, the draw tool and the corner-handle drag, all through pointer events).

## Tests
`node tests/run.mjs slopedit` → `tests/slopcut/slopedit.test.html` (63 tests with the node file, all green, ~40 s). `slopedit.spec-video.js` covers the Layout lane (a 1x1 then 1x3 switch, add/move/delete with undo), the middle-button pan and export presets. `tests/node/slopedit-video-core.test.mjs` tests `shared/video` in Node. `slopedit.spec-tpl.js`
covers templates (region data, apply, re-flow, swap, drop) and the random edit (seeded plan, length, slots, no repeats,
build, reproducibility, reshuffle, one undo, dialog, menu and keyboard). App runs in
iframes (1280×760 and 390×844); `slopedit.helpers.js` exposes `window.ST`. Specs: model (split/trim/ripple/move/
overwrite/snap/links/undo/timecode), render (compositor pixels for layers, crop, rotation, fades, every transition,
GPU vs CPU grade, titles; live preview), media (import + waveform, synthetic video encoded in the page with
VideoEncoder, demux + frame-exact decode incl. backwards seek, MP4 export re-demuxed for frame count/duration/audio,
WebM, cancel, GIF, project round trip, autosave across reload), ui (S/Delete/Ctrl+Z/M/arrows/Home/L/K via keydown,
menus, palette, keymap, inspector, sample project, phone tabs/no overflow, `?drive=` launch, offline build boots,
SlopCmd rebinding, no script errors). Encoder tests skip themselves if VideoEncoder is missing.
Note: Playwright's Chromium has no H.264/AAC, so tests exercise VP9/Opus in MP4; real Chrome/Edge/Safari pick H.264.

## Known limitations / next steps
- Audio is decoded whole into memory (≈380 KB per second of footage); very long files (> ~40 min) are heavy.
- Preview playback relies on `<video>` seeking/playing; reverse shuttle is silent; speed changes pitch the sound.
- Only MP4/MOV get the frame-exact decoder path (fragmented MP4 and WebM inputs use the seek fallback).
- No nested sequences, multicam, LUTs or audio effects beyond volume. Keys cover position, scale, rotation and opacity only (not crop or colour).
- The MediaRecorder fallback could not be verified in headless Chromium (canvas captureStream records 0 bytes
  there); it is only used when WebCodecs is missing (old Firefox/Safari). Check it by hand in such a browser.
- Offline .html has no Slop Drive (by design) and uses fallback fonts (shared/fonts is stripped like other apps).

## Recommended registry status
`beta` (feature-complete and tested; real-world codec/hardware coverage still needs field testing).

Vendored: `vendor/mp4-muxer` (mp4-muxer 5.2.2, MIT), `vendor/webm-muxer` (webm-muxer 5.1.4, MIT), both by Vanilagy.
Every source file is ≤ 300 lines.

## Slop Drive (shared storage)

- **Save project (Ctrl+S)** writes the `.slopedit` back to the Drive file the project came from (`PJ.driveId`, set by `PJ.openFile(file, driveId)` for Drive projects, cleared by New project). The first save asks for a folder. `File ▸ Download project (.slopedit)` downloads; offline builds download on Save.
- Opening a `.slopedit` from Drive (picker or `?drive=`) opens it as a project; media files still import into the bin.

## Remove background (send to SlopIsolate) — `js/io/cutout.js`
- Clip menu ▸ "Remove background (send to Isolate)" (video clips): the clip's media goes to Slop Drive with the clip id and
  SlopIsolate opens on it. Isolate returns a matte pair (colour video + grey matte video). The result is a **new** clip on the
  video track above the source clip, same start, with `clip.matteMedia` = the matte media id. The source clip is kept.
- Arrival: over the Slop Hub bus (`cutout-result`) when Cut is open, or with `?drive=` (session.js `S.launch`, `meta.matteId`).
- `js/render/matte-pair.js` (`SE.matteDraw`): the compositor draws colour × matte (matte's red channel as alpha) in
  `compositor.js` → `CMP.render`, for preview and export. The frame provider (`media/frames.js` `prepare`) primes the matte
  under the id `<clip id>:matte` (`SE.matteDraw.clipOf`), and prunes readers by the base clip id.
- Test: `node tests/run.mjs slopcut/matte-pair` (alpha from the matte: opaque white, transparent black, partial grey).
- Not tested end to end: the Isolate → Cut return path has no browser test. Expect a check of the bus message and the
  `?drive=` path on a real pair before release.
