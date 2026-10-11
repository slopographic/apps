# Slopographic: plan, status and how to continue

## The goal
slopographic.com is a **studio of professional creative apps that run 100% in the browser**: no installs, no accounts, no uploads, **no watermarks**, and each app can be downloaded as one offline `.html` file. All apps share one local file drive (Slop Drive) and can send work to each other. Sloppo™ (the goo mascot) can ride along in every app, Clippy-style.

The **games and experiments** (Sloppo Land, Sloppo Bird, Sloppo Run, Star Defender, Goo Pool Defense, Slop Shots, WWW 2100, Slop Tank, Slop Lighter, Sloppo Reel, Unsubscribe) moved on 2026-10-11 to the **private repo `slopographic/games`**, served at **games.slopographic.com**. This repo's history was rewritten to remove them. Their registry entries here point there, and the old paths (`/games/*`, `/shots/`, `/cards/`, `/tank/`, `/fluid/`, `/lighter/`, `/reel/`, `/unsubscribe/`, `/annoying/`, `/2100/`) are redirect stubs.

## Where things are
- **Repo:** `slopographic/slopographic`. Static site, no build step. GitHub Pages, CNAME `slopographic.com`.
- **Branch:** work on `main`.
  - The old `claude/awesome-cannon-8azcvd` branch still serves the live site until Pages is switched. Publish with:
    `T=$(git commit-tree "main^{tree}" -p origin/claude/awesome-cannon-8azcvd -m "Publish main") && git push origin $T:refs/heads/claude/awesome-cannon-8azcvd`
  - To finish the move (owner, on GitHub): Settings → Default branch = `main`; Settings → Pages → branch `main` / root; then delete `claude/awesome-cannon-8azcvd` and `claude/pensive-faraday-r5n143`.
- **Commit identity:** `slopographic <340656300+slopographic@users.noreply.github.com>`. No Co-Authored-By, no session lines, no attribution of any kind.
- **Tests:** `npm test`, i.e. `node tests/run.mjs [filter]` (headless Chromium via Playwright; harness `tests/harness.js`).
- **Each folder has its own `HANDOFF.md`.** Read it before working there.
- **License:** code MIT (`LICENSE`); Sloppo art all rights reserved (`LICENSE-ART`, lists the files); brand policy in `TRADEMARKS.md`.

## House rules (from the owner)
1. **At most 300 lines per file** (JS, CSS, HTML, tests). Split into package folders like `photoslop/js/{core,io,ui,...}`.
2. **Use the shared kit, never duplicate it** (see below). `shared/apps.js` is the only place to change an app's status.
3. **Every app has tests** under `tests/<app>/`. Keep them green before pushing.
4. **Commit and push often.** Credit can run out mid-task.
5. 100% in the browser, no CDNs, no external requests (fonts are self-hosted), no build step.

## Shared kit (`shared/`)
| Package | Global / API | Notes |
|---|---|---|
| `apps.js` | `window.SLOP_APPS` | Registry: id, kind, name, path, tagline, status `live|beta|building`, accepts, creates, features, shot, icon |
| `slopui.js/.css` | `SlopUI` | Dialogs, menus, toasts, pickers |
| `hub.js` + `drive/` | `SlopHub` | Slop Drive (IndexedDB, folders, trash), Send to, `?drive=` launch, pickers, save back |
| `backup/` | `SlopBackup` | One-file `.slop` export/import of all local data |
| `guard.js` | `SlopGuard` | Hard-reload reminder + unsaved-work prompt (on every page) |
| `commands/` | `SlopCmd` | Spotlight palette (⌘K) and rebindable shortcuts; see its HANDOFF |
| `buddy/` | boot.js | Sloppo assistant; one `<script type="module">` line per page, off by default in apps |
| `guides/` | `SlopGuides` | GuideGuide-style guides/grids panel and engine |
| `fonts/` | fonts.css | Self-hosted woff2 (+ ttf for PDF embedding); link with `data-offline="strip"` |
| `office/` | zip/xml/units | Shared OOXML/ODF helpers for Docs/Tables/Slides |
| `ai/` | `SlopAI` | Local LLM (WebLLM) engine, sysinfo, side panel |
| `cutout/` | `SlopCutout` | On-device background removal (ONNX Runtime Web, Apache-2.0 models in `vendor/models/`) |
| `rewards/` | `SlopRewards` | Slop Tokens wallet (used by the games repo; a copy lives there) |
| `sloppo/` | `drawSloppo` | 2D Sloppo painter (art, see LICENSE-ART) |

## Status
| App | Folder | Status | State |
|---|---|---|---|
| Homepage | `index.html`, `home/`, `app.js`, `style/`, `slop/` | live | Catalog with screenshots and hover clips, Sloppo buddy, status board, Authenticator |
| PhotoSLOP | `photoslop/` (Classic: `photoslop/classic/`) | live | Guides, commands, type-property fix. Next: Layer Style dialog, double-click actions, right-drag brush sizing |
| Slop Vector | `vector/` | live | Guides, commands. Next: double-click/isolation, text property check |
| Slop PDF | `pdf/` | live | Redaction, thumbnail slider, commands. Next: page-switch flash fixes (see pdf/HANDOFF) |
| SlopLabel | `label/` | beta | Needs real printer checks |
| Slop Drive | `drive/` | beta | Folders, 6 views, duplicates, backup, New ▸ menu |
| Slop AI | `ai/` | beta | Never run with a real model yet |
| Slop Press | `press/` | beta | Keep-with-next bug open |
| SlopEdit | `slopedit/` | beta | MediaRecorder fallback unverified |
| Slop Cutout | `cutout/` | building | Engine done and tested; app UI half-built (page currently errors) |
| Slop Docs | `docs/` | building | Layout engine + fonts done; no UI yet |
| Slop Tables | `tables/` | building | Formula engine (324 functions) done; no UI yet |
| Slop Slides | `slides/` | building | Model + renderer done; editor half-written; no page yet |
| Promo | `promo/`, `tools/capture/` | — | Live page done; MP4 render not run (see tools/capture/HANDOFF) |

## Next steps, in priority order
1. Finish the `building` apps from their HANDOFFs: Cutout UI, then Docs, Tables, Slides.
2. PhotoSLOP/Vector follow-ups listed in their HANDOFFs.
3. Slop PDF flash fixes, then a frame-sampling regression test.
4. Render the promo video and capture missing screenshots (`tools/capture/HANDOFF.md`); game recipes now need the games.slopographic.com base URL or removal.
5. README refresh as apps land.

## How to continue in a new session
1. Clone the repo, check out `main`, read this file and the folder's HANDOFF.md.
2. `git config user.name slopographic` and `git config user.email 340656300+slopographic@users.noreply.github.com`.
3. Run `npm test` for the baseline.
4. Commit small, push to `main` often, add no attribution lines.
