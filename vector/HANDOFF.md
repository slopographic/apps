# Slop Vector: handoff

An Illustrator-style vector editor at `/vector/`. Plain scripts (no modules, no build), loaded in order from `index.html`. Every source and test file is at most 300 lines.

## Layout
- `js/geom/`: math, beziers, path data, hit-testing, curve fitting, boolean ops (Pathfinder), slopify. Exposed as `window.SVGeom`.
- `js/core/`: state, document tree, object factories (`SV.mk`), SVG output, render, overlay, history (`SV.commit`, undo/redo), hit-testing.
- `js/tools/`: pointer dispatch, select, direct, pen, draw, misc tools, commands (`SV.cmd`), keyboard.
- `js/io/`: SVG export/parse/import/open, PDF writer, file pickers, offline single-file builder, `hub.js` (Slop Hub).
- `js/ui/`: actions registry (`SV.runAction`), menubar, control bar, dock/panels, layers, colour, status, dialogs, context menus, sample doc, init.
- `css/`: themes (pro / light / classic 98), chrome, canvas, panels, popups, classic, responsive (which also maps `--sui-*`).

## Shared kit
- **SlopUI** (`../shared/slopui.js`) handles every dialog (`UI.dialog` is a thin adapter: `js/ui/dialogs.js`), prompt (Save As), toast (`UI.toast` / `SV.toast`), file picker, download, context menu (`js/ui/ctxmenu.js`) and **menubar dropdown** (`js/ui/menus.js`).
  - The menubar keeps only its buttons. Each dropdown is a `SlopUI.menu` tagged `.sv-dropdown[data-menu=…]`.
  - Hovering another button switches menus. Left and right arrows move between menus. Escape closes.
  - `UI.menuItems(label)` returns a menu's SlopUI items.
  - While a SlopUI menu has focus, app shortcuts are suppressed (`UI.handleGlobalKey`).
- The only app-owned popover left is the colour picker (`js/ui/color.js`). It is a picker, not a dialog or menu.
- **SlopHub** (`js/io/hub.js`):
  - `register('vector')`.
  - File ▸ Open from Slop Drive… and Place from Slop Drive…: SVG opens as a document, raster images open or place as image objects.
  - File ▸ Send to: sends the SVG, or a 2× PNG, to every app in `SLOP_APPS` that accepts it.
  - `?drive=<id>` launch via `consumeLaunch()`, which then strips the query string.

## Guides (`js/ui/guides.js`, uses `shared/guides/`)
- Document guides stay `S.doc.guides = { h: [y…], v: [x…] }` (part of every history snapshot). Rulers drag guides out (`ui/status.js`), the Selection tool moves them (`tools/select.js`), and `SV.buildSnap` (`core/hittest.js`) snaps to them when Show Guides and Snap to Guides are on.
- View ▸ New Guide Layout… (Alt+Shift+Ctrl+;, also in Window) opens the shared GuideGuide-style panel: Form / Notation / Intervals, presets, live preview (`S.guidePreview`, drawn by `core/overlay.js`), Apply / Replace / Clear as single undo steps (`SV.applyGuideList`, `SV.clearGuides`). Targets: Artboard or Selection bounds.
- Also: New Guide… (units), Guides from Selection, Snap to Guides (Shift+Ctrl+;, pref `snapGuides`).

## Commands and shortcuts (`js/ui/commands.js`, uses `shared/commands/`)
- Every action in `SV.actions` is a SlopCmd command `sv.<action id>`; tools are `sv.tool.<id>`; canvas keys (X, Shift+X, D, /, comma, period, arrow nudges) are `sv.paint.*`, `sv.focus.toggle`, `sv.nudge.*`. Menus and context menus label items with `UI.actKey(a)`, i.e. the person's own binding.
- Commands are gated off while the text editor, a SlopUI menu or the colour picker has the keys. Copy/Cut/Paste keep their native events (no SlopCmd keys). With SlopCmd active, `tools/keys.js` handles only Space, Esc, Enter, clipboard and shape-drag arrows.
- Help ▸ Search Commands… (⌘K), Help ▸ Keyboard Shortcuts (SlopCmd's editor; F1), and a search button in the menubar.

## Tests (`node tests/run.mjs vector`): 73 green
- `tests/vector/boot.js`: shared boot. It waits for the app iframe and exposes `W, SV, G, IO, UI, HUB` and helpers.
- `geom.test.html` (16), `model.test.html` (16), `io.test.html` (11), `ui.test.html` (17), `guides.test.html` (8), `commands.test.html` (6). Each page also runs the boot test.
- The offline builder strips `shared/guard.js` (hosted-site reload guard).
- Gotchas:
  - SlopUI fades closed dialogs for about 140 ms. The UI tests' `closed()` waits until `.sui-back` has left the DOM, so lookups never hit the old dialog.
  - Inside an inline `<script>` in a test page, write `<\/script>`, never a literal closing tag.

## Smoke-tested
Desktop (1440×900) and phone (390×844) in Chromium, with zero console errors:
- Menubar dropdown.
- Document Setup dialog fits the screen.
- Right-click menu.
- Send to PhotoSLOP, and `?drive=` launch back into Vector.

## Owner requests not done yet (next steps, in order)
These were asked for together with the PhotoSLOP layer work; none of the Vector part is started.
1. Check the "property change doesn't update" bug for text objects: fill colour, font, size and alignment, on the canvas and in the inspector. Fix it with a Playwright reproduction and a regression test (same approach as `photoslop/js/type/props.js`).
2. Layers panel: double-click a row opens an object/layer options dialog (name, colour, lock/visibility, opacity/blend, appearance: several fills and strokes, drop shadow and blur effects). Double-click the name renames it inline.
3. Canvas: double-click a text object to edit its text; double-click a group to enter isolation mode (Esc leaves it); double-click a path to switch to Direct Selection / point editing.
4. Register these as SlopCmd actions (`SV.actions` → `js/ui/commands.js`) and add tests under `tests/vector/`.

## Test note
`io.test.html` 'offline builder › inlines the app…' currently fails, with a console error ("Cannot use import statement outside a module"). The cause is an uncommitted change by someone else: `vector/index.html` now loads `<script type="module" src="../shared/buddy/boot.js" data-offline="strip">`. The offline builder inlines module scripts as classic scripts. Fix the builder (strip `data-offline="strip"` scripts, or keep them as modules), or drop that tag. Without the tag the suite was 72/73 at the start of this session; the one failure was 'builds SVG and 2× PNG payloads', which timed out on a loaded machine.

## Known / next
- The phone menubar is wider than 390 px; the last menus scroll horizontally inside the bar.
- Google Fonts are linked as in the other apps; the offline build strips them and falls back to system fonts.
- Ideas: ArrowRight to open SlopUI submenus (that belongs in shared), and a touch-friendly long-press context menu.

## Slop Drive (shared storage)

- **Save (Ctrl+S)** writes the SVG back to the Drive file the document was opened from (`HUB.linked`, via `SlopHub.update`, falling back to `put` with the same id). The first save asks for a folder. Any new document (New, Open, recovery, sample) unlinks. `File ▸ Save As…` still downloads. Without the hub, Save downloads as before.
- Open/Place from Drive, `?drive=` launch and `register('vector')` as before. Tested in `tests/vector/ui.test.html` ("Save writes back…").
