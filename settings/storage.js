/* Settings: Storage. How full this site's browser storage is, what uses it, whether the browser keeps it, and the clear
 * actions. Clearing never deletes Drive files, documents or saved projects. Classic script. Needs shared/storage/*.js,
 * shared/cache/regen.js and shared/slopui.js (for the confirm dialogs). Every action asks first. */
(function () {
  'use strict';
  var SS = window.SlopStorage;
  var host = document.getElementById('storage-box');
  var note = document.getElementById('storage-note');
  var NOT_DELETED = 'Your Drive files, documents and saved projects are not deleted.';

  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') n.textContent = props[k]; else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function say(msg) { note.textContent = msg; }
  var PERSIST = {
    granted: 'The browser keeps this site’s data. It will not clear it to free space.',
    denied: 'The browser has not promised to keep this site’s data. It may clear it when the disk is low. Keep a backup.',
    unknown: 'Unknown: this browser does not say whether it keeps the data.',
  };

  /** A clear action: confirms first, runs the clear, then shows the result and redraws the numbers. */
  var ACTIONS = [
    { kind: ['thumbs'], label: 'Clear thumbnails and previews (files kept)', text: 'Drive makes thumbnails and previews again when you open a folder.' },
    { kind: ['models', 'cutout'], label: 'Remove downloaded models (files kept)', text: 'Downloaded AI and cut-out models are removed. Each one downloads again the next time you use it.' },
    { kind: ['oldCaches'], label: 'Remove old offline caches (files kept)', text: 'Offline files from earlier releases are removed. The current release’s offline files are kept.' },
    { kind: ['thumbs', 'faces', 'models', 'cutout', 'oldCaches'], label: 'Clear all downloaded extras (never deletes your files)', text: 'Removes thumbnails, previews, face results, downloaded models and old offline caches. Each is made again when it is needed.' },
  ];
  function run(action) {
    var ask = window.SlopUI.confirm(action.label.replace(/ \(.*\)$/, '') + '?', action.text + ' ' + NOT_DELETED, 'Clear', { cancel: 'Keep it' });
    return ask.then(function (yes) {
      if (!yes) return;
      say('Clearing…');
      return action.kind.reduce(function (p, k) {
        return p.then(function (n) { return SS.clear(k).then(function (r) { return n + r.removed; }); });
      }, Promise.resolve(0)).then(function (n) {
        say(n ? 'Removed ' + n + ' item' + (n === 1 ? '' : 's') + '. Your files are unchanged.' : 'Nothing to remove.');
        return draw();
      });
    });
  }

  function bar(est) {
    var pct = est.usage != null && est.quota ? Math.min(100, est.percent) : 0;
    return el('div', { class: 'meter-bar', role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': pct.toFixed(1), 'aria-label': 'Storage used' },
      [el('i', { style: 'width:' + Math.max(pct, est.usage ? 1 : 0) + '%' })]);
  }
  function partsList(est) {
    if (!est.parts.length) return el('p', { class: 'settings-note' }, 'No site data to list in this browser.');
    return el('ul', { class: 'storage-parts' }, est.parts.map(function (p) {
      var size = typeof p.bytes === 'number' ? SS.bytes(p.bytes) : (p.count != null ? p.count + ' items' : '');
      return el('li', null, [el('span', { text: p.label }), el('small', { text: [size, p.detail].filter(Boolean).join(' · ') })]);
    }));
  }

  /** Redraws the whole section from a fresh estimate. */
  function draw() {
    return Promise.all([SS.estimate(), SS.persisted()]).then(function (r) {
      var est = r[0], persisted = r[1];
      var state = persisted === true ? 'granted' : persisted === false ? 'denied' : 'unknown';
      var used = est.usage == null
        ? 'The browser does not say how much this site uses.'
        : SS.bytes(est.usage) + ' of ' + SS.bytes(est.quota) + ' used (' + Math.round(est.percent) + '%)';
      var keep = el('button', { type: 'button', class: 'btn', 'data-act': 'persist' }, [document.createTextNode(persisted === true ? 'Kept by the browser' : 'Ask the browser to keep my data')]);
      keep.disabled = persisted === true || !est.supported;
      keep.addEventListener('click', function () {
        SS.requestPersist().then(function (answer) {
          say(answer === 'declined' ? 'Not asked. The browser was not contacted.' : answer === 'granted' ? 'The browser will keep this site’s data.' : answer === 'unsupported' ? 'This browser cannot promise to keep storage.' : 'The browser did not promise. Keep a backup.');
          draw();
        });
      });
      var actions = ACTIONS.map(function (a) {
        var b = el('button', { type: 'button', class: 'btn', 'data-act': a.kind.join('+') }, [document.createTextNode(a.label)]);
        b.addEventListener('click', function () { run(a); });
        return el('div', { class: 'storage-act' }, [b, el('p', { class: 'settings-note', text: a.text })]);
      });
      host.replaceChildren(
        el('div', { class: 'meter-h' }, [el('b', { text: 'This site’s storage' }), el('span', { text: used })]),
        bar(est),
        partsList(est),
        el('p', { class: 'settings-note persist-note', 'data-state': state, text: PERSIST[state] }),
        keep,
        el('div', { class: 'storage-acts' }, actions)
      );
    });
  }

  if (host) draw().catch(function () { say('Storage could not be read in this browser.'); });
})();
