/* Slop Vector — io: offline single-file self-download */
(function () {
  'use strict';
  var G = window.SVGeom, SV = window.SV, S = SV.state;
  var fmt = G.fmt, esc = SV.esc, clone = SV.clone;
  var abs = Math.abs, min = Math.min, max = Math.max, sqrt = Math.sqrt;
  var IO = SV.io = SV.io || {};
  var $ = SV._io = SV._io || {};

  /* ================= offline self-download ================= */
  function fetchText(url) { return fetch(url, { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error(url + ' → HTTP ' + r.status); return r.text(); }); }
  // Wrap code in an inline <style>/<script>, neutralising any closing tag inside it so the element can't end early.
  IO.inlineTag = function (tag, code) {
    var re = new RegExp('<\\/(' + tag + ')', 'gi');
    return '<' + tag + '>\n' + String(code).replace(re, '<\\/$1') + '\n</' + tag + '>';
  };
  IO.buildOfflineHTML = function () {
    var offline = location.protocol === 'file:' || !!document.querySelector('meta[name="slop-vector-build"]');
    if (offline) {
      if (window.__SV_PRISTINE) return Promise.resolve(window.__SV_PRISTINE);
      return Promise.reject(new Error('No pristine copy available'));
    }
    return fetchText('index.html').then(function (html) {
      var jobs = [];
      // stylesheets
      html = html.replace(/<link\b[^>]*>/gi, function (tag) {
        var href = (/href="([^"]+)"/i.exec(tag) || [])[1] || '';
        // Web fonts (data-offline="strip") stay online-only: offline, the fallback font stack is used.
        if (/fonts\.(googleapis|gstatic)\.com/.test(href) || /rel="preconnect"|data-offline="strip"/i.test(tag)) return '';
        if (/rel="stylesheet"/i.test(tag) && !/^https?:/i.test(href)) { var k = '@@CSS' + jobs.length + '@@'; jobs.push({ k: k, url: href, kind: 'css' }); return k; }
        if (/rel="icon"/i.test(tag) && !/^https?:|^data:/i.test(href)) { var k2 = '@@ICON' + jobs.length + '@@'; jobs.push({ k: k2, url: href, kind: 'icon' }); return k2; }
        return tag;
      });
      html = html.replace(/<script\b([^>]*)\bsrc="([^"]+)"([^>]*)><\/script>/gi, function (m, a, src) {
        if (/^https?:/i.test(src)) return m;
        var k = '@@JS' + jobs.length + '@@'; jobs.push({ k: k, url: src, kind: 'js' }); return k;
      });
      return Promise.all(jobs.map(function (j) { return fetchText(j.url).then(function (t) { j.text = t; }); })).then(function () {
        jobs.forEach(function (j) {
          var rep;
          if (j.kind === 'css' || j.kind === 'js') rep = IO.inlineTag(j.kind === 'css' ? 'style' : 'script', j.text);
          else rep = '<link rel="icon" href="data:image/svg+xml,' + encodeURIComponent(j.text) + '" type="image/svg+xml">';
          html = html.split(j.k).join(rep);
        });
        html = html.replace(/<meta charset="utf-8">/i, '<meta charset="utf-8">\n  <meta name="slop-vector-build" content="offline">');
        return IO.normalizeHTML(html);
      });
    });
  };
  // Serialise through the HTML parser so the first offline build is byte-identical to the copy the
  // offline app later re-serialises from its own DOM (see the capture script in index.html).
  IO.normalizeHTML = function (html) {
    var d = new DOMParser().parseFromString(html, 'text/html');
    return '<!doctype html>\n' + d.documentElement.outerHTML;
  };
  IO.downloadApp = function () {
    return IO.buildOfflineHTML().then(function (html) {
      IO.download(new Blob([html], { type: 'text/html' }), 'slop-vector.html');
      SV.toast('Downloaded slop-vector.html — open it from disk, works fully offline');
      return html;
    }).catch(function (e) { SV.toast('Could not build offline copy: ' + e.message, 'warn'); });
  };
})();
