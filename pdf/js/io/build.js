/* Slop PDF — "Download app (offline .html)": builds one self-contained HTML file with the
   CSS, the app scripts, pdf.js (+ its worker, started from a Blob URL) and pdf-lib inlined.
   All source files are also embedded verbatim as JSON in <script id="app-src">, so the
   offline copy can rebuild itself byte-for-byte. Standalone: no dependency on other modules
   at load time, because the offline bootstrap runs this file first. */
(function () {
  'use strict';
  var SP = window.SP = window.SP || {};
  var B = SP.build = {};
  var SCRIPT_SRC = (document.currentScript && document.currentScript.src) || '';

  /** App scripts in load order (paths relative to the site root). */
  B.SCRIPTS = ['pdf/js/util.js', 'pdf/js/crypto.js', 'pdf/js/engine.js', 'pdf/js/view.js', 'pdf/js/organizer.js', 'pdf/js/editor.js', 'pdf/js/sign.js', 'pdf/js/panels.js', 'pdf/js/app.js'];
  B.TEXT = ['pdf/index.html', 'pdf/pdf.css', 'shared/slopui.css', 'shared/slopui.js', 'favicon.svg', 'vendor/pdf-lib/pdf-lib.min.js', 'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js', 'pdf/js/build.js'].concat(B.SCRIPTS);
  /** Small binary assets (base64): the two symbol fonts pdf.js cannot take from the system. */
  B.BINARY = ['vendor/pdfjs/standard_fonts/FoxitSymbol.pfb', 'vendor/pdfjs/standard_fonts/FoxitDingbats.pfb'];

  /** JSON safe to place inside a <script> element. */
  B.escapeJSON = function (obj) {
    return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  };
  /** Turns an ES module bundle (pdf.js) into a classic script that sets globalThis[name] to its exports. */
  B.toClassic = function (src, name) {
    var m = /export\s*\{([^}]*)\}\s*;?\s*$/.exec(src);
    if (!m) throw new Error('No export list found in module for ' + name);
    var body = src.slice(0, m.index);
    var props = m[1].split(',').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
      var p = s.split(/\s+as\s+/); return JSON.stringify(p[1] || p[0]) + ':' + p[0];
    });
    body = body.split('import.meta.url').join('"about:blank"');
    return '(function(){"use strict";\n' + body + '\nglobalThis[' + JSON.stringify(name) + ']={' + props.join(',') + '};\n})();';
  };

  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  /** Builds the offline HTML from a {path: text | 'base64:…'} source map (pure, deterministic). */
  B.buildHTML = function (S) {
    var html = S['pdf/index.html'];
    if (!html) throw new Error('index.html missing from sources');
    html = html.replace(/^[^\n]*data-offline="strip"[^\n]*\n/gm, function () { return ''; });
    html = html.replace(/<link\b[^>]*\bdata-src="([^"]+)"[^>]*>/g, function (m, p) {
      var css = S[p]; if (css == null) throw new Error('Missing ' + p);
      return '<style data-src="' + p + '">\n' + css.replace(/<\/style/gi, function () { return '<\\/style'; }) + '\n</style>';
    });
    html = html.replace(/[ \t]*<script\b[^>]*\bdata-src="[^"]+"[^>]*><\/script>\n?/g, function () { return ''; });
    html = html.replace(/href="\.\.\/favicon\.svg"/g, function () { return 'href="data:image/svg+xml;base64,' + b64(S['favicon.svg'] || '') + '"'; });
    html = html.replace(/href="\.\.\/"/g, function () { return 'href="https://slopographic.com/"'; });
    html = html.replace(/<head>/, function () { return '<head>\n  <meta name="slop-pdf-build" content="offline">'; });
    var boot = '(' + BOOT.toString() + ')();';
    html = html.replace(/<\/body>/, function () {
      return '<script type="application/json" id="app-src">' + B.escapeJSON(S) + '</script>\n<script>' + boot + '</script>\n</body>';
    });
    return html;
  };

  /* Runs inside the offline file. Must stay self-contained (it is serialised with toString). */
  function BOOT() {
    var S = JSON.parse(document.getElementById('app-src').textContent);
    var SP = window.SP = window.SP || {};
    function run(code, name) { var s = document.createElement('script'); s.textContent = code + '\n//# sourceURL=' + name; document.body.appendChild(s); }
    function bytes(b64s) { var bin = atob(b64s), o = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) o[i] = bin.charCodeAt(i); return o; }
    run(S['pdf/js/build.js'], 'build.js');
    var B = SP.build;
    SP.offline = { sources: S };
    function FontFactory() {}
    FontFactory.prototype.fetch = function (o) {
      var v = S['vendor/pdfjs/standard_fonts/' + o.filename];
      return v ? Promise.resolve(bytes(v.slice(7))) : Promise.reject(new Error('Font not bundled: ' + o.filename));
    };
    SP.offline.FontFactory = FontFactory;
    run(S['shared/slopui.js'], 'slopui.js');
    run(S['vendor/pdf-lib/pdf-lib.min.js'], 'pdf-lib.min.js');
    run(B.toClassic(S['vendor/pdfjs/pdf.min.js'], 'pdfjsLib'), 'pdf.min.js');
    var wsrc = B.toClassic(S['vendor/pdfjs/pdf.worker.min.js'], 'pdfjsWorker');
    try {
      var url = URL.createObjectURL(new Blob([wsrc], { type: 'text/javascript' }));
      window.pdfjsLib.GlobalWorkerOptions.workerPort = new Worker(url);
    } catch (e) {
      run(wsrc, 'pdf.worker.min.js'); // fall back to pdf.js's main-thread "fake worker"
    }
    B.SCRIPTS.forEach(function (p) { run(S[p], p.split('/').pop()); });
  }

  /** Collects the sources: from the embedded JSON when offline, otherwise from the site. */
  B.collect = async function () {
    if (SP.offline && SP.offline.sources) return SP.offline.sources;
    var root = new URL(SCRIPT_SRC ? '../../' : '../', SCRIPT_SRC || document.baseURI).href, S = {};
    for (var i = 0; i < B.TEXT.length; i++) {
      var r = await fetch(root + B.TEXT[i], { cache: 'no-cache' });
      if (!r.ok) throw new Error('Could not read ' + B.TEXT[i] + ' (' + r.status + ')');
      S[B.TEXT[i]] = await r.text();
    }
    for (var j = 0; j < B.BINARY.length; j++) {
      var rb = await fetch(root + B.BINARY[j]);
      if (!rb.ok) continue;
      var u8 = new Uint8Array(await rb.arrayBuffer()), s = '';
      for (var k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
      S[B.BINARY[j]] = 'base64:' + btoa(s);
    }
    return S;
  };
  B.make = async function () { return B.buildHTML(await B.collect()); };
})();
