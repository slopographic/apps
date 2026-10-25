# Language switcher (shared/i18n)

Eight languages, each with a full table of the shared chrome: English (`en`, the default and the fallback), Spanish
(`es`), French (`fr`), German (`de`), Portuguese (`pt-BR`), Italian (`it`), Arabic (`ar`, right to left) and Swedish (`sv`). The picker
lists them in `LANGS` order, each by its own name. The switch works on the homepage, on Settings, and on every page
that loads the shell (`shell/shell.js`). Only shared chrome is translated so far; each app's own text stays English
(see "Still English" below).

## Files
- `i18n.js`: `window.SlopI18n`. The language list (`LANGS`), `t(key, vars)`, `get()`, `set(code)`, `apply()`,
  `add(code, dict)`, `langs()`, and `create(opts)` for an independent instance (tests).
- `strings.js`: the English table: the top bar and home link, the Apps button and switcher, the Settings labels, the
  homepage footer, the consent strip, the support card, and the common menu words.
- `es.js`, `fr.js`, `de.js`, `pt-BR.js`, `it.js`, `ar.js`, `sv.js`: one table per language. Each must hold every key in
  `strings.js`, with the same `{placeholders}`, and keep the brand names (Sloppo, Slopographic, the app names).
- `sv-apps.js`: Swedish app names, `app.<id>` (a plain business name such as `PDF-redigerare`) and `apptag.<id>` (a
  one-line description), for every id in `shared/apps.js` (`tests/node/i18n-sv.test.mjs` checks it). These keys exist only
  in Swedish: in English the plain names are the registry's `plain` field. A `<code>-apps.js` file loads after `<code>.js`.
- `settings/language.js`: the Language picker in Settings > Appearance (lists `LANGS` in order).

## Loading
- `shell/shell.js` loads `i18n.js`, `strings.js` and every language file when the page has no `SlopI18n`, then calls
  `apply()` once the header is in. So every shell page shows the chosen language at boot, with no tag in its own HTML.
- The homepage and Settings load all of them in their `<head>`, after `shared/profile/profile.js` and
  `shared/theme/theme.js`, so their text is translated before first paint of the body.

## Default language (brand profile)
`DEFAULT` (`en`) is the fallback: a key missing in the chosen language is read from English. `DEFAULT_CHOICE` is the
language a visitor gets when nothing is stored. It is written as one line, `var DEFAULT_CHOICE = /*profile:defaultLang*/'en';`,
and the white-label build (`tools/whitelabel`) rewrites the literal after the marker from the profile's `defaultLang`
(a profile with `"defaultLang": "sv"` starts in Swedish). Keep the marker and the literal on one line. Every language stays in the picker
on every build; only the starting choice changes. `create({ defaultLang })` overrides it in tests.

## Storage
The choice is `SlopProfile` appId `lang`, key `mode` (default `DEFAULT_CHOICE`), so it lives in the `slop-profile` key with the
other settings and survives a reload. An unknown stored code reads as the default choice. Choosing the default choice clears the override.
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
- `apply()` sets `lang` and `dir` on `<html>` from the language's entry in `LANGS`. An entry with `dir: 'rtl'` (Arabic
  today; Hebrew, Persian, Urdu later) turns the page right to left at once; every other entry sets `dir="ltr"`.
- The shared chrome uses logical properties, so it mirrors with `dir`: the header (`shell/shell.css`: `.sh-hdr`,
  `.sh-fab`, `.sh-opt`), the switcher, the consent strip (`shared/consent/banner.css`: `inset-inline`) and the support
  card (`shared/support/support.css`: `inset-inline-end`). Write new chrome CSS the same way: `margin-inline-start`,
  `inset-inline-end`, `text-align: start`, never `left`, `right` or `text-align: left` in those files.
  `tests/node/i18n.test.mjs` fails when a physical side returns to those rules.
- The notification panel and bell (`.sn-*`), the app drawer (`.sh-dr`) and drag markers (`.sh-drop-*`) still use
  physical sides. They are not mirrored yet, so change them the same way before a right-to-left page relies on them.
- An app's own CSS is not checked here. Before an app is shown in Arabic, check it mirrored in a browser.
- The Arabic table is `complete`: it has every key. The shared chrome was checked mirrored in a browser (the header,
  the cookie strip, the Ledger header); `tests/i18n/rtl.test.html` checks the attribute, the header and its margin.

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
- `node tests/run.mjs i18n` (or `node --test tests/node/i18n.test.mjs`): the language list (names, codes, directions,
  English first), one file per language and each adding under its own code, every language loaded by the shell, the
  homepage and Settings, `t()` fallback and vars, the stored choice, `apply()` on a fake DOM (including `dir="rtl"` for
  Arabic), every language table having every English key with the same placeholders, the logical-property CSS, and
  every shared-chrome key used by the shell, the consent strip, the support card, and the homepage and Settings
  existing in English.
- `tests/i18n/switch.test.html`: in a browser, the Settings picker lists all eight codes; choosing Spanish changes the
  homepage nav text; a reload keeps it; a shell page (Ledger) shows it at boot; switching back restores English.
- `tests/i18n/rtl.test.html`: the picker shows each language by its own name; choosing Arabic sets `lang="ar"` and
  `dir="rtl"`, the header's Apps button shows and is on screen, and the header's start margin is on the right; a shell
  page shows it at boot; choosing English puts `dir="ltr"` back.

## Storage and offline
- `service-worker.js` precaches `shared/theme/theme.js` by an explicit list. Its i18n entries are `i18n.js`,
  `strings.js` and `es.js` only, so `fr.js`, `de.js`, `pt-BR.js`, `it.js` and `ar.js` are not in the offline cache until
  that list is updated. Offline, a page in one of those languages falls back to English, since its script never loads.
  (The service worker is not edited here; add the five files to its list in a separate change.)

## Still English
- **Every app** (each app page that loads `shell/shell.js`, the registry in `shared/apps.js`): the app's own top bar and home link, menus and
  menu words used in the app's own markup, toolbars, tool and option labels, dialogs, body text, and status messages.
  Translated today on every shell page: the Apps button and the app switcher (labels, search hint, sections, Esc).
- **Apps that load the consent strip** (`shared/consent/banner.js`) and **the support card** (`shared/support/card.js`):
  these texts are translated. Apps that do not load them have no strip or card.
- **Homepage and Settings**: the marked text (header tabs, footer, Settings labels and the language picker) is
  translated. Unmarked paragraphs and switches (privacy and analytics explanations, the exchange-rate and defaults
  bodies, the donate text) stay English until they are marked.
- **Menu words** (File, Edit, View, Help, Save, Open, Export, Print, Cancel, OK, Close) are in `strings.js` and in
  every language file, but no app's own menus are marked yet. An app marks its menus with `menu.*` keys.
- **Notifications** (`shell/notify.js`, the bell and its panel) and the navigation drawer (`shell/drawer.js`) are English,
  and their CSS is not mirrored yet (see Right-to-left).
- **Every app's own text** is English in all eight languages (see the first bullet above).
