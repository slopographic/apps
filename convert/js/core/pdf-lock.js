/* Two PDF conversions with the site's PDF security handler (shared/pdf-crypto/): Protect PDF with a password (AES-256,
 * with the permissions to print, copy and edit) and Remove PDF password. Spread into CONVERSIONS by catalog.js.
 * Their entries say secret: true, so their password options (type 'password') are never shown in a summary, the live
 * preview does not run them, and the tool forgets the passwords after Convert (ui/file-opts.js forgetSecrets).
 * The passwords live only in the file's options while the page is open; nothing logs or stores them. Browser only.
 *   protectPdf(bytes, { password, confirm, allowPrint, allowCopy, allowEdit }) -> Uint8Array
 *   unlockPdf(bytes, { password }) -> Uint8Array */
import { loadPdfLib } from './lib.js';
import { stemOf as base } from '../io/files.js';

const SHARED = new URL('../../../shared/pdf-crypto/', import.meta.url).href;
const PARTS = ['legacy', 'aes256', 'security', 'decrypt', 'encrypt'];
let ready = null;

function script(src) {
  return new Promise((res, rej) => {
    const s = Object.assign(document.createElement('script'), { src, async: false });
    s.onload = res; s.onerror = () => { s.remove(); rej(new Error('Could not load the PDF password code')); };
    document.head.append(s);
  });
}
/** pdf-lib and window.SlopPdfCrypto, once. */
export function crypto() {
  if (!ready) {
    ready = (async () => {
      await loadPdfLib();
      const C = globalThis.SlopPdfCrypto;
      if (!C || !C.encryptPdf) for (const p of PARTS) await script(`${SHARED}${p}.js`);
      return globalThis.SlopPdfCrypto;
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

const notPdf = (e) => /parse|PDF|header|trailer/i.test(String(e && e.message)) && !e.code;
function readable(e) {
  if (e && e.code === 'password') return new Error('Wrong password. Type the password that opens this PDF.');
  if (e && e.code === 'unsupported') return new Error(e.message);
  if (notPdf(e)) return new Error('This is not a valid PDF, or it is damaged.');
  return e instanceof Error ? e : new Error(String(e));
}

export async function protectPdf(bytes, o = {}) {
  const pw = String(o.password ?? '');
  if (!pw) throw new Error('Type a password in Options.');
  if (pw !== String(o.confirm ?? '')) throw new Error('The two passwords are not the same. Type them again in Options.');
  const C = await crypto();
  try {
    return await C.encryptPdf(bytes, { userPassword: pw, permissions: {
      print: o.allowPrint !== false, copy: o.allowCopy !== false,
      modify: o.allowEdit !== false, annotate: o.allowEdit !== false, assemble: o.allowEdit !== false } });
  } catch (e) {
    if (e && e.code === 'password') throw new Error('This PDF already has a password. Remove it first (Remove PDF password), then protect it again.');
    throw readable(e);
  }
}

export async function unlockPdf(bytes, o = {}) {
  const C = await crypto();
  let out;
  try { out = await C.decryptPdf(bytes, String(o.password ?? ''), { useObjectStreams: false }); }
  catch (e) {
    if (e && e.code === 'password' && !o.password) throw new Error('This PDF needs its password to open. Type it in Options.');
    throw readable(e);
  }
  if (!out) throw new Error('This PDF has no password to remove.');
  return out;
}

const PERM = (key, label) => ({ key, type: 'checkbox', label, value: true });
const pdfOut = (name, bytes) => ({ name, blob: new Blob([bytes], { type: 'application/pdf' }) });
const read = async (f) => new Uint8Array(await f.file.arrayBuffer());

export const PDF_LOCK = [
  { id: 'pdf-protect', label: 'Protect PDF with a password', group: 'PDF', from: ['pdf'], ext: 'pdf', mode: 'each', secret: true, chain: false,
    keywords: ['password', 'encrypt', 'lock', 'secure', 'aes', 'protect'],
    note: 'AES-256, the strongest PDF encryption. Keep the password safe: nobody, not even this site, can open the file without it.',
    options: [
      { key: 'password', type: 'password', label: 'Password', hint: 'Needed to open the PDF. The password is used on this device only and forgotten after Convert.' },
      { key: 'confirm', type: 'password', label: 'Type the password again' },
      PERM('allowPrint', 'Allow printing'), PERM('allowCopy', 'Allow copying text and pictures'),
      { ...PERM('allowEdit', 'Allow editing (pages, text and comments)'), hint: 'PDF readers that follow the permissions (Acrobat, Preview, browsers) apply them once the file is open.' },
    ],
    run: async (files, o) => [pdfOut(`${base(files[0].name)}-protected.pdf`, await protectPdf(await read(files[0]), o))] },
  { id: 'pdf-unlock', label: 'Remove PDF password', group: 'PDF', from: ['pdf'], ext: 'pdf', mode: 'each', secret: true, chain: false,
    keywords: ['password', 'decrypt', 'unlock', 'unprotect', 'remove'],
    note: 'Makes a copy with no password and no limits on printing or copying. You need the password that opens the file.',
    options: [
      { key: 'password', type: 'password', label: 'Password', hint: 'The password that opens the PDF. Leave it blank for a PDF that opens without one but limits printing, copying or editing.' },
    ],
    run: async (files, o) => [pdfOut(`${base(files[0].name)}-unlocked.pdf`, await unlockPdf(await read(files[0]), o))] },
];
