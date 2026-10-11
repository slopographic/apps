/* Slop EML: the actions the buttons, the menus and the commands share: open, print, convert to PDF. Classic script;
 * exposes window.EmlActions. Each one works on the message on screen (EmlApp.current()). */
(function () {
  'use strict';
  const A = (window.EmlActions = {});
  const app = () => window.EmlApp;
  const toast = (msg, ms, action) => window.SlopUI.toast(msg, ms, action);

  /** Opens files chosen with the picker or dropped. Says which ones could not be read. */
  A.openFiles = async function (files) {
    const res = await app().openFiles(files);
    if (res.failed.length) toast('Could not read ' + res.failed.map((f) => f.name).join(', ') + '.', 6000);
    return res;
  };
  A.pick = async function () {
    const files = await window.SlopUI.pickFiles({ accept: '.eml,message/rfc822', multiple: true });
    if (files.length) await A.openFiles(files);
  };

  /** Print: the message's headers and body in a print window, with print styles only (no toolbar, no tabs). The window
   *  holds the same policy as the preview (no scripts, no network), so the mail cannot run or load anything. */
  A.print = function () {
    const doc = app().current();
    if (!doc) return;
    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups for this page to print the message.', 6000); return; }
    const html = window.EmlFrame.printable(doc.msg, doc.summary, doc.view);
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(() => { try { w.focus(); w.print(); } catch (e) { toast('The print window could not start.', 5000); } }, 250);
  };

  /** Convert to PDF: a dialog with the one choice (attachments at the end) and the limits, then the file. */
  A.convertPdf = function () {
    const doc = app().current();
    if (!doc) return;
    const ui = window.SlopUI;
    const check = ui.check('List the attachment names at the end (the files are not embedded)', true);
    const help = document.createElement('p');
    help.className = 'sui-p em-help';
    help.textContent = 'The PDF holds the headers and the plain-text body, or the HTML body reduced to text paragraphs, with line breaks and links kept as text. HTML layout and images are not kept in the PDF; use Print to keep them. A character the standard font cannot draw is replaced with "?", and you are told how many.';
    const body = document.createElement('div');
    body.className = 'em-pdfdlg';
    body.append(help, check.el);
    ui.dialog({
      title: 'Convert to PDF',
      body,
      buttons: [
        { label: 'Cancel' },
        { label: 'Save PDF', primary: true, act: () => A.savePdf(doc, check.input.checked) },
      ],
    });
  };

  /** Makes the PDF and downloads it. Reports replaced characters in the toast. */
  A.savePdf = async function (doc, withAttachments) {
    const pdf = window.EmlPdf;
    try {
      const r = await pdf.build(doc, { attachments: withAttachments });
      window.SlopUI.download(new Blob([r.bytes], { type: 'application/pdf' }), pdf.fileName(doc));
      if (r.replaced) {
        const n = r.replaced;
        toast(n + (n === 1 ? ' character' : ' characters') + ' could not be drawn in the standard font and ' + (n === 1 ? 'was' : 'were') +
          ' replaced with "?": ' + r.samples.join(' ') + '.', 9000);
      } else {
        toast('PDF saved.');
      }
    } catch (e) {
      toast('Could not make the PDF: ' + ((e && e.message) || 'unknown error') + '.', 6000);
    }
  };
})();
