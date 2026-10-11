/* Slop AI Tools speech engine (classic script for infer.worker.js): Whisper tiny, ONNX, multilingual.
 * Pipeline: 30-second windows of 16 kHz mono audio → log-mel features (80 bins, Slaney filters, as Whisper)
 * → encoder → greedy decoder (no KV cache: the decoder reruns on the growing token list, which is fine for tiny)
 * → timestamp tokens become segment times. Byte-level BPE is decoded with vocab.json and the GPT-2 byte map.
 * Exposes self.SlopAISpeech = { transcribe(models, files, samples, opts, progress) }. */
(function (root) {
  'use strict';
  const SR = 16000, N_FFT = 400, HOP = 160, N_MELS = 80, CHUNK = 30 * SR, FRAMES = 3000, TS_STEP = 0.02, MAX_NEW = 220;

  /** Slaney-scale mel filterbank [N_MELS][N_FFT/2+1], normalised as librosa does for Whisper. */
  function melFilters() {
    const nb = N_FFT / 2 + 1, fmin = 0, fsp = 200 / 3, minLog = 1000, minLogMel = (minLog - fmin) / fsp, logstep = Math.log(6.4) / 27;
    const hz2mel = (f) => (f >= minLog ? minLogMel + Math.log(f / minLog) / logstep : (f - fmin) / fsp);
    const mel2hz = (m) => (m >= minLogMel ? minLog * Math.exp(logstep * (m - minLogMel)) : fmin + fsp * m);
    const lo = hz2mel(fmin), hi = hz2mel(SR / 2), pts = [];
    for (let i = 0; i < N_MELS + 2; i++) pts.push(mel2hz(lo + ((hi - lo) * i) / (N_MELS + 1)));
    const fftf = (i) => (SR / 2) * (i / (nb - 1));
    const w = [];
    for (let m = 0; m < N_MELS; m++) {
      const row = new Float32Array(nb), l = pts[m], c = pts[m + 1], r = pts[m + 2], enorm = 2 / (r - l);
      for (let k = 0; k < nb; k++) {
        const f = fftf(k), up = (f - l) / (c - l), down = (r - f) / (r - c);
        row[k] = Math.max(0, Math.min(up, down)) * enorm;
      }
      w.push(row);
    }
    return w;
  }
  let FILTERS = null, COS = null, SIN = null, WIN = null;
  function tables() {
    if (FILTERS) return;
    FILTERS = melFilters();
    WIN = new Float32Array(N_FFT);
    for (let n = 0; n < N_FFT; n++) WIN[n] = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / N_FFT);
    const nb = N_FFT / 2 + 1;
    COS = new Float32Array(nb * N_FFT); SIN = new Float32Array(nb * N_FFT);
    for (let k = 0; k < nb; k++) for (let n = 0; n < N_FFT; n++) { const a = (2 * Math.PI * k * n) / N_FFT; COS[k * N_FFT + n] = Math.cos(a); SIN[k * N_FFT + n] = Math.sin(a); }
  }
  /** Log-mel spectrogram of one window (padded to 30 s), as Float32Array [N_MELS * FRAMES] (row-major mel × frame). */
  function logMel(win) {
    tables();
    const pad = N_FFT / 2, len = CHUNK, x = new Float32Array(len + 2 * pad);
    x.set(win.subarray(0, Math.min(win.length, len)), pad);
    for (let i = 0; i < pad; i++) { x[pad - 1 - i] = x[pad + 1 + i]; x[pad + len + i] = x[pad + len - 2 - i]; } // reflect
    const nb = N_FFT / 2 + 1, mel = new Float32Array(N_MELS * FRAMES), frame = new Float32Array(N_FFT), pw = new Float32Array(nb);
    let mx = -Infinity;
    for (let f = 0; f < FRAMES; f++) {
      const s = f * HOP;
      for (let n = 0; n < N_FFT; n++) frame[n] = x[s + n] * WIN[n];
      for (let k = 0; k < nb; k++) {
        let re = 0, im = 0; const o = k * N_FFT;
        for (let n = 0; n < N_FFT; n++) { re += frame[n] * COS[o + n]; im -= frame[n] * SIN[o + n]; }
        pw[k] = re * re + im * im;
      }
      for (let m = 0; m < N_MELS; m++) {
        const row = FILTERS[m]; let acc = 0;
        for (let k = 0; k < nb; k++) acc += row[k] * pw[k];
        const v = Math.log10(Math.max(acc, 1e-10));
        mel[m * FRAMES + f] = v; if (v > mx) mx = v;
      }
    }
    for (let i = 0; i < mel.length; i++) mel[i] = (Math.max(mel[i], mx - 8) + 4) / 4;
    return mel;
  }

  /** Byte-level BPE decoding: GPT-2 maps each byte to one printable character. */
  function byteDecoder() {
    const bs = [], cs = [];
    for (let b = 33; b < 127; b++) bs.push(b); for (let b = 161; b < 173; b++) bs.push(b); for (let b = 174; b < 256; b++) bs.push(b);
    for (const b of bs) cs.push(b);
    let n = 0; for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n); n++; }
    const m = new Map(); bs.forEach((b, i) => m.set(String.fromCharCode(cs[i]), b));
    return m;
  }
  let BYTES = null;
  function decodeTokens(ids, vocab) {
    BYTES = BYTES || byteDecoder();
    const bytes = [];
    for (const id of ids) { const s = vocab[id]; if (s === undefined) continue; for (const ch of s) { const b = BYTES.get(ch); if (b !== undefined) bytes.push(b); } }
    return new TextDecoder('utf-8').decode(new Uint8Array(bytes));
  }

  /** The special token ids: start, end (in vocab.json), transcribe, and the first timestamp (just after notimestamps). */
  function specials(added, vocab) {
    const need = ['<|startoftranscript|>', '<|transcribe|>', '<|notimestamps|>'];
    for (const k of need) if (added[k] === undefined) throw new Error('Whisper tokens are missing ' + k);
    const eot = vocab.indexOf('<|endoftext|>');
    if (eot < 0) throw new Error('Whisper vocabulary is missing <|endoftext|>');
    const langs = Object.entries(added).filter(([k, v]) => /^<\|[a-z]{2,3}\|>$/.test(k) && v > added['<|startoftranscript|>'] && v < added['<|transcribe|>']).map(([k, v]) => ({ code: k.slice(2, -2), id: v }));
    return { sot: added['<|startoftranscript|>'], eot, transcribe: added['<|transcribe|>'], ts0: added['<|notimestamps|>'] + 1, langs };
  }

  /** Turns decoded tokens into timed segments. Timestamp tokens open and close segments. */
  function segmentsOf(ids, S, vocab, offset) {
    const out = [];
    let start = null, buf = [];
    const flush = (end) => { const text = decodeTokens(buf, vocab).trim(); if (text && start !== null) out.push({ start: offset + start, end: offset + Math.max(end, start + 0.2), text }); buf = []; };
    for (const id of ids) {
      if (id >= S.ts0) {
        const t = (id - S.ts0) * TS_STEP;
        if (start === null) start = t;
        else if (buf.length) { flush(t); start = t; } else start = t;
      } else if (id < S.eot) { if (start === null) start = 0; buf.push(id); }
    }
    if (buf.length) flush(start === null ? CHUNK / SR : start + 2);
    return out;
  }

  /** One decoder pass over the tokens so far: the logits of the last position. */
  async function nextLogits(ort, decoder, tokens, enc) {
    const ids = new ort.Tensor('int64', BigInt64Array.from(tokens.map((t) => BigInt(t))), [1, tokens.length]);
    const out = await decoder.run({ [decoder.inputNames[0]]: ids, [decoder.inputNames[1]]: enc });
    const t = out[decoder.outputNames[0]], V = t.dims[2], o = (tokens.length - 1) * V;
    return { data: t.data, o, V };
  }
  /** Language with the highest score after the start token, among the Whisper language tokens. */
  function detectLanguage(logits, S) {
    let best = S.langs[0], bv = -Infinity;
    for (const l of S.langs) { const v = logits.data[logits.o + l.id]; if (v > bv) { bv = v; best = l; } }
    return best;
  }
  /** Greedy decoding with the prompt, suppressing special tokens other than end and timestamps. */
  async function decodeWindow(ort, models, S, enc, prompt) {
    const toks = prompt.slice();
    for (let step = 0; step < MAX_NEW; step++) {
      const lg = await nextLogits(ort, models.decoder, toks, enc);
      let best = -1, bv = -Infinity;
      for (let v = 0; v < lg.V; v++) {
        if (v >= S.eot && v < S.ts0 && v !== S.eot) continue;
        const x = lg.data[lg.o + v];
        if (x > bv) { bv = x; best = v; }
      }
      if (best === S.eot || best < 0) break;
      toks.push(best);
    }
    return toks.slice(prompt.length);
  }

  /**
   * Transcribes samples (Float32Array, 16 kHz mono). opts: { language: 'auto' | code }. Calls progress({ done, total })
   * per 30-second window. Resolves { segments: [{start, end, text}], language, windows }.
   */
  async function transcribe(models, samples, opts, progress) {
    const ort = await root.SlopAIOrt.get();
    const S = specials(models.added, models.vocab);
    const windows = Math.max(1, Math.ceil(samples.length / CHUNK));
    const segs = [];
    let language = null;
    for (let w = 0; w < windows; w++) {
      progress({ done: w, total: windows });
      const win = samples.subarray(w * CHUNK, Math.min(samples.length, (w + 1) * CHUNK));
      if (w > 0 && win.length < SR) break;
      const mel = logMel(win);
      const feats = new ort.Tensor('float32', mel, [1, N_MELS, FRAMES]);
      const enc = (await models.encoder.run({ [models.encoder.inputNames[0]]: feats }))[models.encoder.outputNames[0]];
      if (!language) {
        if (opts.language && opts.language !== 'auto') { const l = S.langs.find((x) => x.code === opts.language); language = l || S.langs.find((x) => x.code === 'en'); }
        else language = detectLanguage(await nextLogits(ort, models.decoder, [S.sot], enc), S);
      }
      const ids = await decodeWindow(ort, models, S, enc, [S.sot, language.id, S.transcribe]);
      segs.push(...segmentsOf(ids, S, models.vocab, w * (CHUNK / SR)));
    }
    progress({ done: windows, total: windows });
    return { segments: segs, language: language ? language.code : 'en', windows };
  }

  root.SlopAISpeech = { transcribe, logMel, melFilters, decodeTokens, segmentsOf, specials };
})(self);
