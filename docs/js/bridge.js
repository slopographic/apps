/* Slop Docs — bridge: the ES-module engine, exposed as window.SlopDocEngine for the classic UI scripts in
 * docs/js/ui/ (classic scripts cannot import modules). Loaded first, as a deferred module, so it runs
 * before the deferred UI scripts. Fires 'slopdocs:engine' when ready. */
import * as M from './model/doc.js';
import * as S from './model/styles.js';
import * as O from './model/ops.js';
import * as F from './fonts/registry.js';
import { layoutDoc } from './layout/index.js';
import { resolvedProps, clearParaCache } from './layout/para.js';
import { marksAt } from './model/ops.js';
import * as SD from './io/sdoc.js';
import * as DX from './io/docx.js';

/** Load every face the document's runs use (the layout falls back to nearby faces until they arrive). */
async function ensureDocFonts(doc) {
  const seen = new Map();
  for (const b of M.docBlocks(doc)) {
    if (b.type !== 'p') continue;
    for (const r of b.runs || []) {
      if (r.obj) continue;
      const m = S.runMarks(doc, b, r), k = `${m.font}|${!!m.b}|${!!m.i}`;
      if (!seen.has(k)) seen.set(k, { font: m.font, b: !!m.b, i: !!m.i });
    }
  }
  await F.ensureFaces([...seen.values()]);
}

// a face that finishes loading changes the metrics: drop cached paragraph layouts and let the UI re-lay out
F.onFontLoad(() => { clearParaCache(); window.dispatchEvent(new Event('slopdocs:fonts')); });

window.SlopDocEngine = {
  M, S, O, F, SD, DX,
  layoutDoc, resolvedProps, marksAt, ensureDocFonts, clearParaCache,
  textWidth: F.textWidth, vmetrics: F.vmetrics, bestFace: F.bestFace, familyOf: F.familyOf, cssFamily: F.cssFamily,
  FAMILIES: F.FAMILIES, onFontLoad: F.onFontLoad,
  ready: true,
};
document.dispatchEvent(new Event('slopdocs:engine'));
