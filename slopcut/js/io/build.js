/* SlopCut: "Download app (offline .html)". Builds one self-contained HTML file: every stylesheet and
   script listed with data-src in index.html is inlined (the vendored muxers too). Slop Hub is left out,
   because Slop Drive belongs to the website's origin; the shared command palette (SlopCmd) is inlined with all its parts. */
(function () {
  'use strict';
  const SE = window.SE;
  const B = SE.build = {};
  const root = () => (window.SlopHub ? SlopHub.ROOT : new URL('../', location.href).href);
  const esc = (code) => code.replace(/<\/(script|style)/gi, '<\\/$1');
  async function text(rel) { const r = await fetch(new URL(rel, root()).href, { cache: 'no-store' }); if (!r.ok) throw new Error('Could not load ' + rel); return r.text(); }
  async function optional(rel) { try { return await text(rel); } catch (e) { return null; } }

  /** Build the offline HTML string from the deployed sources. */
  B.make = async function () {
    let html = await text('slopcut/index.html');
    const files = new Map();
    for (const m of html.matchAll(/data-src="([^"]+)"/g)) if (!files.has(m[1]) && m[1] !== 'shared/hub.js') files.set(m[1], await text(m[1]));
    html = html.replace(/^[^\n]*data-offline="strip"[^\n]*\n/gm, () => '');
    html = html.replace(/<link\b[^>]*\bdata-src="([^"]+)"[^>]*>/g, (m, p) => '<style data-src="' + p + '">\n' + esc(files.get(p) || '') + '\n</style>');
    html = html.replace(/<script\b[^>]*\bdata-src="([^"]+)"[^>]*><\/script>/g, (m, p) => {
      if (p === 'shared/hub.js') return '';
      const app = (/\sdata-app="([^"]+)"/.exec(m) || [])[1];   // theme.js reads its app id from this attribute
      let out = '<script data-src="' + p + '"' + (app ? ' data-app="' + app + '"' : '') + '>\n' + esc(files.get(p) || '') + '\n</script>';
      if (p === 'shared/slopui.js') out = '<script>window.SE = { offline: true };</script>\n' + out;
      return out;
    });
    const fav = await optional('favicon.svg');
    if (fav) html = html.replace(/href="\.\.\/favicon\.svg"/, () => 'href="data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(fav))) + '"');
    html = html.replace(/href="\.\.\/"/g, () => 'href="https://slopographic.com/"');
    html = html.replace('<head>', () => '<head>\n  <meta name="slopedit-build" content="offline">');
    return html;
  };
  SE.act.downloadApp = async function () {
    if (SE.offline) { SlopUI.toast('This is already the offline app'); return; }
    try {
      SE.app.status('Building the offline app…');
      const html = await B.make();
      SlopUI.download(new Blob([html], { type: 'text/html' }), 'slopedit.html');
      SE.app.status('Downloaded slopedit.html (' + Math.round(html.length / 1024) + ' KB). It works without a connection.');
    } catch (e) { SlopUI.alert('Download app', 'Could not build the offline file: ' + e.message); }
  };
})();
