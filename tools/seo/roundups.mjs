// Round-up pages: "the best free <kind of tool>", a fair comparison of one of our apps with well-known tools, at
// /best/<slug>/ in the site's look (landing.mjs shell). The copy is in shared/seo/roundups/ (one file per family).
// Every claim about another product carries a source (its own page) and the date it was checked; the page says we make
// one of the tools, states its criteria, and gives each tool an honest "best for". write.mjs adds the head and sitemap.
//   checkRoundup(r, apps) -> throws on the first problem
//   roundupPages(apps, site, ROUNDUPS) -> [{ key, dir, url, html, r }]
//   roundupJsonLd(r, url, site) -> Article, ItemList, BreadcrumbList and FAQPage
import { esc, shell } from './landing.mjs';

const MONTH = /^20\d\d-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export function checkRoundup(r, apps) {
  const fail = (m) => { throw new Error(`roundup ${r.slug}: ${m}`); };
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug || '')) fail('slug must be lower-case words joined by hyphens');
  if (!apps.find((a) => a.id === r.app)) fail(`no app ${r.app} in shared/apps.js`);
  if (!MONTH.test(r.checked || '')) fail('checked must be the date the facts were checked, YYYY-MM-DD');
  if (!r.h1 || !r.lead || !Array.isArray(r.criteria) || r.criteria.length < 3) fail('h1, lead and at least 3 criteria');
  if (!Array.isArray(r.tools) || r.tools.length < 3 || r.tools.length > 8) fail('3 to 8 tools');
  if (r.tools.filter((t) => t.ours).length !== 1) fail('exactly one tool is ours (ours: true)');
  if (!Array.isArray(r.columns) || !r.columns.length) fail('columns: the comparison table headings');
  for (const t of r.tools) {
    if (!t.name || !t.bestFor || !Array.isArray(t.pros) || !Array.isArray(t.cons) || !t.cons.length) fail(`${t.name}: name, bestFor, pros and at least one con`);
    if (!Array.isArray(t.cells) || t.cells.length !== r.columns.length) fail(`${t.name}: one cell per column`);
    if (!t.ours) {
      if (!/^https:\/\//.test(t.url || '')) fail(`${t.name}: its own https URL`);
      if (!Array.isArray(t.sources) || !t.sources.length || t.sources.some((s) => !/^https:\/\//.test(s.url || '') || !s.label)) fail(`${t.name}: sources [{ label, url }] for the facts`);
    }
  }
  if (!Array.isArray(r.faq) || r.faq.length < 3) fail('at least 3 questions');
}

const app = (apps, id) => apps.find((a) => a.id === id);
function body(r, apps) {
  const ours = r.tools.find((t) => t.ours), a = app(apps, r.app);
  const rows = r.tools.map((t) => `<tr><th scope="row">${esc(t.name)}${t.ours ? ' <span class="l-badge">ours</span>' : ''}</th>${t.cells.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');
  const tools = r.tools.map((t, i) => `<h2 id="t${i + 1}">${i + 1}. ${esc(t.name)}${t.ours ? ' (ours)' : ''}</h2>
<p><b>Best for:</b> ${esc(t.bestFor)}</p>
${t.summary ? `<p>${esc(t.summary)}</p>` : ''}
<h3>Good</h3><ul>${t.pros.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
<h3>Not so good</h3><ul>${t.cons.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>
<p>${t.ours ? `<a class="btn" href="/${esc(a.path)}">Open ${esc(a.name)}</a>` : `<a href="${esc(t.url)}" rel="noopener nofollow">${esc(t.name)} website</a>`}${t.sources ? ` · Sources: ${t.sources.map((s) => `<a href="${esc(s.url)}" rel="noopener nofollow">${esc(s.label)}</a>`).join(', ')}` : ''}</p>`).join('\n');
  return `<p class="eyebrow">Compared · checked ${esc(r.checked)}</p>
<h1>${esc(r.h1)}</h1>
<p class="lead">${esc(r.lead)}</p>
<p class="note">We make ${esc(ours.name)}, one of the tools on this page. Every fact about the other tools comes from their own pages, linked under each one, as they read on ${esc(r.checked)}. Prices and features change: check each site before you choose.</p>
<h2>How we compared them</h2>
<ul>${r.criteria.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
<h2>At a glance</h2>
<div class="wrap"><table><caption>${esc(r.h1)}: the main facts side by side</caption>
<thead><tr><th scope="col">Tool</th>${r.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
${tools}
${r.verdict ? `<h2>Which one to choose</h2>\n${(Array.isArray(r.verdict) ? r.verdict : [r.verdict]).map((p) => `<p>${esc(p)}</p>`).join('\n')}` : ''}
<h2>Questions</h2>
${r.faq.map(([q, ans]) => `<h3>${esc(q)}</h3>\n<p>${esc(ans)}</p>`).join('\n')}
<p class="note">Names of other products are trademarks of their owners. Slopographic is not affiliated with them.</p>`;
}

export function roundupJsonLd(r, url, site) {
  return [
    { '@context': 'https://schema.org', '@type': 'Article', headline: r.h1, description: r.description, dateModified: r.checked, url,
      author: { '@type': 'Organization', name: 'Slopographic', url: `${site}/` }, publisher: { '@type': 'Organization', name: 'Slopographic', url: `${site}/` } },
    { '@context': 'https://schema.org', '@type': 'ItemList', name: r.h1, itemListElement: r.tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.name, url: t.ours ? `${site}/apps/${r.app}/` : t.url })) },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
      { '@type': 'ListItem', position: 2, name: 'Compared', item: `${site}/best/` }, { '@type': 'ListItem', position: 3, name: r.crumb || r.h1, item: url }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: r.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
}

export function roundupPages(apps, site, ROUNDUPS) {
  const seen = new Set();
  return ROUNDUPS.map((r) => {
    checkRoundup(r, apps);
    if (seen.has(r.slug)) throw new Error(`roundup ${r.slug}: listed twice`);
    seen.add(r.slug);
    return { key: `best/${r.slug}`, dir: `best/${r.slug}/`, url: `${site}/best/${r.slug}/`, html: shell(body(r, apps)), r };
  });
}

/** The index of every round-up: /best/. */
export function roundupIndex(site, ROUNDUPS) {
  const list = ROUNDUPS.map((r) => `<li><a href="/best/${esc(r.slug)}/">${esc(r.h1)}</a></li>`).join('');
  return { dir: 'best/', url: `${site}/best/`, html: shell(`<p class="eyebrow">Compared</p>\n<h1>Free tools compared</h1>\n<p class="lead">Side-by-side comparisons of free tools for common jobs, with the facts checked against each tool's own pages and dated. We make one tool on each page and say which.</p>\n<ul>${list}</ul>`) };
}
