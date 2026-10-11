/* Slop Hex: pure byte helpers (no DOM, no storage). Classic script; exposes window.HexBytes.
 *   parseOffset(text, size)  -> { value } | { error }   decimal, or 0x-prefixed hex, must lie inside the file
 *   parseHex(text)           -> Uint8Array | null       "4D 5A", "4d5a" or "0x4D5A"; whole bytes only
 *   textBytes(text)          -> Uint8Array              UTF-8 bytes of a text search
 *   hexOf(n), asciiOf(n)     one byte as two hex digits, or as one printable character ('.' if not printable)
 *   formatOffset(n, size)    an offset as hex, padded to at least 8 digits (more for large files)
 *   guessType(bytes)         a short label from the magic bytes at the start of the file
 *   indexOf(hay, pat, from) / lastIndexOf(hay, pat, from)   byte search inside one buffer */
(function () {
  'use strict';
  if (window.HexBytes) return;

  function parseOffset(text, size) {
    const s = String(text || '').trim();
    let v = null;
    if (/^0x[0-9a-f]+$/i.test(s)) v = parseInt(s.slice(2), 16);
    else if (/^\d+$/.test(s)) v = parseInt(s, 10);
    if (v === null || !Number.isSafeInteger(v)) return { error: 'Enter a decimal offset or a 0x hex offset' };
    if (v < 0 || v >= size) return { error: size ? `Offset must be between 0 and ${size - 1}` : 'The file is empty' };
    return { value: v };
  }

  /** Hex text to bytes. Spaces and tabs between bytes are allowed; an odd number of digits is not a byte sequence. */
  function parseHex(text) {
    let s = String(text || '').replace(/\s+/g, '');
    if (/^0x/i.test(s)) s = s.slice(2);
    if (!s.length || s.length % 2 || !/^[0-9a-f]+$/i.test(s)) return null;
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }

  function textBytes(text) { return new TextEncoder().encode(String(text || '')); }

  const HEX = '0123456789ABCDEF';
  const hexOf = (n) => HEX[(n >> 4) & 15] + HEX[n & 15];
  function asciiOf(n) { return n >= 0x20 && n <= 0x7e ? String.fromCharCode(n) : '.'; }

  function formatOffset(n, size = 0) {
    const digits = Math.max(8, (size - 1).toString(16).length);
    return '0x' + n.toString(16).toUpperCase().padStart(digits, '0');
  }

  const MAGIC = [
    [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'PNG image'],
    [[0xff, 0xd8, 0xff], 'JPEG image'],
    [[0x47, 0x49, 0x46, 0x38], 'GIF image'],
    [[0x25, 0x50, 0x44, 0x46, 0x2d], 'PDF document'],
    [[0x50, 0x4b, 0x03, 0x04], 'ZIP archive (also Office and EPUB files)'],
    [[0x1f, 0x8b], 'gzip archive'],
    [[0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c], '7-Zip archive'],
    [[0x52, 0x61, 0x72, 0x21, 0x1a, 0x07], 'RAR archive'],
    [[0x7f, 0x45, 0x4c, 0x46], 'ELF executable'],
    [[0x4d, 0x5a], 'Windows executable (MZ)'],
    [[0xcf, 0xfa, 0xed, 0xfe], 'Mach-O 64-bit executable'],
    [[0xce, 0xfa, 0xed, 0xfe], 'Mach-O 32-bit executable'],
    [[0x00, 0x61, 0x73, 0x6d], 'WebAssembly module'],
    [[0x1a, 0x45, 0xdf, 0xa3], 'WebM or Matroska video'],
    [[0x4f, 0x67, 0x67, 0x53], 'Ogg media'],
    [[0x49, 0x44, 0x33], 'MP3 audio (ID3 tag)'],
    [[0xff, 0xfb], 'MP3 audio'],
    [[0x66, 0x4c, 0x61, 0x43], 'FLAC audio'],
    [[0x00, 0x00, 0x01, 0x00], 'ICO icon'],
    [[0x3c, 0x3f, 0x78, 0x6d, 0x6c], 'XML document'],
    [[0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00], 'SQLite database'],
  ];
  const at = (b, off, sig) => sig.every((v, i) => b[off + i] === v);

  /** A label for the file type. Checks the magic bytes first, then whether the start reads as plain text. */
  function guessType(b) {
    if (!b || !b.length) return 'Empty file';
    if (b.length >= 12 && at(b, 0, [0x52, 0x49, 0x46, 0x46]) && at(b, 8, [0x57, 0x45, 0x42, 0x50])) return 'WebP image';
    if (b.length >= 12 && at(b, 0, [0x52, 0x49, 0x46, 0x46]) && at(b, 8, [0x57, 0x41, 0x56, 0x45])) return 'WAV audio';
    if (b.length >= 12 && at(b, 4, [0x66, 0x74, 0x79, 0x70])) return 'MP4 or QuickTime media (ISO base media)';
    for (const [sig, label] of MAGIC) if (b.length >= sig.length && at(b, 0, sig)) return label;
    const n = Math.min(b.length, 1024);
    let text = 0;
    for (let i = 0; i < n; i++) {
      const c = b[i];
      if (c === 0) return 'Binary data';
      if (c === 9 || c === 10 || c === 13 || (c >= 0x20 && c <= 0x7e) || c >= 0x80) text++;
    }
    return text / n >= 0.95 ? 'Text (probably UTF-8 or ASCII)' : 'Binary data';
  }

  /** First index >= from where pat occurs in hay, or -1. */
  function indexOf(hay, pat, from = 0) {
    const m = pat.length, last = hay.length - m;
    if (!m) return -1;
    outer: for (let i = Math.max(0, from); i <= last; i++) {
      if (hay[i] !== pat[0]) continue;
      for (let j = 1; j < m; j++) if (hay[i + j] !== pat[j]) continue outer;
      return i;
    }
    return -1;
  }

  /** Last index <= from where pat occurs in hay, or -1. */
  function lastIndexOf(hay, pat, from = hay.length) {
    const m = pat.length;
    if (!m) return -1;
    outer: for (let i = Math.min(from, hay.length - m); i >= 0; i--) {
      if (hay[i] !== pat[0]) continue;
      for (let j = 1; j < m; j++) if (hay[i + j] !== pat[j]) continue outer;
      return i;
    }
    return -1;
  }

  window.HexBytes = { parseOffset, parseHex, textBytes, hexOf, asciiOf, formatOffset, guessType, indexOf, lastIndexOf, ROW: 16 };
})();
