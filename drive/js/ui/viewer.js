/* Slop Drive — ui/viewer: Drive's side of SlopPreview. Images and PDFs are shown by the shared viewer (zoom, pan,
 * open in a new tab, download, share) in Quick look, the details panel and the columns alike. This file only gives the
 * viewer the file's blob URL and its PDF pages, rendered with the PDF.js path in core/thumbs.js. Classic script. */
'use strict';
(function (DR) {
  /** The width of a Quick look page at 100%: the window, at most 900 px. */
  const pageWidth = () => Math.min(900, innerWidth - 80);
  /** A viewer for a file (image or PDF). big: Quick look (every page, up to 20); otherwise the first page only.
   * sink: the array that keeps the object URL (the caller frees it). */
  DR.viewerFor = function (r, big, sink) {
    const versions = versionsOf(r);
    if (versions.length > 1) return versionTabs(versions, big, sink);
    return plainViewer(r, big, sink);
  };
  /** The original of a PDF and the versions saved beside it in Slop Drive (its edited copy and change list), in tab order. */
  function versionsOf(r) {
    const p = r && r.meta && r.meta.pdf;
    if (!p || p.role === 'edited' || p.role === 'changes' || DR.kindOf(r) !== 'pdf') return [{ label: 'Original', rec: r }];
    const out = [{ label: 'Original', rec: r }];
    const ed = p.edited && DR.item('f:' + p.edited);
    if (ed && ed.blob) out.push({ label: 'Edited copy', rec: ed });
    const ch = p.changes && DR.item('f:' + p.changes);
    if (ch && ch.blob) out.push({ label: 'Change list', rec: ch, changes: true });
    return out;
  }
  /** The tabs above a PDF's preview: one tab per version. The change list shows its edits in a list. */
  function versionTabs(versions, big, sink) {
    const wrap = document.createElement('div'), bar = document.createElement('div'), body = document.createElement('div');
    wrap.className = 'pv-versions';
    bar.className = 'pv-tabs'; bar.setAttribute('role', 'tablist');
    body.className = 'pv-version-body';
    const tabs = versions.map((v, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'pv-tab'; b.setAttribute('role', 'tab'); b.textContent = v.label;
      b.addEventListener('click', () => show(i));
      bar.append(b);
      return b;
    });
    const show = async (i) => {
      tabs.forEach((t, j) => t.setAttribute('aria-selected', j === i ? 'true' : 'false'));
      body.replaceChildren(document.createTextNode('Loading…'));
      const v = versions[i];
      if (v.changes) body.replaceChildren(await changeList(v.rec));
      else body.replaceChildren(plainViewer(v.rec, big, sink).el);
    };
    wrap.append(bar, body);
    show(0);
    return { el: wrap };
  }
  /** The change list of a document as a readable list (each change: what, from, to). */
  async function changeList(rec) {
    let items = [];
    try { items = JSON.parse(await rec.blob.text()); } catch (e) { items = []; }
    if (!Array.isArray(items) || !items.length) {
      const pre = document.createElement('pre'); pre.className = 'pv-changes-raw'; pre.textContent = 'No changes saved.';
      return pre;
    }
    const ul = document.createElement('ul'); ul.className = 'pv-changes';
    for (const c of items.slice(0, 200)) {
      const li = document.createElement('li');
      li.textContent = c && c.label ? `${c.label}: ${c.from ?? ''} → ${c.to ?? ''}` : JSON.stringify(c);
      ul.append(li);
    }
    return ul;
  }
  function plainViewer(r, big, sink) {
    const kind = DR.isAi(r) ? 'pdf' : DR.kindOf(r), blobUrl = URL.createObjectURL(r.blob); // an .ai file shows its PDF page
    sink.push(blobUrl);
    const o = { title: r.name, blobUrl, kind, chrome: false };
    if (kind === 'pdf') o.renderPages = () => pdfPages(r.blob, big);
    if (DR.isAi(r)) o.renderPages = () => DR.aiPdfBlob(r.blob).then((pdf) => (pdf ? pdfPages(pdf, big) : { pages: [], note: 'No PDF page inside this Illustrator file, so there is no preview.' }));
    return window.SlopPreview.create(o);
  };
  /** The pages as canvases, each sized in CSS px (at 100%) and rendered at up to 2× for sharpness. */
  async function pdfPages(blob, big) {
    const doc = await DR.openPdf(blob);
    try {
      const n = big ? Math.min(doc.numPages, 20) : 1, base = big ? pageWidth() : 560, ratio = Math.min(2, devicePixelRatio || 1);
      const pages = [];
      for (let i = 1; i <= n; i++) {
        const c = await DR.renderPdfPage(doc, i, base * ratio);
        c.style.width = base + 'px';
        c.style.height = (base * c.height / c.width) + 'px';
        pages.push(c);
      }
      const note = doc.numPages > n ? `Showing ${n} of ${doc.numPages} pages.${big ? ' Open it in Slop PDF for the rest.' : ''}` : '';
      return { pages, note };
    } finally { doc.destroy(); }
  }
})(window.DR);
