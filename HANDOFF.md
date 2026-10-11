# Handoff: where the work stands

Branch: `main` (single author history). Commit as `slopographic <340656300+slopographic@users.noreply.github.com>`, with no Co-Authored-By or session lines.
The old `claude/awesome-cannon-8azcvd` branch is superseded; delete it once GitHub Pages serves `main`.
Tests: `npm test` (or `node tests/run.mjs <filter>`); needs Playwright Chromium.

## Rules the owner set
- Every source file at most 300 lines; group code in package folders.
- Apps share code through `shared/`: `slopui.js` (dialogs, menus, toasts), `apps.js` (app registry, the single source of truth), `hub.js` (Slop Drive + "Send to…").
- Every app has tests under `tests/<app>/`.
- Sloppo is the mascot: jelly look; the 2D painter lives in `cards/sloppo.js` (moving to `shared/sloppo/`).

## Status
| Area | State |
|---|---|
| PhotoSLOP `paint/` | Done, 25 tests green, split into packages `js/{core,io,filters,tools,brushes,ui,app}` + `css/`. TODO: wire hub (register, `consumeLaunch`, Open from Slop Drive, Send to). |
| Slop Vector `vector/` | Built; SlopUI/hub migration in progress. |
| Slop PDF `pdf/` | In progress (organise, edit, sign). |
| SlopLabel `label/` | In progress (NiceLabel replacement: barcodes, CSV merge, ZPL). |
| WWW 2100 `2100/` | In progress. |
| Games `games/*` | Platformer, Sloppo Bird, runner, Star Defender, tower defense: in progress. |
| Homepage `index.html` | TODO: rebuild professionally. Apps on top, then Games and Experiments, rendered from `shared/apps.js`; a "what's new" status board; screenshots in `assets/shots/<id>.jpg`; a small 2D Sloppo that hops between headings and cards, levels up (XP in localStorage) and has an "unleash" mode that attacks the page, plus a restore button. No "rooms". The 3D reel moved to `reel/`. |
| README | TODO: update for the new structure. |
