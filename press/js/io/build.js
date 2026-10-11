/* Slop Press — "Download App (offline .html)": one self-contained HTML file with every stylesheet and script
   inlined, the bundled Liberation Sans fonts and pdf-lib embedded. Sources ride along as JSON so the offline
   copy can rebuild itself. Slop Hub (Slop Drive) is left out: it belongs to the website's origin. */
(function () {
  'use strict';
  var PR = window.PR = window.PR || {};
  var B = PR.build = {};
  var SRC = (document.currentScript && document.currentScript.src) || '';
  var FONTS = ['LiberationSans-Regular.ttf', 'LiberationSans-Bold.ttf', 'LiberationSans-Italic.ttf', 'LiberationSans-BoldItalic.ttf'];
  B.BINARY = FONTS.map(function (f) { return 'vendor/pdfjs/standard_fonts/' + f; });
  B.EXTRA = ['favicon.svg', 'vendor/pdf-lib/pdf-lib.min.js'];

  B.escapeJSON = function (o) { return JSON.stringify(o).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); };
  /** Paths referenced by index.html (data-src), in order, minus the ones marked data-offline="strip". */
  B.paths = function (html) {
    var out = [], re = /<(link|script)\b[^>]*\bdata-src="([^"]+)"[^>]*>/g, m;
    while ((m = re.exec(html))) if (!/data-offline="strip"/.test(m[0])) out.push({ kind: m[1], path: m[2] });
    return out;
  };
  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  /** Builds the offline HTML from a { path: text | 'base64:…' } map (pure). */
  B.buildHTML = function (S) {
    var html = S['press/index.html'];
    if (!html) throw new Error('index.html missing');
    var scripts = B.paths(html).filter(function (p) { return p.kind === 'script'; }).map(function (p) { return p.path; });
    html = html.replace(/^[^\n]*data-offline="strip"[^\n]*\n/gm, function () { return ''; });
    html = html.replace(/<link\b[^>]*\bdata-src="([^"]+)"[^>]*>/g, function (m, p) {
      var css = S[p]; if (css == null) throw new Error('Missing ' + p);
      return '<style data-src="' + p + '">\n' + css.replace(/<\/style/gi, function () { return '<\\/style'; }) + '\n</style>';
    });
    html = html.replace(/[ \t]*<script\b[^>]*\bdata-src="[^"]+"[^>]*><\/script>\n?/g, function () { return ''; });
    html = html.replace(/href="\.\.\/favicon\.svg"/g, function () { return 'href="data:image/svg+xml;base64,' + b64(S['favicon.svg'] || '') + '"'; });
    html = html.replace(/href="\.\.\/"/g, function () { return 'href="https://slopographic.com/"'; });
    html = html.replace(/<head>/, function () { return '<head>\n  <meta name="slop-press-build" content="offline">'; });
    var boot = '(' + BOOT.toString() + ')(' + JSON.stringify(scripts) + ');';
    return html.replace(/<\/body>/, function () { return '<script type="application/json" id="app-src">' + B.escapeJSON(S) + '</script>\n<script>' + boot + '</script>\n</body>'; });
  };
  /* Runs inside the offline file (serialised with toString: must stay self-contained). */
  function BOOT(scripts) {
    var S = JSON.parse(document.getElementById('app-src').textContent);
    var PR = window.PR = window.PR || {};
    function run(code, name) { var s = document.createElement('script'); s.textContent = code + '\n//# sourceURL=' + name; document.body.appendChild(s); }
    PR.offline = {
      sources: S,
      run: function (p) { if (S[p]) run(S[p], p.split('/').pop()); },
      fontURL: function (file) { var v = S['vendor/pdfjs/standard_fonts/' + file]; return v ? 'data:font/ttf;base64,' + v.slice(7) : null; }
    };
    scripts.forEach(function (p) { if (S[p] != null) run(S[p], p.split('/').pop()); });
  }
  /** Collects sources: from the embedded JSON when offline, otherwise from the site. */
  B.collect = function () {
    if (PR.offline && PR.offline.sources) return Promise.resolve(PR.offline.sources);
    var root = new URL(SRC ? '../../../' : '../', SRC || document.baseURI).href, S = {};
    function text(p) { return fetch(root + p, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error('Could not read ' + p + ' (' + r.status + ')'); return r.text(); }).then(function (t) { S[p] = t; }); }
    return text('press/index.html').then(function () {
      var list = B.paths(S['press/index.html']).map(function (p) { return p.path; }).concat(B.EXTRA);
      return Promise.all(list.map(text));
    }).then(function () {
      return Promise.all(B.BINARY.map(function (p) {
        return fetch(root + p).then(function (r) { return r.ok ? r.arrayBuffer() : null; }).then(function (buf) {
          if (!buf) return; var u8 = new Uint8Array(buf), s = '';
          for (var k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
          S[p] = 'base64:' + btoa(s);
        });
      }));
    }).then(function () { return S; });
  };
  B.make = function () { return B.collect().then(B.buildHTML); };
  B.download = function () {
    if (PR.util) PR.util.toast('Building offline copy…');
    return B.make().then(function (html) {
      window.SlopUI.download(new Blob([html], { type: 'text/html' }), 'slop-press.html');
      if (PR.util) PR.util.toast('Downloaded slop-press.html — open it from disk, it works offline');
      return html;
    }).catch(function (e) { if (PR.util) PR.util.toast('Could not build offline copy: ' + e.message); });
  };
})();
