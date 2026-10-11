# Consent, analytics, ads and donate: handoff

Single source of truth for opt-in tracking and ads. Everything is classic scripts (`window` globals), no build step.
Nothing third-party loads until the visitor accepts. The default for every category is denied.

## Files
- `config.js`: `window.SLOP_CONSENT_CONFIG`. The only place the owner fills in IDs (see below). Malformed values are
  treated as empty.
- `state.js`: `window.SlopConsentState`. Reads and writes the record in localStorage key `slop-consent`. Every storage
  access is in try/catch.
- `consent-mode.js`: `window.SlopConsent`. Google Consent Mode v2. Sets `consent default: denied` first, then loads
  scripts the record allows. Exposes `grant(cat)`, `revoke(cat)`, `setChoices({analytics, ads})`, `state()`, `apply()`.
- `banner.js` + `banner.css`: `window.SlopBanner`. Shown when storage works and there is no choice for the current
  policy version. Injects `banner.css` itself. Pages with `<body data-consent="off">` never show it.
- `donate.js`: `window.SlopDonate`. Fills every `[data-donate]` element with a Patreon link (`target="_blank"`,
  `rel="noopener"`) only when `patreonUrl` is set. Otherwise the element is hidden.
- `../../settings/index.html` + `settings.js` + `settings.css`: the Settings page. Toggles save at once. Its footer
  and header match the homepage.

## Script order (every page that needs consent)
```html
<link rel="stylesheet" href="shared/consent/banner.css">   <!-- only if the page shows the banner; banner.js also adds it -->
<script src="shared/consent/config.js"></script>
<script src="shared/consent/state.js"></script>
<script src="shared/consent/consent-mode.js"></script>   <!-- sets consent default BEFORE any tag -->
<script src="shared/consent/donate.js"></script>          <!-- optional -->
<script src="shared/consent/banner.js"></script>          <!-- optional: shows the banner -->
```
Put these before any other script that could add a tag. Use paths relative to the page (or the site root's
`shared/consent/` path). `state.js` works out the site root from its own src.

## What loads when
| Visitor state                         | Loads                                                              |
|---------------------------------------|--------------------------------------------------------------------|
| No record, or policy version changed   | Nothing third-party. Banner shows (if storage works).              |
| Storage blocked                        | Nothing. No banner (we cannot remember a choice, so we ask nothing). |
| Analytics granted, `ga4MeasurementId` set | `https://www.googletagmanager.com/gtag/js?id=<ID>`, then `gtag('config', ID)`. |
| Analytics granted, ID empty            | Nothing. No script, no `config`.                                   |
| Ads granted, `adsensePublisherId` set  | `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<ID>`. |
| Ads granted, ID empty                  | Nothing.                                                            |
| Revoke                                 | Consent update to denied, `window['ga-disable-<ID>'] = true`, no page reload. Future visits load nothing. Scripts already on the page stay but get no consent. |

Consent Mode types: analytics sets `analytics_storage`; ads sets `ad_storage`, `ad_user_data`, `ad_personalization`.
`functionality_storage`, `personalization_storage` and `security_storage` stay denied. Nothing here uses them.

## The record
localStorage key `slop-consent`:
```json
{ "version": 1, "timestamp": 1760000000000, "categories": { "necessary": true, "analytics": false, "ads": false } }
```
`necessary` is always true. A record whose `version` is not the current `policyVersion`, or that is corrupt, counts as
missing: the visitor is asked again and their old choice does not apply. Only the Settings page and the banner
write it. The Admin app clears it (it is not cleared here).

## Owner must fill in (`config.js` defaults, all currently empty)
1. `ga4MeasurementId`: GA4 measurement ID, e.g. `G-XXXXXXXXXX`. Empty = no analytics script ever loads.
2. `adsensePublisherId`: AdSense publisher ID, e.g. `ca-pub-0000000000000000`. Empty = no ads script ever loads.
3. `patreonUrl`: e.g. `https://www.patreon.com/<name>`. Empty = donate link hidden everywhere.
4. Policy text: the banner sentence is in `banner.js` (`We use local storage for your settings. Turn on analytics and
   ads? You can change this any time in Settings.`). The Settings privacy paragraph is in `settings/index.html`
   (`<p class="privacy">`). If you change either, bump `policyVersion` in `config.js` so everyone is asked again.
5. Review the copy on the homepage and app pages that still says "no tracking" or "nothing uploaded" (see the
   report that came with this change).

## Privacy statement (Settings page, verbatim)
> Slopographic runs in your browser and your files never leave your device. Your choices on this page are stored in
> this browser's local storage and nowhere else. Analytics and ads are off until you turn them on, and no third-party
> script loads until you do. You can change this at any time.

Analytics line: "Google Analytics 4 counts page views, so we can see which apps people use. Off by default."
Ads line: "Google AdSense may show ads on some pages. Off by default."

## Test hooks
`config.js` reads `window.SLOP_CONSENT_OVERRIDES` before applying defaults, and `consent-mode.js` reads
`window.SLOP_CONSENT_LOADER` as its script loader. The tests use both (`tests/consent/fixture.html`). Nothing in the
app sets them.

## Tests (`node tests/run.mjs consent`)
- `tests/consent/consent.test.html`: default denied, consent default first, no third-party script while denied, loads
  only when ID and grant, AdSense rules, malformed IDs, saved choice on next visit, revoke (ga-disable, no reload,
  no later loads), blocked storage.
- `tests/consent/banner.test.html`: sentence and buttons, shows once, Accept all, Manage/Save, outdated policy asks
  again, current policy does not, corrupt record, blocked storage, fits 390 px.
- `tests/consent/donate.test.html`: hidden when empty, link attributes when set, non-https ignored.
- `tests/consent/settings.test.html`: switches read/write the record, privacy sentence, donate hidden by default.
Every test runs in a fresh iframe with a stubbed loader, so nothing reaches the network.

## Not wired yet
No page loads these scripts yet (the homepage only got the Settings link in its footer). Apps and the homepage need
the script order above before they can show the banner or load a tag.
