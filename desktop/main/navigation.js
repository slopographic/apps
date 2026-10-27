/* Where a link or a new window goes in the desktop app:
 *   - a page of the bundled site (app://<host>/…) opens in the app;
 *   - a page of the site that the app does not carry (the SEO pages, desktop/lib/bundle-list.js) opens on the website;
 *   - http(s) and mailto links open in the default browser or mail program;
 *   - a file dragged onto the window where the page takes no drop (the browser would show it, file://) opens in the app
 *     that takes its type, as File ▸ Open… does;
 *   - blob: and about:blank windows (a print preview, a download the page made) stay in the app; anything else is refused.
 *   decide(url, { origin, website, carried(pathname) }) → { action: 'allow' | 'external' | 'file' | 'deny', url?, file? }
 *   guard(contents, ctx)  wires decide into will-navigate and the window-open handler of a WebContents.
 *     ctx: { origin, website, carried, openExternal(url), openFiles(paths) } */
'use strict';
const { fileURLToPath } = require('node:url');

function decide(url, { origin, website, carried }) {
  let u;
  try { u = new URL(url); } catch (e) { return { action: 'deny' }; }
  if (`${u.protocol}//${u.host}` === origin) {   // not u.origin: Node gives 'null' for a scheme it does not know
    if (!carried || carried(u.pathname)) return { action: 'allow' };
    return website ? { action: 'external', url: website.replace(/\/+$/, '') + u.pathname + u.search + u.hash } : { action: 'deny' };
  }
  if (u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'mailto:') return { action: 'external', url: u.href };
  if (u.protocol === 'file:') { try { return { action: 'file', file: fileURLToPath(u) }; } catch (e) { return { action: 'deny' }; } }
  if (u.protocol === 'blob:' || u.href === 'about:blank') return { action: 'allow' };
  return { action: 'deny' };
}

function guard(contents, ctx) {
  const act = (d) => {
    if (d.action === 'external') ctx.openExternal(d.url);
    else if (d.action === 'file') ctx.openFiles([d.file]);
  };
  contents.on('will-navigate', (e, url) => {
    const d = decide(url, ctx);
    if (d.action === 'allow') return;
    e.preventDefault();
    act(d);
  });
  contents.setWindowOpenHandler(({ url }) => {
    const d = decide(url, ctx);
    if (d.action === 'allow') return { action: 'allow' };
    act(d);
    return { action: 'deny' };
  });
}

module.exports = { decide, guard };
