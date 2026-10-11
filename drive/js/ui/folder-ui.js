/* Slop Drive — ui/folder-ui: the "Local folder" box in the sidebar, Connect folder (menu and palette), the question
 * about saving the Slopographic config in the folder, and Load config from folder (the changes are listed before
 * Apply). Logic is in core/folder.js and shared/config/folder.js. Where showDirectoryPicker is missing, the box and the
 * menu say that folders need Chrome or Edge. */
'use strict';
(function (DR) {
  const el = DR.el, $ = DR.$, ui = () => window.SlopUI;
  const FILE = 'slopographic.slop.json';
  const F = () => DR.folderState;
  const failed = (title) => (e) => ui().alert(title, (e && e.message) || String(e));

  /** Runs a folder action and turns a throw into a message, so a button never fails silently. */
  const act = (fn, title = 'Folder') => async () => { try { await fn(); } catch (e) { failed(title)(e); } };
  DR.folderAct = act;
  /** The config scripts, or a message that says why they did not load. */
  const configReady = async () => { try { await DR.ensureConfig(); return true; } catch (e) { await ui().alert('Config tools unavailable', `Slopographic settings could not be loaded here. ${e.message}`); return false; } };

  DR.connectFolder = async function () {
    if (!DR.folderSupported()) return ui().alert('Folders need Chrome or Edge', DR.folderUnsupportedText);
    const r = await window.SlopSyncProviders.local.pick();
    if (!r.ok) { if (!r.cancelled) ui().alert('Folder not connected', r.error); return; }
    await DR.folderRefresh();
    DR.renderFolder();
    const yes = await ui().confirm('Save the config in this folder?',
      `Save the Slopographic settings as ${FILE} in "${r.name}". You can load them back from this folder later. Nothing is sent anywhere.`,
      'Save config', { cancel: 'Not now' });
    if (yes) await DR.folderSaveConfig();
    DR.status && DR.status(`Writing Slop Drive files to “${r.name}”…`);
    await DR.folderMirrorAll();
    await DR.folderRefresh();
    DR.renderFolder();
    DR.status && DR.status('');
    DR.toast(`Connected “${r.name}”`);
  };

  DR.folderSaveConfig = async function () {
    if (!(await configReady())) return;
    const r = await window.SlopConfigFolder.save();
    if (!r.ok) return ui().alert('Config not saved', r.error);
    DR.toast(`Saved ${r.name} in the folder`);
  };

  DR.folderLoadConfig = async function () {
    if (!(await configReady())) return;
    const p = await window.SlopConfigFolder.preview();
    if (!p.ok) return ui().alert('Config not loaded', p.error);
    const body = p.changes.length
      ? el('div', null, el('p', { class: 'sui-p' }, 'Applying this file changes:'),
        el('ul', { class: 'folder-changes' }, p.changes.map((c) => el('li', null, `${c.label}: ${c.from} → ${c.to}`))))
      : 'Nothing would change. The file matches the settings in Slopographic.';
    ui().dialog({
      title: `Load ${p.name} from the folder?`, body,
      buttons: [{ label: 'Cancel' }, {
        label: p.changes.length ? 'Apply' : 'OK', primary: true,
        act: p.changes.length ? async () => {
          const r = await window.SlopConfigFolder.apply(p);
          if (!r.ok) { ui().alert('Config not applied', r.error); return false; }
          DR.toast(`Applied ${r.applied} change${r.applied === 1 ? '' : 's'} from the folder`);
        } : undefined,
      }],
    });
  };

  DR.folderDisconnectAsk = async function () {
    const yes = await ui().confirm('Disconnect this folder?', `Slop Drive stops writing to “${F().name}”. Files already in the folder are kept.`, 'Disconnect', { cancel: 'Keep it' });
    if (yes) await DR.folderDisconnect();
  };

  /** The rows for the More menu: one "Connect" row, or the connected folder's submenu. */
  DR.folderMenuRows = function () {
    const st = F();
    if (!st.name) return [{ label: 'Connect folder…', act: act(() => DR.connectFolder(), 'Folder') }];
    const granted = st.perm === 'granted';
    return [{
      label: `Local folder: ${st.name}`, sub: [
        ...(granted ? [] : [{ label: `Allow access to ${st.name}`, act: act(() => DR.folderAllow()) }, '-']),
        ...(granted ? [{ label: 'Load config from folder…', act: act(() => DR.folderLoadConfig()) }, { label: 'Save config to folder', act: act(() => DR.folderSaveConfig()) }, '-'] : []),
        { label: 'Disconnect folder…', act: () => DR.folderDisconnectAsk() },
      ],
    }];
  };

  const btn = (label, fn, cls = 'btn') => { const b = el('button', { type: 'button', class: cls }, label); b.addEventListener('click', act(fn)); return b; };

  /** The sidebar box: the state in plain words, and one button per next step. */
  DR.folderNodes = function () {
    const st = F();
    if (!DR.folderSupported()) return [el('p', { class: 'folder-note' }, DR.folderUnsupportedText)];
    if (!st.name) return [el('p', { class: 'folder-note' }, 'Keep a copy of your files in a folder on this computer.'), btn('Connect folder…', () => DR.connectFolder())];
    const out = [el('p', { class: 'folder-name' }, el('b', null, 'Folder: '), el('span', { title: st.name }, st.name))];
    if (st.perm !== 'granted') {
      out.push(el('p', { class: 'folder-note' }, st.perm === 'denied'
        ? 'Access was refused. Allow access again, or connect the folder again.'
        : 'The browser asks again before Slop Drive uses this folder.'));
      out.push(btn(`Allow access to ${st.name}`, () => DR.folderAllow(), 'btn primary'));
    } else if (st.missing.length) {
      const n = st.missing.length;
      out.push(el('p', { class: 'folder-note' }, `${n} file${n === 1 ? '' : 's'} in the folder ${n === 1 ? 'is' : 'are'} not in Slop Drive.`));
      out.push(btn('Import them', () => DR.folderImport()));
    }
    const row = el('div', { class: 'folder-row' });
    if (st.perm === 'granted') {
      row.append(btn('Load config', () => DR.folderLoadConfig()), btn('Save config', () => DR.folderSaveConfig()));
    }
    row.append(btn('Disconnect', () => DR.folderDisconnectAsk()));
    out.push(row);
    return out;
  };
  DR.renderFolder = function () {
    const box = $('folderBox');
    if (box) box.replaceChildren(...DR.folderNodes());
  };
})(window.DR);
