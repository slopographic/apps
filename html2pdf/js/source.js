/* Slop HTML to PDF: reads the HTML the person gave us. Parsed inertly (DOMParser runs no script and loads nothing).
 * Removes scripts, handlers, remote links and @import, and maps relative image paths to attached files by file name.
 * Classic script. Exposes window.H2P.source. */
(function () {
  'use strict';
  const DROP_TAGS = 'script,iframe,frame,frameset,object,embed,applet,link,meta,base,portal';
  const SRC_ATTRS = { src: 1, 'xlink:href': 1 };
  const URL_ATTRS = { action: 1, formaction: 1, poster: 1, background: 1, data: 1, ping: 1, srcset: 1, imagesrcset: 1 };

  /** A relative reference: no scheme, not a fragment, not a site-root or protocol-relative path. */
  const isRelative = (u) => !/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(String(u).trim());

  /** The file name a reference points at: 'images/a%20b.png?x=1' gives 'a b.png'. */
  function baseName(u) {
    let s = String(u).split(/[?#]/)[0];
    try { s = decodeURIComponent(s); } catch (e) { /* keep the raw text */ }
    return s.split(/[\\/]/).pop().trim();
  }

  /** CSS: no @import (it would fetch), and url() to an attached file becomes its blob URL. */
  function rewriteCss(css, images) {
    return String(css)
      .replace(/@import[^;]*;?/gi, '')
      .replace(/url\(\s*(['"]?)([^'")]*)\1\s*\)/gi, (m, q, u) => {
        const t = u.trim();
        if (!isRelative(t)) return m;
        const blob = images.get(baseName(t));
        return blob ? `url("${blob}")` : m;
      });
  }

  /** Cleans the HTML. images: Map of file name to blob URL. Returns { styles, body } for the sheet. */
  function prepare(html, images = new Map()) {
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    doc.querySelectorAll(DROP_TAGS).forEach((n) => n.remove());
    const styles = [...doc.querySelectorAll('style')].map((s) => {
      const css = rewriteCss(s.textContent, images);
      s.remove();
      return `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`;
    }).join('');
    for (const n of doc.body.querySelectorAll('*')) {
      const tag = n.tagName.toLowerCase();
      for (const a of [...n.attributes]) {
        const name = a.name.toLowerCase(), v = a.value.trim();
        if (name.startsWith('on') || URL_ATTRS[name]) { n.removeAttribute(a.name); continue; }
        if (name === 'style') { n.setAttribute(a.name, rewriteCss(a.value, images)); continue; }
        if (SRC_ATTRS[name] || (name === 'href' && tag === 'image')) {
          // An attached file by name, or data:/blob: as it is. Anything else (remote, or a missing local file) is removed, never fetched.
          if (isRelative(v) && images.has(baseName(v))) n.setAttribute(a.name, images.get(baseName(v)));
          else if (!/^(data:|blob:|#)/i.test(v)) n.removeAttribute(a.name);
          continue;
        }
        if (name === 'href' && !v.startsWith('#')) n.removeAttribute(a.name); // links stay as text
      }
    }
    return { styles, body: doc.body.innerHTML };
  }

  window.H2P = Object.assign(window.H2P || {}, { source: { prepare, rewriteCss, baseName, isRelative } });
})();
