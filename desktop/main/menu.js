/* The desktop app's native menu. template(ctx) is plain data (tests/node checks it); build(Menu, ctx) makes the menu.
 *   ctx: { name, mac (true on macOS), website ('' hides Help ▸ website), openFile(), goHome(), goDrive(),
 *          checkUpdates() (absent in a store build: the store updates the app), about(), openExternal(url) }
 * File: Open… (the system's file dialog; each file opens in the app the site uses for its type, main/open.js), Home,
 * Slop Drive, Close Window (Quit on Windows and Linux). Edit: the standard roles, so copy and paste work in the pages.
 * View: reload, zoom, full screen, the developer tools. Window: minimise, zoom/close (macOS: bring all to front). Help:
 * About, the website, Check for updates. */
'use strict';

function template(ctx) {
  const mac = !!ctx.mac;
  const help = [{ label: `About ${ctx.name}`, click: () => ctx.about() }];
  if (ctx.website) help.push({ label: `${ctx.name} website`, click: () => ctx.openExternal(ctx.website) });
  if (ctx.checkUpdates) help.push({ type: 'separator' }, { label: 'Check for Updates…', click: () => ctx.checkUpdates() });
  const appMenu = mac ? [{
    label: ctx.name,
    submenu: [
      { label: `About ${ctx.name}`, click: () => ctx.about() },
      { type: 'separator' }, { role: 'services' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' },
    ],
  }] : [];
  return [
    ...appMenu,
    {
      label: 'File',
      submenu: [
        { label: 'Open…', accelerator: 'CmdOrCtrl+O', click: () => ctx.openFile() },
        { type: 'separator' },
        { label: 'Home', accelerator: 'CmdOrCtrl+Shift+H', click: () => ctx.goHome() },
        { label: 'Slop Drive', accelerator: 'CmdOrCtrl+Shift+D', click: () => ctx.goDrive() },
        { type: 'separator' },
        mac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'pasteAndMatchStyle' }, { role: 'delete' },
        { type: 'separator' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' }, { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: mac
        ? [{ role: 'minimize' }, { role: 'zoom' }, { type: 'separator' }, { role: 'front' }]
        : [{ role: 'minimize' }, { role: 'close' }],
    },
    { role: 'help', label: 'Help', submenu: help },
  ];
}

function build(Menu, ctx) {
  const menu = Menu.buildFromTemplate(template(ctx));
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = { template, build };
