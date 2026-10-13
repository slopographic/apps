# View modes: handoff

`shared/viewmode/viewmode.js` (`window.SlopViewMode`) gives every app the same three view modes, one shortcut and one
button in the top bar. Load order on a page: `router.js` is independent; `viewmode.js` goes before the app's glue file.

## Modes and shortcuts

| Mode | What it hides |
|---|---|
| `full` | nothing |
| `focus` | the toolbars and the sidebars (the defaults; an app can change them) |
| `content` | the toolbars, the sidebars and the panels |

- **Ctrl+Shift+F** cycles Full, Focus, Content only (Ctrl or Cmd). The button in the top bar does the same.
- **Ctrl+Shift+L** shows every hidden region until it is pressed again.
- In Focus and Content, move the pointer to a region's window edge (6 px: top for toolbars, left for sidebars, right
  or bottom for panels, unless the app names another edge) and the region comes back. It hides again 0.7 s after the
  pointer leaves it.
- The chosen mode is saved in `localStorage` key `slop.viewmode` and shared by every app. Storage is read and written
  inside try/catch, so a blocked store only means nothing is remembered.

## API

```js
const V = SlopViewMode.register('hex', {
  regions: { toolbar: ['.hx-top', '.hx-bar'], sidebar: '#side', panels: '#hx-info' }, // a selector, an element or a list; missing ones are skipped
  edges:   { panels: 'top' },                 // which window edge brings a hidden region back (defaults: toolbar top, sidebar left, panels right)
  hides:   { focus: ['toolbar'], content: ['toolbar', 'panels'] },  // optional: the defaults are focus [toolbar, sidebar], content [all three]
  mount:   '.hx-top',                         // the element that gets the mode button (optional)
  layout:  { get: () => ({ panel: x }), set: (o) => { ... } },      // optional: which panels are open, restored on load
});
V.mode(); V.set('focus'); V.cycle(); V.saveLayout();
SlopViewMode.modes      // ['full', 'focus', 'content']
SlopViewMode.shortcuts  // { cycle: 'Ctrl+Shift+F', reveal: 'Ctrl+Shift+L' }
```

- Each app's layout (which panels are open) is saved under `slop.viewmode.layout.<app>` by `V.saveLayout()`. Call it
  when a panel opens or closes. Apps that already keep their panels' open state in their own store (PhotoSlop's
  per-panel `collapsed.<id>`, SlopVector's prefs, Tables' sidebar key, Docs' outline key) do not need a second copy, so they
  pass no `layout`. The other apps have no layout hook yet.
- Focus and Content change the window's layout, so the module fires a window `resize` after each change. Apps that
  measure on resize (canvases, grids, editors) follow it without extra code.
- The page's `<html>` gets `data-slopvm="<mode>"`, so a style can react to the mode.
- A region that a page does not have is skipped. An app with no toolbar still gets the modes for its other regions.

## Regions per app

| App (id) | Page | Toolbar | Sidebar | Panels | Button |
|---|---|---|---|---|---|
| `photoslop` | `/photoslop/` | `.topbar` | `#toolbox` | `#panels` | `.topbar` |
| `vector` | `/slopvector/` | `#menubar`, `#controlbar` | `#toolbar` | `#dock` | `#menubar` |
| `slopcut` | `/slopcut/` | `.topbar` | `#bin` | `#insp` | `.topbar` |
| `docs` | `/docs/` | `.topbar`, `#toolbar` | `#outline` | | `.topbar` |
| `slides` | `/slides/` | `.top` | `.slides-pane` | `#inspector` | `.top` |
| `tables` | `/tables/` | `.topbar`, `.fbar` | `#side` | | `.topbar` |
| `press` | `/press/` | `#menubar`, `#controlbar` | `#toolbar` | `#dock` | `#menubar` |
| `contacts` | `/contacts/` | `.topbar` | `#colGroups` | `#card` | `.topbar` |
| `drive` | `/drive/` | `.topbar` | `#side` | `#info` | `.topbar` |
| `label` | `/label/` | `#menubar`, `#ctrlbar` | `#toolbox` | `#dock` | `#menubar` |
| `ocr` | `/ocr/` | `.ocr-top` | | `.ocr-help` (bottom) | `.ocr-top` |
| `convert` | `/convert/` | `.cv-top` | | `.cv-explain`, `.cv-card` (bottom) | `.cv-top` |
| `calc` | `/calculator/` | `.sc-top` | `.sc-side` | | `.sc-top` |
| `eml` | `/eml/` | `.em-top` | | | `.em-top` |
| `hex` | `/hex/` | `.hx-top`, `.hx-bar` | | `#hx-info` (top) | `.hx-top` |

PDF (`/pdf/`) is not wired here; the PDF agent's page is wired by the lead.

Tests: `tests/viewmode/viewmode.test.html` (`node tests/run.mjs viewmode`).
