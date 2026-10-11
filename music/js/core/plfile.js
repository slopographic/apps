/* Slop Music: the .splaylist file. JSON with the Slop Drive ids of the tracks, plus title, artist and album
 * for people reading it. Saved to Slop Drive, opened from it. Exposes window.SlopMusic.plfile. */
(function () {
  'use strict';
  const M = (window.SlopMusic = window.SlopMusic || {});
  const MIME = 'application/x-slop-playlist', EXT = '.splaylist';
  /** A Blob of the playlist. tracks: [{ id, title, artist, album, duration }] in play order. */
  function build(name, tracks) {
    const doc = {
      format: 'slop-playlist', version: 1, name,
      tracks: tracks.map((t) => ({ drive: t.id, title: t.title || '', artist: t.artist || '', album: t.album || '', duration: t.duration ?? null })),
    };
    return new Blob([JSON.stringify(doc, null, 2)], { type: MIME });
  }
  /** Reads a .splaylist text. Returns { name, trackIds }. Throws when it is not a Slop playlist. */
  function parse(text) {
    const doc = JSON.parse(text);
    if (!doc || doc.format !== 'slop-playlist' || !Array.isArray(doc.tracks)) throw new Error('This is not a Slop playlist.');
    return { name: String(doc.name || 'Playlist').slice(0, 80), trackIds: doc.tracks.map((t) => String(t.drive || '')).filter(Boolean) };
  }
  M.plfile = { build, parse, MIME, EXT, fileName: (name) => String(name || 'Playlist').replace(/[\\/:*?"<>|]+/g, ' ').trim() + EXT };
})();
