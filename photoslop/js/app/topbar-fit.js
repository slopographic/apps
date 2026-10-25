/* PhotoSlop: the top bar always fits the app's own width, also when the page is narrower than the window (the Slop AI
 * panel open beside the app takes 380 px). When the bar would overflow, PhotoSlop's own buttons (Macros, Search, the
 * theme switch, New, in that order), then Tour and Slop Drive, fold into a "More ▾" menu (SlopMenuButton, shared/ui/menubutton.js) that clicks the
 * same buttons, so nothing is cut off and nothing runs under the panel. The CSS side is a container query on .app
 * (css/layout.css). Classic script: PSTopbarFit.mount() once the bar is built (app/main.js). */
(function (g) {
  'use strict';
  const ORDER = ['#macrosBtn', '#cmdBtn', '#themeToggle', '#newBtn', '.topbar .stour-btn', '.topbar .sdl'];
  let bar = null, more = null, raf = 0;
  const $ = (sel) => document.querySelector(sel);
  const label = (b) => b.getAttribute('aria-label') || b.textContent.trim() || b.title;
  const keyOf = (b) => ORDER.find((sel) => $(sel) === b);
  const folded = () => ORDER.map($).filter((b) => b && b.classList.contains('ps-fold'));
  const over = () => bar.scrollWidth > bar.clientWidth + 1;

  /** Shows every button, then folds them one at a time while the bar is wider than its room. */
  function fit() {
    raf = 0;
    if (!bar) return;
    for (const id of ORDER) { const b = $(id); if (b) b.classList.remove('ps-fold'); }
    more.hidden = true;
    if (!over()) return;
    more.hidden = false;
    for (const id of ORDER) {
      const b = $(id);
      if (!b || b.hidden || getComputedStyle(b).display === 'none') continue;
      b.classList.add('ps-fold');
      if (!over()) break;
    }
    if (!folded().length) more.hidden = true;
  }
  const later = () => { if (!raf) raf = requestAnimationFrame(fit); };

  function mount() {
    bar = document.querySelector('.topbar');
    const acts = bar && bar.querySelector('.top-actions');
    if (!acts || more) return;
    more = document.createElement('button');
    more.type = 'button'; more.className = 'top-btn ps-more'; more.id = 'topMore'; more.hidden = true;
    more.textContent = 'More ▾';
    more.title = 'More buttons';
    acts.append(more);
    if (g.SlopMenuButton) {
      g.SlopMenuButton.attach(more, {
        label: 'More', search: false,
        items: () => folded().map((b) => ({ value: keyOf(b), label: label(b) })),
        onPick: (sel) => { const b = $(sel); if (b) b.click(); },
      });
    }
    if (g.ResizeObserver) new g.ResizeObserver(later).observe(bar);
    if (g.MutationObserver) new g.MutationObserver(later).observe(bar, { childList: true });   // the shell's buttons arrive later
    g.addEventListener('resize', later);
    fit();
  }

  g.PSTopbarFit = { mount, fit };
})(typeof window !== 'undefined' ? window : globalThis);
