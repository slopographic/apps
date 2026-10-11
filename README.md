# Slopographic

A 3D studio for slop. Live at **[slopographic.com](https://slopographic.com)**.

Creative apps that run 100% in your browser: no installs, no accounts, no uploads, no watermarks. Static files, no backend, no build step. Each app is its own folder and can be downloaded as one offline `.html` file.

| Path | App |
|---|---|
| `/photoslop/` | **PhotoSlop**: Photoshop-style editor (layers, masks, PSD, filters, brushes, guides). Classic MS Paint clone at `/photoslop/classic/` |
| `/slopvector/` | **SlopVector**: Illustrator-style vector editor (pen, shapes, type, pathfinder; SVG/PNG/PDF) |
| `/pdf/` | **Slop PDF**: organise, annotate, fill, sign and truly redact PDFs |
| `/label/` | **SlopLabel**: barcode label designer (ZPL/EPL/TSPL, data merge, PDF) |
| `/press/` | **Slop Press**: InDesign-style layout with print-ready PDF |
| `/slopcut/` | **SlopCut**: multi-track video editor with WebCodecs export |
| `/drive/` | **Slop Drive**: the local drive every app shares, with one-file backup |
| `/ai/` | **Slop AI**: chat with a model running on your own GPU |
| `/slopisolate/`, `/docs/`, `/tables/`, `/slides/` | In development: background remover, word processor, spreadsheet, presentations |
| `/#detector` | **The Authenticator**: get any text certified as slop |

Each folder has its own `HANDOFF.md`. Tests: `npm test`.

## Run locally

```sh
npx http-server . -p 8080   # or: python3 -m http.server 8080
```

## Deploy (GitHub Pages)

Pages serves this branch from the repo root:

1. **Settings → Pages → Source: Deploy from a branch**, pick the branch, folder `/ (root)`.
2. **Custom domain:** `slopographic.com` (already in `CNAME`), with **Enforce HTTPS** on.
3. **DNS** at your registrar: `A` records for `@` → `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and a `CNAME` for `www` → `slopographic.github.io`.

## License
- **Code:** MIT, see [`LICENSE`](LICENSE).
- **Sloppo character art:** all rights reserved, see [`LICENSE-ART`](LICENSE-ART).
- **Brand:** Slopographic™ and Sloppo™ are trademarks; see [`TRADEMARKS.md`](TRADEMARKS.md). Forks must rename and use their own mascot.
- **Third-party code** in `vendor/` keeps its own license.

