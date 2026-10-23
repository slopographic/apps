// Slop Quotes commands, registered with SlopCmd (palette, remappable keys). Also wires [data-cmd] elements. Commands that
// act on the open quote are only offered while the editor shows one (their `when`).
(function (g) {
  'use strict';
  const NS = (g.SlopQuotes = g.SlopQuotes || {});
  const E = () => NS.editor.state();
  const editing = () => E().open && !E().isNew;
  const open = () => editing() && (E().status === 'draft' || E().status === 'sent');

  const COMMANDS = [
    { id: 'view.list', title: 'Go to Quotes', group: 'Go to', run: () => NS.app.go('list') },
    { id: 'view.data', title: 'Go to Data (backup and restore)', group: 'Go to', run: () => NS.app.go('data') },
    { id: 'quotes.new', title: 'Quotes: new quote', group: 'Quotes', keywords: ['add', 'create', 'estimate'], run: () => NS.app.go('new') },
    { id: 'quotes.save', title: 'Quote: save', group: 'Quote', when: () => E().open && (E().status === 'draft' || E().status === 'sent'), run: () => NS.editor.save() },
    { id: 'quotes.send', title: 'Quote: mark as sent', group: 'Quote', when: () => editing() && E().status === 'draft', run: () => NS.editor.send() },
    { id: 'quotes.order', title: 'Quote: make an order', group: 'Quote', keywords: ['accept', 'convert'],
      when: () => editing() && E().status !== 'declined' && !E().converted, run: () => NS.editor.toOrder() },
    { id: 'quotes.invoice', title: 'Quote: make an invoice', group: 'Quote', keywords: ['accept', 'convert', 'bill'],
      when: () => editing() && E().status !== 'declined' && !E().converted, run: () => NS.editor.toInvoice() },
    { id: 'quotes.decline', title: 'Quote: decline…', group: 'Quote', when: open, run: () => NS.editor.decline() },
    { id: 'quotes.pdf', title: 'Quote: export PDF', group: 'Quote', when: editing, run: () => NS.editor.exportPdf() },
    { id: 'data.backup', title: 'Data: download a full backup', group: 'Data', run: () => NS.dataActions.backup() },
  ];
  let runner = null;
  /** Registers the commands with SlopCmd and wires [data-cmd] (SlopBiz.commands, shared/biz/biz.js). */
  function init() { runner = g.SlopBiz.commands('quotes', COMMANDS); }
  /** Runs a command by id (through SlopCmd when it is loaded). */
  const run = (id) => (runner ? runner(id) : false);

  NS.commands = { init, run, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
