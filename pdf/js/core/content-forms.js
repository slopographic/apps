/* Slop PDF — the Form XObjects a strip changed (core/content-strip.js: its forms), written with pdf-lib for
   editor/text-strip.js. Each form a Do draws without some of its text becomes a new stream with the new content and the
   form's own dictionary (BBox, Matrix, Resources, Group …), under the new name in a copy of the resources of the stream
   that draws it (the page's, or the copy of the parent form): the page draws the copy, and the form itself stays as it
   was for every other page, every other Do and every other place that uses it. A form that nothing in the file uses any
   more (nothing the trailer reaches) leaves the file, with the resource dictionaries only it used, so the text taken off
   is not in the file at all. Classic script. */
(function () {
  'use strict';
  var F = window.SlopPdfForms = {};
  function bytesOf(s) { var u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; }
  var SKIP = { Length: 1, Filter: 1, DecodeParms: 1, DL: 1 };

  /** A copy of resources res (a dictionary, or none) whose XObjects have the copies of plan's forms under their new names,
   * and not the names nothing draws now. old: the indirect objects replaced, collected. */
  function resWith(doc, res, plan, old) {
    var L = PDFLib, ctx = doc.context, N = L.PDFName.of, out = res instanceof L.PDFDict ? res.clone(ctx) : ctx.obj({});
    var raw = out.get(N('XObject')), xd = raw ? ctx.lookup(raw) : null; // i18n-ignore: PDF names / font names / producer, not UI
    if (raw instanceof L.PDFRef) old.push(raw);
    xd = xd instanceof L.PDFDict ? xd.clone(ctx) : ctx.obj({});
    plan.forms.forEach(function (f) { xd.set(N(f.as), ctx.register(copyOf(doc, f, old))); });
    plan.unused.forEach(function (n) { xd.delete(N(n)); });
    out.set(N('XObject'), xd); // i18n-ignore: PDF names / font names / producer, not UI
    return out;
  }
  /** The copy of a form with its new content (and, when forms in it changed too, its resources' copy). */
  function copyOf(doc, f, old) {
    var L = PDFLib, ctx = doc.context, N = L.PDFName.of, st = f.x.stream, s = ctx.flateStream(bytesOf(f.text));
    st.dict.entries().forEach(function (e) { if (!SKIP[e[0].decodeText()]) s.dict.set(e[0], e[1]); }); // compat-ok: pdf-lib's entries() is an array
    if (f.forms.length) {
      var raw = st.dict.get(N('Resources')); // i18n-ignore: PDF names / font names / producer, not UI
      if (raw instanceof L.PDFRef) old.push(raw);
      s.dict.set(N('Resources'), resWith(doc, f.x.res.dict, f, old)); // i18n-ignore: PDF names / font names / producer, not UI
    }
    if (f.x.ref) old.push(f.x.ref);
    return s;
  }
  /** The indirect objects the trailer reaches (as "n g R"). */
  function reached(ctx) {
    var L = PDFLib, seen = new Set(), todo = [], t = ctx.trailerInfo || {};
    [t.Root, t.Info, t.Encrypt].forEach(function (o) { if (o) todo.push(o); });
    while (todo.length) {
      var o = todo.pop();
      if (o instanceof L.PDFRef) {
        var key = String(o);
        if (seen.has(key)) continue;
        seen.add(key);
        o = ctx.lookup(o);
      }
      if (!o) continue;
      if (o.dict instanceof L.PDFDict) o = o.dict;
      if (o instanceof L.PDFDict) o.values().forEach(function (v) { todo.push(v); }); // compat-ok: pdf-lib's values() is an array
      else if (o instanceof L.PDFArray) o.asArray().forEach(function (v) { todo.push(v); });
    }
    return seen;
  }
  /** Page `page` of doc draws the plan's form copies (plan: strip's result for its content); the old forms that nothing
   * uses now leave the file. */
  F.put = function (doc, page, plan) {
    if (!plan || !plan.forms || !plan.forms.length) return;
    var L = PDFLib, N = L.PDFName.of, old = [], raw = page.node.get(N('Resources')); // i18n-ignore: PDF names / font names / producer, not UI
    if (raw instanceof L.PDFRef) old.push(raw);
    page.node.set(N('Resources'), resWith(doc, page.node.Resources(), plan, old)); // i18n-ignore: PDF names / font names / producer, not UI
    var seen = reached(doc.context);
    old.forEach(function (ref) { if (!seen.has(String(ref))) doc.context.delete(ref); });
  };
  F.reached = reached;
  /** Page i of doc shows the content text from now on; its old streams (oldRefs, core/content-res.js contentOf) leave the
   * file too unless another page shows them, so what was taken off is not in it at all (editor/text-strip.js X.putContent,
   * io/ocg.js). */
  F.contents = function (doc, i, oldRefs, text) {
    var L = PDFLib, page = doc.getPage(i), ref = doc.context.register(doc.context.flateStream(bytesOf(text)));
    var others = new Set();
    doc.getPages().forEach(function (pg, k) { if (k !== i) window.SlopPdfRes.contentRefs(pg).forEach(function (x) { others.add(String(x)); }); });
    page.node.set(L.PDFName.of('Contents'), ref); // i18n-ignore: PDF names / font names / producer, not UI
    oldRefs.forEach(function (x) { if (x instanceof L.PDFRef && !others.has(String(x))) doc.context.delete(x); });
  };
})();
