/* SlopHeader: adds the shell's buttons to the page header: "Apps" (opens the switcher) and the
 * notifications bell. Goes at the end of header.topbar, header.menubar or header.nav, or floats at the
 * top right when the page has no header. Loaded and mounted by shell/shell.js, which applies the language after.
 * The Apps text and the button's aria-label are marked for SlopI18n; the title is set here (it carries the shortcut). */
(function () {
  'use strict';
  if (window.SlopHeader) return;
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  let sw = null;

  /** The button's title in the chosen language: "Switch app (Ctrl+Space)". English when SlopI18n is not on the page. */
  function title() {
    const shortcut = (isMac ? '⌘' : 'Ctrl') + '+Space';
    const I = window.SlopI18n;
    const s = I ? I.t('shell.switch_title', { shortcut }) : '';
    return s && s !== 'shell.switch_title' ? s : 'Switch app (' + shortcut + ')';
  }

  function mount() {
    if (window.SlopBrand && window.SlopBrand.appMark) window.SlopBrand.appMark(); // the app's icon in the header brand (brand/brand.js)
    const box = document.createElement('div');
    box.className = 'sh-hdr';
    sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'sh-hbtn sh-switch';
    sw.setAttribute('aria-label', 'Switch app');
    sw.setAttribute('data-i18n-attr', 'aria-label:shell.switch_app');
    sw.setAttribute('aria-haspopup', 'dialog');
    sw.title = title();
    sw.innerHTML = ICON_SEARCH + '<span class="sh-hbtn-txt" data-i18n="nav.apps">Apps</span>';
    sw.addEventListener('click', () => window.SlopSwitcher.toggle());
    box.append(sw);
    const host = document.querySelector('header.topbar, header.menubar, header.nav, header');
    if (host) host.append(box);
    else { box.classList.add('sh-fab'); document.body.append(box); }
    window.SlopNotify.mountBell(box);
    window.addEventListener('slop-lang', () => { sw.title = title(); });
  }

  window.SlopHeader = { mount };
})();
