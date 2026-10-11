/* Slop AI — app/main: boot. */
'use strict';
(function (AI) {
  const E = AI.E;
  async function boot() {
    AI.initShell();
    AI.initChat();
    AI.initBuilder();
    AI.initSloppo();
    AI.wireCommands();
    if (window.SlopHub) SlopHub.register('ai');
    E.watchHosts();
    const hash = location.hash.slice(1);
    AI.setTab(AI.TABS.some((t) => t[0] === hash) ? hash : AI.prefs.tab || 'chat');
    addEventListener('hashchange', () => { const h = location.hash.slice(1); if (AI.TABS.some((t) => t[0] === h)) AI.setTab(h); });
    // "Send to Slop AI" from another app: text files become an attachment
    if (window.SlopHub) {
      const r = await SlopHub.consumeLaunch();
      if (r && r.blob) {
        if (AI.tab !== 'chat') AI.setTab('chat');
        if (/^image\//.test(r.type)) AI.toast('Images are not supported yet: the local models read text only');
        else await AI.chat.addFiles([new File([r.blob], r.name, { type: r.type })]);
      }
    }
    if (!AI.sys && AI.tab !== 'sys') AI.runCheck({ bench: false });
    // the default model loads by itself only when it is already downloaded (never a surprise download)
    const def = AI.prefs.defaultModel;
    if (def && !E.ready() && AI.autoload !== false) {
      const st = await E.status(def).catch(() => null);
      if (st && st.state === 'ready') E.load(def, { skipConsent: true });
    }
    document.body.classList.add('ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.AI);
