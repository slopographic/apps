# Homepage handoff

## Files
- `index.html`: app carousel (`#app-carousel`, filled by `home/catalog.js`), the ledge Sloppo perches on, intro (headline,
  call to action, trust row), "Why it's different" strip, Slop 365 and Creative Slop shelves (under `#apps`),
  Status board, the Authenticator view (`#detector`), footer
  (licence and trademark line). Loads `style/*.css`, `home/home.css`, the buddy CSS, `shared/apps.js`, `shared/hub.js`,
  the `slop/` engine, `app.js`, `home/catalog.js`, `motion.js` and `home/mascot/index.js` (module).
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
- `tests/home/boot.js`: loads `index.html` in an iframe (clears `slop.mascot.v1` first).

## Next
- Screenshots/clips for the cards are being done by another agent (`assets/shots`, `assets/clips`).
- README refresh as apps land.
