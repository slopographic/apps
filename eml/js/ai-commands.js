/* Slop EML for the assistant: SlopCmd commands with arguments (shared/commands/args.js), loaded on demand by
 * SlopCmd.prepare() (commands.js). Through EmlApp and the export module (export.js make): open_file (an .eml or .mbox from
 * Slop Drive), new_message (an .eml written from the fields, opened like any file), select_message, search_messages,
 * close_message and export_messages (PDF, text, HTML, Markdown, CSV list, .eml or attachments, to Slop Drive and/or a
 * download). state() lists the open messages; the checkpoint closes the messages the assistant opened. */
(function () {
  'use strict';
  const C = window.SlopCmd, A = () => window.EmlApp, X = () => window.EmlExport;
  if (!C || C.get('eml.ai.export-messages')) return;
  const list = [], opened = [];
  const add = (tool, title, args, run, extra) => list.push(Object.assign({ id: 'eml.ai.' + tool.replace(/_/g, '-'), tool, title, group: 'AI', hidden: true, destructive: false, args,
    run: (a) => run(a || window.SlopCmdArgs.defaults(args)) }, extra));
  const S = (name, description, extra) => Object.assign({ name, type: 'string', maxLength: 300, description }, extra);
  const MSG = S('message', 'subject, file name or id; the open one when empty');
  const find = (q) => {
    if (!q) { const d = A().current(); if (!d) throw new Error('No message is open'); return d; }
    const s = String(q).toLowerCase(), all = A().docs();
    const d = all.find((x) => String(x.id) === String(q)) || all.find((x) => x.name.toLowerCase() === s) || all.find((x) => String(x.summary.subject || '').toLowerCase().includes(s));
    if (!d) throw new Error(`No open message “${q}”`);
    return d;
  };
  /** A plain RFC 5322 message: headers, then the text (quoted-printable is not needed: UTF-8, 8bit). */
  function emlText(a) {
    const enc = (v) => (/^[\x20-\x7e]*$/.test(v) ? v : '=?UTF-8?B?' + btoa(unescape(encodeURIComponent(v))) + '?=');
    const lines = [`From: ${a.from || 'me@example.com'}`, `To: ${a.to}`];
    if (a.cc) lines.push(`Cc: ${a.cc}`);
    lines.push(`Subject: ${enc(a.subject || '')}`, `Date: ${new Date(a.date || Date.now()).toUTCString().replace('GMT', '+0000')}`, 'MIME-Version: 1.0');
    if (a.html) {
      const b = 'slop-' + Math.random().toString(36).slice(2);
      lines.push(`Content-Type: multipart/alternative; boundary="${b}"`, '', `--${b}`, 'Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', a.text || '',
        `--${b}`, 'Content-Type: text/html; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', a.html, `--${b}--`, '');
    } else lines.push('Content-Type: text/plain; charset=utf-8', 'Content-Transfer-Encoding: 8bit', '', a.text || '', '');
    return lines.join('\r\n');
  }

  add('open_file', 'Open messages from Slop Drive', [S('file', 'Slop Drive name or id (.eml or .mbox)', { required: true })], async (a) => {
    const H = window.SlopHub, s = String(a.file).toLowerCase(), all = await H.list();   // intake-ok: an AI command looks a Drive file up by name or id (a lookup; the person's picker is SlopIntake.fromDrive)
    const hit = all.find((f) => f.id === a.file) || all.find((f) => f.name.toLowerCase() === s) || all.find((f) => f.name.toLowerCase().includes(s));
    if (!hit) throw new Error(`No Slop Drive file “${a.file}”`);
    const rec = await H.get(hit.id), n0 = A().docs().length;
    const d = await A().openFile(new File([rec.blob], rec.name));
    opened.push(...A().docs().slice(n0).map((x) => x.id));
    return `Opened ${rec.name}: ${A().docs().length - n0} message(s); the first is “${d.summary.subject || '(no subject)'}”.`;
  });
  add('new_message', 'Write a new message', [S('to', 'addresses', { required: true }), S('from', 'the sender'), S('cc', 'copies'), S('subject', 'the subject', { default: '' }),
    S('text', 'the plain text body', { maxLength: 200000 }), S('html', 'an HTML body too', { maxLength: 200000 }), S('name', 'file name', { default: 'message.eml' })], async (a) => {
    const name = /\.eml$/i.test(a.name) ? a.name : a.name + '.eml';
    const d = await A().openFile(new File([emlText(a)], name, { type: 'message/rfc822' }));
    opened.push(d.id);
    return `Wrote “${d.summary.subject || '(no subject)'}” to ${d.summary.to || a.to} as ${name} (open now; export_messages saves it).`;
  }, { description: 'Write an e-mail as an .eml file (headers and a text or HTML body) and open it.' });
  add('select_message', 'Show a message', [Object.assign({}, MSG, { required: true })], (a) => { const d = find(a.message); A().select(d.id); return `Showing “${d.summary.subject || d.name}”.`; });
  add('search_messages', 'Search the messages', [S('query', 'words in the subject, sender, text…', { default: '' })], (a) => {
    A().setList({ query: a.query }); return `${A().visible().length} message(s) match.`;
  });
  add('close_message', 'Close a message', [MSG], (a) => { const d = find(a.message); A().close(d.id); return `Closed “${d.summary.subject || d.name}”.`; });
  add('export_messages', 'Export messages', [{ name: 'format', type: 'enum', values: ['pdf', 'pdfzip', 'txt', 'html', 'md', 'csv', 'eml', 'atts'], default: 'pdf' },
    { name: 'scope', type: 'enum', values: ['current', 'checked', 'all'], default: 'current' }, { name: 'to', type: 'enum', values: ['drive', 'download', 'both'], default: 'drive' },
    { name: 'attachments', type: 'boolean', default: false, description: 'PDF: add the attachments after the message' }], async (a) => {
    const docs = X().scope(a.scope);
    if (!docs.length) throw new Error('No messages to export');
    const f = await X().make(a.format, docs, { attachments: a.attachments });
    if (!f) throw new Error('The export failed');
    const out = [];
    if (a.to !== 'download') out.push(`Saved ${f.name} to Slop Drive (id ${await window.SlopHub.put(f.blob, { name: f.name, from: 'eml' })})`);
    if (a.to !== 'drive') { window.SlopUI.download(f.blob, f.name); out.push(`downloaded ${f.name}`); }
    return out.join(' and ') + '.' + (f.info ? ' ' + f.info : '');
  }, { description: 'Save one, the ticked or all messages as PDF (one file or one each), text, HTML, Markdown, a CSV list, the .eml files or their attachments.' });

  C.register(list);
  C.provide({
    state: () => ({ app: 'Slop EML', messages: A().visible().slice(0, 50).map((d) => ({ id: d.id, name: d.name, subject: d.summary.subject, from: d.summary.from, date: d.summary.date, attachments: d.attachments.length })),
      current: A().current() ? { subject: A().current().summary.subject, text: String(A().current().msg.text || '').slice(0, 2000) } : null }),
    checkpoint: () => { const mark = opened.length; return () => { for (const id of opened.splice(mark)) if (A().find ? A().find(id) : true) A().close(id); return true; }; },
  });
})();
