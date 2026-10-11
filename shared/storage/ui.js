/* SlopStorage.handle(err, opts): call it in a save's catch. A quota error opens one dialog that says the disk for this
 * site is full, names what is using the space and offers the fixes. Any other error is left to the caller (returns false).
 *   opts.app    the app's name for the message, e.g. 'Notes' (default: the page title)
 *   opts.what   what did not save, e.g. 'this note' (optional)
 *   opts.once   a key: after the first dialog for it, later quota errors with the same key are not shown again (autosave)
 *   opts.retry  async function that saves again. "Try again" runs it and closes the dialog when it resolves.
 *               The content stays in the editor meanwhile: a failed save must never clear the form, canvas or text.
 * Returns true when the error was a quota error (the person has been told), false otherwise.
 * Needs SlopUI (shared/slopui.js); without it, a window.alert. Classic script. */
(function (g) {
  'use strict';
  const SS = (g.SlopStorage = g.SlopStorage || {});
  const FIXES = [
    'Clear thumbnails and previews. Slop Drive makes them again when you open a folder.',
    'Remove downloaded models you do not use (Settings, Storage).',
    'Remove old offline caches (Settings, Storage). The current one is kept.',
    'Connect a folder in Slop Drive (More, Connect folder). New files are then saved to your disk, not to this site.',
  ];

  /** The parts that have a size: the browser's IndexedDB and Cache totals, measured localStorage, and Other. */
  function biggest(est) {
    return (est.parts || []).filter((p) => typeof p.bytes === 'number' && p.bytes > 0).sort((a, b) => b.bytes - a.bytes).slice(0, 4);
  }

  /** The dialog body for an estimate. Built again after each fix so the numbers stay true. */
  function contents(app, what, est, msg) {
    const el = g.SlopUI.el;
    const list = biggest(est);
    const usage = est.usage == null
      ? 'The browser did not say how full the disk for this site is.'
      : `The disk for this site: ${SS.bytes(est.usage)} of ${SS.bytes(est.quota)} used (${Math.round(est.percent)}%).`;
    return [
      el('p', { class: 'sui-p' }, `${app} could not save ${what || 'your work'}, because this site’s storage is full. Your changes are still in the editor and nothing was lost. Free some space, then save again.`),
      el('p', { class: 'sui-p' }, usage),
      el('p', { class: 'sui-p' }, list.length ? 'Using the most space:' : 'Nothing measurable is using the space. The browser may share the disk with other sites.'),
      list.length ? el('ul', { class: 'sui-list' }, list.map((p) => el('li', null, `${p.label}: ${SS.bytes(p.bytes)}`))) : null,
      el('p', { class: 'sui-p' }, 'Ways to free space:'),
      el('ul', { class: 'sui-list' }, FIXES.map((f) => el('li', null, f))),
      msg ? el('p', { class: 'sui-p', role: 'status' }, msg) : null,
    ].filter(Boolean);
  }

  const told = new Set();
  let showing = false; // one dialog at a time: several failed writes in a row show one dialog
  /** The app's name from the page title ("Slop Notes: ..." -> "Slop Notes"), when the caller gives none. */
  const titleApp = () => String((g.document && g.document.title) || '').split(/[:|·—–]/)[0].trim() || 'This app';

  function show(app, what, retry) {
    const el = g.SlopUI.el;
    const holder = el('div', { class: 'storage-full' });
    const paint = (est, msg) => holder.replaceChildren(...contents(app, what, est, msg));
    const refresh = async (msg) => paint(await SS.estimate(), msg);
    const clearThumbs = async () => {
      const r = await SS.clear('thumbs');
      await refresh(`Thumbnails and previews cleared: ${r.removed} removed. Save again.`);
      return false; // stay open so the person can see the change
    };
    const openElsewhere = (href) => () => { g.open(href, '_blank', 'noopener'); return false; };
    const tryAgain = async () => {
      if (!retry) return true;
      try { await retry(); return true; } catch (e) {
        const still = SS.classify(e).quota;
        await refresh(still ? 'Still full. Free more space, then save again.' : 'The save failed for another reason: ' + ((e && e.message) || e));
        return false;
      }
    };
    paint({ usage: null, quota: null, percent: 0, parts: [] }, 'Reading the storage…');
    refresh(null).catch(() => {});
    showing = true;
    g.SlopUI.dialog({
      title: 'This site’s storage is full',
      body: holder,
      onClose: () => { showing = false; },
      buttons: [
        { label: retry ? 'Keep editing' : 'Close' },
        { label: 'Clear thumbnails and previews', act: clearThumbs },
        { label: 'Storage in Settings', act: openElsewhere('/settings/#storage') },
        { label: 'Connect a folder', act: openElsewhere('/drive/') },
        retry ? { label: 'Try again', primary: true, act: tryAgain } : null,
      ].filter(Boolean),
    });
  }

  SS.handle = function (err, opts = {}) {
    if (!SS.classify(err).quota) return false;
    const app = opts.app || titleApp();
    if (showing) return true;
    if (opts.once) { if (told.has(opts.once)) return true; told.add(opts.once); } // autosaves tell the person once per page
    if (!g.SlopUI || !g.SlopUI.dialog) {
      g.alert && g.alert(`${app}: this site’s storage is full. Your changes were not saved. Free space in Settings, Storage, then save again.`);
      return true;
    }
    show(app, opts.what, opts.retry);
    return true;
  };
})(window);
