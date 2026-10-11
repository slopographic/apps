/* Settings: the Local folder section. It is the same folder as Slop Drive's (shared/sync/providers/local.js), so a
 * connect here shows in Slop Drive and the other way round. Connect, allow access, disconnect, and the config actions
 * from shared/config/folder.js (save the settings as slopographic.slop.json; load them back, with the changes listed
 * before Apply). No network. Classic script. Needs the local provider and the config scripts loaded first. */
(function () {
  'use strict';
  var host = document.getElementById('folder-box');
  var ask = document.getElementById('folder-ask');
  var preview = document.getElementById('folder-preview');
  var note = document.getElementById('folder-note');
  var L = window.SlopSyncProviders && window.SlopSyncProviders.local;
  var F = window.SlopConfigFolder;
  var state = { supported: false, name: null, perm: 'none' };

  function el(tag, props, kids) {
    var n = document.createElement(tag);
    Object.keys(props || {}).forEach(function (k) {
      if (k === 'text') n.textContent = props[k];
      else if (k === 'onclick') n.addEventListener('click', props[k]);
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { n.appendChild(c); });
    return n;
  }
  function button(label, fn, cls) {
    return el('button', { type: 'button', class: cls || 'btn', text: label, onclick: function () { run(fn); } });
  }
  function say(msg) { note.textContent = msg || ''; }
  /** Runs an action and shows what went wrong, so a button never fails silently. */
  function run(fn) {
    Promise.resolve().then(fn).catch(function (e) { say(e && e.message ? e.message : String(e)); });
  }
  function hide(node) { node.hidden = true; node.replaceChildren(); }

  async function refresh() {
    state.supported = !!L && L.supported();
    if (state.supported) {
      var ch = await L.chosen();
      state.name = ch ? ch.name : null;
      state.perm = await L.permission();
    } else { state.name = null; state.perm = 'none'; }
    render();
  }

  function render() {
    host.replaceChildren();
    if (!state.supported) {
      host.append(el('p', { class: 'settings-note', text: 'Folders need Chrome or Edge. Slopographic keeps your files in this browser, and nothing is written to your computer.' }));
      return;
    }
    if (!state.name) {
      host.append(el('p', { class: 'settings-note', text: 'No folder is connected.' }), button('Connect folder…', connect));
      return;
    }
    host.append(el('p', { class: 'settings-note', text: 'Folder: ' + state.name + '. Slop Drive uses this folder too.' }));
    if (state.perm !== 'granted') {
      host.append(button('Allow access to ' + state.name, allow));
      return;
    }
    host.append(el('div', { class: 'folder-row' }, [
      button('Save config to folder', save),
      button('Load config from folder…', load),
      button('Disconnect', disconnect, 'btn'),
    ]));
  }

  async function connect() {
    if (!state.supported) return say('Folders need Chrome or Edge.');
    var r = await L.pick();
    if (!r.ok) return say(r.cancelled ? 'No folder was chosen. Nothing was connected.' : r.error);
    await refresh();
    askSave(r.name);
  }

  /** The question after connecting: save the config in the folder now? */
  function askSave(name) {
    hide(preview);
    ask.hidden = false;
    ask.replaceChildren(
      el('p', { class: 'settings-note', text: 'Save the Slopographic settings in “' + name + '” as ' + F.FILE + '? You can load them back from this folder later. Nothing is sent anywhere.' }),
      button('Save config', function () { ask.hidden = true; return save(); }),
      button('Not now', function () { hide(ask); say('Connected. The config was not saved.'); }, 'btn')
    );
  }

  async function save() {
    var r = await F.save();
    if (!r.ok) return say(r.error);
    say('Saved ' + r.name + ' in the folder.');
  }

  async function load() {
    hide(ask);
    var p = await F.preview();
    if (!p.ok) return say(p.error);
    var body = p.changes.length
      ? [el('p', { class: 'settings-note', text: 'Applying this file changes:' }),
        el('ul', { class: 'folder-changes' }, p.changes.map(function (c) { return el('li', { text: c.label + ': ' + c.from + ' → ' + c.to }); }))]
      : [el('p', { class: 'settings-note', text: 'Nothing would change. The file matches the settings here.' })];
    preview.hidden = false;
    preview.replaceChildren.apply(preview, body.concat([el('div', { class: 'folder-row' }, [
      p.changes.length ? button('Apply', async function () {
        var r = await F.apply(p);
        if (!r.ok) return say(r.error);
        hide(preview);
        say('Applied ' + r.applied + ' change' + (r.applied === 1 ? '' : 's') + ' from the folder.');
        if (window.SlopSettings && window.SlopSettings.sync) window.SlopSettings.sync();
      }) : null,
      button('Close', function () { hide(preview); }, 'btn'),
    ].filter(Boolean))]));
  }

  async function allow() {
    var p = await L.allow();
    if (p !== 'granted') return say('The browser did not allow access. Press the button again and allow access.');
    await refresh();
    say('Access allowed.');
  }

  async function disconnect() {
    hide(ask); hide(preview);
    await L.forget();
    await refresh();
    say('Folder disconnected. Nothing in the folder was deleted.');
  }

  refresh();
})();
