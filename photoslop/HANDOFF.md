# PhotoSLOP: handoff

A layered, Photoshop-style image editor at `/photoslop/` (`/paint/` redirects here; `paint/classic/` is the separate MS Paint clone, still served from `photoslop/classic/`, leave it alone). Plain classic scripts loaded in order from `index.html`, sharing top-level names. Every file is at most 300 lines.

## Layout
- `js/core/`: helpers (`util.js`), document model and history (`model.js`: `D`, `Hist`, `commit`, `undo`), compositing, document ops (`ops.js`), the viewport (`view.js`: zoom/pan, drawing, pointer routing).
- `js/tools/`: tool registry and selection/move/crop (`select.js`), painting, fills/shapes/type, free transform.
- `js/guides/`: rulers, guides, grid and snapping (see below).
- `js/brushes/`, `js/filters/`, `js/io/` (PSD, ORA, other formats, autosave in IndexedDB, offline single-file build, Slop Hub).
- `js/ui/`: menus (`menus.js`: `MENUS`), menubar/toolbox/options (`chrome.js`), panels, dialogs, keyboard (`doc-dialogs.js`).
- `js/app/`: tabs (multiple documents), `commands.js` (SlopCmd), `main.js` (boot).

## Type (`js/type/`, loaded right after `tools/fill.js`)
- **Bug fixed:** changing colour/font/size etc. never reached an existing type layer. The options bar only wrote `T.type` (tool defaults), the colour picker only wrote `C.fg`, and only the old textarea editor was ever restyled.
- **Model** (`model.js`): `L.text = { str, x, y, font, size, bold, italic, color, tracking, align, leading, aa, warp:{style,bend}, runs:[{s,e,o}] }`. The character keys are the base style; `runs` override them per character range (rich text). `normText` upgrades old records. `setTextStyle(t, s, e, patch)` restyles a range (an empty or whole range restyles the base). `renderTextCanvas` draws mixed styles per line, tracking (`letterSpacing`), leading (% of size), anti-alias (none/sharp/crisp/strong/smooth as alpha curves) and warp (arc, arch, bulge, flag, wave, rise, by column displacement).
- **Editing** (`edit.js`): a `contenteditable="plaintext-only"` box of styled spans (`data-o` = overrides). `teRead` reads text and runs back; `TE.sel` tracks the selection (kept while focus is in the options bar). The whole edit is one history step (`Edit Type`). `editTypeLayer(L)` edits with everything selected (double-click a type layer's thumbnail, Layer ▸ Edit Text).
- **Changing properties** (`props.js`): `setTypeProps(patch, final)`. While editing it restyles the selection (or all text); with a type layer selected it restyles the whole layer and commits once (`final=false` previews sliders/colour drags and commits after 600 ms). With the Type tool active, changing the foreground colour recolours the text. Controls: options bar (font, style, size + slider, colour, alignment, AA, Warp…) and a **Character** panel (adds tracking and leading). Warp Text… dialog previews; Cancel reverts with no history step.
- **Saving:** autosave stores every key in `LAYER_META` (`core/model.js`); PSDs carry it in a private layer block `SLmd` (`io/psd-meta.js`, UTF-8 JSON), so type stays editable after reopening. Photoshop sees the rendered pixels only. The PSD clipping byte is written and read (`L.clip`), but clipping is not composited yet.

## Guides, rulers, grid, snapping (`js/guides/`, uses `shared/guides/`)
- **Model** (`model.js`): `D.guides` is an immutable array of `{ o: 'v' | 'h', pos }` in document px. It is part of every history snapshot, so every guide change is one undo step (`setGuides(list, label)`, `addGuide`, `applyGuides(list, 'add' | 'replace')`, `clearGuides`). Tabs stash it; autosave stores it; PSD read/write uses image resource 1032, so Photoshop sees the guides. Canvas Size, Crop, Image Size and Image Rotation move the guides with the pixels (`remapGuides`).
- **View settings** live in `store` (`GUIDE_PREFS`): `guides`, `lockGuides`, `snap`, `snapTo.{guides,grid,bounds}`, `rulers`, `grid`, `gridSize`, `gridSub`, `gridColor`, `guideColor`.
- **Snapping**: `snapP(p, tool)` snaps pointer points for marquee, ellipse, polygonal lasso, crop, shape, gradient, type and transform handles (wired in `core/view.js`). `snapDelta(box, dx, dy)` snaps moving boxes by their edges and centre: Move tool (layer or floating selection), moving a selection, Free Transform move. Targets: guides, then document edges/centre, then the grid (guides win over the grid). `V.snapInd` draws the magenta indicator while dragging.
- **Drawing** (`overlay.js`): grid with dotted subdivisions, guides, the live layout preview (`V.guidePreview`), the drag pill, and the rulers (drawn on the view canvas, 18 px bands). `view.js` calls `drawGuidesLayer(g)` and `drawTopOverlays(g)`.
- **Input** (`input.js`): capture-phase pointer listeners on the viewport run before the tools. Drag from a ruler to make a guide; with the Move tool (or Ctrl/⌘ held) drag a guide to move it, drop it on a ruler or outside to delete; double-click or right-click a guide to edit/delete; Shift snaps to ruler ticks.
- **UI** (`ui.js`): View menu: Rulers (Ctrl+R), Grid (Ctrl+'), Grid Settings…, Show Guides (Ctrl+;), Lock Guides (Alt+Ctrl+;), Clear Guides, New Guide… (units: px, %, mm, in, pt), New Guide Layout… (Alt+Shift+Ctrl+;), New Guides from Shape, Snap (Shift+Ctrl+;), Snap To ▸. Window ▸ Guides opens the shared GuideGuide-style panel (`openGuidesPanel`) with Canvas / Selection / Layer bounds targets.

## Commands and shortcuts (`js/app/commands.js`, uses `shared/commands/`)
- Every `MENUS` leaf (ids `ps.<menu>-<path>-<label>` slugs, stored back on the item as `it.cmdId`), every tool (`ps.tool.<id>`, plus `ps.tool.cycle-<key>` for Shift+key), and the canvas keys (X, D, [ ], Shift+[ ], 0–9 opacity, arrow nudges, Alt+1…9, Ctrl+Tab) are SlopCmd commands. Menus show `menuKey(it)` = the person's own binding.
- `onEarlyKey` (capture, registered before SlopCmd) keeps Space-to-pan and tool keys (Enter/Esc/Backspace in transform, crop, lassos) ahead of shortcuts. The legacy `onKeyDown` then only arms the paste catcher for Ctrl+V (the native paste event carries images), or does everything when SlopCmd is missing.
- Help ▸ Search Commands… (⌘K), Help/Edit ▸ Keyboard Shortcuts… (SlopCmd's editor), and a search button in the top bar.

## Tests (`node tests/run.mjs tests/photoslop`): 65 green
- `type.test.html` (21): each property (font, size, bold, italic, colour, alignment, tracking, leading, AA, warp) on the whole layer and the six character properties on a selected range: canvas changes, one undo step, PSD and autosave round trips; colour picker drag = one step; options bar, Character panel and editing; size slider preview; Warp cancel.
- `photoslop.test.html` 'opens a file another app sent with ?drive=' is timing-sensitive when the machine is loaded; it passes on rerun.
- `photoslop.test.html` (27), `guides.test.html` (11: panel → 12 columns → undo, Replace/Clear, ruler drag/move/delete, lock, marquee + move snapping, Snap and Show toggles via keys, New Guide with %, grid snapping, crop/rotate remap, tab switch, PSD round-trip), `commands.test.html` (6).
- Pointer tests dispatch synthetic `PointerEvent`s on `V.el`; pointer capture throws for them and is wrapped in try/catch.

## Smoke-tested
Desktop 1440×900 and phone 390×844 in Chromium, zero console errors: guide panel (a bottom sheet on phones), real mouse drags from the rulers, marquee snapping to guides, the command palette.

## Owner requests not done yet (next steps, in order)
1. **Layer Style dialog** (partly done: `js/layers/fx.js` holds the non-destructive stack `L.fx = [{id,type,on,p}]`, rendered in `fxSurface` inside `compositeInto` and baked by merges; `js/layers/fx-rows.js` shows the rows under each layer with eye, number, label, drag, Move Up/Down, Delete and Alt+Up/Down; `js/ui/fx-dialog.js` is the live Layer Style dialog for Drop Shadow, Outer Glow, Stroke, Color Overlay and Bevel & Emboss, one history step per edit). Still to do: blending options (mode, opacity, fill opacity) plus drop shadow, inner shadow, outer/inner glow, bevel/emboss, stroke, colour/gradient/pattern overlay, with per-effect toggles, live preview, OK/Cancel in a SlopUI modal. Plan: `js/layers/fx.js` renders effects in `compositeInto` (`core/composite.js`) with a WeakMap cache per layer record; `LAYER_META` already lists `fx`. Today Layer ▸ Layer Style still runs the old baked filters (`filters/slop.js`).
2. **Double-click in the Layers panel** (`ui/panels.js`): done for a type thumbnail (edits text) and other thumbnails (opens Layer Properties as a stand-in until item 1). Still to do: an empty row area or thumbnail opens Layer Style; a mask thumbnail opens mask properties (density, feather, invert); fill/adjustment/shape layers reopen their properties. The layer name already renames inline.
3. **Fill, adjustment and shape layers do not exist yet.** Fill layers are plain pixels; adjustments are destructive; shapes are rasterised. Plan: `L.fill`, `L.adj = { id, params }` (applied to the composite below in `compositeInto`; the parameter UI can reuse `paramControl` from `ui/filter-dialog.js`), and `L.shape` (geometry relative to the layer origin, re-rendered from its properties). Clear these keys wherever `text: null` rasterises a layer.
4. **Layer context menu** (`ui/popups.js` `layerContextMenu`): add Blending Options…, Rasterize (generic), Convert to Smart Object, Create Clipping Mask (and compose `L.clip` in `compositeInto`), Copy/Paste Layer Style, and Layer Properties… with a colour label. Add the matching Layer menu items so SlopCmd registers them (menu leaves become commands automatically).
5. **Right-drag brush sizing** (coordinator request, not started): right-drag, Alt+right-drag and Ctrl+Alt+left-drag change size (horizontal) and hardness (vertical) with a HUD; a right-click without a drag still opens the brush picker. Use one tool → property mapping table (type: size/leading, wand/bucket: tolerance, marquee: feather, shapes: radius/stroke). Values persist per tool and add no history. Today only the Shift-drag sizing exists (`core/view.js` `V.resize`) and the right-click is the `contextmenu` handler in `initView`; unify them there.

## Known / next
- Guides are document-wide lines (no per-artboard guides; PhotoSLOP has no artboards). Smart guides between layers are not implemented.
- The offline single-file build strips `shared/guard.js` (the hosted-site reload guard).

## Slop Drive (shared storage)

- **Save (Ctrl+S)** writes the layered PSD back to the Slop Drive file the tab was opened from (`CUR.driveId`, via `SlopHub.update`, falling back to `put` with the same id). The first save asks for a folder. `File ▸ Download as Photoshop (.psd)` keeps the old download; `Save PNG to Slop Drive` still adds a copy.
- **File ▸ Open from Slop Drive…**, `?drive=<id>` launch (`hubBoot` → `openRecordTab`, which links the new tab), and `SlopHub.register('photoslop')` on boot.
- Paint Classic (`classic/`): `hub.js` overrides `ACTIONS.save` (PNG written back to the linked Drive file) and adds `File ▸ Open from Slop Drive…`; it registers as `paint-classic` and opens `?drive=` launches. Offline and without `SlopHub`, Save downloads as before.
