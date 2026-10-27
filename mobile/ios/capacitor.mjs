#!/usr/bin/env node
// The iPhone and iPad app's Capacitor settings and the changes made to the Xcode project Capacitor generates (never
// committed: mobile/ios/ios, from `npx cap add ios`). From the site's facts (mobile/config.mjs), so a white-label build
// gets its own app id, name and icon.
//   node mobile/ios/capacitor.mjs config         write mobile/ios/capacitor.config.json
//   node mobile/ios/capacitor.mjs patch          after `cap add ios`: the site's router (SiteRouter.swift), iOS 16.4 (the
//                                                site's support target), the privacy texts, the app icon and splash
// Node only. Tests: tests/node/mobile-ios.test.mjs.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readConfig } from '../config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
export const MIN_IOS = '16.4';   // tools/compat/features.mjs TARGET: the site's scripts need Safari 16.4

/** capacitor.config.json from the site's facts and mobile.json's ios part. */
export function capConfig(cfg, ios = {}) {
  const c = {
    appId: cfg.appId,
    appName: cfg.name,
    webDir: 'www',
    backgroundColor: cfg.backgroundColor,
    ios: { contentInset: 'never', limitsNavigationsToAppBoundDomains: false, scrollEnabled: true },
    server: { iosScheme: 'capacitor', hostname: 'localhost' },
  };
  if (ios.start && ios.start !== '/') c.server.appStartPath = ios.start;
  return c;
}

/** The privacy texts iOS requires before a page may use the camera, the microphone or save to Photos. */
export function privacyKeys(name) {
  return {
    NSCameraUsageDescription: `${name} uses the camera only when you scan a code or take a photo in an app. Nothing leaves your device.`,
    NSMicrophoneUsageDescription: `${name} uses the microphone only when you record or transcribe. Nothing leaves your device.`,
    NSPhotoLibraryAddUsageDescription: `${name} saves the images you export to Photos when you choose Save Image.`,
  };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Info.plist with keys set (string, or boolean). Replaces a key that is there, else adds it before the last </dict>. */
export function patchPlist(xml, keys) {
  let out = xml;
  for (const [k, v] of Object.entries(keys)) {
    const val = typeof v === 'boolean' ? `<${v}/>` : `<string>${esc(v)}</string>`;
    const re = new RegExp(`(<key>${k}</key>\\s*)(<string>[^<]*</string>|<true/>|<false/>)`);
    if (re.test(out)) out = out.replace(re, `$1${val}`);
    else { const i = out.lastIndexOf('</dict>'); out = `${out.slice(0, i)}\t<key>${k}</key>\n\t${val}\n${out.slice(i)}`; }
  }
  return out;
}

/** The project's Swift and storyboard: the app's view controller (SiteRouter.swift) in place of Capacitor's. */
export function useSiteController(text) { return text.replace(/\bCAPBridgeViewController\(\)/g, 'SiteViewController()'); }
export function useSiteStoryboard(xml) { return xml.replace(/customClass="CAPBridgeViewController" customModule="Capacitor"/g, 'customClass="SiteViewController" customModule="App" customModuleProvider="target"'); }
export function appendOnce(text, add) { return text.includes(add.split('\n')[0]) ? text : text.replace(/\s*$/, '\n\n') + add; }
/** The deployment target and the bundle id in project.pbxproj. */
export function patchPbxproj(text, appId) {
  return text.replace(/IPHONEOS_DEPLOYMENT_TARGET = [\d.]+;/g, `IPHONEOS_DEPLOYMENT_TARGET = ${MIN_IOS};`)
    .replace(/PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g, `PRODUCT_BUNDLE_IDENTIFIER = ${appId};`);
}

/** A square SVG: the site's icon drawing (favicon.svg) at scale, centred on bg (an iOS icon has no transparency). */
export function iconSvg(favicon, bg, size, scale) {
  const d = Math.round(size * scale), o = Math.round((size - d) / 2);
  const inner = favicon.replace(/^<svg\b([^>]*)>/, (t, attrs) => `<svg${attrs.replace(/\s(width|height|x|y)="[^"]*"/g, '')} x="${o}" y="${o}" width="${d}" height="${d}">`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${bg}"/>${inner}</svg>`;
}

function patch() {
  const cfg = readConfig(ROOT);
  const app = path.join(HERE, 'ios', 'App', 'App');
  if (!existsSync(app)) throw new Error('no Xcode project: run `npx cap add ios` in mobile/ios first');
  const edit = (f, fn) => { const p = path.join(app, f); if (existsSync(p)) writeFileSync(p, fn(readFileSync(p, 'utf8'))); };
  edit('AppDelegate.swift', (t) => appendOnce(t, readFileSync(path.join(HERE, 'SiteRouter.swift'), 'utf8')));
  edit('SceneDelegate.swift', useSiteController);
  edit('Base.lproj/Main.storyboard', useSiteStoryboard);
  edit('Info.plist', (t) => patchPlist(t, Object.assign({ CFBundleDisplayName: cfg.shortName.length <= 12 ? cfg.shortName : cfg.name, ITSAppUsesNonExemptEncryption: false }, privacyKeys(cfg.name))));
  const pbx = path.join(app, '..', 'App.xcodeproj', 'project.pbxproj');
  writeFileSync(pbx, patchPbxproj(readFileSync(pbx, 'utf8'), cfg.appId));
  // the icon (1024 px, the drawing at 80 %) and the splash (2732 px, the drawing small in the middle), on the ink colour
  const { Resvg } = createRequire(path.join(HERE, 'package.json'))('@resvg/resvg-js');
  const favicon = readFileSync(path.join(ROOT, 'favicon.svg'), 'utf8');
  const png = (size, scale) => new Resvg(iconSvg(favicon, cfg.backgroundColor, size, scale)).render().asPng();
  const icons = path.join(app, 'Assets.xcassets', 'AppIcon.appiconset'), splash = path.join(app, 'Assets.xcassets', 'Splash.imageset');
  for (const f of readdirSync(icons).filter((n) => n.endsWith('.png'))) writeFileSync(path.join(icons, f), png(1024, 0.8));
  for (const f of readdirSync(splash).filter((n) => n.endsWith('.png'))) writeFileSync(path.join(splash, f), png(2732, 0.16));
  console.log(`patched the Xcode project for ${cfg.appId} (iOS ${MIN_IOS}+)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2];
  if (cmd === 'config') {
    const ios = JSON.parse(readFileSync(path.join(ROOT, 'mobile/mobile.json'), 'utf8')).ios || {};
    writeFileSync(path.join(HERE, 'capacitor.config.json'), JSON.stringify(capConfig(readConfig(ROOT), ios), null, 2) + '\n');
    console.log('wrote mobile/ios/capacitor.config.json');
  } else if (cmd === 'patch') patch();
  else { console.error('usage: capacitor.mjs config | patch'); process.exit(2); }
}
