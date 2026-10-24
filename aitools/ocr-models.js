/* Slop AI Tools: the text recognition (OCR) models, the second family of the shared model chooser (shared/models/: catalog.js
 * ranks them, chooser.js is the dialog). Pure data (no DOM, no storage), so a Node test can load it (module.exports); the
 * browser gets window.SlopOcrModels, and model-registry.js adds MODELS to the model index.
 * Classic script: load shared/models/catalog.js, then this file, then model-registry.js (or this file later: it adds its
 * models to the index then, see shared/ocr/choose.js loadOcr).
 * PaddleOCR reads one script per recognition model. SCRIPTS is the one table of which languages each script group reads
 * (codes as in shared/speech/languages.js, plus zh-Hant for traditional Chinese); every model's languages come from it.
 * The bundled PP-OCRv4 model (Chinese and English, the first one Slop OCR had) is the quick model, always offered; the
 * others are PaddleOCR recognisers (PP-OCRv6 small for Latin script, Chinese and Japanese; PP-OCRv5 mobile for the other
 * scripts) on the slopographic/cdn repository at the release tag in shared/cdn/assets.js (load it first)
 * (models/ocr/<id>/, with manifest.json, the licence and SOURCE.md), each with the same PP-OCRv4 text detector
 * (models/ocr/ppocr-det-v4/) and its own dictionary. The worker (workers/infer.worker.js) knows the files by their ends:
 * *_det_infer.onnx the detector, the other .onnx the recogniser, the .txt the dictionary.
 * Exposes the catalog (shared/models/catalog.js create()) with rank('auto') listing every model, the quick one first,
 * plus SCRIPTS, scriptOf(code), modelFor(code), modelOfScript(script), CDN, QUICK. Each model lists its script groups
 * (scripts) and its languages (the union of theirs). */
