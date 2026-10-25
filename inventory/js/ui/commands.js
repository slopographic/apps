// Slop Inventory commands, registered with SlopCmd (palette, remappable keys). Every main action is here: scan mode,
// receive, sell, adjust, transfer, start and post a count, undo the last scan, products, data. Also wires [data-cmd].
(function (g) {
  'use strict';
  const NS = (g.SlopInv = g.SlopInv || {});

  const COMMANDS = [
    { id: 'view.products', title: 'Go to Products', group: 'Go to', run: () => NS.app.show('products') },
    { id: 'view.scan', title: 'Go to Scan', group: 'Go to', run: () => NS.app.show('scan') },
    { id: 'view.stock', title: 'Go to Stock', group: 'Go to', run: () => NS.app.show('stock') },
    { id: 'view.count', title: 'Go to Count', group: 'Go to', run: () => NS.app.show('count') },
    { id: 'view.reports', title: 'Go to Reports', group: 'Go to', run: () => NS.app.show('reports') },
    { id: 'view.data', title: 'Go to Data', group: 'Go to', run: () => NS.app.show('data') },
    { id: 'scan.mode.keyboard', title: 'Scan: keyboard or scanner mode', group: 'Scan', keywords: ['wedge', 'usb', 'barcode'],
      run: () => { NS.app.show('scan'); NS.scanView.setMode('keyboard'); } },
    { id: 'scan.mode.camera', title: 'Scan: camera mode', group: 'Scan', keywords: ['webcam', 'barcode detector'],
      run: () => { NS.app.show('scan'); NS.scanView.setMode('camera'); } },
    { id: 'scan.mode.toggle', title: 'Scan: switch camera and keyboard mode', group: 'Scan',
      run: () => { NS.app.show('scan'); NS.scanView.setMode(NS.scanView.mode() === 'camera' ? 'keyboard' : 'camera'); } },
    { id: 'scan.undo', title: 'Scan: undo last scan', group: 'Scan', keywords: ['reverse', 'counter'],
      when: () => NS.scanView.log().some((e) => NS.scan.UNDOABLE.includes(e.status)), run: () => NS.scanView.undoLast() },
    { id: 'stock.receive', title: 'Stock: receive…', group: 'Stock', run: () => NS.stockView.open('receive') },
    { id: 'stock.sell', title: 'Stock: sell…', group: 'Stock', run: () => NS.stockView.open('sell') },
    { id: 'stock.adjust', title: 'Stock: adjust…', group: 'Stock', run: () => NS.stockView.open('adjust') },
    { id: 'stock.transfer', title: 'Stock: transfer between locations…', group: 'Stock', run: () => NS.stockView.open('transfer') },
    { id: 'count.start', title: 'Count: start a count', group: 'Count', when: () => !NS.count.isOpen(),
      run: () => { NS.app.show('count'); setTimeout(() => document.getElementById('cLoc').focus(), 40); } },
    { id: 'count.review', title: 'Count: review differences', group: 'Count', when: () => NS.count.isOpen(),
      run: () => { NS.app.show('count'); NS.views.count.review(); } },
    { id: 'count.post', title: 'Count: review, then post the open count', group: 'Count', when: () => NS.count.isOpen(),
      run: () => { NS.app.show('count'); NS.views.count.review(); } },
    { id: 'count.cancel', title: 'Count: cancel the open count', group: 'Count', when: () => NS.count.isOpen(),
      run: () => { NS.app.show('count'); document.getElementById('cCancel').click(); } },
    { id: 'products.new', title: 'Products: add a product', group: 'Products',
      run: () => NS.productForm.open({ onSaved: () => NS.app.refresh() }) },
    { id: 'products.import', title: 'Products: import from CSV', group: 'Products', run: () => NS.dataActions.openImport() },
    { id: 'products.export', title: 'Products: export the list as CSV', group: 'Products', run: () => NS.dataActions.exportCsv() },
    { id: 'products.low', title: 'Reports: show low stock', group: 'Reports', run: () => NS.app.show('reports') },
    { id: 'data.backup', title: 'Data: download a full backup', group: 'Data', run: () => NS.dataActions.backup() },
  ];
  let runner = null;
  /** Registers the commands with SlopCmd and wires [data-cmd] (SlopBiz.commands, shared/biz/biz.js). */
  function init() { runner = g.SlopBiz.commands('inventory', COMMANDS); }
  /** Runs a command by id (through SlopCmd when it is loaded). */
  const run = (id) => (runner ? runner(id) : false);

  NS.commands = { init, run, list: COMMANDS };
})(typeof window !== 'undefined' ? window : globalThis);
