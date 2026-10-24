/* Slop Resize: the page as the suite's View · Panel (shared/frame): the queue in the middle, and on the right the settings
 * (Size, Output, Saved settings), the results' actions (Download, Save to Slop Drive, Open in…, Clear) and, stuck to the
 * panel's foot, the main button: Resize / Resize N files, Cancel while it runs. Phones: the panel is a bottom sheet whose
 * foot (Settings + Resize) always shows. Runs as soon as it loads (the markup is above it), so the first paint has the
 * panel; the controller (app/main.js) calls paint(api) after every change of the queue. Classic script.
 *   SlopResize.layout = { frame, panel, paint(api) } */
(function (g) {
  'use strict';
  const NS = g.SlopResize, $ = (id) => document.getElementById(id);
  const fr = g.SlopFrame.mount($('rs-main'), {
    list: null, view: $('rs-left'), panel: $('rs-panel'), phone: '(max-width: 900px)', panelLabel: 'Settings',
    storageKey: 'resize', button: document.querySelector('.rs-tools'), phoneButton: false, width: 340, min: 280,
  });
  const groups = [...$('rs-panel').querySelectorAll('.rs-group')];
  const panel = g.SlopFrame.panel($('rs-panel'), { title: 'Resize' });
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many);

  function resultActions(api, items, busy) {
    const done = items.filter((i) => i.status === 'done'), one = done.length === 1 ? done[0] : null;
    return [
      { el: $('rs-zip'), label: done.length > 1 ? 'Download all (ZIP, ' + done.length + ')' : 'Download', title: 'One zip of every result (Ctrl+S)', disabled: busy || !done.length, run: () => api.downloadAll() },
      { el: $('rs-save-all'), label: 'Save to Slop Drive', title: 'Save the results to the Slop Resize folder in Slop Drive', disabled: busy || !done.some((i) => !i.drive), run: () => api.saveAll() },
      { id: 'rs-openin', label: 'Open in…', title: one ? 'Open the result in another app' : 'One result at a time: use the row of the file', disabled: busy || !one || !g.SlopOuttake,
        menu: () => (one && g.SlopOuttake ? g.SlopOuttake.items({ from: 'resize', get: () => one.out.blob, name: one.outName, type: one.out.blob.type }) : []) },
      { el: $('rs-clear'), label: 'Clear', disabled: busy || !items.length, run: () => api.clear() },
    ];
  }

  let shape = '';
  /** Redraw the sections when the queue's shape changes (not on every progress tick, and not while someone types in a
   * setting: the settings are the app's own elements and render() moves them); the footer on every call. */
  function paint(api) {
    const items = NS.queue.items(), busy = NS.queue.busy(), ready = items.filter((i) => i.src);
    const now = JSON.stringify([items.length, items.map((i) => i.status + (i.drive ? 'd' : '')), busy]);
    if (now !== shape) {
      shape = now;
      panel.render([
        ...groups.map((gr) => ({ title: gr.dataset.title, key: gr.dataset.title, settings: gr })),
        { title: 'Results', key: 'results', actions: resultActions(api, items, busy) },
      ]);
    }
    panel.footer([
      { el: $('rs-run'), label: ready.length > 1 ? 'Resize ' + plural(ready.length, 'file', 'files') : 'Resize', hidden: busy, disabled: !ready.length, run: () => api.run() },
      { el: $('rs-cancel'), hidden: !busy, run: () => api.cancel() },
    ], { note: 'Ctrl+Enter resizes · Esc cancels', more: 'Settings' });
  }

  NS.layout = { frame: fr, panel, paint, groups };
})(typeof window !== 'undefined' ? window : globalThis);
