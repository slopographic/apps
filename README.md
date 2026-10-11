# Slopographic

A 3D studio for slop. Live at **[slopographic.com](https://slopographic.com)**.

Everything is static files: no backend, no accounts, no build step. Each room is its own folder.

| Page | What it is |
|---|---|
| `/` | **The reel**: a real-time three.js showreel starring **Sloppo**, a glossy slime creature living half-sunk in a pool of goo. Chrome 3D letters rise dripping out of the pool, stretch to SLOOOOOOP and get gulped. It loops on a GSAP timeline with a player bar. Poke Sloppo to make him squish and giggle; stroke the pool to make ripples. Below the reel is a grid of the rooms. |
| `/paint/` | **Slop Paint**: an MS Paint clone with all 16 classic tools, menus, undo/redo, open/save PNG and touch support, plus a Slop Brush, emoji stamps and SLOPIFY. |
| `/fluid/` | **Slop Tank**: a real-time GPU fluid simulation of glossy slime. Stir it, splat it, Space to pour, switch palettes, save a snapshot. |
| `/cards/` | **Slop Shots**: a holographic card game. 60 cards with fractal art, five rarities, pack reveals, crafting, achievements and a parody $SLOP market. Progress saves in the browser. |
| `/annoying/` | **Unsubscribe**: 11 stages of dark patterns, each with a fair way through and an always-visible exit. |
| `/#detector` | **The Authenticator**: paste any text and get a slop certificate with a score, verdict and highlighted tells. |

## Files (home page)

| File | What it does |
|---|---|
| `index.html` | Page shell, nav, reel overlay, rooms grid, Authenticator |
| `style.css` | Styles |
| `reel.js` | The 3D reel (ES module): Sloppo, the goo pool shader with ripples, chrome letters, drops, timeline, interaction |
| `app.js` | Routing (`#detector`), the live counter and the Authenticator |
| `slop.js` | Text generators and the slop-detector rules (no DOM; also runs in Node) |
| `motion.js` | Small site-wide effects (stamp slam, footer fill) |
| `vendor/` | three.js r170 (MIT) and GSAP 3.13 (standard no-charge license), vendored with their license headers |
| `CNAME` | Custom domain for GitHub Pages |

## Run locally

```sh
npx http-server . -p 8080   # or: python3 -m http.server 8080
```

## Deploy (GitHub Pages)

Pages serves this branch from the repo root:

1. **Settings → Pages → Source: Deploy from a branch**, pick the branch, folder `/ (root)`.
2. **Custom domain:** `slopographic.com` (already in `CNAME`), with **Enforce HTTPS** on.
3. **DNS** at your registrar: `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and a `CNAME` for `www` → `slopographic.github.io`.
