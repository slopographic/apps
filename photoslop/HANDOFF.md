# PhotoSLOP: handoff

A layered, Photoshop-style image editor at `/photoslop/` (`/paint/` redirects here; `paint/classic/` is the separate MS Paint clone, still served from `photoslop/classic/`, leave it alone). Plain classic scripts loaded in order from `index.html`, sharing top-level names. Every file is at most 300 lines.

## Layout
- `js/core/`: helpers (`util.js`), document model and history (`model.js`: `D`, `Hist`, `commit`, `undo`), compositing, document ops (`ops.js`), the viewport (`view.js`: zoom/pan, drawing, pointer routing).
- `js/tools/`: tool registry and selection/move/crop (`select.js`), painting, fills/shapes/type, free transform.
- `js/guides/`: rulers, guides, grid and snapping (see below).
- `js/brushes/`, `js/filters/`, `js/io/` (PSD, ORA, other formats, autosave in IndexedDB, offline single-file build, Slop Hub).
- `js/ui/`: menus (`menus.js`: `MENUS`), menubar/toolbox/options (`chrome.js`), panels, dialogs, keyboard (`doc-dialogs.js`).
- `js/app/`: tabs (multiple documents), `commands.js` (SlopCmd), `main.js` (boot).

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

## Tests (`node tests/run.mjs tests/photoslop`): 44 green
- `photoslop.test.html` (27), `guides.test.html` (11: panel → 12 columns → undo, Replace/Clear, ruler drag/move/delete, lock, marquee + move snapping, Snap and Show toggles via keys, New Guide with %, grid snapping, crop/rotate remap, tab switch, PSD round-trip), `commands.test.html` (6).
- Pointer tests dispatch synthetic `PointerEvent`s on `V.el`; pointer capture throws for them and is wrapped in try/catch.

## Smoke-tested
Desktop 1440×900 and phone 390×844 in Chromium, zero console errors: guide panel (a bottom sheet on phones), real mouse drags from the rulers, marquee snapping to guides, the command palette.

## Known / next
- Guides are document-wide lines (no per-artboard guides; PhotoSLOP has no artboards). Smart guides between layers are not implemented.
- The offline single-file build strips `shared/guard.js` (the hosted-site reload guard).
