# Homepage handoff

## Files
- `index.html`: the hero (`#hero`: kicker, headline, buttons, meta line, the keyboard list `.gx-nav`, the globe's box `.gx-box`, the ledge Sloppo
  perches on), the capability strip (between `<!-- site:marquee -->` markers, written by `tools/seo/write.mjs`), the
  finder (`#app-finder`), the jump links (`#jump-links`), workspaces, "Why it's different" strip (with the video link), the section shelves (`#app-sections`, filled by `home/browse.js`),
  Status board, the Authenticator view (`#detector`), footer (licence and trademark line). Loads `style/*.css`,
  `home/home.css`, `shared/finder/finder.css`, the buddy CSS, `shared/apps.js`, `shared/hub.js`, `shared/urlstate/urlstate.js`,
  `shared/finder/model.js`, `finder.js`, `app-search.js`, the `slop/` engine, `app.js`, `home/sections.js`,
  `home/catalog.js`, `home/browse.js`, `home/globe/sphere.js`, `home/globe/paint.js`, `home/globe/labels.js`, `home/globe/globe.js`,
  `home/globe/drag.js`, `home/globe/list.js`, `home/marquee.js`, `motion.js` and
  `home/mascot/index.js` (module). `home/hero.css` styles the hero, the strip and the numbered headings; `home/globe/globe.css` the globe.
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
  badge every icon on the page uses (the globe too). Another agent is adding
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
- Layout: the copy on the left and the app globe on the right on wide screens (900 px and up); on phones the globe sits
  above the centred copy. Chosen over the globe behind the text (icons crossing the headline, too busy) and a larger
  globe bleeding off the right edge (crowded, pushed the strip below the fold). There is no wordmark: the header carries
  the name and the kicker line repeats it on wide screens.
- Copy: kicker, headline (the page's only h1 in the home view; with the sub-line, the largest paint, before the globe
  starts), sub-line, Open the apps (`[data-to-finder]`: home/browse.js scrolls to the finder and focuses its search),
  How it works, meta line. Every string has a `hero.*` key in shared/i18n (all seven languages).
- App globe (`home/globe/`): `sphere.js` is the pure maths (tiers, Fibonacci and weighted spheres, rotation,
  perspective, depth looks, spin with inertia damping, seek and frontOf to bring an icon to the front, centroid and zoom
  for search results, keep-out, the wireframe grid; node-tested in tests/node/globe-sphere.test.mjs). `paint.js` draws
  the canvas (halo, body, rim, turning wireframe in the theme's ink and accent). `globe.js` places the icon links (true
  perspective via translate and scale; depth bands far2/far1/mid/near for blur and glow), runs the turn and reacts to
  the finder; `drag.js` is drag-to-spin with inertia (touch-action: pan-y keeps vertical scroll); `list.js` is the
  keyboard list `.gx-nav` (one tab stop, arrow keys; the focused app comes round to the front). `labels.js` names icons
  without hovering: at rest the few front-most, near-centre icons (5 wide, 3 at phone width), while searching the matches
  on the near side (12 / 6), marked with the accent (`is-match` on label and icon). Pure `pick` (greedy, best first, no
  overlaps with each other, the copy, a hovered icon's chip or the hero's edges; a shown label holds on a little longer
  so it does not flicker; widths estimated from the monospace text, never measured) is node-tested in
  tests/node/globe-labels.test.mjs. A small pool of `.gx-tag` spans in the aria-hidden layer moves by transform only; the
  text changes only when a span takes another app; the fade is a CSS transition on `is-on` (none under reduced motion).
  The text is the icon's accessible name, so a plain-names profile shows its own names.
- Icon sizes come from `weight` in shared/apps.js (2 for the apps most people come for): those are 1.7 times larger
  and sit round the equator, so they pass the front on every turn; the finder also lists them first when nothing is
  searched (home/browse.js rank).
- Finder link: home/browse.js sends the finder's own result (`slop-home-filter`, `{ ids, filtered }`; also
  `SlopHomeBrowse.result()`); the globe never matches by itself. Matches stay bright and grow, the rest fade and shrink,
  the globe leans in (zoomFor) and turns the matches' centre (leaning to the finder's first match) to the front; one
  match comes square to the front, larger, with its name; no match dims it with "No apps match"; clearing restores the
  turn. Reduced motion or an off-screen hero: the end state at once.
- Tiers: full (every app, 60 fps, starts 0.7 s after load when idle), lite (28 icons, 20 fps, no filters, lines
  repainted only when they would visibly lag, no frames while scrolling, starts 2 s after load or at the first tap:
  phones, touch, 4 cores or fewer, 4 GB or less, Save-Data), static (reduced motion: every app, no turn, no drag).
  It runs only while the hero is on screen and the tab is visible. `window.SlopGlobe` (state, frames, startedAt, tier,
  view, icons, focusApp, reduce, pause) is for the tests and list.js.
- Capability strip: `tools/seo/marquee.mjs` (one label per app from its title, File convert as its number of
  conversions), scrolled by CSS, paused on hover or focus, still under reduced motion. Each label links to its app
  (`data-id`); the aria-hidden copy's links are tabindex -1. `home/marquee.js`: one tab stop with arrow keys, hover or
  focus turns the globe to the app (SlopGlobe.focusApp: highlight and name chip), and a plain-names profile shows
  slopAppName. Run `node tools/seo/write.mjs` after
  changing the registry (tests/node/home-marquee.test.mjs fails when index.html is stale).

## Live regions
- `[data-live]` marks a region that changes on its own after load: the globe's layer (`.gx-layer`, added by globe.js,
  turning every frame) and its keyboard list (`.gx-nav`, filled when the globe starts). The globe keeps all of its
  changing state inside them and never touches the hero's own attributes. Page snapshots leave them out: the Unleash
  and Restore checks in tests/home/chaos.test.html compare `main` without `[data-live]`, with the globe turning.

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
- `tests/home/hero-labels.test.html`: front labels (count, no overlap, not over the headline, come and go, pool size,
  hero attributes untouched), search labels, the hovered icon, reduced motion, 390 px. `tests/home/hero-marquee.test.html`:
  the strip's links, keyboard, globe focus, pause, plain names.
- `tests/home/hero-search.test.html`: the globe follows the finder (pdf, one match, no match, clearing, reduced motion), icon
  sizes and the finder's default order from the registry weights.
- `tests/home/hero.test.html` (1280 and 390 px, Light and Dark): the headline the largest paint before the globe, above
  it with no icon shown over it, the layout, the globe turning, stopping in a hidden tab or off screen, still for reduced
  motion, drag and fling, the strip from the registry, no sideways scroll. `tests/home/hero-links.test.html`: icons as named links, hover brings to front, the keyboard
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
