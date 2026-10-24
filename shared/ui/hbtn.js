/* SlopHbtn: keeps a header's shared buttons (shared/ui/hbtn.css) on screen. When the header cannot show everything it
 * holds on one row, it gets the class slop-htight and those buttons drop their labels for their icons; when there is room again,
 * the labels come back. Classic script, no dependencies. Loaded by shell/shell.js, which calls fit() on the header
 * that holds the Apps button.
 *   SlopHbtn.fit(host)    watch host (an element): its size and what it holds. Returns host. Safe to call again.
 *   SlopHbtn.check(host)  measure host now. Returns true when it is tight. */
(function (win) {
  'use strict';
  if (win.SlopHbtn) return;
  const TIGHT = 'slop-htight';
  const watched = new WeakSet();

  /** Something inside host is cut off, pushed past an edge, or wrapped onto a second row (a shared button sits below the
   *  bottom of the header's first item). */
  function over(host) {
    if (host.scrollWidth > host.clientWidth + 1) return true;
    const box = host.getBoundingClientRect();
    const first = [...host.children].map((c) => c.getBoundingClientRect()).find((r) => r.width && r.height);
    const row = first ? first.bottom : box.bottom;
    for (const n of host.querySelectorAll('.slop-hbtn')) {
      const r = n.getBoundingClientRect();
      if (!r.width) continue;
      if (r.right > Math.min(box.right, win.innerWidth) + 1 || r.left < Math.max(box.left, 0) - 1 || r.top >= row - 1) return true;
    }
    return false;
  }
  /** Labels first; only a header that is still over with labels shown goes tight. */
  function check(host) {
    if (!host || !host.isConnected) return false;
    host.classList.remove(TIGHT);
    const tight = over(host);
    host.classList.toggle(TIGHT, tight);
    return tight;
  }
  function fit(host) {
    if (!host || watched.has(host)) return host;
    watched.add(host);
    let queued = false;
    const later = () => {
      if (queued) return;
      queued = true;
      (win.requestAnimationFrame || setTimeout)(() => { queued = false; check(host); });
    };
    if (win.ResizeObserver) new win.ResizeObserver(later).observe(host);
    win.addEventListener('resize', later);
    // A button added later (View, Drive) or a label that changes length (a file name, "Saved") can change the fit.
    if (win.MutationObserver) new win.MutationObserver(later).observe(host, { childList: true, subtree: true, characterData: true });
    check(host);
    return host;
  }

  win.SlopHbtn = { fit, check };
})(window);
