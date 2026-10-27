/* Which of the site's tracked files the desktop app carries (desktop/scripts/bundle.mjs copies them into desktop/.site/).
 * Everything the pages load stays; what only the repository or the public website needs is left out:
 *   - the repository's own folders: tests/, tools/, .github/, .githooks/, the desktop app itself;
 *   - the generated SEO copies in other languages (/sv/, /de/…: the app switches language in the page, it needs no
 *     second copy of every page) and the SEO round-ups and comparisons (best/, compare/), which only search engines read;
 *   - the website's root files: sitemaps, robots.txt, ads.txt, CNAME, the search-console token (*.txt), screenshots at
 *     the root (*.png), package files and dot files. The licence and notice files stay.
 * A link to a page that is not carried opens on the website instead (main/navigation.js).
 * Pure: the caller passes the file list (git ls-files) and the language folder names.
 *   bundled(file, langDirs)       → true when the app carries the repo path
 *   bundleFiles(files, langDirs)  → the carried paths, in the order given
 *   langDirsOf(langs, rootLang)   → the folder names of the other languages ('sv', 'pt-br', …) from SlopI18n.LANGS */
'use strict';

const DROP_DIRS = ['tests/', 'tools/', '.github/', '.githooks/', 'desktop/', 'best/', 'compare/', 'node_modules/'];
const DROP_ROOT = /^(?:[^/]+\.(?:png|xml|txt)|CNAME|README\.md|package(?:-lock)?\.json|\.[^/]+)$/;

function bundled(file, langDirs) {
  const f = String(file || '');
  if (!f || f.startsWith('/') || f.split('/').includes('..')) return false;
  if (DROP_DIRS.some((d) => f.startsWith(d))) return false;
  if (DROP_ROOT.test(f)) return false;
  const top = f.includes('/') ? f.slice(0, f.indexOf('/')) : '';
  if (top && (langDirs || []).includes(top)) return false;
  return true;
}
const bundleFiles = (files, langDirs) => files.filter((f) => bundled(f, langDirs));

const langDirsOf = (langs, rootLang) => (langs || []).map((l) => String(l.code || l).toLowerCase()).filter((c) => c && c !== String(rootLang || 'en').toLowerCase());

module.exports = { bundled, bundleFiles, langDirsOf, DROP_DIRS };
