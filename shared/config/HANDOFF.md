# shared/config: the one config and template format

Every app's shareable config, templates and settings use one versioned JSON format, `.slop.json`. The format, the
validator, import and export, and the AI helpers live here. An app only registers the kinds it understands.

## The file

```json
{
  "format": "slop-config",
  "version": 1,
  "kind": "template",
  "app": "tables",
  "name": "Monthly budget",
  "description": "Optional, one line",
  "created": "2026-10-11T09:00:00Z",
  "data": { }
}
```

- `format` and `version` must be exactly `"slop-config"` and `1`. Any other version is refused with a message.
- `kind` is a short lowercase name. `app` is the app that wrote the file: a registry id from `shared/apps.js`, or
  `"slop"` for shared kinds. No other envelope keys are allowed.
- `data` must match the kind's schema. Keys the schema does not list are refused, with their path.
- Limits: 5 MB for the whole file, 200 pages or sheets (`templateSchema`), 200 items in any list by default, 5000
  characters of text, 120 characters for a name. Text may not hold code or markup (`<script`, `javascript:`,
  event-handler attributes), and nothing is fetched from a URL.

## The kinds

| kind | app | data | what apply does |
| --- | --- | --- | --- |
| `settings` | `*` (any app) | `defaultCurrency` (ISO code), `locale` (e.g. `en-US`), `defaultTaxRate` (a percent, 0 to 100) | writes the `settings/main` record through `SlopData.store.transact`, one transaction |
| `numbering` | `*` (any app) | `sequences`: 1 or 2 of `{ id: "invoice" \| "order", prefix, pad }` | sets prefix and pad on the SlopData numbering records; the counter `next` is never in the file and is kept |
| `template` | the app that registers it | `pages`: a list of `{ name, blocks }`; a block is `{ type: heading \| text \| list \| table, text?, items?, rows? }` | the app maps it to its own store (see `SlopConfig.templateSchema` in `template.js`) |

`settings` stores the tax rate as basis points in SlopData. The file uses percent, so a person or a model writes
`20` for 20%. `kinds.js` converts both ways.

## How an app registers a kind

```js
SlopConfig.registerKind(kind, app, schema, apply, opts)
// kind:   'template' (lowercase name)
// app:    your registry id, e.g. 'slides'; '*' only for shared kinds
// schema: { fields: { key: spec, ... }, strict: true }   (strict is the default)
// apply:  async (data, ctx) => { ... }   runs only after validation passed; throw to roll back
// opts:   { read: async () => data, label, description }  read enables Export for this kind
```

Field specs (`SlopConfig.F`): `str({max, pattern})`, `text({max})`, `num({min, max})`, `int({min, max})`, `bool()`,
`enum(values)`, `currency()`, `locale()`, `cell()`, `list(itemSpec, {min, max})`, `obj(fields)`. Add `required: true`
to make a key mandatory, and `desc: '...'` to tell a model what it means. Schemas are plain objects, so the prompt
writer reads them directly.

For a template, register `SlopConfig.templateSchema` and map its pages to your store in `apply` and `read`. A sheet
is a page with a table block. A slide is a page with heading, text and list blocks.

`apply` should write through your app's own store API, in one transaction if the store has one. If it throws, the
store's transaction aborts. Anything written outside a transaction should be undone with `ctx.undo(fn)`, which runs in
reverse order when the apply throws.

## The rule: every import goes through validate, then apply

- `SlopConfig.validate(input, { app })` returns `{ ok, value, errors: [{ path, message }] }`. It never throws.
- `SlopConfig.importFile(file, { app })`, `importText(text, { app })`, `importFromDrive({ app })` and
  `applyValue(value, { app })` all validate first. `applyValue` validates again, so an AI reply cannot skip the check.
- An apply runs only after validation passed. Applies run one at a time. A failed apply reports `rolledBack: true`.
- `{ app }` is the importing app. A file for another app is refused with "mismatched app", unless the kind is shared.

## Export

`SlopConfig.exportFile(kind, app, name, data, { description, created })` returns a `File` named
`<name>.slop.json`. It throws if the data is not valid, so an export never writes a file the import would refuse.
`SlopConfig.exportKind(kind, app, name, opts)` reads the kind's current data with `read()` and exports it.

## The AI flow

1. `SlopConfig.buildPrompt(kind, app, request)` returns the instructions, every key with its type, limits and allowed
   values, the description of each field, and an example that is a valid file. It is written for a small local model.
2. The model's reply, or the reply pasted by the person from any assistant, goes to
   `SlopConfig.parseAiReply(text, { app })`. It takes the first complete `{ ... }` (prose and code fences around it
   are fine, and braces inside strings are respected), reports invalid JSON with a message, then validates it.
   It returns `{ ok, value, errors }`.
3. Only a reply that checked ok, and is unchanged since, can be applied, through `applyValue`.

`SlopConfigDialog.makeAi({ app })` does all of this in a dialog. It uses `SlopAI.ask` when a local model is loaded,
and otherwise shows the prompt to copy.

## The dialogs (any app)

```html
<script src="../shared/slopui.js"></script>
<script src="../shared/config/schema.js"></script>
<script src="../shared/config/validate.js"></script>
<script src="../shared/config/template.js"></script>   <!-- only if the app uses templates -->
<script src="../shared/config/io.js"></script>
<script src="../shared/config/kinds.js"></script>      <!-- settings and numbering; needs shared/data/ for apply -->
<script src="../shared/config/prompt.js"></script>
<script src="../shared/config/dialog.js"></script>
<script src="../shared/config/dialog-ai.js"></script>
```

```js
SlopConfigDialog.open('import', { app: 'tables' });   // 'import' | 'export' | 'ai'
SlopConfigDialog.menuItems({ app: 'tables' });        // three items for SlopUI.menu
```

Load the scripts in this order. `kinds.js` needs `shared/data/` only when an apply runs, so a page without SlopData can
still load it.

## Tests

`node tests/run.mjs config` runs `tests/node/config.test.mjs` and `config-kinds.test.mjs`. The helpers are in
`config-env.mjs`. There is no browser page for the dialogs yet. They are checked for load and wiring only.
