/* Buddy tests: load tests/buddy/fixture.html (a small fake app) in an iframe. */
(function () {
  'use strict';
  async function openApp(query = '', { clear = false } = {}) {
    if (clear) try { localStorage.removeItem('slop.buddy'); localStorage.removeItem('slop.mascot.v1'); } catch (e) { /* ignore */ }
    const old = document.getElementById('app-frame');
    if (old) old.remove();
    const f = document.createElement('iframe');
    f.id = 'app-frame';
    f.style.cssText = 'width:1100px;height:700px;border:0;display:block';
    f.src = 'fixture.html' + query;
    document.body.prepend(f);
    await new Promise((r) => f.addEventListener('load', r, { once: true }));
    const win = f.contentWindow;
    await SlopTest.waitFor(() => win.SlopBuddyBoot && win.document.querySelector('.buddy-toggle'), { timeout: 10000 });
    return win;
  }
  /** Switch him on and wait until he stands somewhere. */
  async function turnOn(win) {
    if (!win.SlopBuddyBoot.on) win.document.querySelector('.buddy-toggle .bt-main').click();
    await SlopTest.waitFor(() => win.SlopBuddy && win.SlopBuddy.visible && ['perched'].includes(win.SlopBuddy.M.mode), { timeout: 10000 });
    win.SlopBuddy.M.nextIdle = performance.now() + 1e7;
    return win.SlopBuddy;
  }
  const prefs = () => JSON.parse(localStorage.getItem('slop.buddy') || '{}');
  window.BuddyTest = { openApp, turnOn, prefs };
})();
