# The desktop app

The whole suite as an app for Windows, macOS and Linux: [Electron](https://www.electronjs.org/) around a copy of this
site. Electron is Chromium, so WebGPU, WebCodecs, WASM, the File System Access API, IndexedDB and OPFS behave exactly as
on the website in Chrome. The site itself stays a static site with no build step: this folder has its own
`package.json`, and nothing here runs on an ordinary push (the rules workflow never installs Electron).

Installers are never committed. GitHub Actions builds them (`.github/workflows/desktop.yml`) and attaches them to a GitHub
Release.

## How it works

| Part | File |
| --- | --- |
| The site, copied in at build time (`git ls-files` minus tests, tools, workflows, other-language SEO copies, `best/`, `compare/`, sitemaps and other website-only root files) | `lib/bundle-list.js`, `scripts/bundle.mjs` |
| Served from `app://slop/` (standard, secure, fetch, CORS, streams), with folder index pages, `404.html` and byte ranges for media. No COOP/COEP headers: the website sends none, and `require-corp` would block the CDN files | `main/protocol.js`, `lib/paths.js` |
| No service worker in the app: `shared/pwa.js` skips it under `app:` (the files are on disk already). CDN files (models, wasm, fonts: `shared/cdn/assets.js`) still download as on the website | `shared/pwa.js` |
| The window: `contextIsolation`, `sandbox` and `webSecurity` on, no Node in pages. The preload exposes only `window.SlopDesktop` and `window.launchQueue` | `main/main.js`, `main/preload.js` |
| Links: pages the app carries stay in it, other site pages open on the website, `http(s)`/`mailto` in the default browser | `main/navigation.js` |
| Menu: File ▸ Open…, Home, Slop Drive; Edit; View (zoom, full screen); Window; Help (About, website, Check for Updates…) | `main/menu.js` |
| Window size, place and maximised state are kept | `main/window-state.js` |
| Name, app id, icon, update feed from the brand profile | `lib/brand.js`, `builder.config.js` |

### Opening files

Double-click, "Open with", a drop on the Dock icon, a second launch with a file (single instance: it focuses the open
window), a file dropped on a page that takes no drop, and File ▸ Open… all go the same way:

1. The app picks the app the site itself uses for the type (`lib/open-map.js`): first the installed web app's
   `file_handlers` in `manifest.webmanifest` (pdf → Slop PDF; psd, png, jpg, webp → PhotoSlop; csv, json → Convert),
   then Slop Drive's default app for the type (`DR.appsFor` in `drive/js/core/io.js`: docx, txt, md → Docs; xlsx →
   Tables; pptx → Slides; svg → SlopVector). Anything else opens in Slop Drive.
2. The file gets a random token; the page fetches it from `app://slop/__open/<token>` (only files handed over this way).
3. The preload's `window.launchQueue` gives the page the files exactly as Chrome gives an installed web app its launch
   files, and every app takes them through `SlopIntake.launch` (`shared/intake/sources.js`), unchanged.

The installers register these types: pdf, docx, xlsx, csv, pptx, png, jpg/jpeg, webp, svg, psd, txt, md, json.

### Updates

`electron-updater` reads the GitHub Releases of the repository the build ran in (`GITHUB_REPOSITORY`). On start it checks
quietly, downloads a newer version in the background and offers "Restart to update" (otherwise it installs on quit).
Help ▸ Check for Updates… does the same and says when the app is up to date. Updates run in the Windows installer, the
macOS app and the Linux AppImage; not in the portable .exe, the .deb (update it by installing the new one), a
store build or a development run. macOS can only update a signed app.

`/releases/latest` must be a desktop release: keep other releases of this repository marked pre-release, or the
updater and the site's download links pick them.

## Build and run locally

    cd desktop
    npm ci
    npm start                 # bundle the site, run the app from source
    npm run dir               # bundle and build an unpacked app for this system in .dist/
    npm run dist              # bundle and build the installers for this system in .dist/

