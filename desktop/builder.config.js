/* electron-builder's configuration for the desktop app, made from the brand profile (desktop/lib/brand.js builderConfig):
 * name, app id, icon, file associations, installers per system and the GitHub Releases feed for updates.
 *   DESKTOP_PROFILE=<id>     another brand's profile (brand/profiles/<id>.json); default the site's own
 *   DESKTOP_STORE=mas|appx   the Mac App Store or Microsoft Store build instead of the direct downloads
 * Used by npm run dist / dir (desktop/package.json) and .github/workflows/desktop.yml. */
'use strict';
const path = require('node:path');
const { loadBrand, builderConfig } = require('./lib/brand');

module.exports = builderConfig(loadBrand(path.resolve(__dirname, '..')));
