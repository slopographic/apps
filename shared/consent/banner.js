/* The consent strip: a slim bar along the bottom edge, not a modal. Shown only when storage works and there is no choice
 * for the current policy version. Accept or Reject saves the choice; × rejects the optional extras and closes.
 * Detailed switches live on the Settings page. Classic script, exposes window.SlopBanner.
 * Needs config.js, state.js and consent-mode.js loaded first. Plain DOM, native buttons (keyboard works). */
(function () {
  'use strict';
  var S = window.SlopConsentState;
  var C = window.SlopConsent;
  var ID = 'slopc-banner';

  function text(tag, attrs, kids) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    (kids || []).forEach(function (k) { el.append(typeof k === 'string' ? document.createTextNode(k) : k); });
    return el;
  }
  function button(label, act, cls, aria) {
    var b = text('button', { type: 'button', class: 'slopc-btn' + (cls ? ' ' + cls : ''), 'data-act': act }, [label]);
    if (aria) b.setAttribute('aria-label', aria);
    return b;
  }
  function injectCss() {
    if (document.getElementById('slopc-css')) return;
    var link = text('link', { id: 'slopc-css', rel: 'stylesheet', href: S.base + 'shared/consent/banner.css' });
    (document.head || document.documentElement).append(link);
  }
  function remove() {
    var el = document.getElementById(ID);
    if (el) el.remove();
  }
  function choose(next) {
    if (C) C.setChoices(next);
    remove(); // a choice (or a refused save) ends the strip: nothing asks again on this page
  }
  function build() {
    var root = text('div', { id: ID, class: 'slopc-banner', role: 'region', 'aria-label': 'Privacy choice' }, [
      text('p', { class: 'slopc-text' }, [
        'Analytics and ads are off. Turn them on? You can change this any time in ',
        text('a', { href: S.base + 'settings/' }, ['Settings']), '.'
      ]),
      text('div', { class: 'slopc-actions' }, [
        button('Reject', 'reject'),
        button('Accept', 'accept', 'primary'),
        button('×', 'close', 'x', 'Reject optional and close')
      ])
    ]);
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'accept') choose({ analytics: true, ads: true });
      else if (act === 'reject' || act === 'close') choose({ analytics: false, ads: false });
    });
    return root;
  }
  /** Shows the strip if the visitor still needs to choose. Pages with body[data-consent="off"] never show it. */
  function mount() {
    if (!S || !C) return false;
    if (document.body && document.body.getAttribute('data-consent') === 'off') return false;
    if (!S.needsChoice() || document.getElementById(ID) || !document.body) return false;
    injectCss();
    document.body.append(build());
    return true;
  }
  window.SlopBanner = { mount: mount, remove: remove };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
