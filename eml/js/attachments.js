/* Slop EML: saving attachments together. One attachment is saved as it is; two or more go into one ZIP named after the
 * message. Names are cleaned of path characters and made unique inside the ZIP. Classic script: window.EmlAttachments.
 *   EmlAttachments.uniqueNames(names)        -> the same names, with duplicates made distinct ("a (2).pdf")
 *   EmlAttachments.packageOf(doc, indexes)   -> Promise<{ blob, name }> for those attachments, or null when none */
(function () {
  'use strict';
  const safe = (n) => String(n || 'attachment').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').trim() || 'attachment';

  function uniqueNames(names) {
    const used = new Set();
    return names.map((raw) => {
      const base = safe(raw), dot = base.lastIndexOf('.'), stem = dot > 0 ? base.slice(0, dot) : base, ext = dot > 0 ? base.slice(dot) : '';
      let name = base, n = 1;
      while (used.has(name.toLowerCase())) { n += 1; name = stem + ' (' + n + ')' + ext; }
      used.add(name.toLowerCase());
      return name;
    });
  }

  async function packageOf(doc, indexes) {
    const atts = doc.msg.attachments;
    const picked = indexes.filter((i) => atts[i]).map((i) => atts[i]);
    if (!picked.length) return null;
    if (picked.length === 1) return { blob: new Blob([picked[0].bytes], { type: picked[0].type }), name: safe(picked[0].name) };
    const names = uniqueNames(picked.map((a) => a.name));
    const blob = await window.SlopZip.zip(picked.map((a, k) => ({ name: names[k], data: a.bytes })));
    const stem = safe(String(doc.name || 'message').replace(/\.eml$/i, ''));
    return { blob, name: stem + ' attachments.zip' };
  }

  window.EmlAttachments = { uniqueNames, packageOf };
})();
