/* Slop Hex: boot. Registers the app with Slop Drive, wires the toolbar, the Go to and Find bars, drag and drop, the
 * right-click menu and the commands. The open files come back as tabs (js/tabs.js); a file launched with ?drive=<id> (the way
 * Paste and Code launch) opens in a tab of its own.
 * Classic script, runs once the page is parsed. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const A = () => window.HexApp;

  function wire() {
    const act = (id, fn) => $(id).addEventListener('click', fn);
    act('hx-open', () => A().pickComputer());
    act('hx-open2', () => A().pickComputer());
    act('hx-drive', () => A().pickDrive());
    act('hx-drive2', () => A().pickDrive());
    act('hx-save', () => A().saveVersion());
    act('hx-saveas', () => A().saveAs());
    act('hx-dl', () => A().download());
    act('hx-sha-btn', () => A().computeSha());
    act('hx-cmd', () => { if (window.SlopCmd && SlopCmd.open) SlopCmd.open(); });
    act('hx-menu', (e) => {
      const r = e.currentTarget.getBoundingClientRect();
      SlopUI.menu(window.HexCommands.menuItems(), r.left, r.bottom + 4);
    });
    act('hx-prev', () => A().find(-1));
    $('hx-goform').addEventListener('submit', (e) => {
      e.preventDefault();
      if (A().gotoOffset($('hx-goto').value)) A().grid().focus();
    });
    $('hx-findform').addEventListener('submit', (e) => { e.preventDefault(); A().find(1); });
    if (window.SlopCtx) SlopCtx.bind($('hx-scroll'), () => window.HexCommands.contextItems());
    /* A file dropped on the tabs, the strip or the bytes opens (SlopDrop, shared/drop; one file at a time, and a file that is
       already open is not opened again). */
    const drop = window.SlopDrop.attach($('hx-drop'), {
      accept: { any: true, allowEmpty: true, noun: 'a file' },
      limit: 1,
      compact: true,
      targets: [$('hx-tabs'), $('hx-drop'), $('hx-main')],
      process: async (file) => {
        if (A().isOpen(file)) throw new Error('is already open');
        await A().openBlob(file, { name: file.name });
        return file.name;
      },
    });
    // The empty page shows a file's bytes and how (SlopDrop's preview); the sample (a small PDF) goes through the strip.
    const empty = $('hx-empty'), row = empty.querySelector('.hx-empty-b'), sample = document.createElement('button');
    empty.insertBefore(window.SlopDrop.panel.preview({
      picture: { src: '../assets/shots/hex.jpg', alt: 'A PDF open in Slop Hex: offsets, hex bytes and the text beside them' },
      steps: ['Drop any file', 'Read, find and change its bytes', 'Download the changed file'],
    }), row);
    sample.type = 'button'; sample.className = 'sd-sample'; sample.id = 'hx-sample'; sample.textContent = 'Try it with a sample PDF';
    sample.addEventListener('click', () => drop.run([window.SlopSamples.docs.pdf()]));
    row.append(sample);
  }

  async function boot() {
    SlopHub.register('hex');
    const grid = HexGrid.create({
      scroll: $('hx-scroll'), spacer: $('hx-spacer'), rows: $('hx-rows'),
      onSelect: () => A().refresh(),
      onChange: () => A().changed(),
      onCopy: () => A().copySel(),
    });
    A().app.grid = grid;
    wire();
    window.HexCommands.register();
    // The launch is read before the tabs come back: showing a tab rewrites the address bar (its ?drive= id).
    let launch = null;
    try { launch = await SlopHub.consumeLaunch(); } catch (e) { launch = null; }
    const session = HexTabs.mount($('hx-tabs'), { activate: A().activate, deactivate: A().deactivate, refresh: A().refresh });
    try { await session.restore(); } catch (e) { console.warn('Slop Hex: restore failed', e); }
    if (!HexTabs.current()) HexTabs.api().newTab();
    A().refresh();
    try {
      if (launch && launch.blob) await A().openBlob(launch.blob, { name: launch.name, driveId: launch.id });
    } catch (e) {
      SlopUI.toast('Could not open that file: ' + e.message);
    }
    document.body.classList.add('ready');
  }

  document.addEventListener('DOMContentLoaded', () => {
    boot().catch((e) => { console.error(e); document.body.classList.add('ready'); if (window.SlopUI) SlopUI.toast('Slop Hex could not start: ' + e.message); });
  });
})();
