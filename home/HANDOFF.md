# Homepage handoff

## Files
- `index.html`: the hero (`#hero`: wordmark, headline, buttons, meta line, the keyboard list `.vx-nav`, the ledge Sloppo
  perches on), the capability strip (between `<!-- site:marquee -->` markers, written by `tools/seo/write.mjs`), the
  finder (`#app-finder`), the jump links (`#jump-links`), workspaces, "Why it's different" strip (with the video link), the section shelves (`#app-sections`, filled by `home/browse.js`),
  Status board, the Authenticator view (`#detector`), footer (licence and trademark line). Loads `style/*.css`,
  `home/home.css`, `shared/finder/finder.css`, the buddy CSS, `shared/apps.js`, `shared/hub.js`, `shared/urlstate/urlstate.js`,
  `shared/finder/model.js`, `finder.js`, `app-search.js`, the `slop/` engine, `app.js`, `home/sections.js`,
  `home/catalog.js`, `home/browse.js`, `home/vortex/orbit.js`, `home/vortex/vortex.js`, `motion.js` and
  `home/mascot/index.js` (module). `home/hero.css` styles the hero, the strip and the numbered headings.
- `home/sections.js`: the six sections in order (`SECTION_DEFS`), the placement map `SECTIONS` keyed by app id (an array
  gives an app several places; a converter entry's `line` is its in-and-out line), the Print card (`SECTIONS.print`,
  opens `html2pdf/`), `placements()` (an app the map does not name keeps its old group: business, creative, or
  experiments), `typeKinds()` for the file-type facet, and `TOUR_DIRS`.
- `home/browse.js`: builds the shelves once (so the headings keep their perch), mounts the finder with the registry,
  and renders the shelves from what the finder lets through. A section with no matches is hidden; the jump links follow.
- `shared/finder/`: the reusable finder. `model.js` is pure (search with accents folded, facets with OR inside a facet
  and AND across, counts, sort, chips, state) and node-tested; `finder.js` is `SlopFinder.mount(host, options)`; the
  options and the return value are documented at the top of `finder.js`. `app-search.js` holds the description and 4 to
  10 keywords for every registry app (`tests/node/app-search.test.mjs` fails if one is missing).
- `app.js`: routing (home vs `#detector`), the live counter and the Authenticator. Clicks only count as navigation on
  real `[data-view]` links (the `<body>` carries `data-view` as state).
- `home/catalog.js`: renders the cards, the shelves and status board from `shared/apps.js`; `SlopHomeCards.icon` is the
  badge every icon on the page uses (the vortex too). Another agent is adding
  hover clips (`data-clip`, `<video>`) here; coordinate before editing it.
- `home/mascot/index.js`: boots the shared Sloppo buddy with the homepage options:
  `boot({ app: 'home', defaultOn: true })`. The engine lives in `shared/buddy/` (see its HANDOFF.md).
- `slop/`: the slop text engine, split from the old 597-line `slop.js` (output is byte-identical; fingerprint test).
  Browser order: `core.js`, `gen-feeds.js`, `gen-more.js`, `engine.js`, `detect.js` (each extends `window.Slop`).
  Node: `const Slop = require('./slop/index.js')` (also sets `globalThis.Slop`).
- `style/`: `base.css` (tokens, nav, hero), `detector.css`, `footer.css` (footer, toast, responsive, motion), split
  from the old 347-line `style.css` (concatenation is identical).
- `motion.js`: the Authenticator stamp slam and the footer fill.

## Hero (top of the homepage)
- Wordmark: `.hx-mark`, Archivo 900 at 125 % width (75 % on phones), its size in container units of `.hx-stage` (the
  text is 10.27 em wide at 125 %, 6.5 em at 75 %), so it fills the row in any font and the stage keeps its height:
  nothing moves when fonts or scripts arrive. It is the largest paint on desktop. `data-brand-name` follows brand.json.
- Headline (the page's only h1 in the home view), sub-line, Open the apps (`[data-to-finder]`: home/browse.js scrolls to
  the finder and focuses its search; without scripts it is a plain `#app-finder` link), How it works, meta line. Every
  string has a `hero.*` key in shared/i18n (all seven languages).
