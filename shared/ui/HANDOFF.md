# shared/ui: reusable interface pieces

One source for the pieces many apps need: the record list (`list.js`), the view tabs (`tabs.js`) and form reset
(`form-reset.js`). Dialogs, menus, toasts and form fields are `SlopUI` (`shared/slopui.js`); right-click and Menu-key
menus are `SlopCtx` (`shared/ctxmenu.js`). A new app uses these instead of its own copies.

## list.js (`window.SlopList`)

The list of records (orders, invoices, expenses...). One row per record: a title, an amount on the right, and a meta
line of text and status chips. Click or Enter opens a row; the arrows, Home and End move between rows (one row is
tabbable); right-click or the Menu key opens the row's menu (through `SlopCtx` when the page loads it).

```html
<link rel="stylesheet" href="…/shared/ui/list.css">
<script src="…/shared/slopui.js"></script>
<script src="…/shared/ctxmenu.js"></script>
<script src="…/shared/ui/list.js"></script>
```

```js
const list = SlopList.mount(host, { label: 'Expenses', noun: ['expense', 'expenses'], summary: countEl, empty: 'No expenses yet.',
  row: (r) => ({ title: r.supplier, amount: money(r.amount), cls: r.status === 'void' ? 'is-void' : '', meta: [r.date, { chip: 'Void', cls: 'void' }] }),
  open: (r) => go('e/' + r.id), menu: (r) => [{ label: 'Open', act: () => go('e/' + r.id) }] });
list.set(records);   // draws the rows, the count ("3 expenses") and the empty message
```

Chip classes: `good`, `warn`, `void`. A row class `is-void` greys and strikes the title and amount. Tests:
`tests/shared/list.test.html`.

## tabs.js (`window.SlopTabs`)

The view tabs of a page: a `role="tablist"` of `role="tab"` buttons with `data-view`, and a panel per view
(`#view-<name>` unless `panel(name)` says otherwise). `show(name)` shows that panel, hides the others and marks the tab
(`aria-selected`, the only tabbable tab). A click, the arrows, Home and End select a view: through `select(name)` when the
app routes with a `#hash` (it then calls `show` from its router), else `show` directly. `onShow(name)` runs after a view
is shown. Hidden tabs are skipped by the keys but can still be shown. Tests: `tests/shared/tabs.test.html`.

```js
const tabs = SlopTabs.mount(document.querySelector('[role="tablist"]'), { select: (n) => go(n), onShow: (n) => views[n].onShow() });
tabs.show('list');
```


## form-reset.js (`window.SlopFormReset`)

Reset for any form, in any app. It works on a `<form>`, on a SlopUI dialog body, or on a plain `div`. The snapshot
lives in a WeakMap, so nothing is added to the DOM.

```html
<script src="…/shared/slopui.js"></script>
<script src="…/shared/ui/form-reset.js"></script>
```

| call | what it does |
|---|---|
| `SlopFormReset.snapshot(root)` | Remembers every enabled input, select and textarea, and every segmented control (a `[role="group"] > button[aria-pressed]`). Call it once the form is built. |
| `SlopFormReset.isDirty(root)` | True when any of them differs from the snapshot. |
| `await SlopFormReset.reset(root, { confirm = true })` | With edits, asks first (`SlopUI.confirm`, Reset in red). Then restores the values and fires `input` and `change` on each changed field, so the form's own handlers run again. Resolves true when restored, false when the person cancels. |
| `SlopFormReset.dialogButton(root, label = 'Reset')` | A `SlopUI.dialog` button that resets and keeps the dialog open (its `act` returns false). |

Example, in a dialog (this is what CRM and Inventory use):

```js
const body = el('form', null, /* fields */);
SlopFormReset.snapshot(body);
SlopUI.dialog({ title: 'Edit customer', body,
  buttons: [{ label: 'Cancel' }, SlopFormReset.dialogButton(body), { label: 'Save', primary: true, act: save }] });
```

Limits:
- Only values are restored. A control that is built from a list (a stock picker made of buttons, say) is not a field, so
  its selection is not restored. Restore it from the values that the form owns, or snapshot it yourself.
- Fields added after `snapshot` are not tracked. Call `snapshot` again after the form changes shape.
- Disabled fields are skipped at snapshot time.

Used by: SlopLabel (property dialogs, Print, data mapping, paste data, ZPL import and preview), CRM customer form,
Inventory product form. The Label Properties panel does its own Reset (`label/js/ui/props-reset.js`), because its
baseline is the selected objects, not the DOM.

Tests: `tests/label/generate-reset.test.html` (the shared-form section).

## Header buttons (`hbtn.css`, `hbtn.js`)

Every button a shared script puts in an app's header wears `.slop-hbtn`: Slop Drive (`shared/drive-link.js`), Tour
(`shared/tour/mount.js`), View and Show panels (`shared/viewmode`), Theme, Apps and the bell (`shell/header.js`,
`shell/notify.js`). The label is a `.slop-hbtn-txt` span next to an icon. The shell links `hbtn.css` and loads `hbtn.js`
on every shell page; a page without the shell links `hbtn.css` itself.

- **Match the app**: set `--slop-hbtn-h`, `--slop-hbtn-radius`, `--slop-hbtn-bg`, `--slop-hbtn-line`, `--slop-hbtn-hover`
  and `--slop-hbtn-fs` on `:root` or the header (Slides: `.top` in `slides/css/app.css`, like its `.tb-btn`).
- **Fit**: `SlopHbtn.fit(header)` (the shell calls it on the header that holds Apps) watches the header; when a shared
  button is cut off, past an edge, or wrapped onto a second row, the header gets `.slop-htight` and the shared buttons
  show only their icons (title and aria-label still name them). Under 560 px they are icons always.
- Tests: `tests/shared/hbtn.test.html`, `tests/shell/header-buttons.test.html`.