(function (root, factory) {
  const catalog = root.SlopModelCatalog || (typeof module === 'object' && module.exports ? require('../shared/models/catalog.js') : null);
  const cdn = root.SlopCdn || (typeof module === 'object' && module.exports ? require('../shared/cdn/assets.js') : null);
  const api = factory(catalog, cdn);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.SlopOcrModels = api;
  // loaded after the model index (on demand): the index takes these models now
  if (root.SlopAIModels && root.SlopAIModels.add) root.SlopAIModels.add(api.MODELS);
})(typeof window !== 'undefined' ? window : globalThis, function (catalog, cdn) {
  'use strict';
  /** The models' folder in the cdn repository; every URL comes from shared/cdn/assets.js (jsDelivr, then GitHub). */
  const CDN = 'models/ocr/';
  const B = (id, name) => cdn.url(CDN + id + '/' + name);
  const HF = 'https://huggingface.co/';
  const QUICK = 'ppocr-v4';
  const PADDLE = 'https://github.com/PaddlePaddle/PaddleOCR';

  /** Which languages each script group's model reads. A language may sit in two groups (Serbian: Latin and Cyrillic). */
  const SCRIPTS = {
    latin: { name: 'Latin', languages: ['af', 'az', 'br', 'bs', 'ca', 'cs', 'cy', 'da', 'de', 'en', 'es', 'et', 'eu', 'fi', 'fo', 'fr', 'ga', 'gl', 'ha', 'hr', 'ht', 'hu', 'id', 'is', 'it', 'jw', 'la', 'lb', 'ln', 'lt', 'lv', 'mg', 'mi', 'ms', 'mt', 'nl', 'nn', 'no', 'oc', 'pl', 'pt', 'ro', 'sk', 'sl', 'sn', 'so', 'sq', 'sr', 'su', 'sv', 'sw', 'tk', 'tl', 'tr', 'uz'] },
    cyrillic: { name: 'Cyrillic', languages: ['ba', 'be', 'bg', 'kk', 'ky', 'mk', 'mn', 'ru', 'sr', 'tg', 'tt', 'uk'] },
    arabic: { name: 'Arabic', languages: ['ar', 'fa', 'ku', 'ps', 'sd', 'ug', 'ur'] },
    devanagari: { name: 'Devanagari', languages: ['hi', 'mr', 'ne', 'sa'] },
    korean: { name: 'Korean', languages: ['ko'] },
    cjk: { name: 'Chinese and Japanese', languages: ['zh', 'zh-Hant', 'ja', 'en'] },
    greek: { name: 'Greek', languages: ['el'] },
    thai: { name: 'Thai', languages: ['th'] },
    tamil: { name: 'Tamil', languages: ['ta'] },
    telugu: { name: 'Telugu', languages: ['te'] },
    han: { name: 'Chinese', languages: ['zh', 'en'] },
  };

  const DET = { name: 'ch_PP-OCRv4_det_infer.onnx', size: 4745517, sha256: 'd2a7720d45a54257208b1e13e36a8479894cb74155a5efe29462512d42f49da9', url: B('ppocr-det-v4', 'ch_PP-OCRv4_det_infer.onnx') };
  /** The recogniser and dictionary of each model, from models/ocr/<id>/manifest.json on the cdn. */
  const REC = {
    'ppocr-v6-small': [['PP-OCRv6_rec_small.onnx', 21234383, '6f327246b50388f3c176ae304bd95767ea6dc0c9ae92153ef8cbe210b3c14884'], ['ppocrv6_dict.txt', 74947, 'b5f2bfe2bdd9448429e3e82b51c789775d9b42f2403d082b00662eb77e401c5d']],
    'ppocr-v5-cyrillic': [['cyrillic_PP-OCRv5_rec_mobile.onnx', 8074092, '90f761b4bfcce0c8c561c0cb5c887b0971d3ec01c32164bdf7374a35b0982711'], ['ppocrv5_cyrillic_dict.txt', 2781, 'db40aa52ceb112055be80c694afdf655d5d2c4f7873704524cc16a447ca913ba']],
    'ppocr-v5-arabic': [['arabic_PP-OCRv5_rec_mobile.onnx', 8023828, 'c1192e632d0baa9146ae5b756a0e635e3dc63c1733737ebfd1629e87144e9295'], ['ppocrv5_arabic_dict.txt', 2369, '7f92f7dbb9b75a4787a83bfb4f6d14a8ab515525130c9d40a9036f61cf6999e9']],
    'ppocr-v5-devanagari': [['devanagari_PP-OCRv5_rec_mobile.onnx', 7940361, 'd6f0a906580e3fa6b324a318718f1f31f268b6ea8ef985f91c2012a37f52c91e'], ['ppocrv5_devanagari_dict.txt', 1943, '09c7440bfc5477e5c41052304b6b185aff8c4a5e8b2b4c23c1c706f6fe1ee9fc']],
    'ppocr-v5-korean': [['korean_PP-OCRv5_rec_mobile.onnx', 13488748, 'cd6e2ea50f6943ca7271eb8c56a877a5a90720b7047fe9c41a2e541a25773c9b'], ['ppocrv5_korean_dict.txt', 47451, 'a88071c68c01707489baa79ebe0405b7beb5cca229f4fc94cc3ef992328802d7']],
    'ppocr-v5-greek': [['el_PP-OCRv5_rec_mobile.onnx', 7832350, 'b4368bccd557123c702b7549fee6cd1e94b581337d1c9b65310f109131542b7f'], ['ppocrv5_el_dict.txt', 1103, '31defc62c0c3ad3674a82da6192226a2ba98ef4ff014a7045cb88d59f9c3de31']],
    'ppocr-v5-thai': [['th_PP-OCRv5_rec_mobile.onnx', 7915294, 'de541dd83161c241ff426f7ecfd602a0ba77d686cf3ab9a6c255ea82fd08006e'], ['ppocrv5_th_dict.txt', 1767, '57f5406f94bb6688fb7077f7be65f08bbd71cecf48c01ea26c522cb5c4836b7a']],
    'ppocr-v5-tamil': [['ta_PP-OCRv5_rec_mobile.onnx', 7909926, 'a42448808b7dea87597336f12438935f40353f1949e8360acd9e06b4da21bfe1'], ['ppocrv5_ta_dict.txt', 1723, '85b541352ae18dc6ba6d47152d8bf8adff6b0266e605d2eef2990c1bf466117b']],
    'ppocr-v5-telugu': [['te_PP-OCRv5_rec_mobile.onnx', 7923102, 'a3690451b50028a09a3316a1274f7c05728151ea3f8fd392696397a7fefcbd92'], ['ppocrv5_te_dict.txt', 1831, '42f83f5d3fdb50778e4fa5b66c58d99a59ab7792151c5e74f34b8ffd7b61c9d6']],
  };

  // speed and accuracy: 1 (low) to 5 (high), for the bars in the Language and model dialog.
  const META = [
    { id: 'ppocr-v6-small', scripts: ['latin', 'cjk'], name: 'Latin script, Chinese and Japanese (PP-OCRv6 small)', speed: 3, accuracy: 5,
      note: 'Swedish, German, French, Spanish, Polish, Czech, Romanian, Turkish and about 50 more languages in Latin letters with their accents (å, ä, ö, ß, ł, ș …), and Chinese (simplified and traditional) and Japanese.' },
    { id: 'ppocr-v5-cyrillic', scripts: ['cyrillic'], name: 'Cyrillic script (PP-OCRv5)', speed: 5, accuracy: 4,
      note: 'Russian, Ukrainian, Belarusian, Bulgarian, Serbian, Macedonian, Kazakh, Kyrgyz, Mongolian and more, and Latin letters among them.' },
    { id: 'ppocr-v5-arabic', scripts: ['arabic'], name: 'Arabic script (PP-OCRv5)', speed: 5, accuracy: 4,
      note: 'Arabic, Persian, Urdu, Pashto, Kurdish, Sindhi and Uyghur. Lines come out in reading order, right to left.' },
    { id: 'ppocr-v5-devanagari', scripts: ['devanagari'], name: 'Devanagari (PP-OCRv5)', speed: 5, accuracy: 4,
      note: 'Hindi, Marathi, Nepali and Sanskrit.' },
    { id: 'ppocr-v5-korean', scripts: ['korean'], name: 'Korean (PP-OCRv5)', speed: 4, accuracy: 4, note: 'Korean Hangul, with Latin letters and digits.' },
    { id: 'ppocr-v5-greek', scripts: ['greek'], name: 'Greek (PP-OCRv5)', speed: 5, accuracy: 4, note: 'Greek, with its accents, and Latin letters.' },
    { id: 'ppocr-v5-thai', scripts: ['thai'], name: 'Thai (PP-OCRv5)', speed: 5, accuracy: 4, note: 'Thai, with Latin letters and digits.' },
    { id: 'ppocr-v5-tamil', scripts: ['tamil'], name: 'Tamil (PP-OCRv5)', speed: 5, accuracy: 4, note: 'Tamil, with Latin letters and digits.' },
    { id: 'ppocr-v5-telugu', scripts: ['telugu'], name: 'Telugu (PP-OCRv5)', speed: 5, accuracy: 4, note: 'Telugu, with Latin letters and digits.' },
  ];

  /** The bundled model: the one every OCR page has used since the start, from Hugging Face (and its dictionary bundled). */
  const BUNDLED = {
    id: QUICK, name: 'PP-OCRv4 (text detection and recognition)', tool: 'ocr', arch: 'DB detector and CRNN recogniser (mobile, Chinese and Latin)',
    maker: 'PaddlePaddle (Baidu)', scripts: ['han'], languages: SCRIPTS.han.languages, only: false, speed: 5, accuracy: 3,
    note: 'Chinese and English, the quick first read. Reads other Latin-script text without its accents (a for å).',
    licence: 'Apache-2.0', upstream: PADDLE,
    source: HF + 'SWHL/RapidOCR', sourceNote: 'ONNX export of the PaddleOCR PP-OCRv4 mobile models, as published by RapidOCR.',
    files: [
      { name: 'ch_PP-OCRv4_det_infer.onnx', size: 4745517, sha256: 'd2a7720d45a54257208b1e13e36a8479894cb74155a5efe29462512d42f49da9', url: HF + 'SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_det_infer.onnx' },
      { name: 'ch_PP-OCRv4_rec_infer.onnx', size: 10857958, sha256: '48fc40f24f6d2a207a2b1091d3437eb3cc3eb6b676dc3ef9c37384005483683b', url: HF + 'SWHL/RapidOCR/resolve/main/PP-OCRv4/ch_PP-OCRv4_rec_infer.onnx' },
      { name: 'ppocr_keys_v1.txt', size: 26249, sha256: '28b2362ad4ab2dc38769aa72feb535e3a9ddb3fd2a7585a05920e6393b1dc7f7', path: 'vendor/models/ppocr_keys_v1.txt' },
    ],
  };

  /** The entries for the model index (model-registry.js): the same shape as every other model there. */
  const MODELS = [BUNDLED].concat(META.map((m) => ({
    id: m.id, name: m.name, tool: 'ocr', maker: 'PaddlePaddle (Baidu)', scripts: m.scripts, languages: [...new Set(m.scripts.flatMap((x) => SCRIPTS[x].languages))], only: false,
    speed: m.speed, accuracy: m.accuracy, note: m.note,
    arch: `PP-OCRv4 DB detector and ${m.id.startsWith('ppocr-v6') ? 'PP-OCRv6 small' : 'PP-OCRv5 mobile'} recogniser (${m.scripts.map((x) => SCRIPTS[x].name).join(', ')})`,
    licence: 'Apache-2.0', upstream: PADDLE, source: 'https://github.com/slopographic/cdn/tree/main/models/ocr/' + m.id,
    sourceNote: 'ONNX files from the RapidOCR model hub (modelscope.cn/models/RapidAI/RapidOCR, tag v3.10.0), kept on Slopographic\'s file host (github.com/slopographic/cdn) with their licence and SHA-256 checksums.',
    files: [DET].concat(REC[m.id].map(([name, size, sha256]) => ({ name, size, sha256, url: B(m.id, name) }))),
  })));

  const C = catalog.create({ family: 'ocr', models: MODELS, quick: QUICK });
  /** 'auto' (no language chosen): every model, the quick one first, so a script's model can be chosen without a language. */
  function rank(language) {
    if (language && language !== 'auto') return C.rank(language);
    return [{ model: C.byId(QUICK), badges: ['fastest'] }].concat(MODELS.filter((m) => m.id !== QUICK).map((model) => ({ model, badges: [] })));
  }
  /** The script groups a language is read by ([] when none). */
  const scriptOf = (code) => Object.keys(SCRIPTS).filter((s) => SCRIPTS[s].languages.includes(code));
  /** The best model for a script group (not the quick one), or null. */
  const modelOfScript = (script) => MODELS.find((m) => m.id !== QUICK && m.scripts.includes(script)) || null;
  /** The best model for a language (null when none reads it). */
  const modelFor = (code) => C.recommended(code) || (C.fits(C.byId(QUICK), code) ? C.byId(QUICK) : null);
  /** Every language code some model reads. */
  const CODES = [...new Set(MODELS.flatMap((m) => m.languages))];
  return { ...C, rank, SCRIPTS, CODES, scriptOf, modelFor, modelOfScript, CDN };
});
