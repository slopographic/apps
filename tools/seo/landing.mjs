// Landing pages, built from the app registry (shared/apps.js): one per app page under /apps/<id>/, plus
// /slop-365/, /creative-slop-pro/ and /compare/. Each page has an H1, an intro, a feature matrix (features as
// rows, with status and file types), the file types it opens, a button to the app, and related apps.
// Only registry facts are written. Called by tools/seo/write.mjs, which adds the SEO head block to each page.
import { isPage } from './site.mjs';
import { compareTables } from './roundups.mjs';
import OFFLINE_APPS from '../../shared/offline/manifest.js';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Pictures and clips are found by name: assets/shots/<id>.jpg, assets/clips/<id>.webm and .mp4. */
const hasFile = (rel) => existsSync(path.join(ROOT, rel));
/** An app's YouTube tutorial is in the registry (shared/apps.js `video`). Its thumbnail is kept in assets/video, so the
 *  page loads nothing from YouTube. */
const lengthWords = (iso) => { const m = /PT(?:(\d+)M)?(?:(\d+)S)?/.exec(iso || '') || [], n = Math.max(1, Math.round((Number(m[1] || 0) * 60 + Number(m[2] || 0)) / 60));
  return `about ${['', 'one', 'two', 'three', 'four', 'five'][n] || n} minute${n === 1 ? '' : 's'}`; };

/** Slop 365 tools, in the order the hub lists them. Each id must be an app in the registry. */
export const SLOP365 = ['invoices', 'orders', 'contacts', 'inventory', 'crm', 'ledger', 'reports', 'tables', 'docs', 'notes'];
const STATUS = { live: 'Live', beta: 'Beta', building: 'In development' };
const NOTE = {
  beta: 'Beta: still being tested, so some parts may change.',
  building: 'In development: some features listed below may not be finished yet.',
};
/** Readable names for the MIME patterns in an app's `accepts`. Unlisted patterns are shown as written. */
const TYPE = {
  '*': 'Any file', 'image/*': 'Any image', 'video/*': 'Video', 'audio/*': 'Audio', 'text/*': 'Text',
  'application/pdf': 'PDF', 'text/csv': 'CSV', 'text/tab-separated-values': 'TSV', 'text/plain': 'Plain text',
  'text/markdown': 'Markdown', 'text/html': 'HTML', '.html': 'HTML', '.htm': 'HTML', 'application/json': 'JSON',
  'text/vcard': 'vCard', 'text/x-vcard': 'vCard', 'image/svg+xml': 'SVG', 'image/jpeg': 'JPEG', 'image/png': 'PNG',
  'image/webp': 'WebP', 'image/tiff': 'TIFF', 'image/vnd.adobe.photoshop': 'Photoshop (PSD)',
  'application/x-openraster': 'OpenRaster', 'application/illustrator': 'Illustrator (.ai)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (.docx)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (.xlsx)',
  'application/vnd.ms-excel': 'Excel (.xls)', 'application/vnd.oasis.opendocument.spreadsheet': 'OpenDocument spreadsheet (.ods)',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint (.pptx)',
  'application/vnd.oasis.opendocument.presentation': 'OpenDocument presentation (.odp)',
  'message/rfc822': 'Email (.eml)', '.eml': 'Email (.eml)', 'model/gltf-binary': 'GLB', 'model/obj': 'OBJ',
  'audio/mpeg': 'MP3', 'audio/wav': 'WAV', 'audio/ogg': 'Ogg', 'audio/flac': 'FLAC', 'audio/mp4': 'M4A',
  'audio/aac': 'AAC', 'audio/opus': 'Opus', 'text/css': 'CSS', 'text/javascript': 'JavaScript',
  'application/javascript': 'JavaScript', 'text/x-python': 'Python', 'text/typescript': 'TypeScript',
};

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const fileTypeList = (app) => [...new Set((app.accepts || []).map((t) => TYPE[t] || t))];
const fileTypes = (app) => fileTypeList(app).join(', ') || 'Not listed yet';
const statusOf = (app) => STATUS[app.status || 'live'];

