// The files a white-label build writes from the profile instead of copying them: brand.json, CNAME, the licence and
// notices, the README (a generated mirror is never edited by hand), the manifest, the logo and favicon, and the
// profile markers (/*profile:key*/ literals) in the copied code. Pure functions; build.mjs writes their results.
// Node only. Tests: tests/node/whitelabel-profile.test.mjs, tests/node/whitelabel-mascot-slot.test.mjs.
import { hasOverlay, artNotice, artTrademarks } from './mascot.mjs';
import { fontMarkers } from './font.mjs';
import { EMPTY } from '../fonts/css.mjs';

/** The value each marker key takes for a profile. A key whose value is undefined keeps the source literal. */
export function markerValues(p) {
  const seo = p.seo || {};
  return {
    // mascot: the built-in buddy (only when the profile says true); mascotOverlay: the profile's own mascot instead
    naming: p.naming, tone: p.tone, mascot: p.mascot === true, mascotOverlay: hasOverlay(p), media: p.media, analytics: p.analytics, defaultLang: p.defaultLang,
    hideApps: (p.apps && p.apps.hide) || [], themes: p.themes || {},
    seoHomeTitle: seo.homeTitle, seoHomeDescription: seo.homeDescription, seoLangs: seo.langs,   // the static SEO pages' languages (tools/seo/lang.mjs)
    ...fontMarkers(p.fontManifest || EMPTY),     // the type family's token names, the typeface page, the preload
    backupExt: backupExt(p), backupJson: backupExt(p) && backupExt(p) + '.json',
  };
}
/** The backup ZIP's extension for a profile: its backupExt, '.backup' for the plain tone, or undefined (the source's own,
 * renamed like any other token). The "Export everything" file is that extension plus .json. */
export const backupExt = (p) => p.backupExt || (p.tone === 'plain' ? '.backup' : undefined);
const LITERAL = String.raw`'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|true|false|null|-?\d+(?:\.\d+)?|\[\]|\{\}`;
const MARKER = new RegExp(String.raw`/\*profile:(\w+)\*/(${LITERAL})`, 'g');
/** The value of a marker's literal (single-quoted strings read as JSON strings). */
const literal = (lit) => JSON.parse(lit[0] === "'" ? '"' + lit.slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"' : lit);
const BLOCK = /<!--profile:(\w+)-->(.*?)<!--\/profile:\1-->/g;
/** HTML blocks on one line, <!--profile:key-->...<!--/profile:key-->: kept when the value is true, emptied when it is
 * false, and for an object {from: to} kept with each from replaced (the line count never changes). */
export function applyBlocks(text, values) {
  return text.replace(BLOCK, (m, key, body) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) throw new Error(`unknown profile marker ${key}`);
    const v = values[key];
    if (v === true || v === undefined) return m;
    const inner = v && typeof v === 'object' ? Object.entries(v).reduce((t, [a, b]) => t.split(a).join(b), body) : '';
    return `<!--profile:${key}-->${inner}<!--/profile:${key}-->`;
  });
}
/** Rewrites every /*profile:key*\/literal in a text with the profile's value (JSON), and the HTML blocks. Unknown keys are
 * an error. */
export function applyMarkers(text, values) {
  return applyBlocks(text, values).replace(MARKER, (m, key, lit) => {
    if (!Object.prototype.hasOwnProperty.call(values, key)) throw new Error(`unknown profile marker ${key}`);
    const v = values[key];
    if (v === undefined || JSON.stringify(v) === JSON.stringify(literal(lit))) return m;   // the same value keeps its spelling
    return `/*profile:${key}*/${JSON.stringify(v)}`;
  });
}

