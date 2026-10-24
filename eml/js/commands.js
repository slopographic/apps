/* Slop EML: SlopCmd commands (the palette, the shortcuts and the menu bar's File, Edit and View menus, which list them
 * by id). Classic script; exposes window.EmlCommands. Shortcuts go through SlopCmd only. Mod+P is left to the palette and
 * the browser. The side panel's show/hide command ('eml.panel', Ctrl+Alt+B) is SlopFrame's own. */
(function () {
  'use strict';
  if (window.EmlCommands) return;
  const A = () => window.EmlApp;
  const X = () => window.EmlActions;
  const E = () => window.EmlExport;
  const has = () => !!A().current();
  const any = () => A().docs().length > 0;
  const hasHtml = () => has() && A().current().msg.html != null;
  const hasText = () => has() && A().current().msg.text != null;
  const hasCids = () => has() && window.EmlMime.cidRefs(A().current().msg.html) > 0;
  const many = () => A().docs().length > 1;
  const scope = () => E().scope('checked');
  const anyAtts = () => scope().some((d) => d.msg.attachments.length);

  function list() {
    const C = (id, title, group, keys, extra = {}) => Object.assign({ id: 'eml.' + id, title, group, keys, run: () => {} }, extra);
    return [
      C('open', 'Open messages…', 'File', ['Mod+O'], { keywords: ['load', 'file', 'eml', 'mbox', 'mailbox', 'picker', 'computer'], run: () => X().pick() }),
      C('export', 'Export…', 'File', [], { keywords: ['save', 'download', 'pdf', 'text', 'html', 'markdown', 'csv', 'zip'], when: any, run: () => E().dialog() }),
      C('pdf', 'Convert to PDF…', 'File', [], { keywords: ['pdf', 'save', 'export', 'document'], when: any, run: () => X().convertPdf() }),
      C('combine', 'Combine messages into one PDF', 'File', [], { keywords: ['merge', 'join', 'pdf', 'many', 'all', 'contents'], when: many, run: () => X().combine() }),
      C('pdfzip', 'Save each message as PDF (ZIP)', 'File', [], { keywords: ['pdf', 'zip', 'each', 'separate'], when: any, run: () => E().run('pdfzip', scope()) }),
      C('attzip', 'Save all attachments (ZIP)', 'File', [], { keywords: ['attachments', 'files', 'zip', 'download'], when: anyAtts, run: () => E().run('atts', scope()) }),
      C('csv', 'Export message list as CSV', 'File', [], { keywords: ['csv', 'list', 'spreadsheet', 'table', 'index'], when: any, run: () => E().run('csv', scope()) }),
      C('topdf', 'Open in Slop PDF', 'File', [], { keywords: ['sign', 'annotate', 'merge', 'pdf', 'send'], when: any, run: () => X().openInPdf() }),
      C('print', 'Print message', 'File', [], { keywords: ['printer', 'paper', 'pdf'], when: has, run: () => X().print() }),
      C('close', 'Close message', 'File', [], { keywords: ['tab', 'remove'], when: has, run: () => A().close(A().current().id) }),
      C('selectall', 'Select all messages', 'View', [], { keywords: ['tick', 'check', 'every'], when: many, run: () => A().checkAll(true) }),
      C('selectnone', 'Clear the selection', 'View', [], { keywords: ['untick', 'none', 'deselect'], when: () => A().checkedDocs().length > 0, run: () => A().checkAll(false) }),
      C('next', 'Next message', 'View', ['Alt+ArrowDown'], { keywords: ['tab', 'forward', 'down'], when: many, run: () => A().step(1) }),
      C('prev', 'Previous message', 'View', ['Alt+ArrowUp'], { keywords: ['tab', 'back', 'up'], when: many, run: () => A().step(-1) }),
      C('pin', 'Pin or unpin the message as a tab', 'View', [], { keywords: ['tab', 'keep'], when: has, run: () => A().togglePin() }),
      C('html', 'Show HTML body', 'View', [], { keywords: ['layout', 'rich'], when: () => hasHtml() && hasText(), run: () => A().setView('html') }),
      C('plain', 'Show plain text body', 'View', [], { keywords: ['text', 'plain'], when: () => hasHtml() && hasText(), run: () => A().setView('text') }),
      C('images', 'Show embedded images', 'View', [], { keywords: ['cid', 'inline', 'pictures', 'logo'], when: hasCids, run: () => A().toggleCids() }),
    ];
  }

  const HERE = (document.currentScript && document.currentScript.src) || location.href;
  function register() {
    if (!window.SlopCmd) return;
    SlopCmd.init({ app: 'eml' });
    SlopCmd.register(list());
    // the assistant's commands with arguments (ai-commands.js), loaded when the AI panel first asks
    if (SlopCmd.provide) SlopCmd.provide({ prepare: () => new Promise((res, rej) => {
      const s = Object.assign(document.createElement('script'), { src: new URL('ai-commands.js', HERE).href });
      s.onload = res; s.onerror = () => rej(new Error('Could not load ai-commands.js')); document.head.append(s);
    }) });
  }

  window.EmlCommands = { list, register };
})();
