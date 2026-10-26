// The site footer navigation: one block of plain links to the pages the SEO tools write, on the homepage, every
// generated content page (landing.mjs siteFoot) and every converter page. Built only from the data those pages come
// from, so a new app, round-up or converter is linked from the footer the next time tools/seo/write.mjs runs:
//   Apps        one column per registry group (shared/apps.js group, headed by SLOP_GROUP_LABELS), each app's /apps/<id>/
//               (in a build with plain names, the heading carries the i18n key footer.group_<group>)
//               (an app with no group joins the group of the app whose folder holds it)
//   Compare     /compare/, /best/ and every round-up (shared/seo/roundups/)
//   Converters  the first converter page of each category (convert/js/core/pages.js order), and /convert/
//   Guides      How it works, All tools, the first getting-started guides (registry order), Settings, the sitemap
// Each column is a <details open> with its links in a grid (a long list the whole width, a short one half); a small inline script folds them on phones (max-width: 640px) and opens them again on wider
// screens, so without JavaScript every link shows. Styles: shared/footnav/footnav.css. Labels with a data-i18n key are
// translated where the page loads shared/i18n (the homepage).
//   buildFootNav({ apps, groups, roundups, guides, converters }) -> html (pure: tests pass their own data)
//   footNav() -> the html for the site's own data
//   footNavLinks(html) -> [href] in the block
//   addFootSlot(html) -> a converter page with an empty <!-- site:footnav --> slot before its shell script
import { isPage, registryWindow } from './site.mjs';
import { ROUNDUPS } from '../../shared/seo/roundups/index.mjs';
import { GUIDES } from '../../shared/seo/guides/index.mjs';
import { PAGES as CONVERTERS } from '../../convert/js/core/pages.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const PHONE = '(max-width: 640px)';
export const GUIDE_PICKS = 4;   // getting-started guides in the Guides column
const WIDE = 12;                // a list longer than this takes the whole width (fn-wide), a shorter one half

const li = ([href, text, key]) => `<li><a href="${esc(href)}"${key ? ` data-i18n="${key}"` : ''}>${esc(text)}</a></li>`;
function col(head, links, key) {
  const long = links.some(([, t]) => t.length > 22) ? ' fn-long' : '';   // long titles get wider cells
  return `<details class="fn-col${links.length > WIDE ? ' fn-wide' : ''}${long}" open><summary><span${key ? ` data-i18n="${key}"` : ''}>${esc(head)}</span></summary><ul>${links.map(li).join('')}</ul></details>`;
}

export function buildFootNav({ apps, groups = {}, plainNames = false, roundups = [], guides = [], converters = [] }) {
  const pages = apps.filter(isPage);
  const byGroup = new Map(Object.keys(groups).map((g) => [g, []]));
  // an app without a group joins the group of the app it lives in (photoslop/classic/ is PhotoSlop's), else More apps
  const groupOf = (a) => a.group || (pages.find((b) => b !== a && b.group && a.path.startsWith(b.path)) || {}).group;
  for (const a of pages) {
    const g = byGroup.has(groupOf(a)) ? groupOf(a) : '';
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push([`/apps/${a.id}/`, a.name]);
  }
  const cols = [...byGroup].filter(([, l]) => l.length).map(([g, l]) => (g ? col(groups[g], l, plainNames ? `footer.group_${g}` : '') : col('More apps', l, 'footer.more_apps')));
  cols.push(col('Compare', [['/compare/', 'All apps compared', 'footer.all_compared'], ['/best/', 'All comparisons', 'footer.all_comparisons'],
    ...roundups.map((r) => [`/best/${r.slug}/`, r.crumb || r.h1])], 'footer.compare'));
  const firsts = new Map();
  for (const p of converters) if (!firsts.has(p.cat)) firsts.set(p.cat, [`/convert/${p.slug}/`, p.label]);
  cols.push(col('Converters', [...firsts.values(), ['/convert/', 'All conversions', 'footer.all_conversions']], 'footer.converters'));
  const order = new Map(pages.map((a, i) => [a.id, i]));
  const starts = guides.filter((g) => g.slug === 'getting-started' && order.has(g.app)).sort((x, y) => order.get(x.app) - order.get(y.app)).slice(0, GUIDE_PICKS);
  const path = (g) => pages.find((a) => a.id === g.app).path;
  cols.push(col('Guides & help', [['/how-it-works/', 'How it works', 'footer.how'], ['/all-tools/', 'All tools', 'footer.all_tools'],
    ...starts.map((g) => [`/${path(g)}${g.slug}/`, g.h1]), ['/settings/', 'Settings and privacy', 'footer.settings_link'], ['/sitemap.xml', 'Sitemap', 'footer.sitemap']], 'footer.guides'));
  const fold = `<script>(function(){var m=matchMedia('${PHONE}'),s=function(){document.querySelectorAll('.fnav details').forEach(function(d){d.open=!m.matches})};s();m.addEventListener('change',s)})()</script>`;
  return `<nav class="fnav" aria-label="Site map" data-i18n-attr="aria-label:footer.site_map"><div class="fn-grid">${cols.join('')}</div></nav>${fold}`;
}

let cached;
export function footNav() {
  if (cached) return cached;
  const win = registryWindow();
  cached = buildFootNav({ apps: win.SLOP_APPS, groups: win.SLOP_GROUP_LABELS || {}, plainNames: win.SLOP_NAMING === 'plain', roundups: ROUNDUPS, guides: GUIDES, converters: CONVERTERS });
  return cached;
}
export const footNavLinks = (html) => [...(/<nav class="fnav"[\s\S]*?<\/nav>/.exec(html) || [''])[0].matchAll(/<a href="([^"]+)"/g)].map((m) => m[1]);

/** The converter pages (convert/js/core/pages.js), as repo paths. */
export const converterFiles = () => CONVERTERS.map((p) => `convert/${p.slug}/index.html`);
/** A converter page gets the footer in its own frame: a <footer class="cv-foot"> before the shell script. */
export function addFootSlot(html) {
  if (html.includes('<!-- site:footnav -->')) return html;
  const at = html.indexOf('<script src="../../shell/shell.js"></script>');
  if (at < 0) throw new Error('converter page without its shell script: cannot place the footer');
  return `${html.slice(0, at)}<footer class="cv-wrap cv-foot"><!-- site:footnav --><!-- /site:footnav --></footer>\n  ${html.slice(at)}`;
}
