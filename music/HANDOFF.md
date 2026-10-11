# Slop Music: handoff

Slop Music (`music/`) plays the audio in Slop Drive. Everything runs in the browser: no upload, no fetch, no
network request. Files are read from Slop Drive (IndexedDB) and played through object URLs.

## What works

- **Library**: every audio file in Slop Drive (`SlopHub.list` with the audio types). Add files with the picker
  or drop them on the Library; they are saved into Slop Drive first. Sort by artist, album or title; search.
- **Title, artist, album**: ID3v2 tags are read by hand (see below). Without a tag, the title is the file name
  without its extension. Duration comes from the WAV header, or from one decode of the file (cached).
- **Covers**: the ID3 APIC picture when present, else a generated tile in a colour from the title.
- **Playback**: play, pause, next, previous (previous restarts a track after 3 s), shuffle (the current track
  stays first), repeat off / all / one, seek on the full waveform (decoded once, peaks cached in IndexedDB),
  volume, speed 0.5× to 2×, mute.
- **Keyboard**: Space play or pause, ← → seek 5 s (Shift: 15 s), ↑ ↓ volume, M mute, N next, P previous.
- **Media Session**: track, artist, album and cover on the OS and lock screen; play, pause, previous, next and
  seek from media keys.
- **Playlists**: create, rename, delete; add tracks from the library; drag the handle to reorder (touch works,
  and Alt+arrows on the keyboard); saved in IndexedDB. Save as `.splaylist` to Slop Drive, or open one from it.
- **Tags**: stored on the Drive record in `meta.tags`, the same way Slop Drive stores them, so they travel with
  the file. Set with "Tags…" in a track's menu (right-click or ⋯), removed with × on the Now playing view or
  "Remove tag" in the menu. The Tags sidebar filters the library with counts. Helpers: `shared/tags/tags.js`.
- **Mini player**: while a track plays and the Now playing view is closed, a bar at the bottom shows the track,
  play or pause, progress, and a link back to Now playing. Playback goes on while other tabs are open. Starting
  playback in one Music tab pauses any other Music tab.
- **Layout**: works at 390 px with no horizontal scroll. The queue is a bottom sheet.

## Files

| Path | What |
|---|---|
| `index.html`, `css/music.css` | The page: three views, the mini bar, the queue sheet, an SVG icon sprite. |
| `js/core/id3.js` | ID3v2 reader (v2.2, 2.3, 2.4), WAV header reader, MIME and title helpers. |
| `js/core/queue.js` | Play order: shuffle, repeat, next and previous. Pure functions. |
| `js/core/store.js` | IndexedDB `slop-music`: `analysis` and `playlists` stores. |
| `js/core/analyze.js` | Per-file analysis (tags, duration, peaks, cover), cached by Drive id and size. |
| `js/core/library.js` | The track list from Slop Drive, tags, adding files. |
| `js/core/playlists.js`, `js/core/plfile.js` | Playlists, and the `.splaylist` format. |
| `js/core/engine.js` | One `<audio>` element: the queue, seek, volume, speed, repeat, shuffle. |
| `js/core/media.js` | Media Session metadata, actions and position. |
| `js/ui/*.js` | Library list, Now playing, mini bar, playlists, waveform, display helpers. |
| `js/app/main.js` | Views, keyboard, title, launch from `?drive=<id>`, refresh on Drive change. |
| `../shared/tags/tags.js` | Pure tag helpers, shared with Slop Drive (see `shared/tags/HANDOFF.md`). |
| `../tests/music/` | Tests: `library` (WAV duration, MP3 ID3 title, sort, search, tags), `player`, `playlist`, `id3`. Fixtures are built in code. |

## ID3 fields read

From an ID3v2 tag at the start of the file (MP3 and any file that carries one):

- Title: `TIT2` (v2.2 `TT2`). Artist: `TPE1` (`TP1`). Album: `TALB` (`TAL`).
- Cover: `APIC` (`PIC` in v2.2): the first picture, as a Blob with its MIME type.
- Text encodings 0 (Latin-1), 1 (UTF-16 with BOM), 2 (UTF-16BE), 3 (UTF-8).
- Header flags: the v2.3 unsynchronisation and extended header, and the v2.4 per-frame unsynchronisation and
  data length indicator. Compressed or encrypted frames are skipped.

Not read: track number, year, genre, comments, lyrics, ReplayGain.

## Formats and browsers

Decoding is left to the browser (`decodeAudioData` for the analysis, `<audio>` for playback). The app does not
ship a decoder. What a browser can play decides what appears as playable. Names are matched by extension when
the browser gives no MIME type.

| Format | Chrome, Edge | Firefox | Safari |
|---|---|---|---|
| MP3 | yes | yes | yes |
| WAV (PCM) | yes | yes | yes |
| AAC / M4A (MP4) | yes | yes | yes |
| FLAC | yes | yes | yes (11 and later) |
| Ogg Vorbis | yes | yes | no |
| Opus | yes | yes | partial (Safari 17 and later) |

Tested in headless Chromium only. A file that cannot be decoded still shows in the library with its tag title
and file name; its duration is shown once the browser can play it, and the Now playing view says it cannot play.

## Limits

- No lyrics, no equaliser, no streaming, no radio, no podcasts.
- A track that cannot be decoded has no waveform. Its duration appears only if the browser can play it.
- Peaks are one decode per file, kept in IndexedDB. Large files take a few seconds to analyse, one at a time.
- Playlists keep Drive ids. A track deleted from Drive shows as "Not in Slop Drive" until removed.
- One Music tab plays at a time. Other tabs pause when a new one starts.
- The offline service worker (`service-worker.js`) does not yet cache the Music files. Add them there to
  work offline.
- Tags are edited in Music and in Slop Drive; Drive still has its own copy of the tag code (see
  `shared/tags/HANDOFF.md`).
