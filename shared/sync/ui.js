/* Cloud backup panel. Classic script, exposes window.SlopSyncUI. Needs SlopUI, SlopSync and SlopSyncConfig.
 *   SlopSyncUI.onLoad()  call once at page load: completes a sign-in return, if any, and says so.
 *   SlopSyncUI.open()    open the "Cloud backup" panel, e.g. from the app's menu. */
(function () {
  'use strict';
  const U = () => window.SlopUI;
  const S = () => window.SlopSync;
  const CF = () => window.SlopSyncConfig;
  const PRIVACY = 'Your data leaves this device only when you press "Back up now" or "Restore from cloud". ' +
    'Nothing is sent in the background, and cloud backup stays off until you connect a provider.';
  const RESTORE_WARNING = 'Restore from cloud replaces everything on this device with the last cloud backup. ' +
    'Anything changed since that backup is lost. Press "Back up now" first if you want to keep the current data.';

  const btn = (label, onclick, cls = '') => U().el('button', { type: 'button', class: 'sui-btn ' + cls, onclick }, label);
  const when = (ts) => (ts ? new Date(ts).toLocaleString() : 'never');

  let body = null;
  let busy = false;

  // Runs one action with the buttons locked, then redraws the panel.
  async function run(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); } catch (e) { U().toast(String((e && e.message) || 'Something went wrong.')); }
    finally { busy = false; await render(); }
  }

  async function addClientId(id) {
    const p = CF().provider(id);
    const v = await U().prompt(p.label + ': OAuth client ID', 'Client ID', '', { ok: 'Save', placeholder: 'Paste the client ID from the ' + p.label + ' console' });
    if (v == null) return;
    const r = S().configure(id, { clientId: v });
    if (!r.ok) await U().alert('Client ID not saved', r.error);
  }

  async function connect(id) {
    const r = await S().connect(id);
    if (!r.ok) await U().alert('Could not connect', r.error);
    // on success the page is now leaving for the provider's sign-in
  }

  async function backUp(id) {
    const r = await S().pushBackup(id);
    U().toast(r.ok ? 'Backed up to ' + CF().provider(id).label + '.' : r.error);
  }

  async function restore(id) {
    const p = CF().provider(id);
    const warn = U().el('div', null, U().el('p', null, RESTORE_WARNING));
    const yes = await U().confirm('Restore from ' + p.label + '?', warn, 'Replace local data', { danger: true, cancel: 'Keep local data' });
    if (!yes) return;
    const r = await S().pullBackup(id, { confirmed: true });
    if (!r.ok) { U().toast(r.error); return; }
    await U().alert('Restored', 'The cloud backup is now on this device. The page will reload to show it.');
    window.location.reload();
  }

  async function disconnect(id) {
    const p = CF().provider(id);
    const yes = await U().confirm('Disconnect ' + p.label + '?', 'This forgets the sign-in on this device. Your cloud files are not deleted.', 'Disconnect');
    if (!yes) return;
    const r = await S().disconnect(id);
    await U().alert('Disconnected', r.ok ? r.note : r.error);
  }

  async function section(id) {
    const p = CF().provider(id);
    const st = await S().status(id);
    const wrap = U().el('section', { class: 'sui-sync-section' }, U().el('h3', null, p.label));
    if (st.error) wrap.append(U().el('p', { class: 'sui-sync-note' }, st.error));
    if (!st.configured) {
      wrap.append(U().el('p', null, 'Add your OAuth client ID to use ' + p.label + '. ' + p.consoleHelp));
      wrap.append(U().el('p', null, U().el('a', { href: p.consoleUrl, target: '_blank', rel: 'noopener' }, 'Open the ' + p.label + ' console')));
      wrap.append(btn('Add client ID…', () => run(() => addClientId(id))));
    } else if (!st.connected) {
      wrap.append(btn('Connect ' + p.label, () => run(() => connect(id)), 'sui-primary'));
    } else {
      wrap.append(U().el('p', null, 'Connected. Last backup: ' + when(st.lastSync) + '.'));
      wrap.append(U().el('div', { class: 'sui-sync-actions' },
        btn('Back up now', () => run(() => backUp(id)), 'sui-primary'),
        btn('Restore from cloud', () => run(() => restore(id)), 'sui-danger'),
        btn('Disconnect', () => run(() => disconnect(id)))));
    }
    return wrap;
  }

  async function render() {
    if (!body) return;
    const sections = await Promise.all(CF().providerIds().map(section));
    body.replaceChildren(U().el('p', { class: 'sui-sync-privacy' }, PRIVACY), ...sections);
  }

  function open() {
    if (!U() || !window.SlopSync) return;
    body = U().el('div', { class: 'sui-sync-panel' }, U().el('p', null, 'Loading…'));
    U().dialog({ title: 'Cloud backup', body, buttons: [{ label: 'Close', primary: true }], onClose: () => { body = null; } });
    render();
  }

  // Page-load hook: finishes a sign-in that started on this page, and reports the outcome.
  async function onLoad() {
    if (!window.SlopSync || !U()) return null;
    const r = await S().handleRedirect();
    if (r) {
      const name = r.id ? CF().provider(r.id).label : 'cloud';
      if (r.ok) U().toast('Connected to ' + name + '. Open Cloud backup to back up or restore.', 4000);
      else U().toast(r.error, 6000);
    }
    return r;
  }

  window.SlopSyncUI = { open, onLoad };
})();
