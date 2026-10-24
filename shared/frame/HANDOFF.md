# shared/frame: the "List · View · Panel" pattern

One layout for every app that shows items one at a time and acts on them: mail (Slop EML), files, records, attachments,
documents in a batch. People learn it once and find the same places in every app:

```
┌ header: Open (+ the shared header buttons, and the panel's own button) ────────────────┐
│ List (optional)      │ View (the item)                         │ Panel: details + actions │
│ search, sort, ticks  │                                         │ Title                    │
│ one row per item     │                                         │ ACTIONS  [Primary]       │
│                      │                                         │          [Export ▾] ...  │
│                      │                                         │ DETAILS  key  value      │
│                      │                                         │ FILES    name  Save  ▾   │
└──────────────────────┴─────────────────────────────────────────┴──────────────────────────┘
```

**When to use it.** The app opens several items, shows one, and has more actions than fit in a header. Keep only Open
(and the shared header buttons) in the header; every action goes in the panel, the File menu and the Ctrl+K commands
(the same functions: one source of truth). The list appears only when there is more than one item (`setList`).

**Phones** (`phone` media query, default `(max-width: 900px)`): the list is the page; tapping an item shows it over the
list (the app gives a "‹ List" button that calls `showList()`); the panel is a bottom sheet (shared/ui/sheet.js,
SlopSheet: × in its corner, Escape, tap outside or swipe down closes it), opened by the header button or by the app's own
"Actions" button (`openSheet()`). With `phoneButton: false` the header button hides on phones (when the app has its own).

## API

```html
<link rel="stylesheet" href="…/shared/frame/frame.css">
<script src="…/shared/ui/sheet.js"></script>        <!-- the phone sheet -->
<script src="…/shared/ui/menubutton.js"></script>   <!-- menus on panel buttons ("Export ▾") -->
<script src="…/shared/frame/frame.js"></script>
<script src="…/shared/frame/panel.js"></script>
```

```js
const fr = SlopFrame.mount(rootEl, {
  list: listEl, view: viewEl, panel: panelEl,        // list may be null; the order in the DOM does not matter
  phone: '(max-width: 900px)', panelLabel: 'Actions', storageKey: 'eml',
  button: '.smb-tools', phoneButton: true,           // the show/hide button in the header (a shared .slop-hbtn)
  width: 300, min: 240, max: 520,
});
fr.setList(n > 1); fr.showView(); fr.showList(); fr.openSheet(); fr.setPanel(false); fr.togglePanel(); fr.setWidth(320);

const panel = SlopFrame.panel(panelEl, { title: 'Message' });
panel.setTitle('3 selected');
panel.render([
  { title: 'Actions', actions: [{ label: 'Export', primary: true, menu: () => [{ heading: 'Download' }, { label: 'PDF', act }] },
                                 { label: 'Print', run: print }] },
  { title: 'Details', rows: [['From', from], ['Date', date, rawDate]] },         // empty values are skipped
  { title: 'Attachments (2)', list: [{ name, meta: 'PDF · 2 KB', open: preview,
      actions: [{ label: 'Save', run }, { label: 'Open in', menu: () => SlopHub.sendMenuItems(...) }] }] },
  { title: 'Note', note: 'Text' },
]);
```

- **Remembered** per `storageKey` in localStorage (`slop-frame:<key>`): the panel's width and whether it is hidden.
- **Command**: `<storageKey>.panel`, "Show or hide the … panel", Ctrl+Alt+B (SlopCmd, registered by `mount` when the
  page has SlopCmd). Put `cmd:<storageKey>.panel` in the View menu.
- **Resize**: drag the panel's edge, or focus it (a `role=separator`) and use Left/Right (Shift: bigger steps), Home, End.
- **Look**: the panel follows Slop PDF's properties panel (sticky title, small upper-case section headings, label/value
  rows, buttons that wrap). Colours are the theme's `--sl-*` tokens; `--sf-list-w` sets the list column (320px).
- `render()` keeps the keyboard focus on the same button across redraws (give actions an `id` for a stable key).

## Users

- Slop EML (`eml/js/main.js` mounts it; `eml/js/side.js` fills the panel; `eml/js/list.js` is its list).

## Tests

`tests/shared/frame.test.html` (on `tests/shared/frame-page.html`): regions and order, drag and key resize with limits,
hide/show by button, command and Ctrl+Alt+B (remembered across a reload), no list, phone list/view and the bottom sheet,
panel sections, menus and focus. Slop EML: `tests/eml/batch.test.html`, `tests/eml/look.test.html`.

## Screens (described)

- 1280 px: list 340 px on the left (tick box, sender, date, subject, paperclip count), the message in the middle, the
  panel 300 px on the right: "Message" with Actions (Export ▾ filled, then Open in Slop PDF, Print, Convert to PDF…,
  Pin as a tab, Close), Details, Attachments with Save and Open in ▾. With two or more ticked: "N selected" with Combine
  into one PDF, Export ▾, Save attachments (ZIP), Export list (CSV), Open in Slop PDF, Clear selection.
- 390 px: the list fills the page with an Actions button next to the sort; a tapped message shows "‹ Messages (10)" and
  "Actions" above it; Actions slides the panel up as a bottom sheet.