/** Related apps: the most shared file types first, then the same group. Deterministic, registry order breaks ties. */
export function related(app, apps) {
  const mine = new Set(fileTypeList(app));
  const score = (b) => fileTypeList(b).filter((l) => mine.has(l)).length * 2 + (b.group && b.group === app.group ? 1 : 0);
  return apps.filter((b) => isPage(b) && b.id !== app.id)
    .map((b, i) => ({ b, s: score(b), i }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .slice(0, 6).map((x) => x.b);
}

/** The site's page frame for content pages (landing, task, hub and how-it-works pages): the same look as the apps'
 *  About pages (shared/landing/landing.css, which follows the chosen theme), the profile, theme and consent scripts,
 *  and the shell (Theme and Apps in the header). siteTop() and siteFoot() are also written into hand-made pages
 *  between <!-- site:top --> and <!-- site:foot --> markers (write.mjs), so every page has the same header and footer. */
const NAV = [['/', 'Home'], ['/all-tools/', 'All tools'], ['/compare/', 'Compare apps'], ['/how-it-works/', 'How it works'], ['/settings/', 'Settings']];
export const SITE_HEAD = ['<script src="/shared/profile/profile.js"></script>', '<script src="/shared/theme/theme.js" data-app="site"></script>',
  '<script src="/shared/consent/config.js"></script>', '<script src="/shared/consent/state.js"></script>', '<script src="/shared/consent/consent-mode.js"></script>',
  '<script src="/shared/consent/banner.js"></script>', '<link rel="icon" href="/favicon.ico" type="image/x-icon">', '<link rel="stylesheet" href="/shared/landing/landing.css">'];
export const siteTop = () => `<header class="l-top"><a class="l-brand" href="/"><span class="l-brand-dot" aria-hidden="true"></span>Slopographic</a><nav aria-label="Site">${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}</nav></header>`;
export const siteFoot = () => `<footer class="l-foot"><div class="l-foot-links">${NAV.map(([h, t]) => `<a href="${h}">${t}</a>`).join('')}<a href="/best/">Free tools compared</a><a href="https://github.com/slopographic/apps" rel="noopener">Source code</a></div><p class="l-fine">Slopographic · free apps that run in your browser · nothing uploaded</p></footer>`;
export function shell(body) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${SITE_HEAD.join('\n  ')}
</head>
<body>
<div class="l-wrap">
${siteTop()}
<main class="l-doc">
${body}
</main>
${siteFoot()}
</div>
<script src="/shell/shell.js"></script>
</body>
</html>
`;
}

const thumb = (id) => (hasFile(`assets/shots/${id}.jpg`) ? `<img class="thumb" src="/assets/shots/${esc(id)}.jpg" alt="" width="220" height="137" loading="lazy">` : '');
export const cardList = (items) => `<ul class="cards">${items.map((b) => `<li>${thumb(b.id)}<a href="/apps/${esc(b.id)}/">${esc(b.name)}</a><br><span class="note">${esc(statusOf(b))}</span><br>${esc(b.tagline)}</li>`).join('')}</ul>`;

/** The picture, the clip and the YouTube demo of one app, when the files exist. */
export function mediaBlock(app) {
  const id = app.id, out = [];
  const clip = hasFile(`assets/clips/${id}.mp4`);
  if (!clip && hasFile(`assets/shots/${id}.jpg`)) out.push(`<figure class="shot"><img src="/assets/shots/${esc(id)}.jpg" alt="${esc(app.name)} open in a browser" width="1280" height="800" loading="lazy"></figure>`);
  if (clip) {
    const poster = hasFile(`assets/shots/${id}.jpg`) ? ` poster="/assets/shots/${esc(id)}.jpg"` : '';
    out.push(`<video class="clip" controls preload="none" playsinline${poster}><source src="/assets/clips/${esc(id)}.webm" type="video/webm"><source src="/assets/clips/${esc(id)}.mp4" type="video/mp4">Your browser cannot play this clip.</video>`);
  }
  const v = app.video;
  if (v) out.push(`<a class="demo" href="https://www.youtube.com/watch?v=${esc(v.id)}" rel="noopener"><img src="/assets/video/yt-${esc(v.id)}.jpg" alt="" width="480" height="360" loading="lazy"><span><b>Watch the ${esc(v.title)}</b><br>On YouTube, ${lengthWords(v.duration)}.</span></a>`);
  return out.length ? `<div class="media">${out.join('')}</div>` : '';
}

/** The offline download link, for an app with a shared offline build (shared/offline/manifest.js). */
const offlineLink = (app) => (OFFLINE_APPS[app.id] && OFFLINE_APPS[app.id].entry
  ? `\n<p class="note"><a href="/downloads/${esc(app.id)}.html" download>Download offline (.html)</a>: one file that opens from disk and works without a connection.</p>`
  : '');
/** Body of one app's landing page. */
function appBody(app, apps, tasks = [], roundups = []) {
  const feats = app.features || [];
  const types = fileTypeList(app);
  const rows = feats.length
    ? feats.map((f) => `<tr><td>${esc(f)}</td><td>${esc(statusOf(app))}</td><td>${esc(fileTypes(app))}</td></tr>`).join('')
    : `<tr><td colspan="3">No features are listed for this app yet.</td></tr>`;
  const note = NOTE[app.status || 'live'];
  return `<p class="eyebrow">${esc(app.name)} · ${esc(statusOf(app))}</p>
<h1>${esc(app.title || app.name)}</h1>
<p class="lead">${esc(app.tagline)}</p>
<p><a class="btn" href="/${esc(app.path)}" aria-label="Open now: ${esc(app.name)}">Open now</a></p>${offlineLink(app)}
${mediaBlock(app)}
<p>${esc(app.name)} ${feats.length ? `has these main features: ${esc(feats.slice(0, 2).join('; '))}.` : 'is listed below with its file types.'}${types.length ? ` It opens ${esc(types.join(', '))}.` : ''}</p>
${note ? `<p class="note">${esc(note)}</p>` : ''}
${tasks.length ? `<h2>What you can do with ${esc(app.name)}</h2>\n<ul>${tasks.map((t) => `<li><a href="/${esc(app.path)}${esc(t.slug)}/">${esc(t.h1)}</a></li>`).join('')}</ul>\n` : ''}${roundups.map((r) => `<h2>How ${esc(app.name)} compares</h2>\n<p>${esc(app.name)} next to ${esc(r.tools.filter((t) => !t.ours).map((t) => t.name).join(', '))}: facts from each tool's own pages, checked ${esc(r.checked)}. We make ${esc(app.name)}.</p>\n${compareTables(r)}\n<p><a href="/best/${esc(r.slug)}/">The full comparison, with sources: ${esc(r.h1)}</a></p>\n`).join('')}<h2>Feature matrix</h2>
<div class="wrap"><table>
<caption>${esc(app.name)}: features, status and file types</caption>
<thead><tr><th scope="col">Feature</th><th scope="col">Status</th><th scope="col">File types</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>
<h2>File types</h2>
<p>${types.length ? `${esc(app.name)} opens ${esc(types.join(', '))}.` : 'No specific file types are listed for this app yet.'}</p>
<h2>Related apps</h2>
${cardList(related(app, apps))}
<p class="note"><a href="/compare/">Compare all apps in the feature matrix</a></p>`;
}

function slop365Body(apps) {
  const tools = SLOP365.map((id) => apps.find((a) => a.id === id));
  if (tools.some((t) => !t)) throw new Error('SLOP365 lists an id that is not in shared/apps.js');
  return `<p class="eyebrow">Slop 365 · business apps</p>
<h1>Slop 365: business apps that run in your browser</h1>
<p class="lead">Invoices, orders, contacts, inventory, CRM, ledger, reports, tables, docs and notes. Each one is a separate app with its own page.</p>
<h2>The tools</h2>
${cardList(tools)}`;
}

function creativeBody(apps) {
  const ids = ['photoslop', 'vector', 'slopedit'];
  const picks = ids.map((id) => apps.find((a) => a.id === id));
  if (picks.some((t) => !t)) throw new Error('Creative Slop Pro lists an id that is not in shared/apps.js');
  return `<p class="eyebrow">Creative Slop Pro</p>
<h1>Creative Slop Pro: free browser apps for photo, vector and video editing</h1>
<p class="lead">A free browser alternative to Photoshop-style photo editing, Illustrator-style vector drawing and video editing.</p>
<p>Three Slopographic apps cover those jobs. They run in a web browser, so no account or install is needed.</p>
${cardList(picks)}
<h2>What these apps are not</h2>
<ul>
<li>They are not Adobe products. Slopographic is not affiliated with, endorsed by or sponsored by Adobe. Photoshop, Illustrator and Premiere are trademarks of Adobe Inc.</li>
<li>They do not run the full feature sets of Photoshop, Illustrator or Premiere. Each app's page lists what it does.</li>
<li>No account or install is needed, and the apps run in your browser.</li>
</ul>
<h2>Where each job is covered</h2>
<ul>
<li><a href="/apps/photoslop/">PhotoSlop</a>: photo editing with layers, masks and filters.</li>
<li><a href="/apps/vector/">SlopVector</a>: vector drawing with pen and shape tools.</li>
<li><a href="/apps/slopedit/">SlopCut</a>: video editing with a multi-track timeline.</li>
</ul>`;
}

function compareBody(apps) {
  const pages = apps.filter(isPage);
  const rows = pages.map((a) => `<tr><td><a href="/apps/${esc(a.id)}/">${esc(a.name)}</a></td><td>${esc(statusOf(a))}</td><td>${esc((a.features || []).slice(0, 2).join('; ') || 'None listed')}</td><td>${esc(fileTypes(a))}</td></tr>`).join('');
  return `<p class="eyebrow">Compare</p>
<h1>Compare every Slopographic app</h1>
<p class="lead">All ${pages.length} apps with a page, their status, their first two features and the file types they open. Each row links to the app's own page.</p>
<div class="wrap"><table>
<caption>All apps: status, key features and file types</caption>
<thead><tr><th scope="col">App</th><th scope="col">Status</th><th scope="col">Key features</th><th scope="col">File types</th></tr></thead>
<tbody>${rows}</tbody>
</table></div>`;
}

/**
 * Every landing page: [{ key, dir, url, html, crumb }]. `key` is the copy id in shared/seo/copy.mjs LANDING
 * (an app id, or slop-365, creative-slop-pro, compare). `dir` is the folder the page is written to.
 * Throws if a page has no copy.
 */
export function landingPages(apps, site, LANDING, TASKS = [], ROUNDUPS = []) {
  const out = [];
  const add = (key, dir, crumb, html) => {
    if (!LANDING[key]) throw new Error(`${key}: no landing copy in shared/seo/copy.mjs LANDING`);
    out.push({ key, dir, url: `${site}/${dir}`, html: shell(html), crumb });
  };
  for (const app of apps) if (isPage(app)) add(app.id, `apps/${app.id}/`, app.name, appBody(app, apps, TASKS.filter((t) => t.app === app.id), ROUNDUPS.filter((r) => r.app === app.id)));
  add('slop-365', 'slop-365/', 'Slop 365', slop365Body(apps));
  add('creative-slop-pro', 'creative-slop-pro/', 'Creative Slop Pro', creativeBody(apps));
  add('compare', 'compare/', 'Compare', compareBody(apps));
  return out;
}
