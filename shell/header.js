/* SlopHeader: adds the shell's buttons to the page header: "Apps" (opens the switcher) and the
 * notifications bell. Goes at the end of header.topbar, header.menubar or header.nav, or floats at the
 * top right when the page has no header. Loaded and mounted by shell/shell.js. */
(function () {
  'use strict';
  if (window.SlopHeader) return;
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function mount() {
    const box = document.createElement('div');
    box.className = 'sh-hdr';
    const sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'sh-hbtn sh-switch';
    sw.setAttribute('aria-label', 'Switch app');
    sw.setAttribute('aria-haspopup', 'dialog');
    sw.title = 'Switch app (' + (isMac ? '⌘' : 'Ctrl') + '+Space)';
    sw.innerHTML = ICON_SEARCH + '<span class="sh-hbtn-txt">Apps</span>';
    sw.addEventListener('click', () => window.SlopSwitcher.toggle());
    box.append(sw);
    const host = document.querySelector('header.topbar, header.menubar, header.nav, header');
    if (host) host.append(box);
    else { box.classList.add('sh-fab'); document.body.append(box); }
    window.SlopNotify.mountBell(box);
  }

  window.SlopHeader = { mount };
})();
