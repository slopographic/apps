/* The consent banner: shown only when storage works and there is no choice for the current policy version.
 * Classic script, exposes window.SlopBanner. Needs config.js, state.js and consent-mode.js loaded first.
 * Plain DOM, native buttons and checkboxes (keyboard works), styled by banner.css (injected once). */
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
  function button(label, act, cls) {
    return text('button', { type: 'button', class: 'slopc-btn' + (cls ? ' ' + cls : ''), 'data-act': act }, [label]);
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
    remove(); // a choice (or a refused save) ends the banner: nothing asks again on this page
  }
  function build() {
    var cur = C ? C.state() : { analytics: false, ads: false };
    var manageId = 'slopc-manage';
    var analytics = text('input', { type: 'checkbox', id: 'slopc-analytics' });
    var ads = text('input', { type: 'checkbox', id: 'slopc-ads' });
    analytics.checked = cur.analytics;
    ads.checked = cur.ads;
    var manage = text('div', { id: manageId, class: 'slopc-manage', hidden: '' }, [
      text('label', { class: 'slopc-switch' }, [analytics, text('span', {}, ['Analytics'])]),
      text('label', { class: 'slopc-switch' }, [ads, text('span', {}, ['Ads'])]),
      button('Save choices', 'save', 'primary')
    ]);
    var manageBtn = button('Manage', 'manage');
    manageBtn.setAttribute('aria-expanded', 'false');
    manageBtn.setAttribute('aria-controls', manageId);
    var link = text('a', { href: S.base + 'settings/' }, ['Settings']);
    var root = text('div', { id: ID, class: 'slopc-banner', role: 'region', 'aria-label': 'Privacy choices' }, [
      text('div', { class: 'slopc-body' }, [
        text('p', {}, ['We use local storage for your settings. Turn on analytics and ads? You can change this any time in ', link, '.']),
        text('div', { class: 'slopc-actions' }, [
          button('Accept all', 'accept', 'primary'),
          button('Reject optional', 'reject'),
          manageBtn
        ]),
        manage
      ])
    ]);
    root.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('button[data-act]');
      if (!b) return;
      var act = b.getAttribute('data-act');
      if (act === 'accept') choose({ analytics: true, ads: true });
      else if (act === 'reject') choose({ analytics: false, ads: false });
      else if (act === 'manage') {
        var open = manage.hasAttribute('hidden');
        if (open) manage.removeAttribute('hidden'); else manage.setAttribute('hidden', '');
        manageBtn.setAttribute('aria-expanded', String(open));
        if (open) analytics.focus();
      } else if (act === 'save') choose({ analytics: analytics.checked, ads: ads.checked });
    });
    return root;
  }
  /** Shows the banner if the visitor still needs to choose. Pages with body[data-consent="off"] never show it. */
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
