# Slop Slides: handoff

Keynote/PowerPoint alternative at `/slides/`. Status: **building**, but the first version works end to end: you can make a deck, edit it, save it to Slop Drive, reopen it, present it, and export PPTX. `node tests/run.mjs slides` is green (46 tests, 2 pages).

## Architecture
- Classic scripts under `window.SS`. The load order is `js/manifest.js` (`SS_MANIFEST`: core, render, anim, io, ui). `index.html` writes its script tags from that list, so the manifest is the only list. Tests and the future offline build use it too.
- The model is in points: 16:9 is 960×540, 4:3 is 720×540.
- A deck is JSON: `size`, a full copy of `theme`, `master` (footer, showNumber), `slides[]` and `media{id:{mime,data}}`. The shapes are documented in the header comments of `js/core/model.js` and `js/core/objects.js`.
- **One display list for every output.** `js/render/scene.js` builds it, `js/render/canvas.js` draws it. The editor, thumbnails, Present mode and PNG export all use it.
- **Editing goes through one function:** `SS.app.change(label, fn, key)` (`js/ui/app.js`). It records an undo step before `fn` runs, marks the deck unsaved and schedules an autosave. `A.touch()` is the same without an undo step (used during a drag). `A.hist` is `core/history.js`.
- Views subscribe with `A.on(event, fn)`: `load`, `deck` (undo/redo replaced the deck object, so re-read it), `change`, `select`, `slide`, `render`, `mode`.
- **Storage** (`js/io/`):
  - `native.js`: `.sslide` read/write. Mime `application/x-slop-slides`.
  - `draft.js`: the autosave draft in IndexedDB (`slop-slides`, store `drafts`, key `last`).
  - `pptx.js`: PPTX writer on `shared/office/zip.js`.

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
| `js/ui/files.js` | Drive open/save, `?drive=` launch, zero-byte New file, picture and foreign files, `.sslide` download, PPTX and PNG export, boot and draft restore |
| `js/ui/present.js` | Present mode |
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
- **Present:** full screen (Fullscreen API where allowed), Right/Down/PageDown/Space/Enter advance, Left/Up/PageUp/Backspace go back, Home/End jump, a click advances (left third goes back), B blacks out, Escape returns to the slide you were on, hidden slides are skipped, editing commands are off during the show.
- **Export:** `.sslide` JSON download. PowerPoint `.pptx` (text with runs, bullets, alignment, shapes with fill and outline and rotation, pictures PNG/JPEG/GIF, backgrounds as solid colour). PNG of the current slide at 1920 px.
- **Mobile:** at 390×844 there is no horizontal page scroll. The canvas, slide strip and inspector stack in one column. The top bar wraps.
- **Shortcuts and palette:** SlopCmd (Mod+K, the keymap). Keys: Mod+N, Mod+O, Mod+S, Mod+Z, Shift+Mod+Z, Mod+Y, Mod+C, Mod+V, Mod+D, Mod+A, Delete, Escape, Enter, T (text box), Shift+Mod+Enter (new slide), PageUp/PageDown, F5 (Present), Arrow keys.

## Tests
- `tests/slides/model.test.html` (existing): model, layouts, text layout, history, templates.
- `tests/slides/app.test.html`: runs the real editor in iframes (`frame.js` helpers, `spec-boot.js`, `spec-storage.js`, `spec-present.js`). Covers boot, slides, text boxes and dragging, undo, double-click editing, inspector fields, picture insert, template, 390×844 layout, Ctrl+S to the same Drive id and reopen by `?drive=`, folder and star kept, zero-byte, picture, PowerPoint, damaged, draft restore, PPTX package, Present key handling.
- PPTX was loaded with python-pptx (slide size, text, picture and shape positions). **Not yet opened in Microsoft PowerPoint.**

## Missing (in rough order of value)
1. **PDF export** from the display list (subset fonts via `js/render/ttf.js`). Not started. Stretch goal not done.
2. **Transitions, builds and Magic Move** (`anim/` is empty). Builds and transitions are stored on slides but not played.
3. **Presenter window** (second window with notes and timer, via BroadcastChannel), laser pointer.
4. **PowerPoint and ODP import.** A `.pptx` or `.odp` from Drive opens as a blank deck with no link, so it is never overwritten.
5. **PPTX export gaps:** tables, charts, video and audio are left out (the result says how many); speaker notes; footer and slide numbers; transitions.
6. **Editing gaps:** no rotation handle (use the Rotation field), no marquee selection, no group/ungroup or align/distribute buttons (the model has them), no table or chart editing, no image crop or mask, no slide-size change, no per-run formatting controls (only the object's default style).
7. **Text:** the overlay edits plain text. Whole-line changes in multi-run paragraphs lose run formatting.
8. **Drag reorder** works with the mouse (HTML5 drag). On phones use the Move up and Move down buttons.
9. **Offline build** (copy `pdf/js/io/build.js`) is not written.

## Next steps, in order
1. Open a PPTX that the export wrote in PowerPoint and Keynote, and fix whatever they flag.
2. Add PDF export from the display list, and an export test that reads the PDF back.
3. Add `anim/` (builds and transitions) and play them in Present mode.
4. Import PPTX (`shared/office/zip.js` + `ppt/slides/*.xml`).
5. Presenter window and notes.
