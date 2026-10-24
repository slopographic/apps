// The guide around each app: a sidebar on every page about one app (its landing page, its guides, its task pages and its
// comparisons) that lists all of them, and an "On this page" list of the page's sections. Built from the same data as
// the pages themselves (the registry, shared/seo/tasks, shared/seo/guides, shared/seo/roundups), so a new page shows up
// in its app's sidebar by itself. On a phone the sidebar folds into an "In this guide" menu at the top.
//   appNav(app, { tasks, guides, roundups }, current) -> the sidebar HTML (current: the href of the page shown)
//   withToc(body) -> { body, toc }   ids added to the body's <h2>s, and the list of them
//   docsLayout(nav, toc, body) -> the page's main area: sidebar and content side by side
import { esc } from './landing.mjs';

const slugify = (t) => String(t).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 's';

export function withToc(body) {
  const toc = [], used = new Set();
  const out = body.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (m, attrs = '', inner) => {
    let id = (/\sid="([^"]+)"/.exec(attrs) || [])[1];
    if (!id) { id = slugify(inner); let n = 2; while (used.has(id)) id = `${slugify(inner)}-${n++}`; attrs = `${attrs} id="${id}"`; }
    used.add(id);
    toc.push({ id, text: inner.replace(/<[^>]+>/g, '').trim() });
    return `<h2${attrs}>${inner}</h2>`;
  });
  return { body: out, toc };
}

export function appNav(app, { tasks = [], guides = [], roundups = [] } = {}, current = '') {
  const link = (href, text) => `<li><a href="${esc(href)}"${href === current ? ' aria-current="page"' : ''}>${esc(text)}</a></li>`;
  const group = (title, items) => (items.length ? `<p class="l-side-h">${esc(title)}</p><ul>${items.join('')}</ul>` : '');
  const v = app.video;
  return `<nav class="l-side-nav" aria-label="${esc(app.name)} guide">
<p class="l-side-app"><a href="/apps/${esc(app.id)}/"${`/apps/${app.id}/` === current ? ' aria-current="page"' : ''}>${esc(app.name)}</a></p>
<p><a class="btn l-side-open" href="/${esc(app.path)}">Open ${esc(app.name)}</a></p>
${group('Guides', [...guides.map((g) => link(`/${app.path}${g.slug}/`, g.crumb || g.h1)), ...(v ? [`<li><a href="https://www.youtube.com/watch?v=${esc(v.id)}" rel="noopener">Video tutorial</a></li>`] : [])])}
${group('How to', tasks.map((t) => link(`/${app.path}${t.slug}/`, t.crumb || t.h1)))}
${group('Compared', roundups.map((r) => link(`/best/${r.slug}/`, r.crumb || r.h1)))}
</nav>`;
}

/** The sidebar (the app's guide, then this page's sections) beside the content; a <details> menu on narrow screens. */
export function docsLayout(nav, toc, body) {
  const onPage = toc.length > 2 ? `<p class="l-side-h">On this page</p><ul class="l-toc">${toc.map((t) => `<li><a href="#${esc(t.id)}">${esc(t.text)}</a></li>`).join('')}</ul>` : '';
  return `<div class="l-docs">
<aside class="l-side"><details class="l-side-fold" open><summary>In this guide</summary>
${nav}
${onPage}
</details></aside>
<div class="l-docs-main">
${body}
</div>
</div>`;
}
