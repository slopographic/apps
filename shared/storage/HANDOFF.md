# shared/storage: full disk, what uses the space, and the fixes

Browsers give each site a quota. When it is full (or Chrome shrinks it because the disk is low), saves fail:
IndexedDB puts, Cache Storage downloads and localStorage writes. This module makes that failure clear and
recoverable. It is shared by every app that saves; apps do not rewrite their storage.

## Files (classic scripts, in this order; all on `window.SlopStorage`)

| file | what it does |
|---|---|
| `classify.js` | `SlopStorage.classify(err)` → `{ quota, store, message }`. Pure: no DOM, so Node can test it. |
| `storage.js` | `estimate()`, `persisted()`, `requestPersist()`, `bytes(n)`. |
| `clear.js` | `clear(kind)`: removes only regenerable caches. |
| `ui.js` | `handle(err, opts)`: the one dialog a quota error opens. |

Pages load them after `shared/hub.js` or `shared/data/store.js`, and after `shared/slopui.js` (the dialog kit).
`shared/cache/regen.js` (`SlopRegen`) does the actual removal of thumbnails, face results, models and cut-out models.

## The API

- `SlopStorage.classify(err)`: a QuotaExceededError (Chrome, Safari, Edge), NS_ERROR_DOM_QUOTA_REACHED and legacy code 22
  (Firefox), an IndexedDB quota error wrapped in an AbortError (`err.error`, `err.target.error`, `err.cause`), a SlopData
  Result `{ code: 'quota' }`, and a message that says the quota was exceeded. Never throws.
- `SlopStorage.handle(err, { app, what, retry, once })`: returns true when it was a quota error (the person has been told),
  false otherwise (the caller shows its own message). One dialog at a time. `once` is a key: the first dialog for it is
  the only one (use it for autosaves, which fail on every tick).
  - The dialog says the disk for this site is full, shows the usage and the biggest parts, and offers: Clear thumbnails
    and previews (in place), Storage in Settings (new tab), Connect a folder (Slop Drive, new tab), and Try again when
    `retry` is given. A failed retry keeps the dialog open.
- `SlopStorage.estimate()`: `{ supported, usage, quota, percent, parts }`. Parts: `indexedDB` (the browser's total, with
  each database and its record counts listed), `caches` (the browser's total, one part per cache with its entry count),
  `localstorage` (measured in characters × 2), and `other` (the browser total minus IndexedDB and Cache). Bytes are `null`
  where the browser does not say. Databases are opened with no version so none is created; see the rules test.
- `SlopStorage.requestPersist()`: shows one line of explanation (SlopUI.confirm) first, then asks the browser. Resolves
  `granted | denied | declined | unsupported`. Never asks silently.
- `SlopStorage.clear(kind)`: `thumbs` (Drive thumbnails and previews), `faces`, `models` (Cache `webllm/*`, keeping models
  imported from a folder), `cutout`, `oldCaches` (`slopographic-*` caches except the newest), `extras` (all of these).
  Resolves `{ kind, removed }`. Never deletes Drive files, documents, saved projects, backups or localStorage settings.

## Where it is called

| place | call | covers |
|---|---|---|
| `shared/hub.js` `tx()` | `handle(e, { what: 'this file' })` on a failed transaction | Drive, Notes, Paste, Docs, Tables, Slides, Hex, Vector, Isolate, Resize, Upscale, Clean, Photo and every app that saves through SlopHub |
| `shared/data/store.js` `errOf()` | `handle(e, { what: 'this change' })` on a quota Result | CRM, Orders, Invoices, Inventory, Contacts, Calendar, To-do, Ledger, Reminders |
| `slopcut/js/core/util.js` `tx()` | `handle(e, { what: 'this media' })` | Cut (imported media, autosave) |
| `docs/js/ui/files.js` `draftPut`, `tables/js/ui/drafts.js`, `slides/js/io/draft.js`, `label/js/io/files.js` autosave, `photoslop/js/io/save.js` recovery | `handle(e, { once: … })` | drafts and autosaves: the person is told once |
| `settings/storage.js` | `SlopStorage.estimate/clear/requestPersist` | the Storage section of Settings |

Not wired: SlopVector's localStorage autosave already shows its own "storage full" toast (it cannot tell full from blocked).
Other localStorage writes (preferences) stay silent by design: they are small and fall back to defaults.

## Rules for a new save path

1. Call `handle` in the catch of a save the person pressed. Do not clear the editor, the canvas or the form. The content
   stays, and "Try again" (or saving again) works once space is freed.
2. For autosaves, pass `once`.
3. Never call `navigator.storage.persist()` from a save path. Use `SlopStorage.requestPersist()` (asks first).
4. Do not add a version-less `indexedDB.open` outside the generic openers listed in `tests/node/storage-rules.test.mjs`.

## Service worker (not changed here; do it in the release)

`service-worker.js` must be changed by its owner:

1. Add to `PRECACHE`: `/shared/storage/classify.js`, `/shared/storage/storage.js`, `/shared/storage/clear.js`,
   `/shared/storage/ui.js`, `/settings/storage.js`. The `/shared/slopui.js`, `/shared/slopui.css` and `/shared/cache/regen.js`
   entries are already there.
2. Bump `VERSION` (`'v14'` → `'v15'`), because a precached file changed.
3. Run `node tools/pwa-precache.mjs --dry-run` first to check the list. Note the flag: `--dry` is not recognised and
   **writes** the file. Then run it without the flag to regenerate the block, and run `node tests/run.mjs pwa`.

Until this is done, the new files load from the network on first use and are not available offline. Pages still
work online.

## Tests

| test | what it checks |
|---|---|
| `tests/node/storage-classify.test.mjs` | `classify(err)` on the error shapes above, the store names, and that other errors are not quota errors |
| `tests/storage/quota-save.test.html` | a forced IndexedDB quota error on a real SlopData save opens the dialog once, keeps the editor text, "Try again" retries and closes, the estimate reports parts |
| `tests/consent/settings.test.html` | the Storage section renders (usage bar, parts, persist button, the four clear actions) and a clear asks first |
| `tests/node/storage-rules.test.mjs` | the IndexedDB rules now also cover `shared/storage/` |
