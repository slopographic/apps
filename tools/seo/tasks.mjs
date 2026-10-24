// Task pages: one page per thing people search for that an app does ("bulk background remover", "merge PDF files"),
// written to /<app path><slug>/ with the landing pages' look (landing.mjs). The copy is in shared/seo/tasks/ (one file
// per family of apps, merged by index.mjs); this file checks it and draws the pages. Each page has the task's steps, its
// questions and answers, the app's picture and tutorial, an Open button that starts the app set up for the task
// (`query`), the app's other tasks and its landing page. write.mjs adds the head block and the sitemap entries.
//   taskPages(apps, site, TASKS) -> [{ key, dir, url, html, app, task }]
//   taskJsonLd(task, app, url, site) -> the page's JSON-LD (WebPage, BreadcrumbList, HowTo, FAQPage, VideoObject)
//   videoJsonLd(app, site) -> a VideoObject for an app's tutorial, or null
import { esc, shell, mediaBlock, cardList, related } from './landing.mjs';

/** Checks one task's copy; throws with the task's key on the first problem. */
export function checkTask(t, app) {
  const key = `${t.app}/${t.slug}`;
  const fail = (m) => { throw new Error(`task ${key}: ${m}`); };
  if (!app) fail('no such app in shared/apps.js');
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(t.slug || '')) fail('slug must be lower-case words joined by hyphens');
  if (!t.h1 || t.h1.length > 80) fail('h1 missing or longer than 80 characters');
  if (!t.lead || t.lead.length < 60) fail('lead missing or shorter than 60 characters');
  if (!Array.isArray(t.steps) || t.steps.length < 3 || t.steps.length > 6) fail('3 to 6 steps');
  if (!Array.isArray(t.faq) || t.faq.length < 3) fail('at least 3 questions');
  for (const [q, a] of t.faq) if (!q || !q.endsWith('?') || !a || a.length < 40) fail(`question "${q}": a question mark and an answer of 40+ characters`);
  if (t.query && !/^[a-z0-9_-]+=[a-z0-9_.-]+(&[a-z0-9_-]+=[a-z0-9_.-]+)*$/i.test(t.query)) fail('query must be like key=value&key=value (plain words)');
  if (t.body && !Array.isArray(t.body)) fail('body is a list of paragraphs');
}


export function videoJsonLd(app, site) {
  const v = app.video;
  if (!v) return null;
  return { '@context': 'https://schema.org', '@type': 'VideoObject', name: v.title, description: `${app.name}: ${app.tagline}`,
    thumbnailUrl: `${site}/assets/video/yt-${v.id}.jpg`, uploadDate: v.date, duration: v.duration,
    contentUrl: `https://www.youtube.com/watch?v=${v.id}`, embedUrl: `https://www.youtube-nocookie.com/embed/${v.id}` };
}

/** The Open link: the app, set up for the task when the task has a query. */
const openHref = (app, t) => `/${app.path}${t.query ? `?${t.query}` : ''}`;

function body(t, app, apps, siblings) {
  const steps = t.steps.map((s) => `<li>${esc(s)}</li>`).join('');
  const faq = t.faq.map(([q, a]) => `<h3>${esc(q)}</h3>\n<p>${esc(a)}</p>`).join('\n');
  const more = siblings.length ? `<h2>More with ${esc(app.name)}</h2>\n<ul>${siblings.map((s) => `<li><a href="/${esc(app.path)}${esc(s.slug)}/">${esc(s.h1)}</a></li>`).join('')}</ul>` : '';
  return `<p class="eyebrow"><a href="/apps/${esc(app.id)}/">${esc(app.name)}</a> · free, in your browser</p>
<h1>${esc(t.h1)}</h1>
<p class="lead">${esc(t.lead)}</p>
<p><a class="btn" href="${esc(openHref(app, t))}">${esc(t.cta || `Open ${app.name}`)}</a></p>
${mediaBlock(app)}
<h2>How to do it</h2>
<ol>${steps}</ol>
${(t.body || []).map((p) => `<p>${esc(p)}</p>`).join('\n')}
<p class="note">Your files stay on this device: ${esc(app.name)} runs in your browser, with no upload, no account and no watermark.</p>
<h2>Questions</h2>
${faq}
${more}
<h2>Related apps</h2>
${cardList(related(app, apps).slice(0, 3))}`;
}

export function taskJsonLd(t, app, url, site) {
  const landing = `${site}/apps/${app.id}/`;
  const out = [
    { '@context': 'https://schema.org', '@type': 'WebPage', name: t.title, description: t.description, url, isPartOf: { '@type': 'WebSite', name: 'Slopographic', url: `${site}/` } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
      { '@type': 'ListItem', position: 2, name: app.name, item: landing },
      { '@type': 'ListItem', position: 3, name: t.crumb || t.h1, item: url }] },
    { '@context': 'https://schema.org', '@type': 'HowTo', name: t.h1, description: t.lead, tool: { '@type': 'HowToTool', name: app.name },
      step: t.steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })) },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: t.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const v = videoJsonLd(app, site);
  if (v) out.push(v);
  return out;
}

export function taskPages(apps, site, TASKS) {
  const byId = new Map(apps.map((a) => [a.id, a]));
  const seen = new Set();
  return TASKS.map((t) => {
    const app = byId.get(t.app);
    checkTask(t, app);
    const dir = `${app.path}${t.slug}/`;
    if (seen.has(dir)) throw new Error(`task ${t.app}/${t.slug}: listed twice`);
    seen.add(dir);
    const siblings = TASKS.filter((s) => s.app === t.app && s.slug !== t.slug);
    return { key: `${t.app}/${t.slug}`, dir, url: `${site}/${dir}`, html: shell(body(t, app, apps, siblings)), app, task: t };
  });
}
