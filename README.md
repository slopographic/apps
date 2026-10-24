# Slopographic

A 3D studio for slop. Live at **[slopographic.com](https://slopographic.com)**.

A studio of browser apps for creative work and for running a small business. Live at **[slopographic.com](https://slopographic.com)**.

Everything runs 100% in your browser: no installs, no accounts, no uploads, no watermarks. Static files, no backend, no build step. Each app is its own folder and can be downloaded as one offline `.html` file. Your files stay on your device, or in Slop Drive, the local drive every app shares.

### Creative

| Path | App |
|---|---|
| `/photoslop/` | **PhotoSlop**: layers, masks, filters, brushes and guides; PSD support. Classic MS Paint clone at `/photoslop/classic/` |
| `/slopvector/` | **SlopVector**: pen, shapes, type and pathfinder; SVG, PNG and PDF export |
| `/pdf/` | **Slop PDF**: merge, split, sign, annotate, fill and truly redact PDFs |
| `/press/` | **Slop Press**: page layout and print-ready PDF |
| `/slopcut/` | **SlopCut**: multi-track video editor with WebCodecs export |
| `/slides/` | **Slop Slides**: presentations in PowerPoint and Keynote style |
| `/docs/` | **Slop Docs**: word processing, Word and Google Docs style |
| `/tables/` | **Slop Tables**: spreadsheets, Excel and Sheets style |
| `/3d/`, `/img3d/` | **Slop 3D**: a 3D editor for simple models and scenes; **Image to 3D** |
| `/effects/` | **Slop Effects**: motion design |
| `/slopisolate/`, `/upscale/`, `/resize/`, `/watermark/` | **SlopIsolate** (remove backgrounds), **Upscale** (sharper pictures), **Resize**, **Watermark** |
| `/label/` | **SlopLabel**: barcode labels, GS1 and ZPL |
| `/qr/` | **QR SLOP**: QR codes for links, Wi-Fi and contacts |
| `/remix/` | **Reel Remix**: a random video edit from your clips |
| `/music/`, `/gallery/` | **Slop Music** and **Slop Gallery**: your audio and photo libraries |

### Business

| Path | App |
|---|---|
| `/slop-365/` | **Slop 365**: invoices, orders, CRM and ledger in one place |
| `/invoices/` | **Slop Invoices**: gapless invoices, payments and a ledger |
| `/orders/` | **Slop Orders**: orders from draft to fulfilment |
| `/crm/` | **Slop CRM**: customers, pipeline and follow-ups |
| `/ledger/` | **Slop Ledger**: double-entry books and trial balance |
| `/inventory/` | **Slop Inventory**: stock, barcodes and reorder alerts |
| `/reports/` | **Slop Reports**: unpaid invoices, groups and follow-ups |
| `/contacts/` | **Slop Contacts**: vCard and CSV address book |
| `/calendar/`, `/todo/`, `/reminders/`, `/time/` | **Calendar**, **To-do**, **Reminders** and **Time**: schedule, tasks, reminders, world clock and meetings |
| `/notes/`, `/paste/` | **Slop Notes** (Markdown notebooks) and **Paste** (share text, code and images by link) |
| `/calculator/`, `/nodes/`, `/serials/` | **Slopculator**, **Slopnodes** and the **Serial counter** |
| `/transcribe/` | **Slop Transcribe**: voice, MP3 and video to text on the device (Whisper), corrected and saved as TXT, Word, SRT or VTT |
| `/ocr/`, `/aitools/`, `/ai/` | **Slop OCR**, **AI Tools** (OCR, transcription, denoise) and **Slop AI** (chat with a model on your own computer) |

### Utilities

| Path | App |
|---|---|
| `/drive/` | **Slop Drive**: every file from every app in one drive, with one-file backup |
| `/convert/` | **File convert**: image, PDF, mail, calendar and data converter |
| `/eml/`, `/hex/`, `/checksum/`, `/clean/`, `/code/` | **Slop EML** (email files), **Hex**, **Checksum**, **SlopClean** (hidden photo data) and **Slop Code** |
| `/admin/`, `/settings/`, `/how-it-works/` | Company profile and backup, profile and settings, and how the storage works |
| `/#detector` | **The Authenticator**: get any text certified as slop |

Each app folder has its own `HANDOFF.md` with notes for whoever works on it. Tests: `npm test`.

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


## Contributing

Run `npm install` once in a clone. Its `prepare` script switches on the commit hooks in `.githooks/`, which refuse commits not authored as Slopographic and commit messages that carry Claude attribution. Check with `node --test tests/node/attribution.test.mjs`.

### Rules for every change

Checked by the hooks (pre-commit on the staged files, pre-push on the pushed commits) and by CI (`.github/workflows/rules.yml`), with `tools/check-rules.mjs`:

1. **At most 300 lines per source file** (`.js`, `.mjs`, `.css`, `.html`). Split a longer file into modules. `vendor/`, minified files and the generated precache lists are exempt.
2. **Every new or changed script has a test that names it** by its repo path: the test loads it (a script `src` or an `import`), or its header has a `Covers: <path>` line when it tests the file through its app page.

`node tools/check-rules.mjs --all` checks rule 1 on the whole repo; `--staged`, `--range A..B` and `--files <paths>` check both. The pre-push hook also runs the Node tests (Node 20 or later). Tests run on Node 22, as in CI.

Offline copies follow the files: the pre-commit hook regenerates the precache list and the service worker `VERSION` (`tools/pwa-precache.mjs`; see `shared/pwa/HANDOFF.md`).
