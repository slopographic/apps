/* SlopStorage.clear(kind): removes only what the site makes again on demand. Never touches user files, documents,
 * saved projects, Slop Drive's Drive database (slop-hub), the backups or localStorage settings.
 *   'thumbs'      Drive thumbnails and previews (IndexedDB slop-drive-thumbs)
 *   'faces'       face-detection results (IndexedDB slop-faces)
 *   'models'      downloaded AI model files (Cache webllm/*), kept: models imported from a folder
 *   'cutout'      the cut-out model cache
 *   'packs'       downloaded library packs (IndexedDB slop-library), downloaded again when you use them
 *   'aitools'     AI Tools models installed from Get more (IndexedDB slop-aitools), downloaded again with the licence
 *   'oldCaches'   offline caches of earlier releases (slopographic-*); the newest one is kept
 *   'extras'      all of the above
 * Resolves with { kind, removed } (removed: count of entries, or of caches for oldCaches). Never throws. Classic script. */
(function (g) {
  'use strict';
  const SS = (g.SlopStorage = g.SlopStorage || {});
  const KINDS = ['thumbs', 'faces', 'models', 'cutout', 'packs', 'aitools'];

  function versionOf(name) { const m = /^slopographic-v(\d+)$/.exec(name); return m ? Number(m[1]) : -1; }
  /** Deletes every slopographic-* cache except the newest version. The worker that is running uses the newest. */
  async function clearOldCaches() {
    if (!g.caches) return 0;
    const names = (await caches.keys().catch(() => [])).filter((n) => n.startsWith('slopographic-'));
    if (names.length < 2) return 0;
    const newest = names.reduce((a, b) => (versionOf(b) > versionOf(a) ? b : a));
    let n = 0;
    for (const name of names) if (name !== newest && (await caches.delete(name).catch(() => false))) n++;
    return n;
  }

  SS.clear = async function (kind) {
    try {
      if (kind === 'oldCaches') return { kind, removed: await clearOldCaches() };
      if (kind === 'extras') {
        let removed = 0;
        for (const k of KINDS) removed += await g.SlopRegen.only(k).catch(() => 0);
        return { kind, removed: removed + (await clearOldCaches()) };
      }
      if (KINDS.includes(kind)) return { kind, removed: await g.SlopRegen.only(kind).catch(() => 0) };
    } catch (e) { /* a blocked store counts as nothing removed */ }
    return { kind, removed: 0 };
  };
})(window);