- Tool vortex (`home/vortex/`): `orbit.js` is the pure maths (tiers, spiral, placing on the tilted ellipse, fades,
  keep-out over the text boxes, the still ring, the fps cap; node-tested in tests/node/vortex-orbit.test.mjs).
  `vortex.js` builds `.vx-layer` (a canvas for flow lines and trails, and the icon links), starts after `load` when idle,
  and runs only while the hero is on screen and the tab is visible. Tiers: full (34 icons, 60 fps), lite (14 icons,
  30 fps: phones, touch, 4 cores or fewer, 4 GB or less, Save-Data), static (reduced motion: 16 icons on two rings).
  Each icon slot takes the next app when it reaches the centre, so every app comes round. Hover or press holds an icon
  and shows its name. `.vx-nav` lists every app as one tab stop (arrow keys, Home, End); the focused app shows as a chip
  and lights its icon. `window.SlopVortex` (state, frames, tier, icons, reduce, pause) is for the tests.
- Capability strip: `tools/seo/marquee.mjs` (one label per app from its title, File convert as its number of
  conversions), scrolled by CSS, paused on hover and under reduced motion. Run `node tools/seo/write.mjs` after
  changing the registry (tests/node/home-marquee.test.mjs fails when index.html is stale).
- The app carousel that used to lead the page is gone: the vortex shows every app's icon and the finder right under it
  lists them all, so a featured row would only repeat them.

## Perches
Sloppo stands on the top edges of `[data-perch]` elements: the ledge at the bottom right of the hero, the shelf headings,
every card (`data-perch="card"`, which chaos may bite, knock or blast), the status board and the footer wordmark.

## Finder and sections
- Search is at the top: a large box with a suggestion list (name and section); Enter opens the first suggestion. It is
  autofocused on desktop only. It matches name, tagline, the long description, keywords, features and folder.
- Facets (Section, File types, Status: Ready or In development, Guided tour) sit in a closed "Filter by" panel and show
  counts. Chips remove one filter each. Views: cards (the shelves themselves, so the results stay hidden until a filter
  or the list or table view is chosen), a compact list, and a table (App, Section, File types, Open; sortable).
- The filter is kept in the URL under `hp.` (`hp.q`, `hp.view`, `hp.sort`, `hp.dir`, `hp.facets`).

## Tests (`node tests/run.mjs home`)
- `tests/home/catalog.test.html`: every registry entry renders in its shelf, badges and features, the status board, tab
  jumps, Authenticator view switching, clicks on Sloppo are not navigation, the icon markup, no carousel left.
- `tests/home/hero.test.html` (1280 and 390 px, Light and Dark): the wordmark whole and above the vortex with no icon
  shown over it, the vortex moving, stopping in a hidden tab or off screen, the still ring for reduced motion, the strip
  from the registry, no sideways scroll. `tests/home/hero-links.test.html`: icons as named links, hover, the keyboard
  list, the buttons, one h1, translations. `tests/a11y/sweep-40.test.html`: the homepage in the contrast sweep.
- `tests/home/mascot.test.html` (11): levels/hats/lines (pure), loads and perches, pet, level-up with hat and growth,
  drag and throw, moods, leaping back into view, view switches, lazy 3D.
- `tests/home/chaos.test.html` (12): Unleash; each chaos action is undone by Restore page; RAGE; meter.
- `tests/home/physics.test.html` (6): falls when his perch is removed or holed, Restore puts him back, knocked cards
  are rigid bodies that pile on the footer and can be ridden, cards collide.
- `tests/home/slop.test.html` (5): the slop engine API and its fingerprint.
- `tests/home/sections.test.html` (8): the six sections in order, the hero then the search, cards, converter lines,
  Print, Experiments, jump links, and no horizontal scroll at 390 px.
- `tests/home/finder.test.html` (9): search (PDF, keywords, empty state), facets with counts, table sort, list count, URL.
- `tests/finder/finder.test.html` (9): the generic component on its own.
- `tests/node/finder-model.test.mjs` (9) and `tests/node/app-search.test.mjs` (3): the pure logic and the keyword coverage.
- `tests/home/boot.js`: loads `index.html` in an iframe (clears `slop.mascot.v1` first).

## Next
- Screenshots/clips for the cards are being done by another agent (`assets/shots`, `assets/clips`).
- README refresh as apps land.
