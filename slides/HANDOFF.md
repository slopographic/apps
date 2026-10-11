# Slop Slides: handoff

Keynote/PowerPoint alternative at `/slides/`. Status: **building** (no `index.html` yet; the model and renderer are done and tested, the editor UI is half-written).

## Architecture
- Classic scripts under the namespace `window.SS`. Load order is in `js/manifest.js` (`SS_MANIFEST`: core, render, anim, io, ui). The tests and the future `index.html` and offline build should all follow it.
- The model unit is points: 16:9 is 960×540 and 4:3 is 720×540, so the PDF needs no conversion.
- A deck is JSON with `size`, a full copy of `theme`, `master` (footer, showNumber), `slides[]` and `media{id:{mime,data}}`. For the object shapes, see the header comments in `js/core/model.js` and `js/core/objects.js`.
- **Print parity:** `js/render/scene.js` turns a slide into a display list, which `js/render/canvas.js` draws. The PDF writer (not written yet) must draw the same display list.
  - Text layout (`js/render/text.js`) measures with TTF metrics (`js/render/ttf.js`), not the browser.
  - The canvas draws with the same TTF files and kerning off. This is verified to match within 1 px.
- **Fonts:** `fonts/*.ttf` are static instances made from `shared/fonts` with `fonts/mkfonts.py` (fonttools + brotli). They cover latin and latin-ext, with GSUB and GPOS removed. OFL licenses are in the same folder.
  - `SS.fonts` registers each file twice: as `SSF-<file>` for the canvas and as `SSG-<Family>` with weight/style descriptors for DOM text.
  - `ttf.js` has a glyf subsetter for PDF embedding (keeps glyph ids, so use CIDToGIDMap Identity).
- **Themes:** 8 themes in `js/core/themes.js`, including the Slopographic lime/dark theme `slop`. Colours can be theme refs (`accent1`, `text`, `accent1/60`).
- **Layouts:** 9 layouts with placeholders in `js/core/layouts.js`. `layouts.apply` re-maps placeholders when a slide's layout changes.
- **Templates:** pitch deck, photo album, lesson and quarterly report (`js/io/templates*.js`). They include builds, transitions and Magic Move slides as data.

## Done (step 1, committed; `node tests/run.mjs slides` is 16/16 green)
- Model:
  - slides: add, duplicate, delete, move, hide; sections; size change with scaling
  - media dedupe and garbage collection; z-order; align and distribute
  - group and ungroup (PPTX-style `ch` child frame)
  - undo/redo snapshots (`js/core/history.js`, with media kept out of snapshots)
- Rendering:
  - shapes, gradients, shadows, images with crop and mask, tables, bar/line/pie charts, media posters
  - bullets and levels, autofit shrink, footer and slide numbers

## Half-done (step 2, editor UI)
These files are written but not loaded anywhere and not tested. `SS_MANIFEST.ui` is still empty.
- `js/ui/dom.js`, `js/ui/app.js` (state, `A.change`, events), `js/ui/canvas-view.js`, `js/ui/overlay.js`, `js/ui/snap.js`, `js/ui/pointer.js`
- `js/ui/textedit.js` and `js/ui/textedit-parse.js`
- `js/ui/sorter.js` and `js/ui/sorter-drag.js`
- `js/ui/inspector.js` (tab shell and control kit; no tabs registered yet)

These files are referenced but missing:
- `SS.menus` (`objectMenu`, `slideMenu`, `sectionMenu`)
- `SS.insert.pickImageFor`
- `SS.chartData.open`
- `SS.play`

## Next steps, in order
1. Write the inspector tabs: `insp-format.js` (fill, stroke, shadow, image, table, chart), `insp-text.js` (text: font, size, B/I/U, colour, align, bullets; uses `SS.textEdit.applyRun` while editing), `insp-arrange.js`, `insp-animate.js` and `insp-document.js` (size, theme, footer).
2. Write `menus.js`, `commands.js` (SlopCmd, app id `slides`), `insert.js`, `clipboard.js`, `chartdata.js`, `notes.js` and `welcome.js` (theme/template picker).
3. Write `index.html` and `css/` (copy the head/OG/theme pattern from `pdf/`; add the ui list to the manifest).
4. Write `io/native.js`: `.sslide` JSON with mime `application/x-slop-slides`, Drive `?drive=` save-back, and IndexedDB autosave.
5. Build `js/anim/`: builds (appear, fade, fly, scale, wipe, typewriter; click/after/with), transitions, and Magic Move (match by name, then id; tween x/y/w/h/rot/colour/opacity). The scene already supports per-object `state(o) → {opacity, m, clip, reveal}`, and the canvas supports `typewriter`.
6. Write the play mode and the presenter window (BroadcastChannel), including laser pointer, B/W screen and rehearse timer.
7. Add import/export:
   - PPTX and ODP, both reading and writing, using `shared/office/zip.js` (`readZip`/`writeZip`), which did not exist yet when this was written.
   - PDF from the display list, with subset fonts, notes pages and handouts.
   - PNG/JPG per slide, and WebM.
8. Write the tests (Magic Move, round trips, PDF via pdf.js, presenter sync, UI smoke at desktop and 390×844) and the offline build (copy `pdf/js/io/build.js`).
