/* First-use notice: a short dialog the first time an app is given a file, saying where the work happens and what
 * the app downloads (with sizes) before it can start. Shown once per app and kept in localStorage (key 'slop-firstrun:<app>').
 * If storage is unavailable the notice is shown each time, and nothing else changes. Classic script: window.SlopFirstRun.
 *   SlopFirstRun.once(app, { title, lines: [string], downloads: [{ name, bytes }] })  ->  Promise<boolean> (true = carry on)
 * Only the notice is shown on the first use; an app with no downloads passes downloads: [] and gets a plain privacy note. */
(function () {
  'use strict';
  const KEY = (app) => 'slop-firstrun:' + app;
  /** The line every notice ends with: where the files go. True for every app on the site. */
  const PRIVACY = 'Your files stay in this browser. Nothing is uploaded: the site is hosted on GitHub Pages and has no server or backend storage.';
  const size = (b) => (b >= 1048576 ? (b / 1048576).toFixed(b >= 10485760 ? 0 : 1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

  function seen(app) {
    try { return localStorage.getItem(KEY(app)) === '1'; } catch (e) { return false; }
  }
  function remember(app) {
    try { localStorage.setItem(KEY(app), '1'); } catch (e) { /* storage blocked: the notice shows again next time */ }
  }

  /** Resolves true at once when the app has been used before; otherwise shows the notice and waits for the choice. */
  function once(app, o) {
    if (seen(app) || !window.SlopUI) return Promise.resolve(true);
    return new Promise((resolve) => {
      const body = document.createElement('div');
      o.lines.concat([PRIVACY]).forEach((t) => { const p = document.createElement('p'); p.className = 'sui-p'; p.textContent = t; body.append(p); });
      if (o.downloads && o.downloads.length) {
        const total = o.downloads.reduce((n, d) => n + d.bytes, 0);
        const ul = document.createElement('ul');
        ul.className = 'sui-p';
        o.downloads.forEach((d) => { const li = document.createElement('li'); li.textContent = `${d.name}, ${size(d.bytes)}`; ul.append(li); });
        const p = document.createElement('p');
        p.className = 'sui-p';
        p.textContent = `These are downloaded once, about ${size(total)} in all, and kept by this browser for next time.`;
        body.append(p, ul);
      }
      let done = false;
      const finish = (ok) => { if (done) return; done = true; if (ok) remember(app); resolve(ok); };
      SlopUI.dialog({
        title: o.title,
        body,
        buttons: [
          { label: 'Cancel', act: () => finish(false) },
          { label: 'Continue', primary: true, act: () => finish(true) },
        ],
        onClose: (ok) => finish(!!ok),
      });
    });
  }

  window.SlopFirstRun = { once, size };
})();
