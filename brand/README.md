# Brand: making your own copy

Everything a visitor sees as "Slopographic" (the page title, header name and logo, colours, footer and
support links) comes from `brand/brand.json`. Apps and the homepage read it through `brand/brand.js`.

## Fork in three steps

1. **Copy the site.** Copy the whole folder to your own repository. There is no build step: the site is
   plain HTML, CSS and JavaScript, so it runs from any static host.
2. **Edit `brand/brand.json`.**
   - `name`, `tagline`: the header name and the line under the homepage title.
   - `logo`: a path from the site root to your logo (SVG or PNG). Replace `brand/logo.svg`, or point to a new file.
     An empty string keeps the built-in mark.
   - `home`: where the logo links go (a full `https://` URL or a path). Empty keeps each page's own link, which is the site root.
   - `colors`: `ink` (background), `paper` (text), `accent` (highlight). Use `#rgb`, `#rrggbb` or `#rrggbbaa`.
   - `footer`: the footer line on the homepage.
   - `links.patreon`, `links.support`: `https://` or `mailto:` links. An empty value hides that link.
   - `appOrder`: the default order of apps in the switcher and the app drawer (app ids from `shared/apps.js`).
     Apps not listed follow in registry order.
3. **Deploy the folder** to your host (for example GitHub Pages or any static server). Update your domain
   in `CNAME` and the canonical and `og:` tags in `index.html` if you use them.

If `brand.json` is missing or invalid, the built-in defaults are used and the site still works.
Bad values (for example a `javascript:` link or a malformed colour) fall back to their defaults.

## What the brand touches

| Where | What |
| --- | --- |
| Page title | The word "Slopographic" is replaced by `name`. |
| `[data-brand-name]`, header `.brand-name` | Text: `name` |
| `[data-brand-tagline]` | Text: `tagline` |
| `[data-brand-logo]`, or the first svg in a header `.brand` link | The logo image from `logo` |
| `[data-brand-home]`, and the logo link `header a.brand` on app pages | `href`: `home`, when it is set |
| `[data-brand-footer]` | Text: `footer` |
| `[data-brand-link="patreon"]`, `[data-brand-link="support"]` | `href`, hidden when empty |
| `--brand-ink`, `--brand-paper`, `--brand-accent` on `:root` | Colours for the shell and any page that uses them |
| `<html data-brand-tokens>` | Also sets `--ink`, `--bone`, `--slop`, which the homepage uses |

To put a brand hook on a new page, add one of the attributes above to the element you want changed.

## Using it from code

```js
SlopBrand.ready.then((config) => console.log(config.name));   // resolves after brand.json is read
SlopBrand.apply({ name: 'Preview Co' });                      // apply any config again (for live previews)
SlopBrand.order;                                              // the default app order
```

## Offline use

`tools/pwa-precache.mjs` lists the files a page loads at boot so the service worker can cache them. It
follows static `<script src>` tags. The shell (`shell/`) and `brand/` files are loaded from script code,
so they are not in that list yet. Add them to the list and regenerate it before you rely on offline use.

## White-label builds

The same code also builds other sites: a copy of the whole site under another name, with plain app names, its own
colours and logo, no mascot, and no word of this brand anywhere (text, code, file names, storage keys, tests, workflows).
One codebase, one profile per site. A build is generated: it is never edited by hand, and every improvement made here
reaches it at the next release.

**The rule: edit here, publish there. If a change is made there anyway, import it** (`tools/whitelabel/import.mjs`).

### Profiles

