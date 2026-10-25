/* Opens the homepage for the hero tests (tests/home/hero*.test.html) in a same-origin iframe of a given width and theme,
 * and waits until the tool vortex (home/vortex/vortex.js) has drawn a few frames.
 *   HeroTest.open({ width, height, theme }) -> the iframe's window
 *   HeroTest.markBox(win) -> the wordmark's text box (client coordinates of the iframe)
 *   HeroTest.transforms(win) -> each vortex icon's inline transform, in order */
(function () {
  'use strict';
  async function open({ width = 1280, height = 800, theme = 'light' } = {}) {
    try {
      localStorage.removeItem('slop.mascot.v1');
      localStorage.setItem('slop-profile', JSON.stringify({ v: 1, data: { theme: { mode: theme } } }));
    } catch (e) { /* storage blocked: the page still loads */ }
    const old = document.getElementById('home-frame');
    if (old) old.remove();
    const f = document.createElement('iframe');
    f.id = 'home-frame';
    f.style.cssText = `width:${width}px;height:${height}px;border:0;display:block`;
    f.src = '../../index.html';
    document.body.prepend(f);
    await new Promise((r) => f.addEventListener('load', r, { once: true }));
    const win = f.contentWindow;
    win.document.documentElement.style.scrollBehavior = 'auto';
    await SlopTest.waitFor(() => win.SlopVortex && win.SlopVortex.frames() > 4 && win.document.querySelector('#app-finder .fd-input'), { timeout: 30000 });
    return win;
  }
  function markBox(win) {
    const r = win.document.createRange();
    r.selectNodeContents(win.document.querySelector('.hx-mark'));
    return r.getBoundingClientRect();
  }
  const transforms = (win) => [...win.document.querySelectorAll('.vx-i')].map((n) => n.style.transform);
  window.HeroTest = { open, markBox, transforms };
})();
