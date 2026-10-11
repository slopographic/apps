/* Slopographic PWA glue (classic script, sets window.SlopPWA). See shared/pwa/HANDOFF.md.
 *   SlopPWA.mount({ install: '#pwa-install' })  once per page. Registers the service worker
 *     after the page load, shows the install button only when the browser offers an install,
 *     and asks for persistent storage after install or when running standalone.
 *     A no-op (returns false) when the browser has no service worker support.
 *   SlopPWA.requestPersist()   asks the browser to keep storage; returns and records the answer.
 *   SlopPWA.persistAnswer()    the recorded answer: 'granted' | 'denied' | 'unsupported' | null.
 *   SlopPWA.persistMessage(a)  plain-words text for an answer (shown in Slop Drive).
 *   SlopPWA.onPersist(fn)      fn(answer) runs whenever an answer is recorded. */
(function (win) {
  'use strict';
  const NAV = win.navigator;
  const KEY = 'slop-pwa.persist';
  const STYLE = '.pwa-install{font-size:12px;padding:6px 10px;white-space:nowrap}.pwa-install[hidden]{display:none!important}';
  const MESSAGES = {
    granted: 'Kept by the browser. It has agreed to keep Slop Drive, so it will not be cleared to free up space. Clearing this site’s data would still delete your files.',
    denied: 'The browser has not promised to keep Slop Drive. It may still clear it when space runs low. Export a copy with Backup & restore to be safe.',
    unsupported: 'This browser cannot promise to keep storage. Export a copy with Backup & restore now and then.',
  };
  const listeners = [];
  let deferred = null;     // the captured beforeinstallprompt event
  let buttons = [];
  let mounted = false;

  function read() { try { return win.localStorage.getItem(KEY); } catch (e) { return null; } }
  function write(answer) { try { win.localStorage.setItem(KEY, answer); } catch (e) { /* storage blocked */ } }
  function isStandalone() {
    try { if (win.matchMedia && win.matchMedia('(display-mode: standalone)').matches) return true; } catch (e) { /* no media queries */ }
    return NAV.standalone === true;
  }
  function showInstall(on) { buttons.forEach((b) => { b.hidden = !on; }); }
  function resolve(sel) {
    if (!sel) return [];
    if (typeof sel === 'string') return [...document.querySelectorAll(sel)];
    return [].concat(sel).filter(Boolean);
  }
  function injectStyle() {
    if (document.getElementById('pwa-style')) return;
    const s = document.createElement('style');
    s.id = 'pwa-style';
    s.textContent = STYLE;
    document.head.append(s);
  }
  function whenLoaded(fn) {
    if (document.readyState === 'complete') fn();
    else win.addEventListener('load', fn, { once: true });
  }
  function register(url) {
    return NAV.serviceWorker.register(url, { scope: '/' }).catch((err) => {
      console.warn('Service worker not registered:', err && err.message);
      return null;
    });
  }

  /** Asks the browser to keep this origin's storage, records the answer and tells listeners. */
  async function requestPersist() {
    let answer = 'unsupported';
    try {
      if (NAV.storage && NAV.storage.persist) answer = (await NAV.storage.persist()) ? 'granted' : 'denied';
    } catch (e) { answer = 'denied'; }
    write(answer);
    listeners.forEach((fn) => { try { fn(answer); } catch (e) { /* a listener failed; keep going */ } });
    return answer;
  }

  async function onInstallClick() {
    const e = deferred;
    if (!e) return;
    deferred = null;          // a prompt event can only be used once
    showInstall(false);
    try { await e.prompt(); await e.userChoice; } catch (err) { /* prompt blocked */ }
  }

  function mount(opts = {}) {
    if (mounted || !NAV || !('serviceWorker' in NAV) || !NAV.serviceWorker) return false;
    mounted = true;
    injectStyle();
    buttons = resolve(opts.install);
    buttons.forEach((b) => { b.hidden = true; b.addEventListener('click', onInstallClick); });
    win.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferred = e;
      showInstall(!isStandalone());
    });
    win.addEventListener('appinstalled', () => {
      deferred = null;
      showInstall(false);
      requestPersist();
    });
    if (isStandalone() && !read()) requestPersist();
    if (opts.register !== false) whenLoaded(() => register(opts.worker || '/service-worker.js'));
    return true;
  }

  win.SlopPWA = {
    mount,
    requestPersist,
    persistAnswer: read,
    persistMessage: (answer) => MESSAGES[answer] || '',
    isStandalone,
    canInstall: () => !!deferred,
    onPersist: (fn) => { listeners.push(fn); },
  };
})(window);
