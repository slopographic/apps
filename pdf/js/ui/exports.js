/* Slop PDF — progress indicator and every output: download, extract, split (zip), compress,
   pages to images, images to PDF, text extraction and the offline app download. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, O = SP.organizer, Ed = SP.editor, PN = SP.panels, A = SP.app, S = A._;
  var $ = U.$, h = U.h;
  /* ------------------------------------------------------------ S.busy */
  S.busy = function (msg, frac) {
    if (msg == null) { S.els.busy.hidden = true; S.els.app.removeAttribute('aria-busy'); return; }
    S.els.busy.hidden = false; S.els.app.setAttribute('aria-busy', 'true');
    S.els.busy.querySelector('.busy-msg').textContent = msg;
    var bar = S.els.busy.querySelector('.busy-bar i');
    if (frac == null) bar.parentNode.classList.add('indet'); else { bar.parentNode.classList.remove('indet'); bar.style.width = Math.round(U.clamp(frac, 0, 1) * 100) + '%'; }
  }
  A.busy = S.busy;
  S.guarded = async function (label, fn) {
    if (Ed.isEditingText()) Ed.commitText();
    S.busy(label, 0);
    try { return await fn(function (f, m) { S.busy(m || label, f); }); }
    catch (e) { console.error(e); SlopUI.alert('Something went wrong', String((e && e.message) || e)); return null; }
    finally { S.busy(null); }
  }
  S.outName = function (suffix, ext) {
    var b = U.baseName(S.els.fileName.value || 'document');
    return U.safeName(b + (suffix ? '-' + suffix : ''), ext || 'pdf');
  }

  /* --------------------------------------------------------- downloads */
  A.download = function () {
    if (!E.state.pages.length) return;
    return S.guarded('Building your PDF…', async function (prog) {
      var n = E.state.pages.length;
      var bytes = await E.build({ onProgress: function (f) { prog(f * 0.85); } });
      prog(0.92, 'Checking the result…');
      await E.validate(bytes, n);
      var name = U.safeName(S.els.fileName.value || 'document.pdf', 'pdf');
      S.els.fileName.value = name;
      U.download(bytes, name, 'application/pdf');
      A.lastOutput = bytes;
      A.status('Saved ' + name + ' · ' + n + ' pages · ' + U.fmtBytes(bytes.length) + ' · validated ✓', 'ok');
      SlopUI.toast('Downloaded ' + name + ' (' + U.fmtBytes(bytes.length) + ')');
      return bytes;
    });
  };
  A.extract = function () {
    var ids = O.selected();
    if (!ids.length) { SlopUI.toast('Select the pages to extract first.'); return; }
    return S.guarded('Extracting pages…', async function (prog) {
      var set = new Set(ids), pages = E.state.pages.filter(function (p) { return set.has(p.id); });
      var bytes = await E.build({ pages: pages, onProgress: prog });
      await E.validate(bytes, pages.length);
      var name = S.outName('pages-' + U.describeIdx(O.selectedIndices()).replace(/[–, ]+/g, function (m) { return m.indexOf(',') >= 0 ? '_' : '-'; }));
      U.download(bytes, name, 'application/pdf');
      A.status('Extracted ' + pages.length + ' pages to ' + name, 'ok');
      return bytes;
    });
  };
  A.split = function () {
    var groups;
    try { groups = PN.splitGroups(); } catch (e) { SlopUI.alert('Check the ranges', e.message); return; }
    if (!groups.length) return;
    return S.guarded('Splitting…', async function (prog) {
      var files = [], width = String(groups.length).length;
      for (var i = 0; i < groups.length; i++) {
        var pages = groups[i].map(function (k) { return E.state.pages[k]; });
        var bytes = await E.build({ pages: pages });
        await E.validate(bytes, pages.length);
        files.push({ name: S.outName('part' + String(i + 1).padStart(width, '0') + '-p' + U.describeIdx(groups[i]).replace(/[–]/g, '-').replace(/[, ]+/g, '_')), data: bytes });
        prog((i + 1) / groups.length, 'Splitting… ' + (i + 1) + ' / ' + groups.length);
      }
      if (PN.split.output === 'zip' && files.length > 1) {
        U.download(U.makeZip(files), S.outName('split', 'zip'));
        A.status('Split into ' + files.length + ' PDFs (zip)', 'ok');
      } else {
        for (var j = 0; j < files.length; j++) { U.download(files[j].data, files[j].name, 'application/pdf'); await U.sleep(350); }
        A.status('Split into ' + files.length + ' PDFs', 'ok');
        if (files.length > 3) SlopUI.toast('If only some files arrived, allow multiple downloads or choose “One .zip”.');
      }
      return files;
    });
  };
  A.compress = function (o, resultEl) {
    return S.guarded('Compressing…', async function (prog) {
      var n = E.state.pages.length, before = 0;
      new Set(E.state.pages.filter(function (p) { return p.f; }).map(function (p) { return p.f; })).forEach(function (fid) { before += E.files.get(fid).bytes.length; });
      var bytes = await E.build({ onProgress: function (f) { prog(f * (o.mode === 'lossy' ? 0.3 : 0.9)); } });
      if (o.mode === 'lossy') bytes = await E.rasterize(bytes, { dpi: o.dpi, quality: o.quality, onProgress: function (f) { prog(0.3 + f * 0.65, 'Rasterising page ' + Math.ceil(f * n) + ' / ' + n + '…'); } });
      else bytes = await E.resave(bytes);
      await E.validate(bytes, n);
      var name = S.outName('compressed');
      U.download(bytes, name, 'application/pdf');
      var pct = before ? Math.round((1 - bytes.length / before) * 100) : 0;
      if (resultEl) {
        resultEl.innerHTML = '';
        resultEl.append(h('div', { class: 'res-sizes' }, h('span', null, U.fmtBytes(before)), h('i', { html: U.icon('next') }), h('b', null, U.fmtBytes(bytes.length))),
          h('p', { class: 'pp-note' }, pct > 0 ? pct + '% smaller · downloaded as ' + name : 'No size saving (the original was already compact) · downloaded as ' + name));
      }
      A.status('Compressed: ' + U.fmtBytes(before) + ' → ' + U.fmtBytes(bytes.length), 'ok');
      return bytes;
    });
  };
  A.toImages = function (o) {
    return S.guarded('Rendering images…', async function (prog) {
      var pages = E.state.pages, idx = null;
      if (o.which === 'sel') { var s = O.selectedIndices(); if (!s.length) { SlopUI.toast('Select some pages first.'); return null; } idx = s; }
      var bytes = await E.build({ onProgress: function (f) { prog(f * 0.3); } });
      var files = await E.toImages(bytes, { format: o.format, dpi: o.dpi, quality: o.quality, indices: idx, base: U.baseName(S.els.fileName.value || 'page'), onProgress: function (f) { prog(0.3 + f * 0.7, 'Rendering images… ' + Math.round(f * 100) + '%'); } });
      if (files.length === 1) U.download(files[0].data, files[0].name, files[0].mime);
      else U.download(U.makeZip(files), S.outName('images', 'zip'));
      A.status('Exported ' + files.length + ' image' + (files.length === 1 ? '' : 's') + ' at ' + o.dpi + ' dpi', 'ok');
      void pages;
      return files;
    });
  };
  A.imagesToPdf = function (io) {
    SlopUI.pickFiles({ accept: 'image/png,image/jpeg,image/webp,image/gif', multiple: true }).then(function (files) {
      if (!files.length) return;
      S.guarded('Converting images…', async function (prog) {
        var items = [];
        for (var i = 0; i < files.length; i++) { var b = await U.readFile(files[i]), k = U.sniff(b); if (/png|jpeg|webp|gif|bmp/.test(k)) items.push({ bytes: b, kind: k, name: files[i].name }); }
        if (!items.length) { SlopUI.alert('No images', 'None of those files is a PNG, JPEG, WebP or GIF image.'); return; }
        var pdf = await E.imagesToPdf(items, io);
        prog(0.8);
        if (io.add && E.state.pages.length) {
          var f = await E.registerPdf(pdf, (items.length === 1 ? U.baseName(items[0].name) : 'Images (' + items.length + ')') + '.pdf', null);
          var pages = E.pagesForFile(f);
          E.commit('Add images', function (st) { E.ops.insert(st, st.pages.length, pages); });
          A.announce('Added ' + pages.length + ' image page' + (pages.length === 1 ? '' : 's'));
        } else {
          U.download(pdf, items.length === 1 ? U.safeName(U.baseName(items[0].name), 'pdf') : 'images.pdf', 'application/pdf');
          A.status('Converted ' + items.length + ' image' + (items.length === 1 ? '' : 's') + ' to PDF', 'ok');
        }
      });
    });
  };
  A.extractText = function () {
    return S.guarded('Extracting text…', async function () {
      var bytes = await E.build({ stamps: true });
      var txt = await E.extractText(bytes);
      var ta = h('textarea', { class: 'sui-input sp-textout', readonly: true, rows: 16, spellcheck: 'false', 'aria-label': 'Extracted text' });
      ta.value = txt;
      var words = (txt.match(/\S+/g) || []).length;
      SlopUI.dialog({ title: 'Extracted text', cls: 'sui-wide', body: h('div', null, h('p', { class: 'sui-p' }, words + ' words from ' + E.state.pages.length + ' pages.'), ta), buttons: [
        { label: 'Copy', act: function () { ta.select(); var ok = false; try { if (navigator.clipboard) { navigator.clipboard.writeText(txt); ok = true; } } catch (e) { /* ignore */ } if (!ok) try { document.execCommand('copy'); } catch (e) { /* ignore */ } SlopUI.toast('Copied to clipboard'); return false; } },
        { label: 'Download .txt', primary: true, act: function () { U.download(new Blob([txt], { type: 'text/plain;charset=utf-8' }), S.outName('', 'txt')); } }] });
      return txt;
    });
  };
  A.downloadApp = function () {
    return S.guarded('Packing the offline app…', async function () {
      var html = await SP.build.make();
      U.download(new Blob([html], { type: 'text/html;charset=utf-8' }), 'slop-pdf.html');
      A.status('Offline app saved: slop-pdf.html (' + U.fmtBytes(html.length) + '). Open it from your disk; it works without a connection.', 'ok');
      return html;
    });
  };
})();
