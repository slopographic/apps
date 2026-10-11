/* The support card's contents: Sloppo, the ask, Donate, the ads slider (or the ad slot with "Turn off"), "No thanks" and ×.
 * Classic script, exposes window.SlopSupportCard.build({ onClose, onNoThanks }) and .config().
 * Writes no storage itself. Ads go through SlopConsent.setChoices only (the one place ads load). Needs
 * shared/consent (config, state, consent-mode) on the page for the ads row; without it the row is hidden.
 * The ads slider starts at Off. Nothing about the card goes into an exported file. */
(function () {
  'use strict';
  function support() {
    var d = { exportCard: true, donate: true, ads: true };
    var c = window.SlopBrand && window.SlopBrand.config && window.SlopBrand.config.support;
    if (c) { d.exportCard = c.exportCard !== false; d.donate = c.donate !== false; d.ads = c.ads !== false; }
    return d;
  }
  function patreonUrl() {
    var c = window.SlopBrand && window.SlopBrand.config && window.SlopBrand.config.links;
    return (c && c.patreon) || '';
  }
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  /** Sloppo, small and happy: the shared painter, a soft smile, no glow. Falls back to nothing if the module fails. */
  function sloppo() {
    var wrap = el('div', 'slopsup-sloppo');
    wrap.setAttribute('aria-hidden', 'true');
    var cv = el('canvas', null);
    cv.width = 128; cv.height = 128; cv.style.width = '64px'; cv.style.height = '64px';
    wrap.append(cv);
    try {
      var base = window.SlopSupportState.base;
      import(base + 'shared/sloppo/index.js').then(function (m) {
        var g = cv.getContext('2d');
        g.clearRect(0, 0, 128, 128);
        m.drawSloppo(g, 128, 128, { body: 'pink', eyes: 'normal', mouth: 'cat', scale: 1.1, baseY: 0.62, noGlow: true }, 0);
      }).catch(function () { wrap.hidden = true; });
    } catch (e) { wrap.hidden = true; }
    return wrap;
  }
  function adSlot() {
    var s = el('section', 'slopsup-ad');
    s.setAttribute('aria-label', 'Advertisement');
    s.append(el('p', 'slopsup-ad-label', 'Ad'));
    var id = window.SLOP_CONSENT_CONFIG && window.SLOP_CONSENT_CONFIG.adsensePublisherId;
    if (id) {
      var ins = el('ins', 'adsbygoogle');
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', id);
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
      s.append(ins);
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* script not ready: the unit stays empty */ }
    } else {
      s.append(el('p', 'slopsup-ad-empty', 'Ad space (no ad unit configured)'));
    }
    return s;
  }
  /** The ads row: the slider (Off by default) or, once ads are accepted, the ad slot plus "Turn off". */
  function adsRow(rerender) {
    var box = el('div', 'slopsup-adsrow');
    var C = window.SlopConsent, S = window.SlopConsentState;
    if (!C || !S) return box; // no consent scripts on this page: no ads control at all
    if (S.current().ads) {
      box.append(adSlot());
      var off = el('button', 'slopsup-link', 'Turn off ads');
      off.type = 'button';
      off.addEventListener('click', function () { C.setChoices({ ads: false }); rerender(); });
      box.append(off);
      return box;
    }
    var label = el('label', 'slopsup-slider');
    var name = el('span', 'slopsup-slider-name', 'Ads');
    var range = el('input', null);
    range.type = 'range'; range.min = '0'; range.max = '1'; range.step = '1'; range.value = '0';
    range.setAttribute('aria-label', 'Ads: Off or On');
    var ends = el('span', 'slopsup-slider-ends');
    ends.append(el('span', null, 'Off'), el('span', null, 'On'));
    range.addEventListener('input', function () {
      if (range.value === '1') { C.setChoices({ ads: true }); rerender(); }
    });
    label.append(name, range, ends);
    box.append(label);
    return box;
  }
  /** The whole card. onClose: the × (closes for now). onNoThanks: the stored, permanent "No thanks". */
  function build(opts) {
    opts = opts || {};
    var flags = support();
    var root = el('section', 'slopsup-card');
    root.setAttribute('role', 'region');
    root.setAttribute('aria-label', 'Support Slopographic');
    var close = el('button', 'slopsup-x', '×');
    close.type = 'button';
    close.setAttribute('aria-label', 'Close for now');
    close.addEventListener('click', function () { if (opts.onClose) opts.onClose(); root.remove(); });
    var head = el('div', 'slopsup-head');
    head.append(sloppo(), el('h2', 'slopsup-title', 'Support Slopographic'), close);
    var body = el('div', 'slopsup-body');
    body.append(el('p', 'slopsup-text', 'Sloppo made this free. If it helped, a donation keeps it going.'),
      el('p', 'slopsup-fine', 'Analytics and ads are off by default.'));
    var actions = el('div', 'slopsup-actions');
    var url = patreonUrl();
    if (flags.donate && url) {
      var a = el('a', 'slopsup-btn', 'Donate');
      a.href = url; a.target = '_blank'; a.rel = 'noopener';
      actions.append(a);
    }
    var no = el('button', 'slopsup-btn', 'No thanks');
    no.type = 'button';
    no.addEventListener('click', function () { if (opts.onNoThanks) opts.onNoThanks(); root.remove(); });
    actions.append(no);
    body.append(actions);
    if (flags.ads) {
      var rerender = function () { var fresh = adsRow(rerender); box.replaceWith(fresh); box = fresh; };
      var box = adsRow(rerender);
      body.append(box);
    }
    root.append(head, body);
    return root;
  }
  window.SlopSupportCard = Object.freeze({ build: build, config: support, patreonUrl: patreonUrl });
})();