const LINK_KEYS = ['patreon', 'support', 'reddit', 'x', 'tiktok', 'gumroad', 'github'];
/** brand/brand.json: the source file's fields (appOrder...) under the profile's. */
export function brandJson(source, p) {
  const links = {};
  for (const k of LINK_KEYS) links[k] = (p.links && p.links[k]) || '';
  return Object.assign({}, source, {
    name: p.name, tagline: p.tagline, logo: typeof p.logo === 'string' ? p.logo : 'brand/mark.svg',
    colors: Object.assign({}, p.colors), footer: p.footer, links,
    support: Object.assign({ exportCard: true, donate: true, ads: true }, p.support),
  });
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** The square mark (favicon, header): a rounded tile with one letter. */
export function markSvg(p) {
  const l = p.logo || {};
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="${esc(l.color || p.colors.accent)}"/>`
    + `<text x="16" y="22.5" text-anchor="middle" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff">${esc(l.mark || p.name[0])}</text></svg>\n`;
}
/** The wordmark: the mark and the product name, for README, share card and anywhere a wide logo fits. icon: the mark's SVG
 * markup to use instead of the letter tile (a mascot overlay's icon). */
export function logoSvg(p, icon) {
  const l = p.logo || {};
  const text = l.text || p.name;
  const w = 44 + Math.round(text.length * 11.5);
  const mark = icon ? icon.replace(/^<svg\b[^>]*>/, (t) => `<svg x="0" y="0" width="32" height="32" viewBox="${(t.match(/viewBox="([^"]+)"/) || [0, '0 0 64 64'])[1]}">`)
    : `<rect width="32" height="32" rx="7" fill="${esc(l.color || p.colors.accent)}"/>`
    + `<text x="16" y="22.5" text-anchor="middle" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff">${esc(l.mark || p.name[0])}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 32" width="${w * 2}" height="64">${mark}`
    + `<text x="42" y="22" font-family="Inter, Segoe UI, Helvetica, Arial, sans-serif" font-size="19" font-weight="600" fill="${esc(p.colors.ink)}">${esc(text)}</text></svg>\n`;
}

/** The homepage's theme-color: the profile's ink, as the manifest's (the browser's bar matches the installed app). */
export const homeThemeColor = (html, p) => html.replace(/(<meta name="theme-color" content=")[^"]*(">)/, `$1${p.colors.ink}$2`);

/** manifest.webmanifest: the copied one (names already plain) with the profile's names and colours. */
export function manifest(src, p) {
  const m = JSON.parse(src);
  Object.assign(m, { name: p.name, short_name: p.shortName || p.name, description: p.tagline, background_color: p.colors.ink, theme_color: p.colors.ink, lang: p.defaultLang });
  return JSON.stringify(m, null, 2) + '\n';
}

export const mit = (p) => `MIT License

Copyright (c) ${p.legal.year} ${p.legal.holder}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

export const notice = (p) => `# Notice

The code in this repository is MIT-licensed (see [\`LICENSE\`](LICENSE)), copyright ${p.legal.year} ${p.legal.holder}.

1. Names and logos. "${p.name}" and its logo are the names of ${p.legal.holder}. The MIT License grants no trademark
   rights; a copy you publish must use its own name and logo${hasOverlay(p) ? ' and its own mascot' : ''} (see [\`TRADEMARKS.md\`](TRADEMARKS.md)).
2. Third-party code under \`vendor/\` keeps its own licence (see each folder).
${artNotice(p)}`;

export const trademarks = (p) => `# Names and logos

${artTrademarks(p)}
`;

export const security = (p) => `# Security

${p.name} is a static site: every tool runs in the visitor's browser, files are handled on the device, and there is no
server that receives them.

Please report a security problem privately through GitHub's private vulnerability reporting on this repository, not in a
public issue. Include the page, what an attacker could do, and steps to reproduce.
`;

/** The mirror's README. It says the repository is generated, so nobody edits it by hand. */
export const readme = (p, release) => `# ${p.name}

${p.tagline}

Live at **${p.origin}**.

> **Generated - do not edit.** Every file in this repository is generated by a release build. Changes made here are not
> kept: the next release replaces them, and the release step refuses to run while this repository has commits it did not
> make. Report problems as issues instead.

${release ? `Release: ${release}\n\n` : ''}## Run it locally

The site is plain HTML, CSS and JavaScript with no build step. Serve the folder with any static server, for example
\`npx http-server . -p 8080\`, and open http://localhost:8080/.

## Tests

\`node tests/run.mjs\` runs the browser tests in headless Chromium (Playwright); \`node --test tests/node/*.test.mjs\` runs
the Node tests. The workflow in \`.github/workflows\` runs both on every push.

## Licence

MIT, see [LICENSE](LICENSE)${hasOverlay(p) ? `, except the ${p.mascot.name} character's files, which are all rights reserved ([LICENSE-ART](LICENSE-ART))` : ''}.
See also [NOTICE.md](NOTICE.md) and [TRADEMARKS.md](TRADEMARKS.md).
`;