`node scripts/bundle.mjs --list` prints what the app carries. `DESKTOP_PROFILE=<id>` builds another brand's app from
`brand/profiles/<id>.json` (name, app id, icon); a white-label mirror, which has no profiles, uses its own
`brand/brand.json`.

## Releasing

1. Push a tag `desktop-v<version>` (`desktop-v0.1.0`). The workflow sets that version, builds on Windows, macOS and
   Linux, and publishes the release with the installers and the update feeds (`latest.yml`, `latest-mac.yml`,
   `latest-linux.yml`).
2. To try a build without releasing: Actions ▸ Desktop app ▸ Run workflow, with `dry_run` on (the default). The
   installers are artifacts of the run.

The files carry no version (`Slopographic-Setup.exe`, `Slopographic.dmg`, `Slopographic.AppImage`), so
`/releases/latest/download/<file>` always fetches the newest. The site links them in Settings ▸ Updates
(`shared/desktop/download.js`, from `brand/brand.json` "desktop"; a white-label brand gets the links only when its
profile has a `desktop` block). Inside the app that place shows the app's version instead.

## Signing

Every secret is optional. Without them the builds are unsigned: Windows SmartScreen warns on first run, macOS gets an
ad-hoc signature (Apple silicon runs it after right-click ▸ Open) and cannot update itself.

| System | Secrets | What they are |
| --- | --- | --- |
| Windows | `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD` | A code-signing certificate (.pfx, base64-encoded) and its password |
| macOS | `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD` | A "Developer ID Application" certificate (.p12, base64) and its password (Apple Developer Program) |
| macOS notarization | `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | The Apple ID, an app-specific password for it, the team id. Used when the certificate is set |

## Store builds

Run workflow with `mas` and/or `appx` on. They are uploaded as artifacts only; submitting them is done by hand once the
accounts exist. Neither has an update feed: the store updates the app.

**Mac App Store** (`mas`, a universal `.pkg`; sandbox entitlements in `build/entitlements.mas*.plist`). Needs an Apple
Developer Program membership and an app record in App Store Connect. Secrets: `MAS_CSC_LINK` / `MAS_CSC_KEY_PASSWORD`
(an "Apple Distribution" and a "Mac Installer Distribution" certificate in one .p12, base64) and
`MAS_PROVISIONING_PROFILE` (the Mac App Store provisioning profile, base64). Without them electron-builder makes no
.pkg: the artifact is the unsigned universal .app (`mas-universal/`), only good for a look.

Apple does not allow an App Store app to download executable code. AI model weights may stay downloads (they are data),
but these engines are fetched at run time today and must be bundled in the MAS build before a submission (follow-up):

- ffmpeg core (`engines/ffmpeg/0.12.10/`, about 32 MB of wasm, from the cdn repository: video and audio conversion)
- libheif (`engines/libheif/libheif-js-1.23.5/`: HEIC pictures)
- libraw (`engines/libraw/libraw-wasm-1.6.0/`: camera RAW in PhotoSlop)
- the tools bridge (`engines/tools/bridge/`)
- WebLLM's model libraries (wasm from `raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs`, `vendor/web-llm`: the
  local chat models)

The ONNX Runtime wasm, pdf.js and the other vendored engines are in `vendor/` and already inside the app.

**Microsoft Store** (`appx`, an x64 `.appx`). Needs a Partner Center developer account and an app name reserved there.
Secrets: `APPX_IDENTITY_NAME`, `APPX_PUBLISHER` (`CN=…`) and `APPX_PUBLISHER_DISPLAY_NAME`, all from Partner Center ▸
Product identity. The Store signs the package, so no certificate is needed. Follow-up: Store tile images in
`build/appx/` (electron-builder uses placeholders until they exist).

## Tests

`tests/node/desktop-*.test.mjs` (run with the other Node tests on every push): the protocol's path resolution (no `..`
in any spelling), ranges and opened files; the type → app mapping against the real registry and manifest; the opener and
the preload's `launchQueue`; what the bundle carries; the electron-builder configuration and the store variants; the
main process against a stand-in for Electron (scheme, single instance, sandboxed window, link and permission guards).
