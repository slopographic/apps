/* Slop AI — ui/launcher: the Apps list under the chat list. Every app in the registry (shared/apps.js) can be opened
 * in a new tab, with a Slop Drive file, or with a file from this computer (the same as "Send to…" in the other apps). */
'use strict';
(function (AI) {
  const el = AI.el;
  const hub = () => window.SlopHub || null;
  const apps = () => (window.SLOP_APPS || []).filter((a) => a.kind === 'app' && a.id !== 'ai');
  const urlOf = (app) => (hub() ? hub().urlOf(app) : new URL('../' + app.path, location.href).href);

  async function sendFile(app, rec) {
    try { await hub().sendTo(app.id, null, rec.name, { id: rec.id }); }
    catch (e) { window.SlopUI.alert('Could not open ' + app.name, e.message || String(e)); }
  }
  async function fromComputer(app) {
    const files = await window.SlopUI.pickFiles({ accept: app.accepts.filter((p) => p !== '*').join(','), multiple: false });
    const f = files && files[0]; if (!f) return;
    try { await hub().sendTo(app.id, f, f.name); }
    catch (e) { window.SlopUI.alert('Could not open ' + app.name, e.message || String(e)); }
  }
  function menuFor(app, x, y) {
    window.SlopUI.menu([
      { label: 'Open in a new tab', act: () => window.open(urlOf(app), '_blank') },
      { label: 'Open a Slop Drive file in it…', disabled: !hub(), act: async () => { const rec = await hub().pickFromDrive({ accept: app.accepts, title: 'Open in ' + app.name }); if (rec) sendFile(app, rec); } },
      { label: 'Open a file from this computer…', act: () => fromComputer(app) },
    ], x, y);
  }
  function row(app) {
    return el('div', { class: 'app-row', 'data-app': app.id },
      el('a', { class: 'app-link', href: urlOf(app), target: '_blank', rel: 'noopener', title: `Open ${app.name} in a new tab` },
        el('b', null, app.name), el('small', null, app.tagline)),
      el('button', { type: 'button', class: 'app-more', 'aria-label': 'Open ' + app.name + ' with…', title: 'Open with a file…',
        onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); menuFor(app, r.right - 220, r.bottom + 4); } }, AI.icon('more')));
  }

  /** The Apps section of the chat sidebar. */
  AI.renderLauncher = function () {
    return el('section', { class: 'apps-launch', id: 'appsLaunch', 'aria-label': 'Open an app' },
      el('h2', { class: 'apps-h' }, 'Apps'),
      el('div', { class: 'apps-list' }, apps().map(row)));
  };
})(window.AI);
