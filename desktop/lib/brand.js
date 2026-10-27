/* The desktop app's name, id, icon and release home, from the brand profile, so a white-label build makes its own app.
 *   loadBrand(repoRoot, id?, env?)  → { id, name, slug, appId, origin, owner, repo, icon }
 *       id: the profile (brand/profiles/<id>.json), default env.DESKTOP_PROFILE or the site's own. A checkout without
 *       profiles (a white-label mirror) reads its brand/brand.json and manifest.webmanifest instead.
 *       owner/repo: where the releases live: env.GITHUB_REPOSITORY ("owner/repo", set in GitHub Actions), else the
 *       profile's GitHub account and this repository's name, "apps".
 *   artifactNames(slug)             → { windows, portable, mac, macZip, linux, deb, mas, appx }: the installers' file names. They
 *       carry no version, so /releases/latest/download/<name> always fetches the newest (brand/brand.json "desktop").
 *   builderConfig(brand, env?)      → the electron-builder configuration (desktop/builder.config.js passes it on);
 *       env.DESKTOP_STORE 'mas' / 'appx' makes the Mac App Store or Microsoft Store build instead (storeConfig).
 *       Signing follows the environment: CSC_LINK (macOS) / WIN_CSC_LINK (Windows) sign, APPLE_* notarize; without them
 *       Windows and Linux build unsigned and macOS gets an ad-hoc signature (desktop/README.md, "Signing"). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { ASSOCIATIONS } = require('./open-map');

const SITE_PROFILE = 'slopographic';
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const slugOf = (name) => String(name || 'App').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'App';
const idPart = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'app';

function loadBrand(repoRoot, id, env = process.env) {
  const want = id || env.DESKTOP_PROFILE || SITE_PROFILE;
  const p = readJson(path.join(repoRoot, 'brand', 'profiles', want + '.json'));
  const b = readJson(path.join(repoRoot, 'brand', 'brand.json')) || {};
  const m = readJson(path.join(repoRoot, 'manifest.webmanifest')) || {};
  const gh = /github\.com\/([^/]+)/.exec((b.links && b.links.github) || '');
  const name = (p && p.name) || b.name || m.name || 'App';
  const owner = (p && p.github) || (gh && gh[1]) || idPart(name);
  const [envOwner, envRepo] = String(env.GITHUB_REPOSITORY || '').split('/');
  return {
    id: (p && p.id) || idPart(name),
    name,
    slug: slugOf(name),
    appId: `com.${idPart(owner)}.${idPart((p && p.id) || name)}`,
    origin: (p && p.origin) || '',
    owner: envOwner || owner,
    repo: envRepo || 'apps',
    icon: 'assets/icons/icon-512.png',   // white-label builds draw their own (tools/whitelabel/images.mjs)
  };
}

const artifactNames = (slug) => ({
  windows: `${slug}-Setup.exe`, portable: `${slug}-Portable.exe`, mac: `${slug}.dmg`, macZip: `${slug}-mac.zip`,
  linux: `${slug}.AppImage`, deb: `${slug}.deb`, mas: `${slug}-MacAppStore.pkg`, appx: `${slug}.appx`,
});

function builderConfig(brand, env = process.env) {
  const a = artifactNames(brand.slug);
  const signedMac = !!(env.CSC_LINK || env.CSC_NAME);
  const config = {
    appId: brand.appId,
    productName: brand.name,
    copyright: `© ${brand.name}`,
    directories: { output: 'dist', buildResources: 'build' },
    files: ['main/**', 'lib/**', 'site/**', 'app-brand.json', 'package.json'],
    asar: true,
    extraMetadata: { name: brand.slug.toLowerCase() + '-desktop', productName: brand.name, homepage: brand.origin || undefined },
    publish: [{ provider: 'github', owner: brand.owner, repo: brand.repo, releaseType: 'release' }],
    fileAssociations: ASSOCIATIONS.map((x) => ({ ext: x.ext, name: x.name, mimeType: x.mime, role: 'Editor' })),
    icon: 'build/icon.png',
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }, { target: 'portable', arch: ['x64'] }],
      // electron-builder 26 signs on Windows with WIN_CSC_LINK / WIN_CSC_KEY_PASSWORD when they are set
    },
    nsis: { artifactName: a.windows, oneClick: true, perMachine: false, deleteAppDataOnUninstall: false },
    portable: { artifactName: a.portable },
    mac: {
      target: [{ target: 'dmg', arch: ['universal'] }, { target: 'zip', arch: ['universal'] }],
      category: 'public.app-category.productivity',
      artifactName: a.macZip,   // the zip (what the mac updater downloads); the dmg has its own name below
      identity: signedMac ? undefined : '-',   // no certificate: ad-hoc, so Apple silicon still runs it
      hardenedRuntime: signedMac,
      notarize: signedMac && !!(env.APPLE_ID || env.APPLE_API_KEY),
    },
    dmg: { artifactName: a.mac },
    linux: {
      target: [{ target: 'AppImage', arch: ['x64'] }, { target: 'deb', arch: ['x64'] }],
      category: 'Office',
      executableName: brand.slug.toLowerCase(),
      maintainer: `${brand.name} <${brand.owner}@users.noreply.github.com>`,
      synopsis: `${brand.name}: office and creative apps that work offline`,
    },
    appImage: { artifactName: a.linux },
    deb: { artifactName: a.deb },
  };
  return env.DESKTOP_STORE ? storeConfig(config, brand, env) : config;
}

/** The store builds (env.DESKTOP_STORE 'mas' or 'appx'; desktop/README.md, "Store builds"): no update feed (the store
 * updates the app, main/updates.js stays off), the Mac App Store's sandbox entitlements and provisioning profile, the
 * Microsoft Store's package identity. Unsigned until the store accounts' certificates are in the secrets. */
function storeConfig(config, brand, env) {
  const a = artifactNames(brand.slug);
  const out = { ...config, publish: null };
  if (env.DESKTOP_STORE === 'mas') {
    out.mac = { ...config.mac, target: [{ target: 'mas', arch: ['universal'] }], identity: undefined, hardenedRuntime: false, notarize: false };
    out.mas = {
      artifactName: a.mas,
      entitlements: 'build/entitlements.mas.plist',
      entitlementsInherit: 'build/entitlements.mas.inherit.plist',
      hardenedRuntime: false,
      provisioningProfile: env.MAS_PROVISIONING_PROFILE || undefined,
      identity: env.CSC_LINK || env.CSC_NAME ? undefined : null,   // no certificate yet: an unsigned package to inspect
    };
  }
  if (env.DESKTOP_STORE === 'appx') {
    out.win = { ...config.win, target: [{ target: 'appx', arch: ['x64'] }] };
    out.appx = {
      artifactName: a.appx,
      applicationId: brand.slug.replace(/-/g, ''),
      identityName: env.APPX_IDENTITY_NAME || `${brand.owner}.${brand.slug.replace(/-/g, '')}`,
      publisher: env.APPX_PUBLISHER || `CN=${brand.owner}`,
      publisherDisplayName: env.APPX_PUBLISHER_DISPLAY_NAME || brand.name,
      displayName: brand.name,
      backgroundColor: '#0a0a0a',
      languages: ['en-US', 'sv-SE'],
    };
  }
  return out;
}

module.exports = { loadBrand, artifactNames, builderConfig, slugOf, SITE_PROFILE };
