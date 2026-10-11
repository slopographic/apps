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

## Tests (`node tests/run.mjs vector`): 59 green
- `tests/vector/boot.js`: shared boot. It waits for the app iframe and exposes `W, SV, G, IO, UI, HUB` and helpers.
- `geom.test.html` (16), `model.test.html` (16), `io.test.html` (11), `ui.test.html` (17). Each page also runs the boot test.
- Gotchas:
  - SlopUI fades closed dialogs for about 140 ms. The UI tests' `closed()` waits until `.sui-back` has left the DOM, so lookups never hit the old dialog.
  - Inside an inline `<script>` in a test page, write `<\/script>`, never a literal closing tag.

## Smoke-tested
Desktop (1440×900) and phone (390×844) in Chromium, with zero console errors:
- Menubar dropdown.
- Document Setup dialog fits the screen.
- Right-click menu.
- Send to PhotoSLOP, and `?drive=` launch back into Vector.

## Known / next
- The phone menubar is wider than 390 px; the last menus scroll horizontally inside the bar.
- Google Fonts are linked as in the other apps; the offline build strips them and falls back to system fonts.
- Ideas: ArrowRight to open SlopUI submenus (that belongs in shared), and a touch-friendly long-press context menu.