A site is one profile, `<id>.json`, next to its rename map, `<id>.map.json`. This repository holds only
`brand/profiles/slopographic.json` (this site; no map, so a build of it is a plain copy with today's values) and two
made-up samples that CI builds (`sample`: "Acme Tools", English; `sample-sv`: Swedish by default). The profiles of real
sites live outside this repository, with the publish script; pass their folder with `--profiles=<dir>`.

| Field | What it sets |
| --- | --- |
| `id` | The file name. |
| `name`, `shortName`, `brandWord`, `tagline` | The product name (title, header, footer, manifest), the short name (manifest), the word that replaces this brand before a lower-case word ("the Acme apps"), and the line under the homepage title. |
| `origin`, `cname`, `mailDomain`, `github` | The site's address (canonical, Open Graph, sitemap, robots), its custom domain (`CNAME`), mail domain, and GitHub account (cdn and repository links). |
| `defaultLang` | The language a visitor gets when nothing is stored (`en`, `sv`, ...). Every language stays in the picker. |
| `naming` | `brand` (PhotoSlop, Slop PDF) or `plain` (Image Editor, PDF Editor; the `PLAIN` table in `shared/apps.js`). |
| `tone` | `playful` or `plain`: plain applies the copy layer, `brand/copy/plain.json`. |
| `mascot` | `false` turns the mascot off everywhere (the buddy, the Drive empty states, the AI top bar). An object puts the profile's own mascot in its place: `{ overlay, name, files, icon?, holder?, trademarks? }` (see "A mascot of your own"). |
| `colors`, `themes`, `palette` | `brand.json` colours; the Light and Dark theme tokens (`hide` drops themes such as `lime`); the hue every accent-coloured colour in the CSS and code moves to (`tools/whitelabel/palette.mjs`). |
| `logo` | `{ text, mark, color }`: the build draws a wordmark (`brand/logo.svg`), a square mark (`brand/mark.svg`, the favicon) and the PNG icons and share card from it. Replace the files in a later commit of the profile's folder if you have a real logo. |
| `links`, `footer`, `support`, `analytics` | Footer and support links (empty hides them), the footer line, the export card parts, and third parties: `false` leaves out analytics, ads and the consent strip. |
| `copy` | Extra phrase replacements for this site (`"source phrase": "replacement"`), on top of the tone's. |
| `apps.hide`, `media` | Apps left out of every list, menu and sitemap (their guides and task pages too; the SEO tests of a mirror then need their names on the skip list); `false` leaves out screenshots, clips and videos (they show this brand). |
| `seo` | `homeTitle`, `homeDescription`, `titleSuffix` for the generated head blocks and the sitemap. |
| `legal` | `{ holder, year, trademarks? }`: the MIT licence's copyright holder, `NOTICE.md` and `TRADEMARKS.md` (`trademarks`: the names the holder claims; default the product name). |
| `publish` | `{ repo, branch, secret, author, email }`: where the publish script pushes, the token's secret name, and the release commit's author. |
| `brandTerms`, `forbid`, `scanAllow` | Words only this site uses (no other build may contain them), extra words to forbid, and allowed scan hits (`{ file, term, why }`, reported every time). |

`tools/whitelabel/profile.mjs` `validate()` is the schema in code; `tests/node/whitelabel-profile.test.mjs` checks every
profile here.

### The rename map

`<id>.map.json` holds every token and folder rename of a build, in one file: `stem` (`["slop", "<new stem>"]`, every case
form: `SlopUI` -> `TlbxUI`, `SLOP_APPS` -> `TLBX_APPS`) and `compounds` (`photoslop` -> `imageeditor`, also the folder:
`/imageeditor/`). A compound can give a folder its own spelling (`"path": "image-editor"`), but code that builds a path
from an id then misses it, so the maps here keep one spelling. English words that contain the stem (slope, sloped, sloppy, SLOPE) are never touched. The map is a
bijection: its targets must not occur in the source (the build refuses a map whose targets do), so the reverse is exact.
`node tools/whitelabel/roundtrip.mjs <id>` proves it over the whole repository; CI runs it on every push.

### Build one locally

```sh
node tools/whitelabel/build.mjs sample /tmp/acme              # the whole site for the profile, scan included
node tools/whitelabel/build.mjs <id> <dir> --profiles=<dir>   # a real profile kept outside the repository
node tools/whitelabel/export.mjs <id> <mirror checkout> --profiles=<dir>   # round trip + build into a mirror's checkout
```

A build copies every file (`git ls-files`), leaves out this brand's own files (licence notices, trademarks, its
workflows' identity checks, the profiles, this tool), renames paths and text through the map, writes the profile's files
(`brand/brand.json`, `CNAME`, `LICENSE`, `NOTICE.md`, `TRADEMARKS.md`, `SECURITY.md`, a README that says "generated - do
not edit", the manifest, logo, favicon, icons, share card and the mirror's own CI workflow), runs the SEO writer and the
precache list inside the copy, and then scans every file name, text line and binary for this brand's words and every
other profile's terms. Any hit fails the build. Serve the folder with any static server to look at it.

### A mascot of your own

`"mascot": { "overlay": "<folder>", "name": "...", "files": [...] }` swaps this site's buddy for a mascot module the
profile supplies. The folder (relative to the profiles folder, kept with the profile) is copied to `brand/mascot/` and
holds two ES modules: `mascot.js` (`name`, `animations`, optional `moments`, `create(el, { reduce })` returning
`{ play(name, { loop, side }), dispose() }`) and `icon.js` (`name`, `svg(size, small)`, no DOM). The buddy's toggle then
loads the mascot slot (`shared/mascot/slot.js`) instead of its engine, and the slot plays a named animation for each of the
buddy's moments (`shared/mascot/moments.js`):

| Moment | Animation | When |
| --- | --- | --- |
| greeting | `hello` | the mascot is shown |
| working | `working` | a task starts (a SlopFlow tile runs, a region is `aria-busy`); it loops while the task runs |
| done / error | `celebrate` / `oops` | the task ends well or fails |
| idle / wake | `sleep` / `wake` | a minute without input; the next input |
| point | `point` | a page sends `mascot-moment` with `{ moment: 'point', target }`, or after the greeting at `[data-mascot-point]` |

Any page may send a moment: `document.dispatchEvent(new CustomEvent('mascot-moment', { detail: { moment: 'done' } }))`.
An overlay that lacks an animation simply skips that moment, and may map a moment to another one (`moments`).

`files` lists every file of the folder (the build refuses a folder with an unlisted file or a listed file that is missing).
The build writes `LICENSE-ART` (the character's files and the icons drawn from it, all rights reserved, outside the MIT
licence), a `NOTICE.md` item and a `TRADEMARKS.md` that names the character design; with `icon` (default on) the favicon
(the small drawing), the header mark, the app icons and the share card come from `icon.js`. `holder` and `trademarks`
name the character's owner when it is not `legal.holder`; the owner's name is then allowed in the character's files and
the notices only (reported by the scan). The made-up sample uses `brand/profiles/overlays/acme/`.

### The file host (cdn)

The apps download large files (models, engines, font packs) from this site's `cdn` repository at a release tag
(`shared/cdn/assets.js` `TAG`). A build's links name `<github>/cdn` at the same tag. `tools/whitelabel/cdn.mjs` makes that
repository's content for a build: the files the build fetches (its `tools/cdn-assets.mjs`) and the licence and source
notes beside them, read with `git archive` from a local checkout of this site's `cdn` repository at the tag (content only:
none of its commits, authors or history), the notes renamed like the site, and a README. Everything is scanned; bytes
inside a binary that happen to spell the stem and the English word in a speech model's tokenizer vocabulary are the only
allowed hits, and each kind is reported. The publish script commits it as one commit of the profile's author, tags it
with the tag, and pushes it before the site. `--cdn-ref=<tag>` on the build points the links at another tag.

```sh
node tools/whitelabel/cdn.mjs <id> <build dir> <cdn checkout> <out dir> --profiles=<dir>
```

### Tests in a mirror

A mirror keeps the whole test suite, renamed, and its own CI workflow runs it. The few Node tests that check this site's
own profile values (its brand app names, its copy lengths, its media, its support links) are skipped by name there, and
only when the profile differs (`tools/whitelabel/mirror-skip.mjs`, each with its reason). The mirror's workflow also runs
the smoke pages and the whole contrast sweep (`tests/a11y/sweep-*`) in its own colours, in six parallel slices. CI here runs
the same build checks on the samples.

### Colours

A build refuses a profile whose Light or Dark theme reads worse than this site's: text and the accent at 4.5:1 on the
surfaces and on a hover tint, muted text at 4.5:1, borders at 3:1, and text at least as bright (dark) or as dark (light)
as this site's, which the apps' own greys were tested against (`tools/whitelabel/palette.mjs` `themeProblems`; the unit test
also reads a private profile folder from `WHITELABEL_PROFILES`). The accent family in the CSS moves to the profile's hue
with the same luminance, so every contrast the sweep checked here still holds.

### Releases

A release builds each profile with `export.mjs` and pushes the result as one commit on top of the mirror's last release
commit (one commit per release, author from `publish`, a neutral message) to the mirror's `testing` branch. The mirror's
own CI runs there; only a green run fast-forwards `main`, which GitHub Pages serves. Tests for a mirror run on GitHub,
not on the machine that publishes. The publish script refuses to run when the
mirror has a commit it did not make, and names it, instead of overwriting it. The script and the real profiles are kept
outside this repository; CI here builds the samples on every push, so a change that would break a white-label build
fails here first.

**DNS for a mirror on GitHub Pages:** in the domain's DNS add `CNAME <subdomain> -> <account>.github.io` (for example
`tools -> <account>.github.io`); the build writes the `CNAME` file and the publish script turns Pages on for the
repository with that custom domain. Turn on "Enforce HTTPS" once the certificate is issued.

