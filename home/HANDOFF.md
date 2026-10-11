# Homepage handoff

## Files
- `index.html`: the finder at the top (`#app-finder`, above the carousel), app carousel (`#app-carousel`, filled by
  `home/catalog.js`), the ledge Sloppo perches on, intro (headline, call to action, trust row), the jump links
  (`#jump-links`), "Why it's different" strip, the section shelves (`#app-sections`, filled by `home/browse.js`),
  Status board, the Authenticator view (`#detector`), footer (licence and trademark line). Loads `style/*.css`,
  `home/home.css`, `shared/finder/finder.css`, the buddy CSS, `shared/apps.js`, `shared/hub.js`, `shared/urlstate/urlstate.js`,
  `shared/finder/model.js`, `finder.js`, `app-search.js`, the `slop/` engine, `app.js`, `home/sections.js`,
  `home/catalog.js`, `home/browse.js`, `motion.js` and `home/mascot/index.js` (module).
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
- `home/catalog.js`: renders the carousel, the shelves and status board from `shared/apps.js`. Another agent is adding
  hover clips (`data-clip`, `<video>`) here; coordinate before editing it.
- `home/mascot/index.js`: boots the shared Sloppo buddy with the homepage options:
  `boot({ app: 'home', defaultOn: true })`. The engine lives in `shared/buddy/` (see its HANDOFF.md).
- `slop/`: the slop text engine, split from the old 597-line `slop.js` (output is byte-identical; fingerprint test).
  Browser order: `core.js`, `gen-feeds.js`, `gen-more.js`, `engine.js`, `detect.js` (each extends `window.Slop`).
  Node: `const Slop = require('./slop/index.js')` (also sets `globalThis.Slop`).
- `style/`: `base.css` (tokens, nav, hero), `detector.css`, `footer.css` (footer, toast, responsive, motion), split
  from the old 347-line `style.css` (concatenation is identical).
- `motion.js`: the Authenticator stamp slam and the footer fill.

## App carousel (top of the homepage)
- One slide per app, built in `home/catalog.js` from `window.SLOP_APPS` (shared/apps.js), with the badge from
  `window.SLOP_ICONS` / `SLOP_ICON_BADGE` (shared/app-icons.js). Each slide: badge, name, status, the registry `tagline`,
  the first three `features`, an Open link (`href` = the app's path) and a Tour link (`?tour=1`) when the app has a tour.
- Order: `CAROUSEL_TOP` (by name), then the rest of the registry in registry order. A name missing from the registry is
  skipped. A slide with no glyph in `SLOP_ICONS` uses the card's fallback icon (`ICONS[a.icon]`).
- `TOUR_DIRS` lists the folders with a tour. Keep it in step with `TOURS` in `shared/tour/mount.js`.
- Controls: previous and next (wrap around), a "4 / 41" counter, and Pause. Dots: one button per slide, but only five around
  the current slide plus the first and last are shown (at most seven); `aria-current` marks the current one. Auto-advance every 7 seconds (`CAROUSEL_MS`). It pauses while the pointer is over the carousel or focus is
  inside it, and stops for good once a control, a dot, an arrow key or a swipe is used. Pause is hidden once stopped.
- Arrow keys work when focus is inside the region. Swipe works on touch (horizontal, more than 40px, `touch-action: pan-y`).
- `prefers-reduced-motion: reduce`: no auto-advance, no Pause button, slides change instantly.
- Accessibility: `role="region"`, `aria-roledescription="carousel"`, each slide is a group with `aria-roledescription="slide"`
  and non-current slides are `inert`. A visually hidden live region names the current slide (`aria-live` is `off` while it
  auto-advances and `polite` otherwise).
- Phone width: one slide visible, the dots wrap onto their own row. The hero headline and call to action sit below it.

## Perches
Sloppo stands on the top edges of `[data-perch]` elements: the intro title, the ledge under the carousel, the shelf headings,
every card (`data-perch="card"`, which chaos may bite, knock or blast), the status board and the footer wordmark.

## Finder and sections
- Search is at the top: a large box with a suggestion list (name and section); Enter opens the first suggestion. It is
  autofocused on desktop only. It matches name, tagline, the long description, keywords, features and folder.
- Facets (Section, File types, Status: Ready or In development, Guided tour) sit in a closed "Filter by" panel and show
  counts. Chips remove one filter each. Views: cards (the shelves themselves, so the results stay hidden until a filter
  or the list or table view is chosen), a compact list, and a table (App, Section, File types, Open; sortable).
- The filter is kept in the URL under `hp.` (`hp.q`, `hp.view`, `hp.sort`, `hp.dir`, `hp.facets`).

## Tests (`node tests/run.mjs home`)
- `tests/home/catalog.test.html` (24, incl. group labels and the carousel): every registry entry renders in its shelf, badges and
  features, the status board, tab jumps, Authenticator view switching, clicks on Sloppo are not navigation, the carousel's
  slide order, slide contents, Tour links, next, previous, wrap, dots, arrow keys, live region and the 7-second auto-advance
  (hover pause, stop after a control; this one takes about 25 seconds).
- `tests/home/mascot.test.html` (11): levels/hats/lines (pure), loads and perches, pet, level-up with hat and growth,
  drag and throw, moods, leaping back into view, view switches, lazy 3D.
- `tests/home/chaos.test.html` (12): Unleash; each chaos action is undone by Restore page; RAGE; meter.
- `tests/home/physics.test.html` (6): falls when his perch is removed or holed, Restore puts him back, knocked cards
  are rigid bodies that pile on the footer and can be ridden, cards collide.
- `tests/home/slop.test.html` (5): the slop engine API and its fingerprint.
- `tests/home/sections.test.html` (8): the six sections in order, the search above the carousel, cards, converter lines,
  Print, Experiments, jump links, and no horizontal scroll at 390 px.
- `tests/home/finder.test.html` (9): search (PDF, keywords, empty state), facets with counts, table sort, list count, URL.
- `tests/finder/finder.test.html` (9): the generic component on its own.
- `tests/node/finder-model.test.mjs` (9) and `tests/node/app-search.test.mjs` (3): the pure logic and the keyword coverage.
- `tests/home/boot.js`: loads `index.html` in an iframe (clears `slop.mascot.v1` first).

## Next
- Screenshots/clips for the cards are being done by another agent (`assets/shots`, `assets/clips`).
- README refresh as apps land.
