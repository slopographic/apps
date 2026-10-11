# Language switcher (shared/i18n)

Two languages: English (`en`, the default and the fallback) and Spanish (`es`, a full table, second in the picker).
The switch works on the homepage, on Settings, and on every page that loads the shell (`shell/shell.js`). Only shared
chrome is translated so far; each app's own text stays English (see "Still English" below).

## Files
- `i18n.js`: `window.SlopI18n`. The language list (`LANGS`), `t(key, vars)`, `get()`, `set(code)`, `apply()`,
  `add(code, dict)`, `langs()`, and `create(opts)` for an independent instance (tests).
- `strings.js`: the English table: the top bar and home link, the Apps button and switcher, the Settings labels, the
  homepage footer, the consent strip, the support card, and the common menu words.
- `es.js`: the Spanish table. It must hold every key in `strings.js`, with the same `{placeholders}`.
- `settings/language.js`: the Language picker in Settings > Appearance (lists `LANGS` in order).

## Loading
- `shell/shell.js` loads `i18n.js`, `strings.js` and `es.js` when the page has no `SlopI18n`, then calls `apply()` once
  the header is in. So every shell page shows the chosen language at boot, with no tag in its own HTML.
- The homepage and Settings load the three files in their `<head>`, after `shared/profile/profile.js` and
  `shared/theme/theme.js`, so their text is translated before first paint of the body.

## Storage
The choice is `SlopProfile` appId `lang`, key `mode` (default `en`), so it lives in the `slop-profile` key with the
other settings and survives a reload. An unknown stored code reads as English. Choosing English clears the override.
A change in another tab re-applies on `storage`.

## Adding a language
1. Add an entry to `LANGS` in `i18n.js`: `{ code: 'fr', name: 'Français', dir: 'ltr', complete: false }`. Use a BCP 47
   code. The picker lists every entry, in list order.
2. Add `shared/i18n/<code>.js` with `window.SlopI18n.add('fr', { 'nav.apps': 'Applications', ... })`, and load it
   after `strings.js` on the homepage and Settings (shell pages pick it up only if the shell loads it: add it to the
   list in `shell/shell.js` too).
3. Keys missing in the language fall back to English key by key, so a partial table is safe. Set `complete: true`
   only when every key in `strings.js` is there. `tests/node/i18n.test.mjs` fails when a complete table misses a key
   or changes a placeholder.

## Right-to-left (rule)
- `apply()` sets `dir` on `<html>` from the language's `dir` in `LANGS`. Set `dir: 'rtl'` for an RTL language (Arabic,
  Hebrew, Persian, Urdu) and the page turns right to left at once.
- No RTL language is in the list yet. Before one is added, the shell and app CSS must be checked in RTL: the layout
  uses physical left and right in places (margins, `left:`/`right:`, the switcher and consent strip). Use logical
  properties (`margin-inline-start`, `inset-inline-end`) where the layout changes, and do not mark the language
  `complete` until the pages look right mirrored.

## Adding strings
1. Add the English text to `strings.js` (shared chrome) or to the app's own table (an app-specific `<app>.*` table).
   Use dotted keys grouped by where they appear (`nav.*`, `shell.*`, `switcher.*`, `consent.*`, `support.*`,
   `menu.*`, `footer.*`, `settings.*`), and add the same key to every language file.
2. Mark the HTML. Text goes in `data-i18n`; attributes in `data-i18n-attr="attr:key"` (several separated by `;`):

   ```html
   <a class="tab" href="#apps" data-i18n="nav.apps">Apps</a>
   <button data-i18n-attr="aria-label:menu.close;title:menu.close">Close</button>
   ```

   Keep the English text inside the element. It is the fallback if the script fails to load.
3. For text built in JavaScript, call `SlopI18n.t('key', { name: value })`. `{name}` placeholders are filled from vars and
   left as they are when a var is missing. Values go in as text, never as HTML. Elements built in JS can carry
   `data-i18n` too, so a later `apply()` (on a language change, or at boot) updates them.
4. Mark an element only when its whole text is the string. `apply()` replaces `textContent`, so an element with child
   elements (a `<strong>` or `<a>`) needs its text wrapped in a `<span data-i18n>`. Do not mark elements that other
   scripts set (`data-brand-name`, `data-brand-footer`, the status board, the catalog).
5. Call `SlopI18n.apply()` again after you render text from JavaScript into a marked element.

## Tests
- `node tests/run.mjs i18n` (or `node --test tests/node/i18n.test.mjs`): the language list, `t()` fallback and vars, the
  stored choice, `apply()` on a fake DOM, every language table having every English key with the same placeholders,
  Spanish being second and complete, and every shared-chrome key used by the shell, the consent strip, the support card,
  and the homepage and Settings existing in English.
- `tests/i18n/switch.test.html`: in a browser, the Settings picker lists `en` then `es`; choosing Spanish changes the
  homepage nav text; a reload keeps it; a shell page (Ledger) shows it at boot; switching back restores English.

## Storage and offline
- `service-worker.js` precaches `shared/theme/theme.js` by an explicit list and does not list `shared/i18n/*`. The
  i18n files are not in the offline cache until that list is updated. Offline, a page with no cached i18n file shows its
  English HTML, since the script never loads. (The service worker is not edited here.)

## Still English
- **Every app** (each app page that loads `shell/shell.js`, the registry in `shared/apps.js`): the app's own top bar and home link, menus and
  menu words used in the app's own markup, toolbars, tool and option labels, dialogs, body text, and status messages.
  Translated today on every shell page: the Apps button and the app switcher (labels, search hint, sections, Esc).
- **Apps that load the consent strip** (`shared/consent/banner.js`) and **the support card** (`shared/support/card.js`):
  these texts are translated. Apps that do not load them have no strip or card.
- **Homepage and Settings**: the marked text (header tabs, footer, Settings labels and the language picker) is
  translated. Unmarked paragraphs and switches (privacy and analytics explanations, the exchange-rate and defaults
  bodies, the donate text) stay English until they are marked.
- **Menu words** (File, Edit, View, Help, Save, Open, Export, Print, Cancel, OK, Close) are in `strings.js` and
  `es.js`, but no app's own menus are marked yet. An app marks its menus with `menu.*` keys.
- **Notifications** (`shell/notify.js`, the bell and its panel) and the navigation drawer (`shell/drawer.js`) are English.
