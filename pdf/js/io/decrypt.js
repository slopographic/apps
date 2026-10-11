/* Slop PDF — removes the standard PDF security handler (RC4 40/128, AES-128, AES-256 R5/R6)
   so pdf-lib can rewrite password-protected or permission-restricted PDFs.
   pdf.js renders encrypted files by itself, but pdf-lib cannot read them; this module
   decrypts every string and stream with the password the user typed (or the empty
   password for owner-restricted files) and returns plain PDF bytes. Runs locally. */
(function () {
  'use strict';
  var SP = window.SP = window.SP || {};
  var D = SP.decrypt = {};

  /* ---------------- MD5 (RFC 1321) on Uint8Array ---------------- */
  var K = new Int32Array(64), S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  for (var i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  function md5(data) {
    var len = data.length, padLen = ((len + 72) & ~63);
    var buf = new Uint8Array(padLen);
    buf.set(data); buf[len] = 0x80;
    var bits = len * 8;
    buf[padLen - 8] = bits & 255; buf[padLen - 7] = (bits >>> 8) & 255; buf[padLen - 6] = (bits >>> 16) & 255; buf[padLen - 5] = (bits >>> 24) & 255;
    var hi = Math.floor(len / 536870912);
    buf[padLen - 4] = hi & 255; buf[padLen - 3] = (hi >>> 8) & 255; buf[padLen - 2] = (hi >>> 16) & 255; buf[padLen - 1] = (hi >>> 24) & 255;
    var a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476, w = new Int32Array(16);
    for (var off = 0; off < padLen; off += 64) {
      for (var j = 0; j < 16; j++) { var p = off + j * 4; w[j] = buf[p] | (buf[p + 1] << 8) | (buf[p + 2] << 16) | (buf[p + 3] << 24); }
      var a = a0, b = b0, c = c0, d = d0, f, g;
      for (var k = 0; k < 64; k++) {
        if (k < 16) { f = (b & c) | (~b & d); g = k; }
        else if (k < 32) { f = (d & b) | (~d & c); g = (5 * k + 1) & 15; }
        else if (k < 48) { f = b ^ c ^ d; g = (3 * k + 5) & 15; }
        else { f = c ^ (b | ~d); g = (7 * k) & 15; }
        var t = d; d = c; c = b;
        var x = (a + f + K[k] + w[g]) | 0, s = S[(k >> 4) * 4 + (k & 3)];
        b = (b + ((x << s) | (x >>> (32 - s)))) | 0; a = t;
      }
      a0 = (a0 + a) | 0; b0 = (b0 + b) | 0; c0 = (c0 + c) | 0; d0 = (d0 + d) | 0;
    }
    var out = new Uint8Array(16), hs = [a0, b0, c0, d0];
    for (var q = 0; q < 4; q++) { out[q * 4] = hs[q] & 255; out[q * 4 + 1] = (hs[q] >>> 8) & 255; out[q * 4 + 2] = (hs[q] >>> 16) & 255; out[q * 4 + 3] = (hs[q] >>> 24) & 255; }
    return out;
  }
  D.md5 = md5;

  function rc4(key, data) {
    var s = new Uint8Array(256), j = 0, i, t;
    for (i = 0; i < 256; i++) s[i] = i;
    for (i = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; t = s[i]; s[i] = s[j]; s[j] = t; }
    var out = new Uint8Array(data.length), x = 0, y = 0;
    for (var k = 0; k < data.length; k++) {
      x = (x + 1) & 255; y = (y + s[x]) & 255; t = s[x]; s[x] = s[y]; s[y] = t;
      out[k] = data[k] ^ s[(s[x] + s[y]) & 255];
    }
    return out;
  }
  D.rc4 = rc4;

  function concat() {
    var len = 0, i; for (i = 0; i < arguments.length; i++) len += arguments[i].length;
    var out = new Uint8Array(len), o = 0;
    for (i = 0; i < arguments.length; i++) { out.set(arguments[i], o); o += arguments[i].length; }
    return out;
  }
  function eq(a, b, n) { for (var i = 0; i < n; i++) if (a[i] !== b[i]) return false; return true; }

  /* ---------------- AES via WebCrypto ---------------- */
  var subtle = (window.crypto && window.crypto.subtle) || null;
  function importAes(key) { return subtle.importKey('raw', key, { name: 'AES-CBC' }, false, ['encrypt', 'decrypt']); }
  /* CBC-decrypt without padding checks: append one crafted block that decrypts to a full
     PKCS#7 padding block, so WebCrypto strips exactly that block and returns raw plaintext. */
  async function aesCbcRaw(cryptoKey, iv, data) {
    if (!data.length) return new Uint8Array(0);
    var last = data.subarray(data.length - 16), x = new Uint8Array(16);
    for (var i = 0; i < 16; i++) x[i] = last[i] ^ 16;
    var enc = new Uint8Array(await subtle.encrypt({ name: 'AES-CBC', iv: new Uint8Array(16) }, cryptoKey, x));
    var full = concat(data, enc.subarray(0, 16));
    return new Uint8Array(await subtle.decrypt({ name: 'AES-CBC', iv: iv }, cryptoKey, full));
  }
  async function aesDecryptPdf(cryptoKey, data) {
    if (data.length < 32) return new Uint8Array(0);
    var iv = data.slice(0, 16), body = data.subarray(16, 16 + Math.floor((data.length - 16) / 16) * 16);
    var raw = await aesCbcRaw(cryptoKey, iv, body);
    var pad = raw[raw.length - 1];
    if (pad >= 1 && pad <= 16 && pad <= raw.length) {
      var ok = true; for (var i = raw.length - pad; i < raw.length; i++) if (raw[i] !== pad) { ok = false; break; }
      if (ok) return raw.slice(0, raw.length - pad);
    }
    return raw;
  }
  async function sha(name, data) { return new Uint8Array(await subtle.digest(name, data)); }

  var PAD = new Uint8Array([0x28, 0xBF, 0x4E, 0x5E, 0x4E, 0x75, 0x8A, 0x41, 0x64, 0x00, 0x4E, 0x56, 0xFF, 0xFA, 0x01, 0x08,
    0x2E, 0x2E, 0x00, 0xB6, 0xD0, 0x68, 0x3E, 0x80, 0x2F, 0x0C, 0xA9, 0xFE, 0x64, 0x53, 0x69, 0x7A]);
  function padPw(pw) { var out = new Uint8Array(32), n = Math.min(32, pw.length); out.set(pw.subarray(0, n)); out.set(PAD.subarray(0, 32 - n), n); return out; }
  function latin1(s) { var o = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) o[i] = s.charCodeAt(i) & 255; return o; }

  /* Algorithm 2: file key from a (padded) user password, R2–R4 */
  function computeKeyR4(pwPadded, enc, id0) {
    var p = enc.P >>> 0;
    var parts = [pwPadded, enc.O.subarray(0, 32), new Uint8Array([p & 255, (p >>> 8) & 255, (p >>> 16) & 255, (p >>> 24) & 255]), id0];
    if (enc.R >= 4 && !enc.encryptMetadata) parts.push(new Uint8Array([255, 255, 255, 255]));
    var h = md5(concat.apply(null, parts)), n = enc.R === 2 ? 5 : enc.keyLen;
    if (enc.R >= 3) for (var i = 0; i < 50; i++) h = md5(h.subarray(0, n));
    return h.slice(0, n);
  }
  function checkUserR4(key, enc, id0) {
    if (enc.R === 2) return eq(rc4(key, PAD), enc.U, 32);
    var x = rc4(key, md5(concat(PAD, id0)));
    for (var i = 1; i <= 19; i++) { var k2 = new Uint8Array(key.length); for (var j = 0; j < key.length; j++) k2[j] = key[j] ^ i; x = rc4(k2, x); }
    return eq(x, enc.U, 16);
  }
  function ownerToUserR4(pw, enc) {
    var h = md5(padPw(pw)), n = enc.R === 2 ? 5 : enc.keyLen;
    if (enc.R >= 3) for (var i = 0; i < 50; i++) h = md5(h);
    var key = h.slice(0, n), data = enc.O.slice(0, 32);
    if (enc.R === 2) return rc4(key, data);
    for (var r = 19; r >= 0; r--) { var k2 = new Uint8Array(n); for (var j = 0; j < n; j++) k2[j] = key[j] ^ r; data = rc4(k2, data); }
    return data;
  }
  /* Algorithm 2.A / 2.B: R5 and R6 hashing */
  async function hashR6(pw, salt, udata, R) {
    var k = await sha('SHA-256', concat(pw, salt, udata));
    if (R === 5) return k;
    var i = 0, e = null;
    while (i < 64 || e[e.length - 1] > i - 32) {
      var unit = concat(pw, k, udata), k1 = new Uint8Array(unit.length * 64);
      for (var j = 0; j < 64; j++) k1.set(unit, j * unit.length);
      var ck = await importAes(k.slice(0, 16));
      var full = new Uint8Array(await subtle.encrypt({ name: 'AES-CBC', iv: k.slice(16, 32) }, ck, k1));
      e = full.subarray(0, k1.length);
      var sum = 0; for (var q = 0; q < 16; q++) sum += e[q];
      var m = sum % 3;
      k = await sha(m === 0 ? 'SHA-256' : m === 1 ? 'SHA-384' : 'SHA-512', e);
      i++;
    }
    return k.slice(0, 32);
  }
  async function keyR6(password, enc) {
    var pw = new TextEncoder().encode(password.normalize ? password.normalize('NFKC') : password).subarray(0, 127);
    var U = enc.U.subarray(0, 48), O = enc.O.subarray(0, 48);
    var h = await hashR6(pw, U.subarray(32, 40), new Uint8Array(0), enc.R);
    if (eq(h, U, 32)) {
      var ik = await hashR6(pw, U.subarray(40, 48), new Uint8Array(0), enc.R);
      return aesCbcRaw(await importAes(ik), new Uint8Array(16), enc.UE.subarray(0, 32));
    }
    var ho = await hashR6(pw, O.subarray(32, 40), U, enc.R);
    if (eq(ho, O, 32)) {
      var ok = await hashR6(pw, O.subarray(40, 48), U, enc.R);
      return aesCbcRaw(await importAes(ok), new Uint8Array(16), enc.OE.subarray(0, 32));
    }
    return null;
  }

  D.isEncrypted = function (bytes) {
    // Cheap scan for an /Encrypt trailer key; decryptPdf() double-checks with a real parse.
    return SP.util.indexOfBytes(bytes, SP.util.ascii('/Encrypt')) >= 0;
  };

  var queue = Promise.resolve();
  /** Returns decrypted PDF bytes, or null if the file turned out not to be encrypted.
      Throws Error with .code = 'password' | 'unsupported'. */
  D.decryptPdf = function (bytes, password) {
    var run = queue.then(function () { return decryptImpl(bytes, password || ''); });
    queue = run.catch(function () { /* keep queue alive */ });
    return run;
  };

  function err(code, msg) { var e = new Error(msg); e.code = code; return e; }

  async function decryptImpl(bytes, password) {
    var L = window.PDFLib;
    if (!subtle) throw err('unsupported', 'This browser has no WebCrypto, so encrypted PDFs cannot be rewritten.');
    var OSP = L.PDFObjectStreamParser, PP = L.PDFParser.prototype;
    var origFor = OSP.forStream, origHeader = PP.parseIndirectObjectHeader;
    var lastRef = null, objStms = [], ctx;
    PP.parseIndirectObjectHeader = function () { var r = origHeader.call(this); lastRef = r; return r; };
    OSP.forStream = function (raw) { objStms.push({ ref: lastRef, raw: raw }); return { parseIntoContext: function () { return Promise.resolve(); } }; };
    try {
      ctx = await L.PDFParser.forBytesWithOptions(bytes, Infinity, false, false).parseDocument();
    } finally { OSP.forStream = origFor; PP.parseIndirectObjectHeader = origHeader; }

    var encRef = ctx.trailerInfo.Encrypt, encDict = encRef ? ctx.lookup(encRef) : null;
    if (!encDict || !(encDict instanceof L.PDFDict)) return null;
    var N = function (k) { return L.PDFName.of(k); };
    var num = function (k, d) { var v = encDict.lookup(N(k)); return v instanceof L.PDFNumber ? v.asNumber() : d; };
    var str = function (d, k) { var v = d.lookup(N(k)); return v && v.asBytes ? v.asBytes() : null; };
    var filter = encDict.lookup(N('Filter'));
    if (!filter || filter.asString() !== '/Standard') throw err('unsupported', 'This PDF uses a non-standard security handler (' + (filter ? filter.asString() : 'none') + ').');
    var enc = { V: num('V', 0), R: num('R', 2), P: num('P', 0), O: str(encDict, 'O'), U: str(encDict, 'U'), OE: str(encDict, 'OE'), UE: str(encDict, 'UE'), keyLen: num('Length', 40) / 8, encryptMetadata: true, stm: 'V2', str: 'V2' };
    var em = encDict.lookup(N('EncryptMetadata'));
    if (em && em.asBoolean && em.asBoolean() === false) enc.encryptMetadata = false;
    if (enc.V >= 4) {
      var cf = encDict.lookup(N('CF')), stmF = encDict.lookup(N('StmF')), strF = encDict.lookup(N('StrF'));
      var method = function (nm) {
        if (!nm) return 'Identity';
        var name = nm.asString().slice(1);
        if (name === 'Identity') return 'Identity';
        var d = cf && cf.lookup(N(name)), cfm = d && d.lookup(N('CFM'));
        var m = cfm ? cfm.asString().slice(1) : 'None';
        if (m === 'AESV2' || m === 'AESV3' || m === 'V2') return m;
        if (m === 'None') return 'Identity';
        throw err('unsupported', 'Unsupported crypt filter ' + m + '.');
      };
      enc.stm = method(stmF); enc.str = method(strF);
      if (enc.V === 4) { var cfd = cf && stmF && cf.lookup(N(stmF.asString().slice(1))); var ln = cfd && cfd.lookup(N('Length')); if (ln) { var lv = ln.asNumber(); enc.keyLen = lv > 40 ? lv / 8 : lv; } if (!enc.keyLen || enc.keyLen < 5) enc.keyLen = 16; }
    }
    if (!enc.O || !enc.U) throw err('unsupported', 'The encryption dictionary is damaged.');
    var idArr = ctx.trailerInfo.ID ? ctx.lookup(ctx.trailerInfo.ID) : null;
    var id0 = new Uint8Array(0);
    if (idArr && idArr.size && idArr.size() > 0) { var first = idArr.lookup(0); if (first && first.asBytes) id0 = first.asBytes(); }

    var fileKey = null;
    if (enc.R >= 5) {
      if (!enc.UE || !enc.OE) throw err('unsupported', 'The AES-256 encryption dictionary is incomplete.');
      fileKey = await keyR6(password, enc);
    } else {
      var pw = latin1(password);
      var k1 = computeKeyR4(padPw(pw), enc, id0);
      if (checkUserR4(k1, enc, id0)) fileKey = k1;
      else {
        var upw = ownerToUserR4(pw, enc);
        var k2 = computeKeyR4(upw, enc, id0);
        if (checkUserR4(k2, enc, id0)) fileKey = k2;
      }
    }
    if (!fileKey) throw err('password', 'Incorrect password.');

    var keyCache = new Map();
    async function objKey(ref, aes) {
      if (enc.R >= 5) { if (!keyCache.has('v5')) keyCache.set('v5', await importAes(fileKey)); return keyCache.get('v5'); }
      var n = ref.objectNumber, g = ref.generationNumber;
      var extra = new Uint8Array([n & 255, (n >> 8) & 255, (n >> 16) & 255, g & 255, (g >> 8) & 255]);
      var k = md5(aes ? concat(fileKey, extra, latin1('sAlT')) : concat(fileKey, extra)).slice(0, Math.min(fileKey.length + 5, 16));
      return aes ? importAes(k) : k;
    }
    async function dec(data, ref, method) {
      if (method === 'Identity') return data;
      if (method === 'V2') return rc4(await objKey(ref, false), data);
      return aesDecryptPdf(await objKey(ref, true), data);
    }
    function toHex(b) { var s = ''; for (var i = 0; i < b.length; i++) s += (b[i] < 16 ? '0' : '') + b[i].toString(16); return s; }
    async function walk(obj, ref) {
      if (obj instanceof L.PDFString || obj instanceof L.PDFHexString) return L.PDFHexString.of(toHex(await dec(obj.asBytes(), ref, enc.str)));
      if (obj instanceof L.PDFArray) {
        for (var i = 0; i < obj.size(); i++) { var v = obj.get(i), nv = await walk(v, ref); if (nv !== v) obj.set(i, nv); }
        return obj;
      }
      if (obj instanceof L.PDFDict) {
        var ents = obj.entries();
        for (var j = 0; j < ents.length; j++) { var w = await walk(ents[j][1], ref); if (w !== ents[j][1]) obj.set(ents[j][0], w); }
        return obj;
      }
      return obj;
    }
    var all = ctx.enumerateIndirectObjects();
    for (var a = 0; a < all.length; a++) {
      var ref = all[a][0], obj = all[a][1];
      if (ref === encRef || obj === encDict) continue;
      if (obj instanceof L.PDFRawStream) {
        var type = obj.dict.lookup(N('Type')), tn = type && type.asString ? type.asString() : '';
        if (tn === '/XRef') continue;
        await walk(obj.dict, ref);
        if (!(tn === '/Metadata' && !enc.encryptMetadata)) obj.contents = await dec(obj.contents, ref, enc.stm);
      } else {
        await walk(obj, ref);
      }
    }
    // Object streams: decrypt as a whole, then expand (their members are not encrypted individually).
    for (var s = 0; s < objStms.length; s++) {
      var os = objStms[s];
      var plain = await dec(os.raw.contents, os.ref, enc.stm);
      var raw = L.PDFRawStream.of(os.raw.dict, plain);
      try { await origFor.call(OSP, raw).parseIntoContext(); } catch (e) { console.warn('Slop PDF: skipped a damaged object stream', e); }
    }
    ctx.trailerInfo.Encrypt = undefined;
    ctx.delete(encRef);
    var doc = new L.PDFDocument(ctx, true, false);
    if (!doc.getPageCount()) throw err('unsupported', 'No pages survived decryption.');
    return doc.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
  }
})();
