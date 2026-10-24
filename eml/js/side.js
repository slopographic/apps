/* Slop EML: the side panel (SlopFrame's panel, shared/frame/panel.js). It follows what is chosen:
 *   one message: its details (from, to, date, size, file), its attachments (each opens a preview, with Save and Open in ▾),
 *                and its actions (Export ▾, Open in Slop PDF, Print, Convert to PDF…, Pin as a tab, Close);
 *   two or more ticked: "N selected" with Combine into one PDF, Export ▾, Save attachments (ZIP), Export list (CSV),
 *                Open in Slop PDF and Clear selection.
 * Every action is the same one the File menu and the commands run (EmlActions, EmlExport). Classic script; window.EmlSide. */
(function () {
  'use strict';
  const S = (window.EmlSide = {});
  const A = () => window.EmlApp, X = () => window.EmlExport, ACT = () => window.EmlActions;
  let panel = null;
  const size = (n) => (window.SlopHub ? window.SlopHub.fmtSize(n) : n + ' B');
  const when = (t, raw) => (t == null ? raw || '' : new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }));

  S.init = function (el) { panel = window.SlopFrame.panel(el, { title: 'Message' }); };

  function attachments(doc) {
    const atts = doc.msg.attachments;
    return {
      title: 'Attachments (' + atts.length + ')', key: 'atts', empty: 'No attachments.',
      list: atts.map((a, i) => ({
        name: a.name, meta: [window.EmlBatch.typeOf(a.name, a.type), size(a.size), a.inline ? 'inline' : '', a.malformed ? 'could not be read in full' : ''].filter(Boolean).join(' · '),
        title: 'Preview ' + a.name, open: () => window.EmlPreview.open(doc, i),
        actions: [
          { label: 'Save', aria: 'Save ' + a.name, run: () => window.EmlView.saveAttachment(doc, i) },
          { label: 'Open in', aria: 'Open ' + a.name + ' in another app', menu: () => X().attachmentItems(doc, i).slice(1), empty: 'No app opens this type' },
        ],
      })),
      actions: atts.length > 1 ? [{ label: 'Save all (ZIP)', id: 'em-atts-zip', run: () => window.EmlView.downloadAll() }] : null,
    };
  }

  function one(doc) {
    const s = doc.summary;
    panel.setTitle('Message');
    return [
      { title: 'Actions', key: 'acts', actions: [
        { label: 'Export', id: 'em-p-export', primary: true, menu: X().menu(() => [A().current()].filter(Boolean)) },
        { label: 'Open in Slop PDF', id: 'em-p-topdf', run: () => ACT().openInPdf() },
        { label: 'Print', id: 'em-p-print', run: () => ACT().print() },
        { label: 'Convert to PDF…', id: 'em-p-convert', run: () => ACT().convertPdf() },
        { label: doc.pinned ? 'Unpin tab' : 'Pin as a tab', id: 'em-p-pin', run: () => A().togglePin() },
        { label: 'Close', id: 'em-p-close', run: () => A().close(doc.id) },
      ] },
      { title: 'Details', key: 'details', rows: [['From', s.from], ['To', s.to], ['Cc', s.cc], ['Bcc', s.bcc], ['Date', when(doc.time, s.date), s.date],
        ['Size', size(doc.size)], ['File', doc.fromMbox ? doc.fromMbox : doc.name]] },
      attachments(doc),
    ];
  }

  function many(docs) {
    const t = docs.map((d) => d.time).filter((x) => x != null);
    const n = docs.reduce((k, d) => k + d.msg.attachments.length, 0);
    panel.setTitle(docs.length + ' selected');
    const day = (x) => new Date(x).toLocaleDateString(undefined, { dateStyle: 'medium' });
    const span = t.length ? day(Math.min(...t)) + (day(Math.min(...t)) !== day(Math.max(...t)) ? ' – ' + day(Math.max(...t)) : '') : '';
    return [
      { title: 'Actions', key: 'acts-many', actions: [
        { label: 'Combine into one PDF', id: 'em-p-combine', primary: true, run: () => ACT().combine() },
        { label: 'Export', id: 'em-p-export-many', menu: X().menu(() => A().checkedDocs()) },
        { label: 'Save attachments (ZIP)', id: 'em-p-atts', disabled: !n, run: () => X().run('atts', A().checkedDocs()) },
        { label: 'Export list (CSV)', id: 'em-p-csv', run: () => X().run('csv', A().checkedDocs()) },
        { label: 'Open in Slop PDF', id: 'em-p-topdf-many', run: () => X().toApp('pdf', 'pdf', A().checkedDocs()) },
        { label: 'Clear selection', id: 'em-p-clear', run: () => A().checkAll(false) },
      ] },
      { title: 'Selection', key: 'sel', rows: [['Messages', String(docs.length)], ['Dates', span], ['Attachments', String(n)]] },
      { title: 'Combined PDF', key: 'note', note: 'One PDF in date order: a contents page, then each message from a new page, with its attachment names. Choose Export ▸ More options… to add PDF and image attachments as pages.' },
    ];
  }

  S.render = function () {
    if (!panel) return;
    const app = A(), picked = app.checkedDocs(), cur = app.current();
    if (picked.length > 1) panel.render(many(picked));
    else if (cur) panel.render(one(cur));
    else { panel.setTitle('Actions'); panel.render([{ title: 'Start', note: 'Open .eml files or a mailbox (.mbox) to read them. Nothing is uploaded.', actions: [{ label: 'Open…', primary: true, run: () => ACT().pick() }] }]); }
  };
})();
