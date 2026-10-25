/* Reel Remix: the floating Remix button (bottom right; hidden while the options panel has its footer, js/side.js, whose
   Remix button pulses instead) and the settings dialog. The button pulses while clips wait for a
   remix, or before any remix exists, and stops once a remix has run. A click remixes; a long press, the Settings button
   or the palette command "Remix settings" opens the settings (auto remix on or off). The pulse is a CSS keyframe on the
   button's ring; reduced motion gets a steady ring (css/remix-auto.css). Exposes RM.fab. */
(function () {
  'use strict';
  const RM = window.RM, $ = (id) => document.getElementById(id);
  const LONG_MS = 600;
  let pressTimer = null, longFired = false;

  /** Pulse while clips wait, or before the first remix. */
  function refresh() {
    const b = $('rm-fab'); if (!b) return;
    const n = RM.pendingCount();
    b.classList.toggle('pulse', n > 0 || !RM.state.plan);
    $('rm-remix').classList.toggle('pulse', n > 0 || !RM.state.plan);   // the panel's Remix (side.js) carries the pulse
    b.title = (n ? 'Remix the ' + n + ' new clip' + (n === 1 ? '' : 's') : 'Remix') + '. Long press for settings.';
  }
  function openSettings() {
    const d = $('rm-settings'); if (!d) return;
    $('rm-set-auto').checked = RM.auto.enabled();
    if (d.showModal) { if (!d.open) d.showModal(); } else d.setAttribute('open', '');
  }
  function closeSettings() {
    const d = $('rm-settings'); if (!d) return;
    if (d.close) d.close(); else d.removeAttribute('open');
  }

  const b = $('rm-fab');
  b.addEventListener('pointerdown', () => {
    longFired = false; clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { longFired = true; openSettings(); }, LONG_MS);
  });
  for (const t of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(t, () => { clearTimeout(pressTimer); pressTimer = null; });
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('click', () => {
    if (longFired) { longFired = false; return; } // the press opened the settings
    RM.remixNow(false);
  });
  $('rm-settings-btn').addEventListener('click', openSettings);
  $('rm-set-close').addEventListener('click', closeSettings);
  $('rm-set-auto').addEventListener('change', (e) => {
    RM.auto.setEnabled(e.target.checked);
    if (RM.say) RM.say(e.target.checked ? 'Auto remix is on: new clips are remixed when their upload finishes.' : 'Auto remix is off: press Remix to plan new clips.');
  });
  $('rm-settings').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeSettings(); }); // a click on the backdrop
  RM.onPlan(refresh);
  RM.fab = { refresh, openSettings };
  refresh();
  try {
    if (window.SlopCmd && SlopCmd.register) SlopCmd.register([{ id: 'remix.settings', title: 'Remix settings', group: 'Reel Remix', run: openSettings }]);
  } catch (e) { console.warn('Remix: settings command not registered', e); }
})();
