/* Slop AI Tools: the model index. Every model the hub can use, with its licence, size, source and SHA-256.
 * Pure data and checks (no DOM, no storage), so a Node test can load it (module.exports) and the browser gets
 * window.SlopAIModels. Classic script. A remote file is downloaded only after the person presses Download and
 * confirms the licence (get-more.js); a bundled file ships with the site under vendor/models/.
 * Each file: { name, size, sha256, url } (remote) or { name, size, sha256, path } (bundled). See HANDOFF.md. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SlopAIModels = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /** Licences a model may declare, with the name shown to the person. Anything else is refused. */
  const LICENCES = {
    'MIT': 'MIT License',
    'Apache-2.0': 'Apache License 2.0',
    'BSD-3-Clause': 'BSD 3-Clause License',
  };
  /** Hosts a remote file may be served from: Hugging Face and its storage hosts. Checked on the final URL after redirects. */
  // Hugging Face serves a download from several storage hosts (cdn-lfs-us-1.hf.co, us.aws.cdn.hf.co, transfer.xethub.hf.co …),
  // and the set changes over time. So the rule is the domain family: huggingface.co, or any subdomain of hf.co or xethub.hf.co.
  const HOST_ROOTS = ['huggingface.co', 'hf.co', 'xethub.hf.co'];
  const HF = 'https://huggingface.co/';
  const SHA = /^[0-9a-f]{64}$/;

  const MODELS = [
    {
      id: 'whisper-tiny', name: 'Whisper tiny', tool: 'speech', arch: 'Transformer encoder-decoder, multilingual (39M parameters)',
      licence: 'MIT', upstream: 'https://github.com/openai/whisper',
      source: HF + 'Xenova/whisper-tiny', sourceNote: 'ONNX export of openai/whisper-tiny (quantised int8). The export page is tagged Apache-2.0; the weights are MIT.',
      files: [
        { name: 'encoder_model_quantized.onnx', size: 10124910, sha256: 'fd9d995b9dcb0520f0dbf6cf68651af639fc385f594d9d876e69ca2802dc438e', url: HF + 'Xenova/whisper-tiny/resolve/main/onnx/encoder_model_quantized.onnx' },
        { name: 'decoder_model_quantized.onnx', size: 30460101, sha256: 'd1ac41063dd0a01d278dca49214ff8ce1b930cc9e34e2881c56a79a428650534', url: HF + 'Xenova/whisper-tiny/resolve/main/onnx/decoder_model_quantized.onnx' },
        { name: 'vocab.json', size: 1036584, sha256: '50d6a919f0a0601d56a04eb583c780d18553aa388254ba3158eb6a00f13e2c1a', url: HF + 'Xenova/whisper-tiny/resolve/main/vocab.json' },
        { name: 'added_tokens.json', size: 2082, sha256: 'ce949fe720c14311cb6c446e69cfe340dc669d7b006077a6feed6ae571dd7e88', url: HF + 'Xenova/whisper-tiny/resolve/main/added_tokens.json' },
      ],
    },
    {
      id: 'ppocr-v4', name: 'PP-OCRv4 (text detection and recognition)', tool: 'ocr', arch: 'DB detector and CRNN recogniser (mobile, Chinese and Latin)',
      licence: 'Apache-2.0', upstream: 'https://github.com/PaddlePaddle/PaddleOCR',
      source: HF + 'SWHL/RapidOCR', sourceNote: 'ONNX export of the PaddleOCR PP-OCRv4 mobile models, as published by RapidOCR.',
      files: [
        { name: 'ch_PP-OCRv4_det_infer.onnx', size: 4745517, sha256: 'd2a7720d45a54257208b1e13e36a8479894cb74155a5efe29462512d42f49da9', url: HF + 'SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_det_infer.onnx' },
        { name: 'ch_PP-OCRv4_rec_infer.onnx', size: 10857958, sha256: '48fc40f24f6d2a207a2b1091d3437eb3cc3eb6b676dc3ef9c37384005483683b', url: HF + 'SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_rec_infer.onnx' },
        { name: 'ppocr_keys_v1.txt', size: 26249, sha256: '28b2362ad4ab2dc38769aa72feb535e3a9ddb3fd2a7585a05920e6393b1dc7f7', path: 'vendor/models/ppocr_keys_v1.txt' },
      ],
    },
    {
      id: 'mobilenetv3-l100', name: 'MobileNetV3 Large 100 (ImageNet tags)', tool: 'tags', arch: 'MobileNetV3 image classifier, 1000 ImageNet classes',
      licence: 'Apache-2.0', upstream: 'https://github.com/huggingface/pytorch-image-models',
      source: HF + 'onnxmodelzoo/mobilenetv3_large_100_Opset17', sourceNote: 'ONNX export (opset 17) of timm mobilenetv3_large_100 weights.',
      files: [
        { name: 'mobilenetv3_large_100_Opset17.onnx', size: 21919274, sha256: 'b0b785f44a068dee4ff35bd88b114d4fd17a8bd635816f8f0ee46fa8b196c29f', url: HF + 'onnxmodelzoo/mobilenetv3_large_100_Opset17/resolve/main/mobilenetv3_large_100_Opset17.onnx' },
        { name: 'imagenet-labels.json', size: 13489, sha256: '0507e07632759ad025d035ba6115d3bbae65dd4d83e01c0b294ad26bffb32979', path: 'vendor/models/imagenet-labels.json' },
      ],
    },
    {
      id: 'modnet-portrait', name: 'MODNet portrait matting (shared with Slop Isolate)', tool: 'portrait', arch: 'MODNet portrait matting network',
      licence: 'Apache-2.0', upstream: 'https://github.com/ZHKKKe/MODNet',
      source: 'vendor/models/modnet-portrait.onnx', sourceNote: 'Bundled with the site. The same file Slop Isolate uses (shared/cutout).',
      files: [
        { name: 'modnet-portrait.onnx', size: 25888640, sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9', path: 'vendor/models/modnet-portrait.onnx' },
      ],
    },
  ];

  const TOOLS = [
    { id: 'ocr', name: 'OCR', page: 'ocr/', models: ['ppocr-v4'], blurb: 'Read text from an image or a scanned PDF page.' },
    { id: 'speech', name: 'Speech to text', page: 'speech/', models: ['whisper-tiny'], blurb: 'Transcribe audio or a video, with timestamps. Exports .srt and .txt.' },
    { id: 'denoise', name: 'Denoise', page: 'denoise/', models: [], blurb: 'Median and bilateral filters with a before and after slider. No model needed.' },
    { id: 'tags', name: 'Auto tags', page: 'tags/', models: ['mobilenetv3-l100'], blurb: 'Suggest tags for a photo. You accept or edit them, then they are saved to Slop Drive.' },
    { id: 'portrait', name: 'Portrait blur', page: 'portrait/', models: ['modnet-portrait'], blurb: 'Blur the background of a portrait, with a strength slider.' },
  ];

  const byId = (id) => MODELS.find((m) => m.id === id) || null;
  const remoteFiles = (m) => m.files.filter((f) => !f.path);
  /** Total bytes a person would download for a model (bundled files excluded). */
  const downloadBytes = (m) => remoteFiles(m).reduce((n, f) => n + f.size, 0);

  /** Checks the whole index. Returns a list of problems (empty when the index is sound). */
  function problems(models = MODELS) {
    const out = [], ids = new Set();
    for (const m of models) {
      const who = `model ${m.id}`;
      if (!m.id || ids.has(m.id)) out.push(`${who}: id missing or repeated`);
      ids.add(m.id);
      if (!Object.prototype.hasOwnProperty.call(LICENCES, m.licence)) out.push(`${who}: licence "${m.licence}" is not on the list`);
      if (typeof m.upstream !== 'string' || !/^https:\/\//.test(m.upstream)) out.push(`${who}: upstream must be an https link`);
      if (!Array.isArray(m.files) || !m.files.length) out.push(`${who}: no files`);
      for (const f of m.files || []) {
        if (!SHA.test(f.sha256)) out.push(`${who}: ${f.name} sha256 must be 64 lowercase hex digits`);
        if (!Number.isInteger(f.size) || f.size < 1) out.push(`${who}: ${f.name} size must be a positive integer`);
        if (f.url !== undefined && !allowedUrl(f.url)) out.push(`${who}: ${f.name} url must be https on an allowed host`);
        if (f.url === undefined && f.path === undefined) out.push(`${who}: ${f.name} needs a url or a path`);
      }
    }
    for (const t of TOOLS) for (const id of t.models) if (!ids.has(id)) out.push(`tool ${t.id}: unknown model ${id}`);
    return out;
  }

  /** True when url is https and its host is HOST_ROOTS itself or a subdomain of one (never a look-alike such as hf.co.evil.com). */
  function allowedUrl(url) {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return false;
      return HOST_ROOTS.some((root) => u.hostname === root || u.hostname.endsWith('.' + root));
    } catch (e) { return false; }
  }

  /** Human size: 4.5 MB, 980 KB. */
  function formatSize(n) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
    return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
  }

  return { MODELS, TOOLS, LICENCES, HOST_ROOTS, byId, remoteFiles, downloadBytes, problems, allowedUrl, formatSize };
});
