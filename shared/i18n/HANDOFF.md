# Language switcher (shared/i18n)

Foundation only. English is the only full language; the homepage and Settings are the only pages wired up. No other
app is translated yet.

## Files
- `i18n.js`: `window.SlopI18n`. The language list (`LANGS`), `t(key, vars)`, `get()`, `set(code)`, `apply()`,
  `add(code, dict)`, `langs()`, and `create(opts)` for an independent instance (tests).
- `strings.js`: the English table for the homepage header and footer and the Settings labels. Same text as the HTML.
- `settings/language.js`: the Language picker in Settings > Appearance.

## Loading a page
In the `<head>`, after `shared/profile/profile.js` (and after `shared/theme/theme.js`):

```html
<script src="../shared/i18n/i18n.js" data-src="shared/i18n/i18n.js"></script>
<script src="../shared/i18n/strings.js" data-src="shared/i18n/strings.js"></script>
```

On load, `i18n.js` sets `lang` and `dir` on `<html>` at once and replaces the marked text when the DOM is ready.
Pages with no marked elements are unaffected.

## Storage
The choice is `SlopProfile` appId `lang`, key `mode` (default `en`), so it lives in the `slop-profile` key with the
other settings. An unknown stored code reads as English. A change in another tab re-applies on `storage`.

## Adding a language
1. Add an entry to `LANGS` in `i18n.js`: `{ code: 'fr', name: 'Français', dir: 'ltr', complete: false }`. Use a BCP 47
   code. `dir` is `'rtl'` for right-to-left scripts. The picker lists every entry.
2. Add a table for it, e.g. in `strings.js` or a file of its own loaded after it:
   `window.SlopI18n.add('fr', { 'nav.apps': 'Applications', ... })`.
3. Keys missing in the language fall back to English key by key, so a partial table is safe. Set `complete: true`
   only when every key in `strings.js` is there.

## Adding strings to an app
1. Add the English text to the app's own table, or to `strings.js` if it is shared chrome. Use dotted keys grouped by
   the place they appear (`nav.*`, `footer.*`, `settings.*`, or `<app>.*`).
2. Mark the HTML. Text goes in `data-i18n`; attributes in `data-i18n-attr="attr:key"` (several separated by `;`):

   ```html
   <a class="tab" href="#apps" data-i18n="nav.apps">Apps</a>
   <button data-i18n-attr="aria-label:nav.close;title:nav.close">Close</button>
   ```

   Keep the English text inside the element. It is the fallback if the script fails to load (the page stays readable).
3. For text built in JavaScript, call `SlopI18n.t('key', { name: value })`. `{name}` placeholders are filled from vars
   and left as they are when a var is missing. Values go in as text, never as HTML.
4. Mark an element only when its whole text is the string. `apply()` replaces `textContent`, so an element with child
   elements (a `<strong>` or `<br>`) needs its text wrapped in a `<span data-i18n>`. Do not mark elements that other
   scripts set (`data-brand-name`, `data-brand-footer`, the status board, the catalog).
5. Call `SlopI18n.apply()` again after you render text from JavaScript into a marked element.

## Tests
- `node --test tests/node/i18n.test.mjs` (also `node tests/run.mjs i18n`): the language list, `t()` fallback and vars,
  the stored choice, `apply()` on a fake DOM, and every `data-i18n` key on the homepage and Settings having English text.

## Known gaps
- `service-worker.js` precaches `shared/theme/theme.js` by an explicit list and does not list `shared/i18n/*`. Those two
  files are not in the offline cache until the list is updated (the service worker is not edited here). Offline, the
  pages show their English HTML, since the script never loads.
- Only the homepage header and footer and Settings are marked. Other apps keep their text as it is.
