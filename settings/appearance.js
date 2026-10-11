/* Settings: the Appearance section. One radio per theme, each with a preview swatch. A choice applies at once on this page
 * and is stored through SlopTheme, which mirrors it into every app's own theme key. Classic script. Needs
 * shared/theme/theme.js (and shared/profile/profile.js) loaded first. */
(function () {
  'use strict';
  var T = window.SlopTheme;
  var host = document.getElementById('theme-options');
  var note = document.getElementById('theme-note');
  if (!T || !host) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  /** A small preview of one theme's tokens. System shows the light half and the dark half. */
  function paint(box, t) {
    var tk = t.tokens;
    box.style.setProperty('--sw-bg', tk.background);
    box.style.setProperty('--sw-surface', tk.surface);
    box.style.setProperty('--sw-text', tk.text);
    box.style.setProperty('--sw-accent', tk.accent);
    box.style.setProperty('--sw-border', tk.border);
  }
  function swatch(choice) {
    var box = el('span', 'theme-swatch');
    box.setAttribute('aria-hidden', 'true');
    if (choice.id === T.SYSTEM) {
      var lightHalf = el('span', 'theme-half'), darkHalf = el('span', 'theme-half');
      paint(lightHalf, T.THEMES[0]);
      paint(darkHalf, T.THEMES[1]);
      box.appendChild(lightHalf);
      box.appendChild(darkHalf);
      return box;
    }
    paint(box, choice.theme);
    box.appendChild(el('span', 'theme-panel'));
    box.appendChild(el('span', 'theme-dot'));
    box.appendChild(el('span', 'theme-aa', 'Aa'));
    return box;
  }
  var choices = [{ id: T.SYSTEM, name: 'System', hint: 'Follows your device' }].concat(T.THEMES.map(function (t) {
    return { id: t.id, name: t.name, theme: t };
  }));

  function sync() {
    var cur = T.get();
    host.querySelectorAll('input[name="theme"]').forEach(function (input) { input.checked = input.value === cur; });
  }
  function render() {
    host.textContent = '';
    choices.forEach(function (c) {
      var id = 'theme-' + c.id;
      var input = el('input');
      input.type = 'radio';
      input.name = 'theme';
      input.id = id;
      input.value = c.id;
      input.addEventListener('change', function () {
        var r = T.set(c.id);
        sync();
        note.textContent = r.ok
          ? 'Saved. ' + c.name + ' is the theme for every app and this site.'
          : r.error;
      });
      var label = el('label', 'theme-opt');
      label.htmlFor = id;
      label.appendChild(input);
      label.appendChild(swatch(c));
      var text = el('span', 'theme-text');
      text.appendChild(el('span', 'theme-name', c.name));
      text.appendChild(el('span', 'theme-hint', c.hint || (c.theme.scheme === 'dark' ? 'Dark' : 'Light')));
      label.appendChild(text);
      host.appendChild(label);
    });
    sync();
  }
  render();
})();
