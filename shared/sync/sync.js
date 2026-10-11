/* SlopSync: opt-in cloud backup to the person's own Google Drive or Dropbox. Classic script, window.SlopSync.
 *
 * Privacy contract: data leaves the device ONLY inside pushBackup, pullBackup, pushAppFile and pullAppFile,
 * each called from a button press. connect() only redirects to the provider's sign-in page. handleRedirect()
 * talks to the provider only when the URL carries an OAuth code from our own sign-in. Nothing runs on a timer.
 *
 * Every public function resolves to {ok, ...} or {ok: false, error: 'message'}; none throws into the UI. */
(function () {
  'use strict';
  const BACKUP_NAME = 'slopographic-backup.json';
  const APPS_FOLDER = 'Apps';
  const PENDING_KEY = 'slop-sync-pending';
  const PENDING_MAX_MS = 10 * 60 * 1000;

  const C = () => window.SlopSyncConfig;
  const P = () => window.SlopSyncPkce;
  const T = () => window.SlopSyncTokens;
  const PR = () => window.SlopSyncProviders || {};

  const fail = (error, extra) => Object.assign({ ok: false, error }, extra || {});

  function msg(e) {
    if (e && e.status === 401) return 'Your sign-in has expired. Connect again.';
    return (e && e.message) ? e.message : 'Something went wrong. Nothing was changed.';
  }

  function providerModule(id) {
    const m = C().provider(id) ? PR()[id] : null;
    if (!m) throw new Error('Unknown cloud provider.');
    return m;
  }

  // Remote names: a single path segment, no separators or control characters.
  function safeName(name) {
    const s = String(name == null ? '' : name);
    if (!s || s.length > 200 || s === '.' || s === '..' || /[\/\\\u0000-\u001f]/.test(s)) {
      throw new Error('That file name cannot be used in cloud storage.');
    }
    return s;
  }

  // Pending sign-in lives in sessionStorage: it survives the redirect in this tab and is gone when the tab closes.
  function savePending(p) { sessionStorage.setItem(PENDING_KEY, JSON.stringify(p)); }
  function takePending() {
    try {
      const raw = sessionStorage.getItem(PENDING_KEY);
      sessionStorage.removeItem(PENDING_KEY);
      const p = raw ? JSON.parse(raw) : null;
      if (!p || Date.now() - p.createdAt > PENDING_MAX_MS) return null;
      return p;
    } catch (e) { return null; }
  }

  // Returns a usable access token, refreshing it when needed. Throws when not connected.
  async function validToken(id) {
    const rec = await T().load(id);
    if (!rec) throw new Error('Not connected to ' + C().provider(id).label + '. Connect it first.');
    if (!T().needsRefresh(rec)) return rec.access;
    if (!rec.refresh) throw new Error('Your sign-in has expired. Connect again.');
    const clientId = C().getClientId(id);
    if (!clientId) throw new Error('Add your OAuth client ID first.');
    const t = await P().refresh(id, { clientId, refreshToken: rec.refresh });
    const next = { access: t.access, refresh: t.refresh || rec.refresh, expiresAt: t.expiresAt };
    await T().save(id, next);
    return next.access;
  }

  // Reads the local export through SlopData (owned by shared/data/export.js).
  async function exportBlob() {
    const SD = window.SlopData;
    if (!SD || typeof SD.exportAll !== 'function') throw new Error('Backup is not available in this app yet.');
    const blob = await SD.exportAll();
    if (!blob || typeof blob.size !== 'number') throw new Error('The export did not produce a file.');
    return blob;
  }

  const SlopSync = {
    BACKUP_NAME,
    APPS_FOLDER,

    // Stores the person's OAuth client ID. No network.
    configure(id, opts = {}) {
      if (!C().provider(id)) return fail('Unknown cloud provider.');
      return C().setClientId(id, opts.clientId);
    },

    // Starts the PKCE sign-in by navigating this page to the provider. No network from this page.
    async connect(id) {
      try {
        if (!C().provider(id)) return fail('Unknown cloud provider.');
        const clientId = C().getClientId(id);
        if (!clientId) return fail('Add your OAuth client ID first. Open the Cloud backup panel to paste it.');
        const pk = await P().create();
        const redirectUri = C().redirectUri();
        savePending({ id, clientId, redirectUri, verifier: pk.verifier, state: pk.state, createdAt: Date.now() });
        window.location.assign(P().authUrl(id, { clientId, redirectUri, state: pk.state, challenge: pk.challenge }));
        return { ok: true, redirecting: true };
      } catch (e) { return fail(msg(e)); }
    },

    // Call once at page load. Returns null when the URL is not a sign-in return.
    async handleRedirect() {
      let id;
      try {
        const q = new URLSearchParams(window.location.search);
        if (!q.has('code') && !q.has('error')) return null;
        const pending = takePending();
        try { history.replaceState(null, '', window.location.pathname + window.location.hash); } catch (e) { /* keep URL */ }
        if (!pending) return fail('This sign-in was not started from this page, so nothing was connected.');
        id = pending.id;
        if (q.has('error')) return fail('Sign-in was cancelled or refused. Nothing was connected.', { id });
        if (!P().checkState(pending.state, q.get('state'))) return fail('Sign-in check failed (state mismatch). Nothing was connected.', { id });
        const tokens = await P().exchangeCode(id, {
          clientId: pending.clientId,
          code: q.get('code'),
          verifier: pending.verifier,
          redirectUri: pending.redirectUri
        });
        await T().save(id, tokens);
        return { ok: true, id };
      } catch (e) { return fail(msg(e), { id }); }
    },

    // Connection state. Reads local storage only (no network).
    async status(id) {
      const p = C().provider(id);
      const base = {
        label: p ? p.label : '',
        configured: !!C().getClientId(id),
        lastSync: C().getLastSync(id) || null
      };
      try {
        const rec = await T().load(id);
        return Object.assign(base, { connected: !!rec });
      } catch (e) {
        return Object.assign(base, { connected: false, error: msg(e) });
      }
    },

    // Exports the local data and uploads it. The only path that sends the backup.
    async pushBackup(id) {
      try {
        const mod = providerModule(id);
        const token = await validToken(id);
        const blob = await exportBlob();
        await mod.upload({ token }, BACKUP_NAME, blob);
        const at = Date.now();
        C().setLastSync(id, at);
        return { ok: true, at, bytes: blob.size };
      } catch (e) { return fail(msg(e)); }
    },

    // Downloads the backup and replaces local data. Refuses unless the caller passes confirmed: true
    // after showing the person a warning. Checked before any network call.
    async pullBackup(id, opts = {}) {
      try {
        if (opts.confirmed !== true) return fail('Restoring replaces your local data. Confirm first.');
        const mod = providerModule(id);
        if (!window.SlopData || typeof window.SlopData.importAll !== 'function') return fail('Restore is not available in this app yet.');
        const token = await validToken(id);
        const blob = await mod.download({ token }, BACKUP_NAME);
        if (!blob) return fail('No cloud backup found yet. Back up first.');
        await window.SlopData.importAll(blob);
        return { ok: true, bytes: blob.size };
      } catch (e) { return fail(msg(e)); }
    },

    // Optional: upload one app file (e.g. a document) into the Apps folder.
    async pushAppFile(id, name, blob) {
      try {
        const mod = providerModule(id);
        if (!blob || typeof blob.size !== 'number') throw new Error('No file to upload.');
        const token = await validToken(id);
        const out = await mod.upload({ token }, safeName(name), blob, { folder: APPS_FOLDER });
        return { ok: true, name: out.name || name, bytes: blob.size };
      } catch (e) { return fail(msg(e)); }
    },

    // Optional: download one app file from the Apps folder. Returns it as a Blob; the caller decides what to do.
    async pullAppFile(id, name) {
      try {
        const mod = providerModule(id);
        const token = await validToken(id);
        const blob = await mod.download({ token }, safeName(name), { folder: APPS_FOLDER });
        if (!blob) return fail('That file is not in the Apps folder.');
        return { ok: true, blob };
      } catch (e) { return fail(msg(e)); }
    },

    // Forgets the tokens on this device. The provider grant stays until the person removes the app in
    // their Google Account or Dropbox settings (no network call here, by design).
    async disconnect(id) {
      try {
        if (!C().provider(id)) return fail('Unknown cloud provider.');
        await T().clear(id);
        C().setLastSync(id, 0);
        return { ok: true, note: 'Disconnected on this device. To revoke access completely, remove this app in your Google Account or Dropbox settings.' };
      } catch (e) { return fail(msg(e)); }
    }
  };

  window.SlopSync = SlopSync;
})();
