/* SlopTour mount: the one script an app page loads (<script src="…/shared/tour/mount.js" data-app="photoslop">).
 * It adds a Tour button to the header, registers "Start tour: <name>" in the command palette and opens the
 * tour when the URL has ?tour=1 (the homepage links use that). The engine loads only when a tour starts.
 * On the homepage (data-home="1") it adds a Tours menu that links to each app's tour. Classic script. */
(function () {
  'use strict';
  const me = document.currentScript;
  if (!me || !me.src) return;
  const BASE = new URL('./', me.src).href;
  const APP = me.dataset.app || '';
  const HOME = me.dataset.home === '1';
  const TOURS = [
    ['photoslop', 'PhotoSlop'], ['slopvector', 'SlopVector'], ['slopcut', 'Slop Cut'], ['remix', 'Reel Remix'],
    ['slopisolate', 'Slop Isolate'], ['drive', 'Slop Drive'], ['orders', 'Slop Orders'], ['invoices', 'Slop Invoices'],
    ['crm', 'Slop CRM'], ['calendar', 'Slop Calendar'], ['todo', 'Slop To-do'], ['notes', 'Slop Notes'],
    ['paste', 'Slop Paste'], ['resize', 'Slop Resize'], ['upscale', 'Slop Upscale'], ['aitools', 'Slop AI Tools'],
    ['3d', 'Slop 3D'], ['img3d', 'Slop Image to 3D'], ['effects', 'Slop Effects'], ['docs', 'Slop Docs'],
    ['slides', 'Slop Slides'], ['tables', 'Slop Tables'], ['label', 'Slop Label'], ['gallery', 'Slop Gallery'],
    ['hex', 'Slop Hex'], ['code', 'Slop Code'],
  ];
  const NAME = Object.fromEntries(TOURS);
  let loading = null;

  function script(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('could not load ' + src));
      document.head.append(s);
    });
  }
  /** Load the engine (once): stylesheet, then core, spot, panel and engine in order. */
  function ensure() {
    if (window.SlopTour && window.SlopTour.start) return Promise.resolve(window.SlopTour);
    if (loading) return loading;
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = BASE + 'tour.css';
    document.head.append(css);
    loading = (async () => {
      for (const f of ['core', 'spot', 'panel', 'engine']) await script(BASE + f + '.js');
      return window.SlopTour;
    })();
    return loading;
  }
  async function startTour(app) {
    try {
      const T = await ensure();
      await T.start(app);
    } catch (e) {
      console.warn('SlopTour: the tour did not start. ' + e.message);
    }
  }
  function button(label, title, fn) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'stour-btn top-btn'; b.textContent = label;
    b.title = title; b.setAttribute('aria-label', title);
    b.addEventListener('click', fn);
    return b;
  }
  function headerButton() {
    const host = document.querySelector('.top-actions') || document.querySelector('header.topbar') || document.querySelector('header') || document.querySelector('main') || document.body;
    if (host.querySelector('.stour-btn')) return;
    const b = button('Tour', 'Start the ' + NAME[APP] + ' tour', () => startTour(APP));
    if (host.matches('.top-actions, main, body')) host.prepend(b); else host.append(b);
  }
  /** Register "Start tour: <name>". Pages without the palette get its registry core (no key handling) to hold it. */
  function paletteCommand() {
    const reg = () => window.SlopCmd && SlopCmd.register && SlopCmd.register([{
      id: 'tour.start.' + APP, title: 'Start tour: ' + NAME[APP], group: 'Help',
      keywords: ['tour', 'guide', 'walkthrough', 'learn', 'help'], run: () => startTour(APP),
    }]);
    if (window.SlopCmd) reg(); else script(BASE + '../commands/commands.js').then(reg, () => {});
  }
  function homeMenu() {
    const nav = document.querySelector('header.nav') || document.querySelector('header');
    if (!nav) return;
    const dlg = document.createElement('dialog');
    dlg.className = 'stour-menu'; dlg.setAttribute('aria-label', 'Guided tours');
    const h = document.createElement('h2'); h.textContent = 'Guided tours';
    const ul = document.createElement('ul');
    for (const [app, name] of TOURS) {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = app + '/?tour=1'; a.textContent = name;
      li.append(a); ul.append(li);
    }
    dlg.append(h, ul);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    document.body.append(dlg);
    nav.append(button('Tours', 'Guided tours for each app', () => dlg.showModal()));
  }
  function init() {
    if (HOME) { homeMenu(); return; }
    if (!APP || !NAME[APP]) return;
    headerButton();
    paletteCommand();
    const params = new URLSearchParams(location.search);
    if (params.get('tour') === '1') {
      history.replaceState(null, '', location.pathname + location.hash);
      startTour(APP);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
