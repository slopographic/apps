/* Work out what kind of file a dropped File is: magic bytes first, then extension, then MIME type,
 * then a text sniff. Pure: no DOM, no network. Kinds: png jpg webp bmp gif svg pdf csv json md txt html bin. */
const MAGIC = [
  ['pdf', [0x25, 0x50, 0x44, 0x46]],        // %PDF
  ['png', [0x89, 0x50, 0x4e, 0x47]],
  ['jpg', [0xff, 0xd8, 0xff]],
  ['gif', [0x47, 0x49, 0x46, 0x38]],        // GIF8
];
const EXT = {
  png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', bmp: 'bmp', gif: 'gif', svg: 'svg',
  pdf: 'pdf', csv: 'csv', json: 'json', md: 'md', markdown: 'md', txt: 'txt', text: 'txt',
  html: 'html', htm: 'html', vcf: 'vcf', vcard: 'vcf', xlsx: 'xlsx',
};
const MIME = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/pjpeg': 'jpg', 'image/webp': 'webp', 'image/bmp': 'bmp', 'image/x-ms-bmp': 'bmp',
  'image/gif': 'gif', 'image/svg+xml': 'svg', 'application/pdf': 'pdf', 'text/csv': 'csv', 'application/json': 'json',
  'text/markdown': 'md', 'text/plain': 'txt', 'text/html': 'html', 'text/vcard': 'vcf', 'text/x-vcard': 'vcf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
};
/** Extension used when a file of this kind is saved. */
export const EXT_OF_KIND = { png: 'png', jpg: 'jpg', webp: 'webp', bmp: 'bmp', gif: 'gif', svg: 'svg', pdf: 'pdf', csv: 'csv', json: 'json', md: 'md', txt: 'txt', html: 'html', vcf: 'vcf', xlsx: 'xlsx', bin: 'bin' };
export const TEXT_KINDS = ['csv', 'json', 'md', 'txt', 'html', 'vcf'];

const startsWith = (head, sig) => sig.every((b, i) => head[i] === b);
const ascii = (head, from, len) => String.fromCharCode(...head.subarray(from, from + len));

/** Kind from the first bytes of a file, or null when the bytes do not say. */
export function kindFromMagic(head) {
  if (!head || !head.length) return null;
  for (const [kind, sig] of MAGIC) if (startsWith(head, sig)) return kind;
  if (head.length >= 12 && ascii(head, 0, 4) === 'RIFF' && ascii(head, 8, 4) === 'WEBP') return 'webp';
  if (head.length >= 14 && head[0] === 0x42 && head[1] === 0x4d) return 'bmp';
  return null;
}

/** True when the bytes contain no NUL and decode as UTF-8 (a sniff for plain text). */
export function looksLikeText(head) {
  if (!head) return false;
  for (let i = 0; i < head.length; i++) if (head[i] === 0) return false;
  try { new TextDecoder('utf-8', { fatal: true }).decode(head); return true; } catch (e) { return false; }
}

/** Detect the kind of a file. name and type are strings; head is the first ~512 bytes (Uint8Array) or null. */
export function detectKind(name = '', type = '', head = null) {
  const fromMagic = kindFromMagic(head);
  const ext = (String(name).split('.').pop() || '').toLowerCase();
  const fromExt = name.includes('.') ? EXT[ext] : undefined;
  const mime = String(type || '').toLowerCase().split(';')[0].trim();
  const fromMime = MIME[mime];
  if (fromMagic === 'pdf' || fromMagic === 'png' || fromMagic === 'jpg' || fromMagic === 'gif' || fromMagic === 'webp' || fromMagic === 'bmp') return fromMagic;
  if (fromExt === 'svg' || mime === 'image/svg+xml') return 'svg';
  if (fromExt && fromExt !== 'svg') return fromExt;
  if (fromMime) return fromMime;
  if (head && head.length) {
    const t = ascii(head, 0, Math.min(head.length, 256)).trimStart();
    if (/^<svg[\s>]/i.test(t) || (/^<\?xml/i.test(t) && /<svg[\s>]/i.test(ascii(head, 0, head.length)))) return 'svg';
  }
  if (head && looksLikeText(head)) return 'txt';
  return 'bin';
}

/** Human label for a kind. */
export const KIND_LABEL = { png: 'PNG image', jpg: 'JPEG image', webp: 'WebP image', bmp: 'BMP image', gif: 'GIF image', svg: 'SVG image', pdf: 'PDF', csv: 'CSV', json: 'JSON', md: 'Markdown', txt: 'Plain text', html: 'HTML', vcf: 'vCard', xlsx: 'Excel (XLSX)', bin: 'Binary file' };
