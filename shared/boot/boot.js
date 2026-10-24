/* SlopBoot: an app page stays behind a plain cover in the theme's background until it is built, then shows whole, so
 * nobody sees the bare HTML while the scripts add the menus, rails and panels one by one. Classic script: load it in the
 * <head> right after shared/theme/theme.js (which sets the --sl-* colours the cover uses), on every app page. Without
 * JavaScript nothing is covered.
 * The page counts as built once the document has been parsed (every classic and deferred script has run), the shell
 * has put its header buttons in (SlopShell.ready, when the page has the shell), and nothing has been added to it for
 * QUIET ms (a restored tab), at most SETTLE ms after parsing; and never later than LIMIT ms after the start. On a slow load a small pulsing drop shows after a moment;
 * a fast one goes from the background colour straight to the app. The cover takes no clicks or keys.
 *   SlopBoot.reveal()   shows the page now (an app that knows it is ready may call it; calling it again does nothing)
 *   SlopBoot.done       a promise, resolved when the page is shown
 *   SlopBoot.at         when it was shown (performance.now() ms), or 0 while covered
 *   SlopBoot.timing     { QUIET, SETTLE, LIMIT } in ms */
(function () {
  'use strict';
  var root = document.documentElement;
  if (window.SlopBoot || !root) return;
  var QUIET = 120, SETTLE = 2000, LIMIT = 6000, FADE = 160;
  var DROP = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpath d='M16 2C16 2 6 13.5 6 20a10 10 0 0 0 20 0C26 13.5 16 2 16 2z'/%3E%3C/svg%3E\")";
  var css =
    'html.slop-booting::after{content:"";position:fixed;inset:0;z-index:2147483646;pointer-events:none;' +
    'background:var(--sl-background,Canvas);opacity:1;transition:opacity ' + FADE + 'ms ease-out}' +
    'html.slop-booting::before{content:"";position:fixed;inset-block-start:50%;inset-inline-start:50%;width:36px;height:36px;' +
    'margin:-18px 0 0 -18px;z-index:2147483647;pointer-events:none;background:var(--sl-accent,#d4ff3a);' +
    '-webkit-mask:' + DROP + ' center/contain no-repeat;mask:' + DROP + ' center/contain no-repeat;' +
    'opacity:0;animation:slop-boot-in .3s .45s ease-out forwards,slop-boot-pulse 1.2s .75s ease-in-out infinite}' +
    'html.slop-boot-out::after,html.slop-boot-out::before{opacity:0;animation:none}' +
    '@keyframes slop-boot-in{to{opacity:1}}@keyframes slop-boot-pulse{50%{transform:scale(.86);opacity:.55}}' +
    '@media (prefers-reduced-motion:reduce){html.slop-booting::before{animation:slop-boot-in .01s .45s forwards}' +
    'html.slop-booting::after{transition:none}}';
  var style = document.createElement('style');
  style.id = 'slop-boot-css';
  style.textContent = css;
  (document.head || root).appendChild(style);
  root.classList.add('slop-booting');

  var shown = false, resolve, quietTimer = 0, settleTimer = 0, mo = null;
  var done = new Promise(function (r) { resolve = r; });
  function reveal() {
    if (shown) return;
    shown = true;
    api.at = Math.round(performance.now());
    clearTimeout(quietTimer); clearTimeout(settleTimer); clearTimeout(limitTimer);
    if (mo) mo.disconnect();
    root.classList.add('slop-boot-out');
    setTimeout(function () {   // and leaves no trace: a page that saves itself (an offline copy) is as it was sent
      root.classList.remove('slop-booting', 'slop-boot-out');
      if (!root.classList.length) root.removeAttribute('class');
      if (style.parentNode) style.parentNode.removeChild(style);
    }, FADE);
    resolve();
  }
  var limitTimer = setTimeout(reveal, LIMIT);
  /** After parsing: show once the page has been still for QUIET ms (two frames at least), or after SETTLE ms. */
  function settle() {
    if (shown) return;
    settleTimer = setTimeout(reveal, SETTLE);
    var shell = window.SlopShell && window.SlopShell.ready;
    if (shell && typeof shell.then === 'function') shell.then(watch, watch); else watch();
  }
  function watch() {
    if (shown) return;
    var still = function () { clearTimeout(quietTimer); quietTimer = setTimeout(function () { requestAnimationFrame(function () { requestAnimationFrame(reveal); }); }, QUIET); };
    if (typeof MutationObserver === 'function' && document.body) {
      mo = new MutationObserver(still);
      mo.observe(document.body, { childList: true, subtree: true });
    }
    still();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', settle, { once: true });
  else settle();
  window.addEventListener('error', function (e) { if (e && e.target === window) reveal(); });   // a script that throws must not leave the cover up
  var api = window.SlopBoot = { reveal: reveal, done: done, at: 0, timing: { QUIET: QUIET, SETTLE: SETTLE, LIMIT: LIMIT } };
})();
