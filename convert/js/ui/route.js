/* Slop Convert: the URL sections (shared/router) and the view modes (shared/viewmode). Parameter: ?to=<format>, the
 * format the converter starts on (for example ?to=pdf). Applied once, when the converter has its formats (they depend on
 * the files chosen, so the link waits for them); written when the person picks a format. The files are never in the URL.
 * Classic script; loads after the converter module. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  function init() {
    const R = SlopRoute.register('convert', {
      params: { to: { pattern: /^[a-z0-9-]{1,12}$/, def: '' } },
    });
    let applied = false;
    const obs = new MutationObserver(() => {
      const sel = $('cv-target');
      if (applied || !sel || sel.options.length === 0) return;
      applied = true;
      obs.disconnect();
      const want = R.get('to');
      if (R.has('to') && want && [...sel.options].some((o) => o.value === want) && sel.value !== want) {
        sel.value = want;
        sel.dispatchEvent(new Event('change'));
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('change', (e) => { if (e.target && e.target.id === 'cv-target') R.set({ to: e.target.value }); });
    SlopViewMode.register('convert', {
      regions: { toolbar: '.cv-top', panels: ['.cv-explain', '.cv-card'] },
      edges: { panels: 'bottom' },
      hides: { focus: ['toolbar'], content: ['toolbar', 'panels'] },
      mount: '.cv-top',
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
