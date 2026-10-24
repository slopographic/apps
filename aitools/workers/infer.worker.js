/* Slop AI Tools inference worker. Classic worker: every model runs here, never on the page's main thread.
 * Protocol (every message carries id): page → { id, type, data, transfer }, worker → { id, type: 'progress' | 'done' | 'error', data | message }.
 *   load       { model, files: { name: ArrayBuffer } }   builds the sessions for one model (kept until the page reloads)
 *   ocr        { bitmap, w, h }                            → { lines: [{ text, score, box }] }
 *   transcribe { model, samples: Float32Array (16 kHz mono), language }   → { segments, language, languages, windows, skipped }
 *   detect     { model, samples }                         → { languages: [{ code, p }] } (the first 30 s, most likely first)
 *   unload     { model }                                  frees a model's sessions (a big speech model when another is chosen)
 *   classify   { bitmap, w, h }                            → { tags: [{ label, p }] }
 * The page sends the model files it reads from IndexedDB or vendor/models/ (aitools/models.js). */
/* global importScripts, SlopAIOrt, SlopAIOcr, SlopAISpeech, SlopAITags */
'use strict';
importScripts('ort.js', 'ocr-engine.js', 'whisper-logits.js', 'whisper-quality.js', 'whisper-decode.js', 'whisper-longform.js', 'speech-engine.js', 'classify-engine.js');

const loaded = new Map();
const text = (buf) => new TextDecoder('utf-8').decode(buf);

/** Builds the sessions and tables a model needs. */
async function load(model, files) {
  if (loaded.has(model)) return { ok: true, model, cached: true };
  if (files['encoder_model_quantized.onnx']) {   // a Whisper model (speech-models.js): tiny, base, small, KB-Whisper ...
    const [encoder, decoder] = await Promise.all([SlopAIOrt.session(files['encoder_model_quantized.onnx']), SlopAIOrt.session(files['decoder_model_merged_quantized.onnx'] || files['decoder_model_quantized.onnx'])]);
    const vj = JSON.parse(text(files['vocab.json'])), vocab = [];
    for (const [tok, id] of Object.entries(vj)) vocab[id] = tok;
    const json = (n) => (files[n] ? JSON.parse(text(files[n])) : null);
    loaded.set(model, { speech: true, encoder, decoder, vocab, added: JSON.parse(text(files['added_tokens.json'])), config: json('config.json'), generation: json('generation_config.json') });
  } else if (model === 'ppocr-v4') {
    const [det, rec] = await Promise.all([SlopAIOrt.session(files['ch_PP-OCRv4_det_infer.onnx']), SlopAIOrt.session(files['ch_PP-OCRv4_rec_infer.onnx'])]);
    const dict = text(files['ppocr_keys_v1.txt']).replace(/\r/g, '').split('\n');
    if (dict[dict.length - 1] === '') dict.pop();
    loaded.set(model, { det, rec, chars: ['', ...dict, ' '] });
  } else if (model === 'mobilenetv3-l100') {
    const session = await SlopAIOrt.session(files['mobilenetv3_large_100_Opset17.onnx']);
    loaded.set(model, { session, labels: JSON.parse(text(files['imagenet-labels.json'])) });
  } else throw new Error('Unknown model ' + model);
  return { ok: true, model, cached: false };
}
function need(model) {
  const m = loaded.get(model);
  if (!m) throw new Error(model + ' is not loaded yet');
  return m;
}

const handlers = {
  load: (d) => load(d.model, d.files),
  ocr: async (d, progress) => {
    const m = need('ppocr-v4');
    const lines = await SlopAIOcr.run({ det: m.det, rec: m.rec }, m.chars, { bitmap: d.bitmap, w: d.w, h: d.h }, progress);
    return { lines };
  },
  transcribe: async (d, progress) => {
    const m = need(d.model || 'whisper-tiny');
    return SlopAISpeech.transcribe(m, d.samples, { language: d.language || 'auto', conditionPrevious: !!d.conditionPrevious }, progress);
  },
  detect: async (d) => ({ languages: await SlopAISpeech.detect(need(d.model || 'whisper-tiny'), d.samples) }),
  unload: async (d) => {
    const m = loaded.get(d.model);
    loaded.delete(d.model);
    if (m) for (const s of [m.encoder, m.decoder]) { try { if (s && s.release) await s.release(); } catch (e) { /* already gone */ } }
    return { ok: true };
  },
  classify: async (d) => {
    const m = need('mobilenetv3-l100');
    return { tags: await SlopAITags.classify(m.session, m.labels, d.bitmap, d.w, d.h) };
  },
};

self.onmessage = async (e) => {
  const { id, type, data } = e.data || {};
  const h = handlers[type];
  if (!h) { self.postMessage({ id, type: 'error', message: 'Unknown message ' + type }); return; }
  try {
    const out = await h(data || {}, (p) => self.postMessage({ id, type: 'progress', data: p }));
    self.postMessage({ id, type: 'done', data: out });
  } catch (err) {
    self.postMessage({ id, type: 'error', message: (err && err.message) || String(err) });
  }
};
