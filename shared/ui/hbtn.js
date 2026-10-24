/* SlopHbtn: keeps a header's shared buttons (shared/ui/hbtn.css) on screen. When the header cannot show everything it
 * holds on one row, it gets the class slop-htight and those buttons drop their labels for their icons; when there is room again,
 * the labels come back. Classic script, no dependencies. Loaded by shell/shell.js, which calls fit() on the header
 * that holds the Apps button.
 * Buttons that yield (data-hbtn-yield="1", "2", ...: Convert… and AI, shell/header.js) give way before anything else:
 * first their labels (class sh-icon-only), in that order, then the buttons themselves (hidden; the Theme menu offers them).
 * Only a header that is still over with all of them gone goes tight; there they come back as icons where they fit. They never make a header taller than it is without
 * them, so they cannot wrap it onto a new row.
 *   SlopHbtn.fit(host)    watch host (an element): its size and what it holds. Returns host. Safe to call again.
 *   SlopHbtn.check(host)  measure host now. Returns true when it is tight. */
(function (win) {
  'use strict';
  if (win.SlopHbtn) return;
  const TIGHT = 'slop-htight';
  const watched = new WeakSet();

  /** Something inside host is cut off, pushed past an edge, or wrapped onto a second row (a shared button sits below the
   *  bottom of the header's first item), or the app's title (h1) is squeezed: it runs past the box that holds it, which
   *  clips it ("Slop Upsca"). */
  function over(host) {
    if (host.scrollWidth > host.clientWidth + 1) return true;
    for (const t of host.querySelectorAll('h1')) {
      const p = t.parentElement, tr = t.getBoundingClientRect();
      if (!tr.width || !p || p === host) continue;
      if (tr.right > p.getBoundingClientRect().right + 1 || t.scrollWidth > t.clientWidth + 1) return true;
    }
    const box = host.getBoundingClientRect();
    const first = [...host.children].map((c) => c.getBoundingClientRect()).find((r) => r.width && r.height);
    const row = first ? first.bottom : box.bottom;
    for (const n of host.querySelectorAll('.slop-hbtn')) {
      const r = n.getBoundingClientRect();
      if (!r.width) continue;
      if (r.right > Math.min(box.right, win.innerWidth) + 1 || r.left < Math.max(box.left, 0) - 1 || r.top >= row - 1) return true;
    }
    return overlap(host);
  }
  /** Two of the header's controls drawn over each other: a group that cannot shrink further spills into its neighbour
   *  without anything scrolling. A control placed over another on purpose (position absolute or fixed, such as a clear
   *  button in a search box) or one inside another does not count. */
  const CONTROLS = 'button, a[href], input, select, textarea, [role="button"]';
  function placed(n, host) {
    for (let e = n; e && e !== host; e = e.parentElement) { const p = win.getComputedStyle(e).position; if (p === 'absolute' || p === 'fixed') return true; }
    return false;
  }
  function overlap(host) {
    const rs = [];
    for (const n of host.querySelectorAll(CONTROLS)) {
      const r = n.getBoundingClientRect();
      if (r.width < 1 || r.height < 1 || placed(n, host)) continue;
      rs.push({ n, r });
    }
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      if (a.n.contains(b.n) || b.n.contains(a.n)) continue;
      const x = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), y = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
      if (x > 1 && y > 1) return true;
    }
    return false;
  }
  /** The yielding buttons, in the order they give way, and how one is shown: 'full', 'icon' or 'hidden'. */
  const yielders = (host) => [...host.querySelectorAll('[data-hbtn-yield]')].sort((a, b) => a.dataset.hbtnYield - b.dataset.hbtnYield);
  function show(b, st) {
    if (b.hidden !== (st === 'hidden')) b.hidden = st === 'hidden';
    if (b.classList.contains('sh-icon-only') !== (st === 'icon')) b.classList.toggle('sh-icon-only', st === 'icon');
  }
  /** Every step, from all labels shown to all gone: [[button, state], ...] for each. */
  function steps(ys) {
    const out = [], st = ys.map(() => 'full');
    out.push(st.slice());
    for (let i = 0; i < ys.length; i++) { st[i] = 'icon'; out.push(st.slice()); }
    for (let i = 0; i < ys.length; i++) { st[i] = 'hidden'; out.push(st.slice()); }
    return out;
  }
  /** Labels first; only a header that is still over with labels shown goes tight. */
  function check(host) {
    if (!host || !host.isConnected) return false;
    host.classList.remove(TIGHT);
    const ys = yielders(host);
    if (ys.length) {
      ys.forEach((b) => show(b, 'hidden'));
      const h0 = host.getBoundingClientRect().height;   // the header without them: they may not make it taller
      const plan = steps(ys);
      for (let k = 0; k < plan.length - 1; k++) {
        ys.forEach((b, i) => show(b, plan[k][i]));
        if (host.getBoundingClientRect().height <= h0 + 1 && !over(host)) return false;
      }
      ys.forEach((b) => show(b, 'hidden'));
    }
    const tight = over(host);
    host.classList.toggle(TIGHT, tight);
    // A tight header (every label an icon) may still have room for them as icons: Convert… stays out first.
    if (tight && ys.length) {
      const h1 = host.getBoundingClientRect().height;
      for (let k = 0; k < ys.length; k++) {
        ys.forEach((b, i) => show(b, i < k ? 'hidden' : 'icon'));
        if (host.getBoundingClientRect().height <= h1 + 1 && !over(host)) return tight;
      }
      ys.forEach((b) => show(b, 'hidden'));
    }
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
    // A web font that arrives later changes the labels' and the title's widths but not the header's own size.
    const fonts = win.document.fonts;
    if (fonts && fonts.addEventListener) { fonts.addEventListener('loadingdone', later); fonts.ready.then(later); }
    check(host);
    return host;
  }

  win.SlopHbtn = { fit, check };
})(window);
