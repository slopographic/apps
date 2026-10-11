/* Slop Music test fixtures: builds WAV and ID3v2 MP3 files in code (no binary files are committed).
 * Classic script, sets window.MusicFixtures.
 *   wav(seconds, rate)                      a 16-bit mono WAV with a quiet tone
 *   tag(major, frames)                      an ID3v2 header + frames (major 3 or 4)
 *   mp3({ title, artist, album, cover, major, enc })   an ID3 tag, then one fake MPEG frame */
(function () {
  'use strict';
  const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
  const syncsafe = (n) => [(n >> 21) & 127, (n >> 14) & 127, (n >> 7) & 127, n & 127];
  const u32 = (n) => [(n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255];
  const utf16le = (s) => [...s].flatMap((c) => [c.charCodeAt(0) & 255, c.charCodeAt(0) >> 8]);
  /** Text payload: encoding byte, then the text (enc 0 Latin-1, 1 UTF-16 with BOM, 3 UTF-8). */
  function text(enc, s) {
    if (enc === 1) return [1, 0xff, 0xfe, ...utf16le(s)];
    if (enc === 3) return [3, ...new TextEncoder().encode(s)];
    return [0, ...ascii(s)];
  }
  function frame(major, id, payload) {
    const size = major === 4 ? syncsafe(payload.length) : u32(payload.length);
    return [...ascii(id), ...size, 0, 0, ...payload];
  }
  /** An ID3v2 tag made of frames (arrays of bytes). */
  function tag(major, frames) {
    const body = frames.flat();
    return new Uint8Array([0x49, 0x44, 0x33, major, 0, 0, ...syncsafe(body.length), ...body]);
  }
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52];
  /** An MP3 for tests: an ID3 tag with title, artist, album and an optional PNG cover, then one MPEG frame header. */
  function mp3({ title = '', artist = '', album = '', cover = false, major = 3, enc = 1 } = {}) {
    const frames = [];
    if (title) frames.push(frame(major, 'TIT2', text(enc, title)));
    if (artist) frames.push(frame(major, 'TPE1', text(enc, artist)));
    if (album) frames.push(frame(major, 'TALB', text(enc, album)));
    if (cover) frames.push(frame(major, 'APIC', [0, ...ascii('image/png'), 0, 3, 0, ...PNG]));
    const head = tag(major, frames);
    const mpeg = new Uint8Array([0xff, 0xfb, 0x90, 0x64, ...new Array(400).fill(0)]);
    return new Blob([head, mpeg], { type: 'audio/mpeg' });
  }
  /** A WAV of seconds length (16-bit mono, a quiet 440 Hz tone so the waveform is not flat). */
  function wav(seconds = 2, rate = 8000) {
    const n = Math.round(seconds * rate), data = new DataView(new ArrayBuffer(n * 2));
    for (let i = 0; i < n; i++) data.setInt16(i * 2, Math.round(Math.sin((i / rate) * 2 * Math.PI * 440) * 6000), true);
    const h = new DataView(new ArrayBuffer(44));
    const str = (o, s) => ascii(s).forEach((c, i) => h.setUint8(o + i, c));
    str(0, 'RIFF'); h.setUint32(4, 36 + n * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
    h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true); h.setUint32(24, rate, true);
    h.setUint32(28, rate * 2, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); str(36, 'data'); h.setUint32(40, n * 2, true);
    return new Blob([h.buffer, data.buffer], { type: 'audio/wav' });
  }
  window.MusicFixtures = { wav, tag, frame, text, mp3, PNG, syncsafe, ascii };
})();
