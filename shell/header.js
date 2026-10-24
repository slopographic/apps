/* SlopHeader: adds the shell's buttons to the page header: the theme menu (every page, from SlopTheme), "Apps" (opens
 * the switcher), the notifications bell, and Tutorial (the app's YouTube tutorial, when the registry has one). Goes at the end of header.topbar, header.menubar or header.nav, or floats at the
 * top right when the page has no header. Loaded and mounted by shell/shell.js, which applies the language after.
 * The Apps text and the button's aria-label are marked for SlopI18n; the title is set here (it carries the shortcut). */
(function () {
  'use strict';
  if (window.SlopHeader) return;
  const ICON_SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg>';
  const ICON_THEME = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>';
  const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z" fill="currentColor"/></svg>';
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  let sw = null;

  /** The button's title in the chosen language: "Switch app (Ctrl+Space)". English when SlopI18n is not on the page. */
  function title() {
    const shortcut = (isMac ? '⌘' : 'Ctrl') + '+Space';
    const I = window.SlopI18n;
    const s = I ? I.t('shell.switch_title', { shortcut }) : '';
    return s && s !== 'shell.switch_title' ? s : 'Switch app (' + shortcut + ')';
  }

  /** The theme button: a menu of System and every theme in SlopTheme, the current choice checked. None without SlopTheme. */
  function themeButton() {
    const T = window.SlopTheme;
    if (!T || !T.THEMES) return null;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sh-hbtn slop-hbtn sh-theme';
    b.title = 'Theme';
    b.setAttribute('aria-label', 'Theme');
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.innerHTML = ICON_THEME + '<span class="slop-hbtn-txt">Theme</span>';
    b.addEventListener('click', () => {
      if (!window.SlopUI) return;
      const now = T.get();
      const pick = (id) => () => { const r = T.set(id); if (!r.ok && window.SlopUI.toast) window.SlopUI.toast(r.error); };
      const items = [{ label: 'System', check: now === T.SYSTEM, act: pick(T.SYSTEM) }, '-']
        .concat(T.THEMES.map((t) => ({ label: t.name, check: now === t.id, act: pick(t.id) })));
      const r = b.getBoundingClientRect();
      const m = window.SlopUI.menu(items, r.left, r.bottom + 4);
      b.setAttribute('aria-expanded', 'true');
      const done = new MutationObserver(() => { if (!m.isConnected) { b.setAttribute('aria-expanded', 'false'); done.disconnect(); } });
      done.observe(document.body, { childList: true });
    });
    return b;
  }

  /** The app's video tutorial (shared/apps.js `video`), opened on YouTube in a new tab: the page itself loads nothing
   *  from YouTube. Null on a page whose app has no tutorial. */
  function tutorialLink() {
    const app = window.SlopShell && window.SlopShell.currentApp, v = app && app.video;
    if (!v || !/^[\w-]{6,20}$/.test(v.id)) return null;
    const a = document.createElement('a');
    a.className = 'sh-hbtn slop-hbtn sh-tutorial';
    a.href = 'https://www.youtube.com/watch?v=' + v.id;
    a.target = '_blank'; a.rel = 'noopener';
    a.title = 'Watch the video tutorial (YouTube)';
    a.setAttribute('aria-label', 'Watch the ' + app.name + ' video tutorial on YouTube');
    a.innerHTML = ICON_PLAY;   // an icon only: the app's own controls keep the header's room (title and label say what it is)
    return a;
  }

  function mount() {
    if (window.SlopBrand && window.SlopBrand.appMark) window.SlopBrand.appMark(); // the app's icon in the header brand (brand/brand.js)
    const box = document.createElement('div');
    box.className = 'sh-hdr';
    sw = document.createElement('button');
    sw.type = 'button';
    sw.className = 'sh-hbtn slop-hbtn sh-switch';
    sw.setAttribute('aria-label', 'Switch app');
    sw.setAttribute('data-i18n-attr', 'aria-label:shell.switch_app');
    sw.setAttribute('aria-haspopup', 'dialog');
    sw.title = title();
    sw.innerHTML = ICON_SEARCH + '<span class="sh-hbtn-txt slop-hbtn-txt" data-i18n="nav.apps">Apps</span>';
    sw.addEventListener('click', () => window.SlopSwitcher.toggle());
    const tut = tutorialLink(), theme = themeButton();
    if (tut) box.append(tut);
    if (theme) box.append(theme);
    box.append(sw);
    const host = document.querySelector('header.topbar, header.menubar, header.nav, header');
    const slot = host && host.querySelector('.sh-hdr-slot');   // room kept for the buttons in the page's own HTML
    if (slot) slot.replaceWith(box); else if (host) host.append(box);
    if (host) { if (window.SlopHbtn) window.SlopHbtn.fit(host); }   // labels give way to icons when the header is full
    else { box.classList.add('sh-fab'); document.body.append(box); }
    window.SlopNotify.mountBell(box);
    window.addEventListener('slop-lang', () => { sw.title = title(); });
  }

  window.SlopHeader = { mount };
})();
