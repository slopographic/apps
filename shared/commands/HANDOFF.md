# SlopCmd: shared command palette and customizable shortcuts

## Files (all ≤300 lines)
- `commands.js`: the core. It covers key parsing and display (`Mod` = Ctrl or ⌘, chords, ⌘⇧⌥ on Mac), the registry, per-app overrides (`localStorage 'slop.keys.<app>'`), recents/frecency (`'slop.cmd.recent.<app>'`), providers and the single capturing keydown dispatcher. Missing UI parts load on demand.
- `search.js`: fuzzy ranking over title, keywords, group and id. Acronyms count, every word must match, enabled items rank first and recent use boosts. It also builds "Go to <app>" entries from `SLOP_APPS` and the provider sections.
- `palette.js`: the Spotlight palette. It uses the ARIA combobox + listbox pattern with `aria-activedescendant`, traps focus, restores focus on close and is a full-width sheet at ≤640 px. The floating search button is opt-in: `init({ fab: true | 'touch' })`.
- `recorder.js`: shortcut recording (chords; Esc cancels) and `assign`, which asks "Replace?" on a conflict. Also export and import of JSON.
- `keymap.js`: the shortcut editor, a SlopUI dialog with search, click-to-record, + to add, × to remove, reset one or all, conflict warnings and import/export.
- `commands.css`: themed through `--sui-*`, plus a Win98 skin under `[data-theme=paint|classic]`. Checked in SlopLabel's Pro, Light and Classic 98 themes and in Paint Classic.

## API
Load it after `slopui.js`:
`<link rel="stylesheet" href="…/shared/commands/commands.css">`
`<script src="…/shared/commands/commands.js">`
List `search.js`, `palette.js`, `recorder.js` and `keymap.js` too if the app builds an offline single file; otherwise they load lazily.

- `init({ app, target?, fab?, paletteKeys? })`
- `register([{ id, title, group, keys, icon, keywords, when, checked, run(ctx), repeat?, global?, hidden? }])`
- `unregister(id)`, `run(id, ctx)`, `list()`, `get(id)`
- `keyFor(id)`, `keysFor(id)`, `bindings(id)`
- `open(q)`, `close()`, `openKeymap()`, `isOpen`
- `on('change' | 'run' | 'open' | 'close' | 'dismiss', fn)` returns an off function
- `setKeys(id, keys)`, `resetKeys(id?)`, `conflicts(binding, exceptId)`, `allConflicts()`
- `exportKeys()` / `importKeys(obj)`, `recent()`, `frecency(id)`
- `addProvider({ id, title, search(q) → [{ id, title, run }] })`
- `parse`, `canon`, `format`, `eventSteps`, `search(q)`

`run(ctx)` receives `{ source: 'key' | 'palette' | 'api', event }`.

Built-in commands:
- `cmd.palette`: Mod+K, Shift+Mod+P and `/` (`/` only outside text fields).
- `cmd.keymap`

Dispatch rules:
- Text fields only get bindings that use Mod/Ctrl/Meta.
- Nothing fires while a SlopUI dialog or the palette is open, except `global` commands (the palette toggle).
- When `when()` is false, the key falls through to the next command bound to it, or to the page.
- Auto-repeat only fires commands that set `repeat: true`.
- Punctuation also matches by `e.code`, so `Shift+Mod+]` works on US layouts.

## How to integrate
1. Add the tags.
2. Write `<app>/…/commands.js`, which calls `init({ app: '<SlopHub id>' })` and registers every discrete action. Keep held movement keys in the game's own input code.
3. Delete the old keydown branches.
4. Use `SlopCmd.keyFor(id)` for menu labels and tooltips.
5. Add Help ▸ Search commands… / Keyboard shortcuts…, or a search button.
6. For games, use `SlopCmd.on('open', pause)`.

## Integrated apps (tests green)
- **label**: every tool and menu action (~100), Help entries and a toolbar Search button; it is also in the offline build. 69 tests.
- **games/sloppo-bird**: 34 tests.
- **games/star-defender**: 34 tests.
- **games/tower-defense**: 54 tests.
- **games/runner**: 57 tests.
- **games/platformer**: pause, mute and recenter go through `input.press`; also restart, map, show, levels and settings. 137 tests.
- **shots**: `tests/shots/commands.test.html`.
- **tank**, **lighter**, **unsubscribe** (light touch) and **photoslop/classic** (Win98 skin, Help entries): `tests/commands/apps.test.html`.
- **2100**: `/` stays the search shortcut through `paletteKeys`. Its own 38 tests passed; a palette page test is still to do.

Not integrated (owned by other agents): photoslop/, vector/, pdf/, press/, slopedit/, drive/ (drive already codes against it and uses `addProvider`), home/, reel/.

## Tests
- `node tests/run.mjs commands/commands`: 41 tests.
- `commands/apps`: 4 tests.

## Next steps
1. Integrate reel/ and the remaining apps.
2. Re-add a 2100 palette page test.
3. Drive's test `tests/drive/commands.test.html` swaps `window.SlopCmd` for a mock after the real one has already attached its listener, so its "private map" assertion fails. That test should stub before boot, or call `SlopCmd.resetKeys` / unregister.
