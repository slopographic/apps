# Cloud backup (shared/sync): handoff

Opt-in backup of the app's local data to the person's own Google Drive or Dropbox. Off by default.
Files: `config.js` (settings, provider table), `pkce.js` (OAuth PKCE), `tokens.js` (encrypted token store),
`providers/gdrive.js`, `providers/dropbox.js` (REST wrappers), `sync.js` (public API, `window.SlopSync`),
`ui.js` (the "Cloud backup" panel, `window.SlopSyncUI`).

## Privacy behaviour

- Nothing is sent in the background. There are no timers, and nothing is requested at page load unless the
  URL carries an OAuth return (`code` or `error`) from a sign-in this page started.
- Network use happens only on these actions, each started by a button press:
  - `connect(id)`: no network. It saves a pending sign-in (verifier, state, client ID) in sessionStorage and
    navigates this page to the provider's sign-in page.
  - Return from the provider: `handleRedirect()` checks the `state` value (a mismatch is rejected before any
    request) and exchanges the code at the provider's token endpoint.
  - `pushBackup(id)` / `pullBackup(id, {confirmed: true})`: upload or download the backup. `pullBackup`
    refuses unless the person confirmed, because it replaces local data.
  - `pushAppFile` / `pullAppFile`: optional single-file transfers in an `Apps` folder. Not used by the panel.
  - `status`, `configure`, `disconnect`: no network.
- Hosts contacted (allow-list): accounts.google.com, oauth2.googleapis.com, www.googleapis.com,
  www.dropbox.com, api.dropboxapi.com, content.dropboxapi.com. Nothing else is requested by this module.
- Scope: Google uses `drive.file` (only files this app creates or opens). Dropbox uses
  `files.content.read` and `files.content.write`, which cover the whole Dropbox unless the app is set to
  App folder access. Prefer App folder when creating the Dropbox app.
- Tokens are kept in IndexedDB (`slop-sync` / `kv`), encrypted with a non-extractable AES-GCM key stored in the
  same database. This stops a copied profile file from showing plain tokens. It does not protect against
  JavaScript running on this origin, so the apps must not load third-party scripts.
- Client IDs and last-sync times are kept in localStorage under `slop-sync`. A client ID is not a secret (PKCE,
  no client secret).
- Disconnect deletes the tokens on this device and makes no network call. The provider grant stays until the
  person removes the app in their Google Account or Dropbox settings. The panel says so.
- Cloud files are never deleted by the app.

## Setup

1. Google Drive: in the Google Cloud console, create an OAuth client ID of type "Web application". Add the page
   address (origin and path, no query or hash) as an authorised redirect URI. Enable the Google Drive API for
   the project.
2. Dropbox: in the Dropbox app console, create an app with Scoped access (App folder preferred). In its
   Permissions tab, enable `files.content.read` and `files.content.write`. Add the same page address as a
   redirect URI.
3. In the app, open Cloud backup, choose "Add client ID", paste the client ID, then "Connect" and approve.
4. "Back up now" uploads `slopographic-backup.json`. "Restore from cloud" replaces local data after confirmation.
5. Call `SlopSyncUI.onLoad()` once at page load and `SlopSyncUI.open()` from the app menu. The data module must
   provide `SlopData.exportAll()` and `SlopData.importAll(blob)`.

## Tests

`node tests/run.mjs sync` runs `tests/node/sync.test.mjs`, `tests/node/sync-providers.test.mjs` and the shared
harness `tests/node/sync-helpers.mjs`. No network: fetch is a recording stub.
