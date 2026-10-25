/* Slop EML: exporting from the page. Classic script; exposes window.EmlExport. The files are made by eml/js/export.js
 * (loaded on first use); here they are downloaded (SlopUI.download), or sent to another app through Slop Drive
 * (SlopHub.sendTo: the file goes into the Drive and the app opens with ?drive=<id>), as every app does.
 *   EmlExport.scope(which)            'current' | 'checked' | 'all' → docs ('checked' falls back to all when none is ticked)
 *   EmlExport.run(format, docs, o)    makes the file and downloads it (o: { attachments, append })
 *   EmlExport.toApp(appId, format, docs, o)   makes it and opens it in that app (PDF → 'pdf': Slop PDF)
 *   EmlExport.menu(docs)              the Export ▾ items: every format, then Open in Slop PDF and Save to Slop Drive
 *   EmlExport.dialog({ format, scope })   the dialog: which messages, which format, the PDF options
 *   EmlExport.attachmentItems(doc, i)  Save, Send to <every app that opens its type>, Save to Slop Drive */
(function () {
  'use strict';
  const X = (window.EmlExport = {});
  const app = () => window.EmlApp, ui = () => window.SlopUI;
  const toast = (m, ms) => ui().toast(m, ms);
  const mod = () => import('./export.js');

  X.scope = function (which) {
    const A = app();
    if (which === 'current') return A.current() ? [A.current()] : [];
    if (which === 'checked') { const c = A.checkedDocs(); return c.length ? c : A.visible(); }
    return A.visible();
  };
  X.formats = async () => (await mod()).FORMATS;

  /** Makes one export, with a toast while it runs and what it says after. Resolves the file or null on failure. */
  X.make = async function (format, docs, o = {}) {
    if (!docs.length) { toast('Open a message first.'); return null; }
    const busy = format.startsWith('pdf') && docs.length > 1 ? 'Making the PDF of ' + docs.length + ' messages…' : format.startsWith('pdf') ? 'Making the PDF…' : '';
    if (busy) toast(busy, 60000);
    try {
      const f = await (await mod()).make(format, docs, o);
      return f;
    } catch (e) {
      toast('Could not export: ' + ((e && e.message) || 'unknown error'), 6000);
      return null;
    }
  };
  X.run = async function (format, docs, o) {
    const f = await X.make(format, docs, o);
    if (!f) return null;
    ui().download(f.blob, f.name);
    toast(f.info || ('Saved ' + f.name + '.'), f.info ? 9000 : 3000);
    return f;
  };
  X.toApp = async function (appId, format, docs, o) {
    const H = window.SlopHub, f = await X.make(format, docs, o);
    if (!f || !H) return null;
    try {
      // the one way out (shared/intake/outtake.js): the file goes through Slop Drive and the app takes it with its intake
      const id = await window.SlopOuttake.send(appId, { from: 'eml', get: () => f.blob, name: f.name, type: f.blob.type });
      const a = H.appById(appId);
      toast((f.info ? f.info + ' ' : '') + 'Opened ' + f.name + ' in ' + (a ? a.name : appId) + '.', f.info ? 9000 : 4000);
      return { id, file: f };
    } catch (e) { toast('Could not open it: ' + e.message, 6000); return null; }
  };
  X.toDrive = async function (format, docs, o) {
    const H = window.SlopHub, f = await X.make(format, docs, o);
    if (f && H) await H.saveToDrive(f.blob, f.name);
  };

  const LABELS = [['pdf', 'PDF'], ['pdfzip', 'PDF, one per message (ZIP)'], ['txt', 'Plain text'], ['html', 'HTML'], ['md', 'Markdown'],
    ['csv', 'List of messages (CSV)'], ['eml', 'Original .eml'], ['atts', 'Attachments (ZIP)']];
  /** The Export ▾ menu for these messages (a function, so it reads the state when it opens). */
  X.menu = function (get) {
    return () => {
      const docs = get(), many = docs.length > 1, none = !docs.length, noAtts = !docs.some((d) => d.msg.attachments.length);
      return [{ heading: 'Download' }]
        .concat(LABELS.filter(([id]) => many || id !== 'pdfzip').map(([id, label]) => ({
          label: id === 'pdf' && many ? 'PDF, one file (combined)' : label, disabled: none || (id === 'atts' && noAtts),
          keywords: [id, 'save', 'download'], act: () => X.run(id, get(), { attachments: true }),
        })))
        .concat([{ heading: 'Open in' }, { label: 'Open in Slop PDF', disabled: none, keywords: ['sign', 'annotate', 'merge'], act: () => X.toApp('pdf', 'pdf', get()) },
          { label: 'Save PDF to Slop Drive…', disabled: none, keywords: ['drive', 'store'], act: () => X.toDrive('pdf', get()) },
          { label: 'More options…', disabled: none, act: () => X.dialog({ docs: get() }) }]);
    };
  };

  /** The dialog: which messages, the format, and for PDF whether to list or add the attachments. */
  X.dialog = function (o = {}) {
    const A = app(), U = ui(), body = document.createElement('div');
    body.className = 'em-exdlg';
    const total = A.docs().length, k = A.checkedDocs().length;
    const scopes = [['current', 'This message'], ['checked', 'Selected (' + k + ')'], ['all', 'All (' + A.visible().length + ')']]
      .filter(([id]) => (id === 'current' ? !!A.current() : id === 'checked' ? k > 0 : total > 1));
    const want = o.scope || (k > 1 ? 'checked' : A.current() ? 'current' : 'all');
    const scope = U.select(scopes, scopes.some((s) => s[0] === want) ? want : scopes[0] && scopes[0][0]);
    scope.id = 'em-ex-scope';
    const format = U.select(LABELS, o.format || 'pdf');
    format.id = 'em-ex-format';
    const list = U.check('List the attachment names under each message', true);
    const append = U.check('Add PDF and image attachments as pages', !!o.append);
    append.input.id = 'em-ex-append';
    const help = document.createElement('p');
    help.className = 'sui-p em-help';
    const paint = () => {
      const pdf = format.value.startsWith('pdf');
      list.el.hidden = append.el.hidden = !pdf;
      help.textContent = pdf ? 'Several messages go in date order, each from a new page, after a contents page. Text in every language is kept; the HTML layout and pictures of the body are not (Print keeps them).'
        : format.value === 'atts' ? 'One folder per message, with each file under its own name.' : '';
    };
    format.addEventListener('change', paint);
    paint();
    if (scopes.length > 1) body.append(U.field('Messages', scope));
    body.append(U.field('Format', format), list.el, append.el, help);
    const docs = () => (o.docs && !scopes.length ? o.docs : X.scope(scopes.length ? scope.value : 'current'));
    const opts = () => ({ attachments: list.input.checked, append: append.input.checked });
    U.dialog({
      title: 'Export', body, cls: 'em-exdlg-box',
      buttons: [
        { label: 'Cancel' },
        { label: 'Open in Slop PDF', act: async () => { if (!format.value.startsWith('pdf')) format.value = 'pdf'; await X.toApp('pdf', 'pdf', docs(), opts()); } },
        { label: 'Download', primary: true, act: () => X.run(format.value, docs(), opts()) },
      ],
    });
  };

  /** One attachment's menu: Save, then the one builder's items (SlopOuttake): Send to each app that opens its type, and
   *  Save to Slop Drive…. */
  X.attachmentItems = function (doc, i) {
    const a = doc.msg.attachments[i], H = window.SlopHub;
    if (!a) return [];
    const type = window.EmlBatch.typeOf(a.name, a.type), blob = () => new Blob([a.bytes], { type });
    const items = [{ label: 'Save', act: () => ui().download(blob(), window.EmlBatch.safeName(a.name, 'attachment')) }];
    if (H && window.SlopOuttake) for (const it of window.SlopOuttake.items({ get: blob, name: a.name, type, from: 'eml', verb: 'Send to' })) items.push({ label: it.label, act: it.act });
    return items;
  };
})();
