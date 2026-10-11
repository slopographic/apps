# shared/ui: reusable form pieces

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
