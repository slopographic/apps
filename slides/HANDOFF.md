# Slop Slides: handoff

Keynote/PowerPoint alternative at `/slides/`. Status: **building**, but the first version works end to end: you can make a deck, edit it, save it to Slop Drive, reopen it, present it, export PPTX, and keep decks as templates. `node tests/run.mjs slides` is green (97 tests, 6 pages).

## Architecture
- Classic scripts under `window.SS`. The load order is `js/manifest.js` (`SS_MANIFEST`: core, render, anim, io, ui). `index.html` writes its script tags from that list, so the manifest is the only list. Tests and the future offline build use it too.
- The model is in points: 16:9 is 960×540, 4:3 is 720×540.
- A deck is JSON: `size`, a full copy of `theme`, `master` (footer, showNumber), `slides[]` and `media{id:{mime,data}}`. The shapes are documented in the header comments of `js/core/model.js` and `js/core/objects.js`.
- **Motion** is the shared engine `shared/motion/` (SlopMotion, see its HANDOFF). The `anim` group of `js/manifest.js` loads it first. The editor never interpolates or eases: `js/anim/` only plans and samples through the engine.
- **One display list for every output.** `js/render/scene.js` builds it, `js/render/canvas.js` draws it. The editor, thumbnails, Present mode and PNG export all use it.
- **Editing goes through one function:** `SS.app.change(label, fn, key)` (`js/ui/app.js`). It records an undo step before `fn` runs, marks the deck unsaved and schedules an autosave. `A.touch()` is the same without an undo step (used during a drag). `A.hist` is `core/history.js`.
- Views subscribe with `A.on(event, fn)`: `load`, `deck` (undo/redo replaced the deck object, so re-read it), `change`, `select`, `slide`, `render`, `mode`.
- **Storage** (`js/io/`):
  - `native.js`: `.sslide` read/write. Mime `application/x-slop-slides`.
  - `draft.js`: the autosave draft in IndexedDB (`slop-slides`, store `drafts`, key `last`).
  - `pptx.js`: PPTX writer on `shared/office/zip.js`.
  - `validate.js`: `SS.deckCheck.run(deck)`, the one deck validator. Version check, migration (`anim/migrate.js`), then structure (types, numbers, layouts, picture references). Throws with a reason ("Slide 2, object 3 (Name): unknown type ...").
  - `template-file.js`: `.sslide-template` files (`SS.templateFile`). Envelope `{kind:'slop-slides-template', format:1, name, created, deck}`. Parsing calls `SS.native.normalize`, so a template and a `.sslide` pass the same checks.
  - `template-store.js`: "My templates" (`SS.templateStore`). IndexedDB `slop-slides-templates` / `templates` (record: name, slides, first-slide JPEG preview, deck, driveId), plus a copy in the "Templates" folder of Slop Drive.

## Files
| File | Job |
| --- | --- |
| `index.html`, `css/app.css` | page; desktop three columns, phones one column (canvas, slide strip, inspector) |
| `js/ui/app.js` | state, `change`, history, selection, slide index, draft and guard hooks |
| `js/ui/canvas-view.js` | canvas sizing, painting (coalesced per frame), screen ↔ slide mapping |
| `js/ui/overlay.js` | selection outline, resize handles, hit testing, resize maths |
| `js/ui/snap.js` | smart guides while moving |
| `js/ui/pointer.js` | select, move, resize, Shift-toggle, double-click/double-tap to edit text |
| `js/ui/textedit.js`, `textedit-parse.js` | overlay textarea over a text box or shape; maps lines back to paragraphs |
| `js/ui/ops.js` | insert text/shape/picture, delete, duplicate, copy/paste, arrange, nudge, slide add/duplicate/delete/move, layout, theme, title |
| `js/ui/sorter.js`, `sorter-drag.js` | slide strip: thumbnails, click to select, drag to reorder (desktop) |
| `js/ui/inspector.js` | slide (layout, hidden, notes), document (footer, numbers), selection (position, size, rotation, opacity, fill, outline, font, size, bold, italic, align, colour, arrange) |
| `js/ui/toolbar.js` | top bar; File menu (new, new from template, open, save, download, export) |
| `js/ui/templates-dialog.js` | "New from template" (starter and My templates cards with previews, Export, Delete, Import file / Drive), "Save as template" (name, whole deck or current slide), import validation dialogs (`SS.templatesUI`) |
| `js/ui/files.js` | Drive open/save, `?drive=` launch, zero-byte New file, picture and foreign files, `.sslide` download, PPTX and PNG export, boot and draft restore |
| `js/anim/object.js` | object animations: `anims` lists, the build plan (steps and clicks), state at a time (presets + timeline) |
| `js/anim/transition.js` | slide transition `{name, duration}`, engine names, clamping, menu labels |
| `js/anim/migrate.js` | version 1 to 2 file migration (legacy transitions and builds) |
| `js/ui/present.js` | Present mode: slide order, builds, transitions, keys, clicks |
| `js/ui/present-view.js` | Present picture: two canvases whose transform, opacity and clip come from `SlopMotion.transitions` |
| `js/ui/anim-panel.js` | inspector sections: Transition (Apply to all slides), Present switch, Animation list (add, preset, trigger, delay, duration, move, delete) |
| `js/ui/commands.js` | every shortcut and palette command (SlopCmd, app `slides`) |
| `js/ui/main.js` | boot; adds `body.ready` |

