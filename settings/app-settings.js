/* Settings page: one section per registry app that declares options (shared/profile/app-options.js), read and written
 * through SlopProfile. Only overrides are stored; "Reset this app" clears them. Classic script. Needs shared/apps.js
 * and shared/profile/profile.js first. With no declared options it says so. */
(function () {
  'use strict';
  var host = document.getElementById('app-settings');
  var P = window.SlopProfile;

  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') n.textContent = props[k];
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }

  /** One control for one option. Changing it saves at once; a refused value is reported and the control is put back. */
  function control(app, key, opt, note) {
    var id = 'opt-' + app.id + '-' + key;
    var cur = P.get(app.id, key);
    var input;
    var set = function (v) {
      var r = P.set(app.id, key, v);
      note.textContent = r.ok ? 'Saved.' : r.error;
      if (!r.ok) renderApp(app, true);
    };
    if (opt.type === 'bool') {
      input = el('input', { type: 'checkbox', id: id });
      input.checked = !!cur;
      input.addEventListener('change', function () { set(input.checked); });
      return el('label', { class: 'set-check' }, [input, el('span', { text: opt.label })]);
    }
    if (opt.type === 'enum') {
      input = el('select', { id: id, class: 'set-select' });
      (opt.values || []).forEach(function (v) { input.appendChild(el('option', { value: String(v), text: String(v) })); });
      input.value = String(cur);
      input.addEventListener('change', function () { set(input.value); });
    } else {
      input = el('input', { id: id, class: 'set-select', type: opt.type === 'number' ? 'number' : 'text', value: String(cur) });
      if (opt.type === 'number') {
        if (opt.min !== undefined) input.setAttribute('min', String(opt.min));
        if (opt.max !== undefined) input.setAttribute('max', String(opt.max));
      }
      input.addEventListener('change', function () {
        set(opt.type === 'number' ? Number(input.value) : input.value);
      });
    }
    return el('div', { class: 'app-opt' }, [el('label', { for: id, text: opt.label }), input]);
  }

  function renderApp(app, keepNote) {
    var opts = (window.SLOP_APP_OPTIONS || {})[app.id] || {};
    var old = document.getElementById('app-' + app.id);
    var note = old && keepNote ? old.querySelector('.settings-note') : null;
    var section = el('div', { class: 'app-block', id: 'app-' + app.id });
    section.appendChild(el('h3', { text: app.name }));
    var note2 = el('p', { class: 'settings-note', role: 'status', 'aria-live': 'polite' });
    Object.keys(opts).forEach(function (key) {
      section.appendChild(control(app, key, opts[key], note2));
    });
    var reset = el('button', { type: 'button', class: 'btn', text: 'Reset this app' });
    reset.addEventListener('click', function () {
      var r = P.reset(app.id);
      note2.textContent = r.ok ? 'Back on this app\'s own defaults.' : r.error;
      renderApp(app, false);
    });
    section.appendChild(reset);
    section.appendChild(note2);
    if (note) note2.textContent = note.textContent;
    if (old) host.replaceChild(section, old); else host.appendChild(section);
  }

  function render() {
    host.textContent = '';
    var opts = window.SLOP_APP_OPTIONS || {};
    var apps = (window.SLOP_APPS || []).filter(function (a) { return opts[a.id] && Object.keys(opts[a.id]).length; });
    if (!P || !apps.length) {
      host.appendChild(el('p', { text: 'No app has settings yet. When an app adds options, they appear here.' }));
      return;
    }
    apps.forEach(function (a) { renderApp(a, false); });
  }

  render();
  window.SlopAppSettings = { render: render };
})();
