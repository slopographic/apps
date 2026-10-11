/* Loads the homepage in a same-origin iframe for the homepage tests.
 * openHome({ fresh }) resolves with the iframe's window once app.js, the catalog and the mascot are up. */
(function () {
  'use strict';
  async function openHome({ fresh = true, hash = '' } = {}) {
    if (fresh) try { localStorage.removeItem('slop.mascot.v1'); } catch (e) { /* ignore */ }
    const old = document.getElementById('home-frame');
    if (old) old.remove();
    const f = document.createElement('iframe');
    f.id = 'home-frame';
    f.style.cssText = 'width:1200px;height:760px;border:0;display:block';
    f.src = '../../index.html' + hash;
    document.body.prepend(f);
    await new Promise((r) => f.addEventListener('load', r, { once: true }));
    const win = f.contentWindow;
    await SlopTest.waitFor(() => win.SlopMascot && win.document.querySelector('.app-card'), { timeout: 15000 });
    return win;
  }
  /** Wait until the mascot is standing on something. */
  const settled = (win, timeout = 8000) => SlopTest.waitFor(() => win.SlopMascot.M.mode === 'perched', { timeout });
  window.HomeTest = { openHome, settled };
})();
