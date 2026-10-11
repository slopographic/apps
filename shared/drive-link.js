/* Slop Drive link: a "Slop Drive" link with the Drive icon for an app's top bar or menu, so there is always an
 * easy way back to the drive. The link goes to the Drive path in the registry (SLOP_APPS, id 'drive') and resolves
 * from this script's own location, so it works from any folder depth. A plain click opens Drive in the same tab;
 * Shift-, Ctrl/⌘- or middle-click opens it in a new tab. Classic script; exposes window.SlopDriveLink:
 *   SlopDriveLink.mount(container, { before })   container: an element or a selector; the link is appended (or
 *                                                 placed before `before`). Mounting twice in one place adds one link.
 *   SlopDriveLink.href()                          the absolute URL of Slop Drive. */
(function () {
  'use strict';
  if (window.SlopDriveLink) return;
  const self = document.currentScript;
  // The site root: from this script's URL, else from the page. A blob: or about: page (an offline file run inline)
  // has no usable base, so the root is null and no link is made; the throw would otherwise stop the whole script.
  function rootUrl() {
    try { return self && self.src ? new URL('../', self.src).href : new URL('/', location.href).href; } catch (e) { return null; }
  }
  const ROOT = rootUrl();
  const ICON = '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>';
  const CSS = '.sdl{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;margin-left:4px;border-radius:6px;' +
    'color:inherit;font:inherit;font-size:13px;line-height:1;text-decoration:none;white-space:nowrap;opacity:.85;flex:none}' +
    '.sdl:hover,.sdl:focus-visible{opacity:1;background:rgba(127,127,127,.16);outline:none}' +
    '.sdl svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}';

  /** The absolute Drive URL, or null when the page has no site root. */
  function href() {
    if (!ROOT) return null;
    const app = (window.SLOP_APPS || []).find((a) => a.id === 'drive');
    return new URL(app ? app.path : 'drive/', ROOT).href;
  }
  function style() {
    if (document.getElementById('sdl-style')) return;
    const s = document.createElement('style');
    s.id = 'sdl-style';
    s.textContent = CSS;
    document.head.append(s);
  }
  /** The link element (not yet placed). */
  function build() {
    style();
    const a = document.createElement('a');
    a.className = 'sdl';
    a.href = href();
    a.title = 'Open Slop Drive (Shift- or middle-click: new tab)';
    a.setAttribute('aria-label', 'Slop Drive');
    a.dataset.sdl = '';
    a.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON}</svg><span>Slop Drive</span>`;
    // Plain click: the browser follows the link in this tab. Modified or middle clicks open a new tab.
    a.addEventListener('click', (e) => {
      if (e.button !== 0 || e.shiftKey || e.ctrlKey || e.metaKey) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
    });
    a.addEventListener('auxclick', (e) => {
      if (e.button === 1) { e.preventDefault(); window.open(a.href, '_blank', 'noopener'); }
    });
    return a;
  }
  function mount(container, { before } = {}) {
    const host = typeof container === 'string' ? document.querySelector(container) : container;
    if (!host) return null;
    const have = host.querySelector(':scope > [data-sdl]');
    if (have) return have;
    const a = build();
    const ref = typeof before === 'string' ? host.querySelector(before) : before;
    host.insertBefore(a, ref && ref.parentNode === host ? ref : null);
    return a;
  }

  window.SlopDriveLink = { mount, href };
})();
