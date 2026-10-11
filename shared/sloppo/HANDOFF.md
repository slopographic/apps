# Refactor handoff (cards, fluid, annoying, lighter, reel, shared/sloppo)

Stopped early on coordinator request. Nothing committed by this session.

## Done

### shared/sloppo/ (single source of truth for the Sloppo painter)
- `palette.js` (BODIES, TAU, shade, rgba, star, mulberry), `body.js`, `face.js` (eyes, mouths),
  `hats.js` (HATS, OVER), `props.js`, `auras.js`, `draw.js` (drawSloppo), `index.js` (exports drawSloppo, BODIES, HATS, OVER, PROPS).
- Code was sliced from the original by line range, so it is byte-identical. Verified pixel-identical to the
  original `cards/sloppo.js` for all 60 card looks plus edge cases (3 sizes and t values, 189 renders, 0 differing pixels).
- New backwards-compatible option `look.noGlow` skips the dark radial contrast glow.
- `cards/sloppo.js` is now a 3-line re-export of `../shared/sloppo/index.js` (games still import it).

### cards/ (Slop Shots), fully refactored and working
- `cards/js/data/`: random.js, rarities.js, palettes.js, art.js, stats.js, set-basics.js, set-quest.js, set-online.js,
  pool.js (CARDS, BY_ID, SETS, byRarity), format.js, index.js. Deep-equal to the original data.js (checked in Node).
- `cards/js/art/`: shader.js (GLSL), cpu.js (CPU fallback), engine.js (ArtEngine; imports the shared painter).
- `cards/js/game/` (pure, rnd injectable, default Math.random keeps the same call order): save.js, packs.js
  (regen, checkStreak, timerText, rollSlots, rollPack, randomSerial, grant, PITY/PACK_MS/PACK_CAP), market.js,
  craft.js, achievements.js (ACH, earned, award).
- `cards/js/ui/`: dom, store, runtime, ticker, hud, toast, pack, deal, cinematic, views, collection, craft,
  detail (with the new "Send to…" button `#dSend` using SlopHub.sendMenuItems with the card PNG), portfolio, sound,
  debug, card, tilt, png, fx, sfx.
- `cards/js/main.js` boots everything in the original order and calls `SlopHub.register('shots')`.
- `cards/css/`: base, bar, stage, card, views, modals (exact split of cards.css; concatenation verified identical).
- `cards/index.html` loads the css/ files, ../shared/slopui.css, apps.js, slopui.js, hub.js, then js/main.js.
- Old cards.js, card.js, data.js, fractal.js, fx.js and cards.css were deleted (working tree only; not staged).
- Visual check: after-screenshots match the before ones (packs, dealt fan, flip, collection, craft, detail).
- All files are 300 lines or fewer (largest: cards/css/card.css, 231 lines).

### tests
- `tests/cards/pool.test.html`: 11 tests, all passing (`node tests/run.mjs cards/pool`): 60 cards, rarity counts per
  set (8/5/4/2/1), ids, stats, a fingerprint of the whole pool (`[31534, 'e7e3cf16']`, taken from the original data),
  re-import determinism, rng/hash and formatting.

## Not done

1. **Tests still to write** (each file 300 lines max):
   - `tests/cards/game.test.html`: pack odds with a seeded rnd (slots 1-3: 84/16 common/uncommon; slot 4: 74/23/3;
     slot 5: 76/19/5 rare/legendary/mythic), the rigged first pack, pity (sinceLeg >= 9 forces legendary+; never
     more than 10 packs without one), grant/dust (dupes add RARITIES[r].dust), craftCard (cost, refusal when owned or
     short of dust), market bounds (stepMarket keeps idx in [0.35, 3.2], hist <= 120, returned slices <= 60),
     earned()/award(), and save/load round-trip with a fake storage (`load(() => fakeStorage)`).
   - `tests/cards/app.test.html`: iframe `../../cards/?debug=1`, wait for `window.slopDebug`, open a pack
     (focus #pack, Enter), assert state and Send-to items, zero console errors.
   - `tests/shared/sloppo.test.html`: import `/shared/sloppo/index.js` and the cards data; every card look draws
     without throwing and paints pixels; `noGlow` leaves the corners transparent on a transparent canvas; the
     `cards/sloppo.js` exports are the same functions.
2. **fluid/**: not started. fluid.js (1228 lines, IIFE) and fluid.css (510 lines) still need splitting. Plan: ES modules
   `fluid/js/state.js` (S, PALETTES, pickColor), `gl/shaders-sim.js`, `gl/shaders-display.js`, `gl/targets.js`
   (formats, fbo, doubleFbo), `gl/engine.js` (step, render, splat with a shared context object), `gl/behave.js`
   (pour, auto bots, ambient), `cpu/engine2d.js`, `ui/*.js`, `main.js`. Add a "Send to…" button for the snapshot,
   `SlopHub.register('tank')`, and a debug hook such as `window.SlopTank = { S, engine, setAuto }`. Tests: step the
   engine and read back velocity/dye with readPixels (RGBA/FLOAT) to check values stay finite; toggle #b-auto.
3. **annoying/**: not started. annoying.js (1380 lines) and annoying.css (1047 lines). Split per stage into
   `annoying/js/stages/*.js` plus core (h(), ctx, progress, toast) and finale. Register 'unsubscribe'. Add a hook
   `window.SlopUnsub = { go, state, STAGES }`. Test each stage's fair way through via the existing data-testid
   attributes, and that #escape is visible (elementFromPoint at its centre) on every stage.
4. **lighter/**: not started (lighter.js 383 lines, lighter.css 96 lines). Split into sound, state/controls,
   particles, crowd, flame shader and loop modules. Keep `window.__lighter = S`. Note the original restores saved
   settings before `burn` is declared, so `setSound(false)` throws a TDZ error inside the try; preserve the effective
   behaviour (sound off restored). Register 'lighter'. Add "Send to…" that composites the crowd, flame (render, then
   copy in the same task) and fx canvases. Tests: lid/strike/ignite (up to 3 strikes), fuel drain (1 per 1.2s lit),
   closing the lid snuffs the flame, and mode keys/chips.
5. **reel/**: not started. `reel/index.html` does not exist yet. Create it with the `section.reel` markup from
   /index.html (lines 51-74), the head pattern from fluid/index.html, the import map
   (`"three": "../vendor/three/three.module.min.js"`, `"three/addons/": "../vendor/three/addons/"`), gsap at
   ../vendor/gsap/gsap.min.js, a home link and a `reel/css/page.css` holding the tokens reel.css needs (--mono,
   --bone, --bone-dim, --bone-faint, --line, --slop, --chrome, --cond, --serif, --top; values are in /style.css lines
   2-16). Split reel.js (958 lines) into reel/js/* modules. Keep reel/reel.js as the entry because the current
   homepage loads it. Asset URLs use import.meta.url, so adjust the relative paths in moved files ('../../assets/…').
   Move the HUD scoring (combo, xp, need = 3 + lv*2) into a pure score.js for tests. Register 'reel'.
6. Final `wc -l` audit and a full `node tests/run.mjs` for each filter.

## How to test
- `node tests/run.mjs cards` (and later fluid, annoying, lighter, reel, sloppo). The runner serves the repo itself.
- Reference screenshots and tools are in this session's scratchpad (may not persist):
  `shots.cjs <label> [cards,fluid,...]` (seeded Math.random, before shots in shots/before),
  `cmp-sloppo.cjs` (pixel comparison of the painter against orig/), and orig/ (copies of the untouched sources).
  If the scratchpad is gone, the originals are in git history from before this refactor.
