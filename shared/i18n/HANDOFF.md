# Language switcher (shared/i18n)

Twenty-nine languages, each with a full table of the shared chrome and of the shared components: English (`en`, the
default and the fallback), Spanish (`es`), French (`fr`), German (`de`), Portuguese (`pt-BR`), Italian (`it`), Arabic
(`ar`, right to left), Swedish (`sv`), Simplified and Traditional Chinese (`zh-CN`, `zh-TW`), Japanese (`ja`), Korean
(`ko`), Hindi (`hi`), Russian (`ru`), Ukrainian (`uk`), Polish (`pl`), Dutch (`nl`), Turkish (`tr`), Indonesian (`id`),
Vietnamese (`vi`), Hebrew (`he`, right to left), and, marked `quality: 'beta'` until a native review, Swahili (`sw`),
Amharic (`am`), Hausa (`ha`), Yoruba (`yo`), Igbo (`ig`), Zulu (`zu`), Xhosa (`xh`) and Afrikaans (`af`). The picker lists
them in `LANGS` order, each by its own name (`name`; `en` is the English name, for search). Apps translate their own
text with tables of their own: the recipe is `APPS-HOWTO.md`, the progress `COVERAGE.md`, the terms `glossary-<code>.md`.

## Files
- `i18n.js`: `window.SlopI18n`. The language list (`LANGS`), `t(key, vars)` (plural forms by `vars.n`), `has(key)`,
  `get()`, `set(code)`, `apply(scope)`, `add(code, dict)`, `source(spec)`, `need(code)`, `ready()`, `on(fn)`, `num()`,
  `date()`, `money()`, `list()`, `plural(n)`, `lang(code)`, `langs()`, and `create(opts)` for an independent instance.
- `strings.js`: the English chrome table: the top bar and home link, the Apps button and switcher, the Settings labels,
  the homepage footer, the consent strip, the support card, the common menu words (`menu.*`) and the storage text.
- `<code>.js` (one per language): the chrome table. Each must hold every key in `strings.js`, with the same
  `{placeholders}`, and keep the brand names (Sloppo, Slopographic, the app names).
- `ui/en.js` and `ui/<code>.js`: the words of the shared components (`ui.*`: SlopUI dialogs, SlopFrame, sheets, menu
  buttons, the SlopCmd palette and shortcut editor, tours, SlopIntake/SlopOuttake, drop panels, document tabs, view modes).
- `sv-apps.js`: Swedish app names, `app.<id>` and `apptag.<id>`, for every id in `shared/apps.js`
  (`tests/node/i18n-sv.test.mjs`). It loads after `sv.js` because the `sv` entry has `appNames: true`.
- `script/<script>.css`: per-script font fallbacks and line breaking (World-ready, below).
- `settings/language.js`: the Language picker in Settings > Appearance (lists `LANGS` in order, `(beta)` after a beta one).
- `tools/i18n/`: the extractor, the checker and the coverage report (`APPS-HOWTO.md` § 6).

## Loading
- A page loads `i18n.js` once (in its `<head>`, after `shared/profile/profile.js` and `shared/theme/theme.js`, or through
  `shell/shell.js`). `i18n.js` fetches its own tables: English and the chosen language, for the chrome
  (`strings.js` + `<code>.js`), the shared components (`ui/<code>.js`) and any app that registers a source (its
  `i18n/index.js`). Nothing is fetched for the other languages.
- In the `<head>` it writes the tables into the page while it is parsed (`document.write` of same-origin scripts), so
  they run before the page's own scripts and the first paint is in the right language, with no layout shift.
- Later (a language change, another tab's change, or `i18n.js` added by the shell) it appends them, applies the marked
  elements once they are in, and fires `slopi18n` on `window` (`SlopI18n.on(fn)`); `slop-lang` fires at once on `set()`.
  The shell marks its own tag `data-late` and waits for `SlopI18n.ready()` before it mounts the header.
- An offline single-file copy (`<meta content="offline">`) fetches nothing: its manifest embeds the English tables.

## World-ready
- `<html lang>` and `dir` follow the language (`apply()`); `ar` and `he` are right to left.
- Fonts: the brand fonts carry Latin only. A language with `script` in `LANGS` (`han-sc`, `han-tc`, `jpan`, `kore`,
  `deva`, `ethi`, `hebr`, `cyrl`, `viet`) also gets `script/<script>.css`: `@font-face` rules that add that script's
  glyphs to the brand families from fonts already on the device (`local()` only: nothing heavy is downloaded), plus line
  breaking (`line-break: strict` for Chinese and Japanese, `word-break: keep-all` for Korean) and a taller line for
  Devanagari and Ethiopic. Other text falls back to the browser's font for the page's `lang`.
- Numbers, dates, money and lists: `SlopI18n.num/date/money/list` (Intl in the chosen language). A number passed in
  `vars` is formatted the same way; pass a string for ids and years.
- Plurals: `t('k', { n })` reads `k#<Intl.PluralRules category>` and then `k` (`APPS-HOWTO.md` § 2).
- Text expansion: keep labels short; German and Russian run 30% longer. `tests/i18n/pdf-sv.test.html` checks the PDF
  editor's top bar at 390 px in German.

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
1. Add an entry to `LANGS` in `i18n.js`: `L('fr', 'Français', 'French', 'ltr')`, with `{ quality: 'beta' }` until a native
   speaker has reviewed it and `{ script: '...' }` when it needs a script stylesheet. Use a BCP 47 code.
2. Add `shared/i18n/<code>.js` (every key in `strings.js`), `shared/i18n/ui/<code>.js` (every key in `ui/en.js`) and
   `shared/i18n/glossary-<code>.md`. `node tools/i18n/i18n.mjs --check` fails until both tables are complete.
3. Apps add the language by adding `<app>/i18n/<code>/` and running `node tools/i18n/i18n.mjs index <app>`; until then
   that app reads English in it, key by key.
4. Run `node tools/i18n/i18n.mjs coverage --baseline`.

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
