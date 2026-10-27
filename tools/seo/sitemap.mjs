// The sitemaps (tools/seo/write.mjs): sitemap.xml lists the root language's pages, sitemap-<code>.xml each other
// published language's (sv: sitemap-sv.xml), and sitemap-index.xml all of them (robots.txt names both sitemap.xml and the
// index). A URL keeps the date it was last written with; only a new URL gets this run's date.
//   sitemaps(byLang, date, codes) -> [{ file, html, before }] (a sitemap of a language no longer published: html null)
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, SITE } from './site.mjs';
import { ROOT_LANG } from './lang.mjs';

const read = async (f) => (existsSync(f) ? readFile(f, 'utf8') : '');
export const sitemapName = (code) => (code === ROOT_LANG ? 'sitemap.xml' : `sitemap-${code.toLowerCase()}.xml`);

async function urlset(file, urls, date, keepOld) {
  const old = await read(file);
  const list = [...urls];
  // Keep the pages of the root sitemap that are not written here (the convert hub's own entries), while their file is there
  // (a white-label build can leave a page out: the typeface page of a site without its own fonts).
  const onDisk = (u) => { const rel = u.slice(SITE.length + 1); return existsSync(path.join(ROOT, rel === '' || rel.endsWith('/') ? rel + 'index.html' : rel)); };
  if (keepOld) for (const m of old.matchAll(/<loc>([^<]+)<\/loc>/g)) if (!list.includes(m[1]) && onDisk(m[1])) list.push(m[1]);
  const dated = new Map([...old.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));
  // the order the file had (a smaller change), new URLs after it in the order written
  const at = new Map([...old.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m, i) => [m[1], i]));
  const ordered = [...new Set(list)].map((u, i) => [u, at.has(u) ? at.get(u) : 1e9 + i]).sort((x, y) => x[1] - y[1]).map((x) => x[0]);
  const body = ordered.map((u) => `  <url><loc>${u}</loc><lastmod>${dated.get(u) || date}</lastmod></url>`).join('\n');
  return { file, html: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`, before: old };
}

export async function sitemaps(byLang, date, codes) {
  const out = [];
  for (const code of codes) out.push(await urlset(path.join(ROOT, sitemapName(code)), byLang.get(code), date, code === ROOT_LANG));
  const names = new Set(codes.map(sitemapName));
  for (const f of readdirSync(ROOT).filter((x) => /^sitemap-(?!index)[a-z-]+\.xml$/.test(x) && !names.has(x))) out.push({ file: path.join(ROOT, f), html: null, before: await read(path.join(ROOT, f)) });
  const index = path.join(ROOT, 'sitemap-index.xml');
  const body = codes.map((c) => `  <sitemap><loc>${SITE}/${sitemapName(c)}</loc></sitemap>`).join('\n');
  out.push({ file: index, html: `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`, before: await read(index) });
  return out;
}
