/* SlopCutout model registry (classic script, page or worker). Sets self.SlopCutoutModels.
 * Files live in vendor/models/ (sources, licenses and hashes: vendor/models/README.md). Every model is
 * permissively licensed for commercial use. The sha256 is checked after each download. */
(function (root) {
  'use strict';
  const MODELS = {
    fast: {
      id: 'fast', name: 'Fast', arch: 'U²-Netp', file: 'u2netp.onnx', bytes: 4574105,
      sha256: '071286c4799087ffb7706481f2d970adb2ca2d70563f1d92f71e067fd4c8810c',
      input: 'input.1', size: [320, 320], mean: [0.485, 0.456, 0.406], std: [0.229, 0.224, 0.225], maxNorm: true, minMax: true,
      license: 'Apache-2.0', source: 'https://github.com/xuebinqin/U-2-Net',
      blurb: 'Small and quick (4.6 MB). Good for products and simple shapes.',
    },
    quality: {
      id: 'quality', name: 'Quality', arch: 'IS-Net (general use)', file: 'isnet-general-w8.onnx', bytes: 46535524,
      sha256: 'd26c429eb10cb83457239610a7cc4ccf21775e7bc18c16bc626c5bbf3b9743b8',
      input: 'input_image', size: [1024, 1024], mean: [0.5, 0.5, 0.5], std: [1, 1, 1], maxNorm: true, minMax: true,
      license: 'Apache-2.0', source: 'https://github.com/xuebinqin/DIS',
      blurb: 'Sharper edges and fine detail (47 MB, slower). Best for most photos.',
    },
    portrait: {
      id: 'portrait', name: 'Portrait', arch: 'MODNet', file: 'modnet-portrait.onnx', bytes: 25888640,
      sha256: '07c308cf0fc7e6e8b2065a12ed7fc07e1de8febb7dc7839d7b7f15dd66584df9',
      input: 'input', dynamic: { short: 512, multiple: 32, maxLong: 1024 }, mean: [0.5, 0.5, 0.5], std: [0.5, 0.5, 0.5], maxNorm: false, minMax: false,
      license: 'Apache-2.0', source: 'https://github.com/ZHKKKe/MODNet',
      blurb: 'People: hair-level matting for portraits (26 MB).',
    },
  };
  /** Model input size [w, h] for an image of w×h. */
  function inputSize(model, w, h) {
    const m = typeof model === 'string' ? MODELS[model] : model;
    if (m.size) return m.size.slice();
    const d = m.dynamic, k = d.short / Math.min(w, h);
    let tw = w * k, th = h * k;
    const long = Math.max(tw, th);
    if (long > d.maxLong) { const s = d.maxLong / long; tw *= s; th *= s; }
    const snap = (v) => Math.max(d.multiple, Math.round(v / d.multiple) * d.multiple);
    return [snap(tw), snap(th)];
  }
  root.SlopCutoutModels = { MODELS, inputSize, get: (id) => MODELS[id] || MODELS.fast, ids: Object.keys(MODELS) };
})(typeof self !== 'undefined' ? self : globalThis);
