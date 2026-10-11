# Homepage handoff

## Files
- `index.html`: intro, Apps / Games / Experiments shelves, Status board, the Authenticator view (`#detector`), footer
  (licence and trademark line). Loads `style/*.css`, `home/home.css`, the buddy CSS, `shared/apps.js`, `shared/hub.js`,
  the `slop/` engine, `app.js`, `home/catalog.js`, `motion.js` and `home/mascot/index.js` (module).
- `app.js`: routing (home vs `#detector`), the live counter and the Authenticator. Clicks only count as navigation on
  real `[data-view]` links (the `<body>` carries `data-view` as state).
- `home/catalog.js`: renders the shelves and status board from `shared/apps.js`. Another agent is adding hover clips
  (`data-clip`, `<video>`) here; coordinate before editing it.
- `home/mascot/index.js`: boots the shared Sloppo buddy with the homepage options:
  `boot({ app: 'home', defaultOn: true })`. The engine lives in `shared/buddy/` (see its HANDOFF.md).
- `slop/`: the slop text engine, split from the old 597-line `slop.js` (output is byte-identical; fingerprint test).
  Browser order: `core.js`, `gen-feeds.js`, `gen-more.js`, `engine.js`, `detect.js` (each extends `window.Slop`).
  Node: `const Slop = require('./slop/index.js')` (also sets `globalThis.Slop`).
- `style/`: `base.css` (tokens, nav, hero), `detector.css`, `footer.css` (footer, toast, responsive, motion), split
  from the old 347-line `style.css` (concatenation is identical).
- `motion.js`: the Authenticator stamp slam and the footer fill.

## Perches
Sloppo stands on the top edges of `[data-perch]` elements: the intro title, the intro stage ledge, the shelf headings,
every card (`data-perch="card"`, which chaos may bite, knock or blast), the status board and the footer wordmark.

## Tests (`node tests/run.mjs home`)
- `tests/home/catalog.test.html` (11): every registry entry renders in its shelf, badges and features, the status
  board, tab jumps, Authenticator view switching, and clicks on Sloppo are not navigation.
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
