# SlopEdit — handoff

In-browser video editor at `/slopedit/` (registry id `slopedit`). Premiere/DaVinci-lite: media bin, multi-track
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
   or WebM (webm-muxer). MP4 tries H.264 (level picked from size/fps) then VP9/AV1; audio AAC then Opus. 720p,
   1080p, 4K or sequence size, 24–60 fps, quality presets, whole sequence or in/out, progress with Cancel, result
   dialog with preview, Download, Save to Slop Drive. Frames come from `js/media/frames.js`: a hand-written MP4
   demuxer (`demux.js`) + VideoDecoder (frame-exact), falling back to seeking a private `<video>` (rVFC).
   Without WebCodecs: real-time WebM via MediaRecorder (`recorder.js`). GIF (`gif.js`, median-cut palette, LZW,
   ≤15 s). Snapshot frame to PNG (Shift+E), Send frame to PhotoSLOP. `.slopedit` project files = store-only zip
   (`core/zip.js`) with project.json + media (`io/project.js`). Autosave of the project to IndexedDB (`io/session.js`).
6. **Polish**: themes Pro/Light/Classic 98 (`--sui-*` tokens), phone layout ≤760 px (monitor on top, bottom tabs
   Media/Effects/Inspector/Timeline, + buttons on bin items), sample project generated on the device
   (`io/synth.js`, `io/sample.js`), File ▸ Download app (offline .html, `io/build.js`), every action is a SlopCmd
   command (`js/ui/commands.js`; Help ▸ Search commands ⌘K, Keyboard shortcuts). `cmd-fallback.js` is a small
   built-in dispatcher/palette used only if SlopCmd is missing.

## Tests
`node tests/run.mjs slopedit` → `tests/slopedit/slopedit.test.html` (37 tests, ~40 s, all green). App runs in
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
- No nested sequences, multicam, keyframed transforms, LUTs or audio effects beyond volume.
- The MediaRecorder fallback could not be verified in headless Chromium (canvas captureStream records 0 bytes
  there); it is only used when WebCodecs is missing (old Firefox/Safari). Check it by hand in such a browser.
- Offline .html has no Slop Drive (by design) and uses fallback fonts (shared/fonts is stripped like other apps).

## Recommended registry status
`beta` (feature-complete and tested; real-world codec/hardware coverage still needs field testing).

Vendored: `vendor/mp4-muxer` (mp4-muxer 5.2.2, MIT), `vendor/webm-muxer` (webm-muxer 5.1.4, MIT), both by Vanilagy.
Every source file is ≤ 300 lines.
