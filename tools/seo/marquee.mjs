// The capability strip under the homepage hero: one short label per app (shared/apps.js, kind "app"), in registry order,
// with File convert shown as its number of conversions (convert/js/core/pages.js). tools/seo/write.mjs writes it into
// index.html between <!-- site:marquee --> and <!-- /site:marquee -->, so a new app joins the strip the next time it runs.
// The list is written twice: the second copy (aria-hidden) lets the strip loop without a gap (home/hero.css scrolls it).
//   capability(app) -> the short label, from the app's title: "PhotoSlop: photo editor" -> "photo editor",
//     "OCR: read text from images" -> "OCR" (the part before the colon when it is not the app's own name),
//     "Contacts (address book)" -> "Contacts"; a long label is cut at its first comma, or before "for", "with"...
//   capabilities(apps, conversions) -> [label] (no repeats)
//   buildMarquee(labels) -> html
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

export function capabilities(apps, conversions) {
  const out = [];
  for (const a of apps) {
    if (a.kind !== 'app') continue;
    const label = a.id === 'convert' && conversions ? `${conversions} conversions` : capability(a);
    if (label && !out.some((x) => x.toLowerCase() === label.toLowerCase())) out.push(label);
  }
  return out;
}

export function buildMarquee(labels) {
  const items = labels.map((l) => `<li>${esc(l)}</li>`).join('');
  return `<div class="hx-marquee"><div class="mq-track"><ul class="mq-list" aria-label="What the apps do" data-i18n-attr="aria-label:hero.marquee">${items}</ul>` +
    `<ul class="mq-list" aria-hidden="true">${items}</ul></div></div>`;
}

let cached;
export function marquee() {
  if (!cached) cached = buildMarquee(capabilities(registryWindow().SLOP_APPS, CONVERTERS.length));
  return cached;
}