### Importing a change made in a mirror

```sh
node tools/whitelabel/import.mjs <id> --mirror=<mirror checkout> --from=<mirror commit> --to=<mirror commit> \
  --base=<source commit the --from release was built from> --profiles=<dir>
```

It adds a worktree on a new `wip/import-...` branch, turns every changed path and line back through the map, puts back
the source names the profile replaced on those lines, stages the result and lists what needs a look: lines that hold the
profile's own words (they must not reach this public repository), regenerated files and binaries. It never commits.

### Checklist: a feature that works in every build

- Show an app's name with `slopAppName(app)` (or `app.name`), never a hard-coded brand name in a new string.
- Playful text goes through the copy layer: add the plain wording to `brand/copy/plain.json`, not a second copy of the
  feature.
- Behaviour that differs per site reads a profile flag through a marker (`/*profile:mascot*/true`,
  `/*profile:naming*/'brand'`; values in `tools/whitelabel/emit.mjs` `markerValues`). Never `if (brand === '...')`.
- Colours: use the theme tokens (`--sl-*`) or this brand's accent family, which the palette shift recolours.
- New user-facing strings in the shared chrome get an i18n key (`shared/i18n`).
- Run `node tools/whitelabel/build.mjs sample /tmp/acme` before you push a change that adds brand words; CI does it anyway.