## Works
- **Boot:** fonts load, `SlopHub.register('slides')`, `consumeLaunch()`, then the launched file, else the last draft, else a blank deck.
- **Slides:** add, duplicate, delete (never leaves zero), move up/down (buttons and drag), layout change (re-maps placeholders), hidden slides, notes, footer, slide numbers, theme choice, new deck from one of the four templates.
- **Objects:** text boxes, rectangles, ellipses, pictures (file picker, scaled to 60% of the slide), move (with smart guides), resize from 8 handles (unrotated objects), rotation and opacity by field, copy/paste/duplicate, delete, arrange, arrow nudge (Shift for 10 pt), groups are drawn and flattened on export.
- **Text:** double-click or double-tap, or Enter, opens an overlay textarea with the object's font, size, colour and alignment. Commit on blur, Escape or Ctrl/Cmd+Enter. Unchanged lines keep their runs; a changed line keeps the formatting of a one-run paragraph.
- **Undo/redo:** every edit (`Mod+Z`, `Shift+Mod+Z`, `Mod+Y`); a drag is one step; a press that does not move adds no step; repeated field edits merge.
- **Storage:**
  - Ctrl+S saves to the same Drive id with `SlopHub.put` (keeps folder, star and trash state). The first save asks for a folder with `saveToDrive`. Save as a new file is in the File menu.
  - `?drive=<id>` reopens; the address bar keeps the id.
  - A zero-byte `.sslide` (Drive's New menu, "Untitled Presentation.sslide") opens as a blank deck linked to that file.
  - A picture opens as a one-slide deck with no link. Other formats open as a blank deck with no link. A damaged `.sslide` is reported and never overwritten. In all three cases Save makes a new file, so nothing is overwritten.
  - Autosave draft in IndexedDB about 1 s after each edit. It is restored at boot and cleared once the deck is saved. Unsaved state is reported to `SlopGuard`.
- **Present:** full screen (Fullscreen API where allowed). Each slide opens with its transition (`SlopMotion.transitions`, duration from the slide), then plays its automatic build. A click, Right, Down, PageDown, Space or Enter first finishes a motion that is running, else plays the next on-click build, else moves to the next slide. Left, Up, PageUp, Backspace go back (a transition plays either way). Home/End jump with no transition. Clicks: left third goes back. B blacks out, Escape returns to the slide you were on, hidden slides are skipped, editing commands are off during the show. The inspector's **Present** section has **Play animations** (session only, not saved): off means no builds and no transitions, each click moves on.
- **Animations:** each object (top-level, any type) can have a list of `{id, preset, trigger, at, timeScale}`. Presets are the engine's (fade-in, slide-up, pop, shake, pulse, spin-in). `trigger` is `with` (starts with the previous animation on the slide, plus `at`) or `click` (starts a new build at the end of the previous one). Duration is the preset duration times `timeScale`. Before its start an animated object is in its first frame (fade-in hidden).
- **Transitions:** each slide has `{name, duration}` (names: none, fade, push-left/right/up/down, wipe, zoom-in/out, cube; duration 0.2 to 3 s). Set in the inspector's Transition section; Apply to all slides copies it.- **Templates you keep:** File > Save as template… keeps the whole deck or the current slide. File > New from template… lists the starter templates and My templates, each with a preview of its first slide. Export downloads a `.sslide-template`. Import takes a file from this computer or from Slop Drive; the file is validated first and a bad one shows its reason and changes nothing. Templates are copied to the "Templates" folder of Slop Drive when saved or imported.
- **Export:** `.sslide` JSON download (schema version 2: transitions and animations are kept). PowerPoint `.pptx` (text with runs, bullets, alignment, shapes with fill and outline and rotation, pictures PNG/JPEG/GIF, backgrounds as solid colour). PNG of the current slide at 1920 px.
- **Mobile:** at 390×844 there is no horizontal page scroll. The canvas, slide strip and inspector stack in one column. The top bar wraps.
- **Shortcuts and palette:** SlopCmd (Mod+K, the keymap). Keys: Mod+N, Mod+O, Mod+S, Mod+Z, Shift+Mod+Z, Mod+Y, Mod+C, Mod+V, Mod+D, Mod+A, Delete, Escape, Enter, T (text box), Shift+Mod+Enter (new slide), PageUp/PageDown, F5 (Present), Arrow keys.

## Schema
- `.sslide-template` (format **1**): `{kind, format, name, created, deck}`. `deck` is a full deck (version 2) with only the pictures it uses, embedded as data. "Layouts" means each slide's `layout` id, checked against `SS.layouts`; the placeholder geometry stays in code.
- Import of any deck (template, `.sslide`, draft): `SS.deckCheck.run` refuses a newer version, migrates version 1, then checks structure. A picture reference with no picture in the file is an error. Nothing is stored or opened before the check passes.
- `.sslide` version **2** (`deck.version`). Slides: `transition: {name, duration}`; objects: `anims: [...]` (optional, default `[]`); slides no longer have `builds`.
- Version 1 files open with a migration (`js/anim/migrate.js`): `transition {type, dir, dur}` maps to an engine name (dissolve and magic become fade, slide and push become push-<dir>, zoom becomes zoom-in), and each v1 build becomes an animation on its object (fly to slide-up, scale to pop, otherwise fade-in; `after` becomes `with`). The paragraph split of builds is not kept. Files with no transition or animation fields open with the defaults.
- Drafts and Drive files both go through `SS.native.normalize`, so both migrate.

## PowerPoint export drops
- Slide transitions and object animations are not written to `.pptx` (not sure of the transition XML, so none is invented). The export message says so.
- Also left out: tables, charts and media (the message counts them).

## Tests
- `tests/slides/model.test.html` (existing): model, layouts, text layout, history, templates.
- `tests/slides/anim.test.html`: engine names, clamping, the first frame of a fade-in is hidden, delay and time scale, with-previous and on-click steps, legacy and version 1 files, round trip, templates.
- `tests/slides/present-anim.test.html` (`spec-anim.js`): Present on an injected clock (`SS.present.clock`): progress 0 shows only the outgoing slide, 1 only the incoming (all ten transitions), clicks play builds before the next slide, Play animations off, the transition and animation inspector panels store their data.
- `tests/slides/templates.test.html` (`spec-templates.js`): save as template (whole deck and one slide, Save as template dialog) and its preview in New from template, the Drive copy in the Templates folder, export then import round trip (slides, transitions, animations), pictures copied in as data, a broken import changes nothing and shows the reason, the `.sslide` loader and template import give the same reason, a version 1 deck migrates on import.
- `tests/slides/app.test.html`: runs the real editor in iframes (`frame.js` helpers, `spec-boot.js`, `spec-storage.js`, `spec-present.js`). Covers boot, slides, text boxes and dragging, undo, double-click editing, inspector fields, picture insert, template, 390×844 layout, Ctrl+S to the same Drive id and reopen by `?drive=`, folder and star kept, zero-byte, picture, PowerPoint, damaged, draft restore, PPTX package, Present key handling.
- PPTX was loaded with python-pptx (slide size, text, picture and shape positions). **Not yet opened in Microsoft PowerPoint.**

## Templates: not done
- Import from Drive and from a file are covered by `importText` tests; the file picker and Drive picker themselves are not automated.
- My templates has no rename and no reorder. Preview is one slide, the first.

## Missing (in rough order of value)
1. **PDF export** from the display list (subset fonts via `js/render/ttf.js`). Not started. Stretch goal not done.
2. **Magic Move** is not in the engine (the v1 `magic` transition maps to fade). Animations apply to top-level objects only, not to children of a group.
3. **Presenter window** (second window with notes and timer, via BroadcastChannel), laser pointer.
4. **PowerPoint and ODP import.** A `.pptx` or `.odp` from Drive opens as a blank deck with no link, so it is never overwritten.
5. **PPTX export gaps:** tables, charts, video and audio are left out (the result says how many); speaker notes; footer and slide numbers; transitions and animations (see Schema and PowerPoint export drops).
6. **Editing gaps:** no rotation handle (use the Rotation field), no marquee selection, no group/ungroup or align/distribute buttons (the model has them), no table or chart editing, no image crop or mask, no slide-size change, no per-run formatting controls (only the object's default style).
7. **Text:** the overlay edits plain text. Whole-line changes in multi-run paragraphs lose run formatting.
8. **Drag reorder** works with the mouse (HTML5 drag). On phones use the Move up and Move down buttons.
9. **Offline build** (copy `pdf/js/io/build.js`) is not written.

## Next steps, in order
1. Open a PPTX that the export wrote in PowerPoint and Keynote, and fix whatever they flag.
2. Add PDF export from the display list, and an export test that reads the PDF back.
3. Animations for objects inside groups.
4. Import PPTX (`shared/office/zip.js` + `ppt/slides/*.xml`).
5. Presenter window and notes.
