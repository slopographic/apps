/* Updates from the GitHub Releases of the repository the app was built from (electron-builder writes the feed into the
 * app: app-update.yml; desktop/lib/brand.js publish). On start the app checks quietly, downloads a newer version in the
 * background and then offers "Restart to update" (installed on quit otherwise). Help ▸ Check for Updates… does the same
 * and says when the app is up to date. Nothing runs in a store build (the store updates the app: process.mas,
 * process.windowsStore), in a development run (npm start), in the portable .exe, or in a Linux .deb (only the AppImage
 * can replace itself).
 *   enabled(app, env)                → false where updates cannot or must not run
 *   start({ app, dialog, getWindow, updater?, log? }) → { check(manual) }: wires the updater and checks once */
'use strict';

function enabled(app, env = process.env, proc = process) {
  if (!app.isPackaged || proc.mas || proc.windowsStore) return false;
  if (proc.platform === 'linux' && !env.APPIMAGE) return false;
  if (env.PORTABLE_EXECUTABLE_DIR) return false;   // the portable .exe: nothing installed to replace
  return true;
}

function start({ app, dialog, getWindow, updater, log = console }) {
  if (!enabled(app)) return { check: async () => null, enabled: false };
  const up = updater || require('electron-updater').autoUpdater;
  up.autoDownload = true;
  up.autoInstallOnAppQuit = true;
  up.logger = null;
  let manual = false, offered = false;

  up.on('update-downloaded', async (info) => {
    if (offered) return;
    offered = true;
    const r = await dialog.showMessageBox(getWindow() || undefined, {
      type: 'info', buttons: ['Restart to update', 'Later'], defaultId: 0, cancelId: 1,
      message: `${app.getName()} ${info && info.version ? info.version + ' ' : ''}is ready`,
      detail: 'Restart now to use the new version, or keep working: it is installed the next time you quit.',
    });
    if (r.response === 0) setImmediate(() => up.quitAndInstall());
  });
  up.on('update-not-available', () => {
    if (!manual) return;
    manual = false;
    dialog.showMessageBox(getWindow() || undefined, { type: 'info', message: `${app.getName()} is up to date`, detail: `Version ${app.getVersion()}.` });
  });
  up.on('error', (e) => {
    if (log && log.warn) log.warn('update check failed:', e && e.message);
    if (!manual) return;   // offline, or no release yet: a quiet check says nothing
    manual = false;
    dialog.showMessageBox(getWindow() || undefined, { type: 'warning', message: 'Could not check for updates', detail: String((e && e.message) || e) });
  });

  async function check(byHand) {
    manual = !!byHand;
    try { return await up.checkForUpdates(); } catch (e) { return null; }   // the 'error' event has reported it
  }
  setTimeout(() => check(false), 5000);   // after the first page is up
  return { check, enabled: true };
}

module.exports = { enabled, start };
