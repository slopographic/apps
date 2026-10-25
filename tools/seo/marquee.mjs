// The capability strip under the homepage hero: one short label per app (shared/apps.js, kind "app"), in registry order,
// with File convert shown as its number of conversions (convert/js/core/pages.js). tools/seo/write.mjs writes it into
// index.html between <!-- site:marquee --> and <!-- /site:marquee -->, so a new app joins the strip the next time it runs.
// data-controls: its links move (it scrolls), so Sloppo treats the whole strip as controls (shared/buddy/avoid.js).
// The list is written twice: the second copy (aria-hidden) lets the strip loop without a gap (home/hero.css scrolls it).
// Each label is a link to its app (data-id: home/marquee.js turns the globe to it on hover or focus). One tab stop: the
// first link takes Tab, the arrow keys move along (home/marquee.js); the copy's links are never in the tab order.
//   capability(app) -> the short label, from the app's title: "PhotoSlop: photo editor" -> "photo editor",
//     "OCR: read text from images" -> "OCR" (the part before the colon when it is not the app's own name),
//     "Contacts (address book)" -> "Contacts"; a long label is cut at its first comma, or before "for", "with"...
//   entries(apps, conversions) -> [{ id, path, label }] (no repeated labels; apps only, with a page)
//   capabilities(apps, conversions) -> [label]
//   buildMarquee(entries) -> html
//   marquee() -> the html for the site's own data
import { registryWindow } from './site.mjs';
import { PAGES as CONVERTERS } from '../../convert/js/core/pages.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LONG = 26;

export function capability(a) {
  const t = String(a.title || a.name).replace(/\s*\([^)]*\)/g, '');
  const i = t.indexOf(': ');
  let x = i < 0 ? t : t.slice(0, i) !== a.name ? t.slice(0, i) : t.slice(i + 2);
  x = x.split(', ')[0];
  if (x.length > LONG) x = x.split(/ for | across | with | from /)[0];
  return x.trim();
}

export function entries(apps, conversions) {
  const out = [];
  for (const a of apps) {
    if (a.kind !== 'app' || !a.path || a.path.startsWith('#')) continue;
    const label = a.id === 'convert' && conversions ? `${conversions} conversions` : capability(a);
    if (label && !out.some((x) => x.label.toLowerCase() === label.toLowerCase())) out.push({ id: a.id, path: a.path, label });
  }
  return out;
}
export const capabilities = (apps, conversions) => entries(apps, conversions).map((e) => e.label);

export function buildMarquee(list) {
  const items = (copy) => list.map((e, i) => `<li><a href="${esc(e.path)}" data-id="${esc(e.id)}" tabindex="${!copy && !i ? 0 : -1}">${esc(e.label)}</a></li>`).join('');
  return `<div class="hx-marquee" data-controls><div class="mq-track"><ul class="mq-list" aria-label="What the apps do" data-i18n-attr="aria-label:hero.marquee">${items(false)}</ul>` +
    `<ul class="mq-list" aria-hidden="true">${items(true)}</ul></div></div>`;
}

let cached;
export function marquee() {
  if (!cached) cached = buildMarquee(entries(registryWindow().SLOP_APPS, CONVERTERS.length));
  return cached;
}
