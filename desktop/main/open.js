/* Files the system opens the desktop app with (a double-click, "Open with", a drop on the Dock icon, a second launch with
 * a file, File ▸ Open…) go to the app the site uses for their type (desktop/lib/open-map.js) the way an installed copy
 * of the website gets them: through window.launchQueue, which the preload provides (main/preload.js) and every app's
 * SlopIntake.launch already reads (shared/intake/sources.js). The bytes never cross IPC: each file gets a random token
 * and the page fetches app://<host>/__open/<token> (main/protocol.js), which serves only files handed over here.
 *   createOpener({ map, origin, show })   → { open(paths), take(url), file(token), argvFiles(argv, cwd) }
 *     map: { ext: route } (openMap); show(url, files, newWindow): load url (the first group in the main window, the
 *     others in a window of their own), or send files to the page already showing url and return true; otherwise the
 *     files wait for take(url).
 *     open(paths)    groups the files by route (the app that opens them) and shows each group; returns the routes
 *     take(url)      the files waiting for the page at url (the preload asks once it has loaded); emptied by asking
 *     file(token)    the path of an opened file, for the protocol
 *     argvFiles(argv, cwd, skip)  the existing file paths among command-line arguments (Windows/Linux "Open with"),
 *                    after the first skip ones (1: the program; 2 in a development run: electron and the app folder) */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { routeFor } = require('../lib/open-map');
const { mimeOf, OPEN_PREFIX } = require('../lib/paths');

function createOpener({ map, origin, show }) {
  const tokens = new Map();     // token → absolute path
  const waiting = new Map();    // route → [{ name, type, url, modified }]

  function describe(file) {
    const token = crypto.randomBytes(16).toString('hex');
    tokens.set(token, file);
    let modified = Date.now();
    try { modified = fs.statSync(file).mtimeMs; } catch (e) { /* gone: the fetch says so */ }
    const type = mimeOf(file).split(';')[0];
    return { name: path.basename(file), type: type === 'application/octet-stream' ? '' : type, url: origin + OPEN_PREFIX + token, modified };
  }
  const routeOf = (url) => { try { return new URL(url).pathname; } catch (e) { return ''; } };

  function open(paths) {
    const groups = new Map();   // route → files, in the order the files came
    for (const p of paths || []) {
      const file = path.resolve(String(p));
      let st = null;
      try { st = fs.statSync(file); } catch (e) { st = null; }
      if (!st || !st.isFile()) continue;
      const route = routeFor(file, map);
      if (!groups.has(route)) groups.set(route, []);
      groups.get(route).push(describe(file));
    }
    [...groups].forEach(([route, files], i) => {
      waiting.set(route, (waiting.get(route) || []).concat(files));
      if (show(origin + route, files, i > 0) === true) waiting.delete(route);   // the page was there and took them
    });
    return [...groups.keys()];
  }

  function take(url) {
    const route = routeOf(url);
    const files = waiting.get(route) || [];
    waiting.delete(route);
    return files;
  }

  const file = (token) => tokens.get(String(token || '')) || null;

  function argvFiles(argv, cwd, skip = 1) {
    return (argv || []).slice(skip).filter((a) => a && !a.startsWith('-')).map((a) => path.resolve(cwd || process.cwd(), a))
      .filter((f) => { try { return fs.statSync(f).isFile() && !/\.(exe|asar)$/i.test(f); } catch (e) { return false; } });
  }

  return { open, take, file, argvFiles };
}

module.exports = { createOpener };
