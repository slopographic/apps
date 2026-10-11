# Slopographic: plan, status and how to continue

## The goal
slopographic.com started as an AI-slop meme site. It is becoming a **professional studio of creative apps that run 100% in the browser**: no installs, no accounts, no uploads, and each app can be downloaded as one offline `.html` file. Alongside the apps sit **games starring Sloppo** (the jelly-slime mascot) and **experiments**. All apps share one file drive and can send work to each other.

## Where things are
- **Repo:** `slopographic/slopographic`. Static site, no build step. GitHub Pages, CNAME `slopographic.com`.
- **Branch:** work on `main`, which has single-author history.
  - The old `claude/awesome-cannon-8azcvd` branch still serves the live site until Pages is switched. Every commit pushed to it was a fast-forward copy of `main`.
  - To finish the move: Settings → Default branch = `main`; Settings → Pages → branch `main` / root; then delete the old branch.
- **Commit identity:** `slopographic <340656300+slopographic@users.noreply.github.com>`. No Co-Authored-By lines, no session lines, no attribution.
- **Tests:** `npm test`, i.e. `node tests/run.mjs [filter]`. It serves the repo, runs every `tests/**/*.test.html` in headless Chromium, and runs `tests/node/*.test.mjs` with `node --test`.
  - Harness: `tests/harness.js` (`SlopTest.describe/it/expect/waitFor`).
  - Pattern: load the app in a same-origin iframe, then reach its globals via `win.eval`.
- **Each app folder has its own `HANDOFF.md`** with that app's details. Read it before working on the app.

## House rules (from the owner)
1. **At most 300 lines per source file.** Split into package folders: `js/core`, `js/io`, `js/ui`, … PhotoSLOP is the model.
2. **One shared kit, one source of truth:**
   - `shared/apps.js`: the registry of every app, game and experiment (`window.SLOP_APPS`: id, kind, name, path, tagline, status `live|beta|building`, accepts, features, shot). The homepage and the "Send to…" menus render from it. **To change a status, edit only this file.**
   - `shared/slopui.js` + `.css`: dialogs, confirm/prompt, menus, toasts and file pickers. Every app uses these instead of its own modals.
   - `shared/hub.js` (`window.SlopHub`):
     - Slop Drive: a shared IndexedDB file store.
     - A BroadcastChannel bus.
     - `sendTo(app, blob)`, which opens `app/?drive=<id>`.
     - `consumeLaunch()`, `pickFromDrive()` and `register(appId)`.
   - `shared/sloppo/`: the 2D Sloppo painter, an ES module: `drawSloppo(ctx, W, H, look, t)`.
3. **Every app has tests** under `tests/<app>/`.
4. **Commit often.** Credit can run out mid-task.

## Status
| Area | Folder | State |
|---|---|---|
| **Homepage** | `index.html`, `home/`, `app.js`, `style.css` | Rebuilt professionally: intro, then Apps, Games, Experiments, and a Status board, all rendered from `shared/apps.js`. The Authenticator view (`#detector`) is kept. |
| PhotoSLOP (Photoshop) | `paint/` | Live. 27 tests green. Packages under `js/{core,io,filters,tools,brushes,ui,app}` plus `css/`; Slop Hub wired in. |
| Slop Vector (Illustrator) | `vector/` | Built; SlopUI/hub migration was in progress. See `vector/HANDOFF.md`. |
| Slop PDF | `pdf/` | Beta, in progress. See `pdf/HANDOFF.md`. |
| SlopLabel (NiceLabel replacement) | `label/` | In progress. See `label/HANDOFF.md`. |
| WWW 2100 | `2100/` | In progress. See `2100/HANDOFF.md`. |
| Games | `games/{platformer,sloppo-bird,runner,star-defender,tower-defense}` | In progress. See each game's `HANDOFF.md`. |
| Slop Shots, Tank, Lighter, Reel, Unsubscribe, Paint Classic | `cards/`, `fluid/`, `lighter/`, `reel/`, `annoying/`, `paint/classic/` | Live. The refactor into the shared Sloppo package is noted in `shared/sloppo/HANDOFF.md`. |

## Next steps, in priority order
1. **Finish each in-progress app** using its own `HANDOFF.md`. When one is solid, flip its `status` in `shared/apps.js`.
2. **Homepage Sloppo mascot.** Not built yet; it was planned as `home/mascot/*.js` ES modules (each ≤300 lines) plus `home/mascot/mascot.css`, loaded with `<script type="module" src="home/mascot/index.js">`.
   - **Look:** a small 2D Sloppo (~72 px), drawn with `drawSloppo(..., { noGlow: true })` from `shared/sloppo/index.js`.
   - **Moving around:**
     - He is absolutely positioned in page coordinates, so he scrolls away with the page.
     - He hops between perches: the top edges of `[data-perch]` elements (headings, cards and the intro stage ledge are already marked).
     - When his perch has been off-screen for about 1.5 s, he leaps back into view.
   - **Interaction:** click to pet (hearts, XP). Drag and throw him with physics: he lands on any perch top he falls through.
   - **Mood faces:** heart/happy eyes when petted, `o` mouth in the air, spiral eyes after a hard throw, angry eyes with fangs in chaos mode.
   - **Levels:**
     - XP is stored in localStorage; level = 1 + floor(sqrt(xp / 8)).
     - He gets slightly bigger each level.
     - Each level unlocks a hat (`HATS` in `shared/sloppo/hats.js`: crown, wizard, ninja, …). A small HUD shows the level and an XP bar.
   - **"Unleash" chaos mode:**
     - He bites cards (CSS radial-gradient masks).
     - He eats letters from headings (wrap characters in spans, fly them into his mouth).
     - He knocks cards off the page (fall with gravity and rotation).
     - He splats goo.
     - Every change is recorded so **"Restore page"** can undo it all.
   - Respect `prefers-reduced-motion`: no automatic hopping.
3. **Screenshots** for the homepage cards: capture each app with Playwright into `assets/shots/<id>.jpg`, about 1280×800 at JPEG quality 80. The cards already load these and fall back to a generated tile until they exist.
4. **Remaining 300-line splits:**
   - `slop.js` (597 lines): split into a folder and keep the Node export the tests use.
   - `style.css` (347 lines).
   - Check with `find . -name '*.js' -not -path './vendor/*' -not -path './node_modules/*' | xargs wc -l | sort -n | tail`.
5. **Tests to add:** the homepage (catalog renders every registry entry; nav jumps work), `shared/hub.js` (put/get/list/sendTo) and `shared/slopui.js`.
6. **README:** rewrite for the new structure (apps, shared kit, tests, hub).

## How to continue in a new session
1. Clone the repo and check out `main`.
2. Read this file, then the `HANDOFF.md` in the folder you'll work on.
3. Run `npm test` first so you know the baseline.
4. Set the git identity:
   ```
   git config user.name slopographic
   git config user.email 340656300+slopographic@users.noreply.github.com
   ```
5. Commit small, push often, and add no attribution lines.
