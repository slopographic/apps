/* Slop Docs — io/pdf-text: one laid-out line as PDF text. Every font run of every frag (layout/runs.js, the same runs the
 * screen draws) becomes glyphs at the layout's own x:
 * - the document's faces: one glyph per character from the cmap, advanced by the same widths the layout measured;
 * - a language face: fontkit's shaped glyph run (joining forms, conjuncts, marks with their offsets), in visual order.
 * Glyphs go out as Identity-H glyph ids of a pdf-lib subset font (its ToUnicode map keeps the text searchable), in Tm/Tj
 * chunks: a new chunk starts wherever a glyph does not sit where the previous glyph's width would put it.
 * Highlight, underline, strike-through and link areas are added around the text.
 *   drawLine(ctx, page, it, pageH)   ctx: { PL, pdf, font(page, face) → { pf, name }, links: [] } */
import { fragRuns, visualChars } from '../layout/runs.js';
import { charWidth, vmetrics } from '../fonts/registry.js';

const rgbOf = (hex, PL) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '#000000')) || [0, '000000'], n = parseInt(m[1], 16);
  return PL.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
};
export { rgbOf };

/** A glyph that stands for no character of its own (the dots Noto Sans Arabic draws as separate marks) maps to U+034F,
 * the combining grapheme joiner, in the ToUnicode map: invisible, ignored by search, and not a stray control code. */
const CGJ = [0x34f];
/** The pdf-lib subset id of a glyph, as four hex digits (what CustomFontSubsetEmbedder.encodeText does for one glyph). */
function gidHex(pf, g) {
  const e = pf.embedder;
  let id = e.glyphIdMap.get(g.id);
  if (id === undefined) {
    id = e.subset.includeGlyph(g);
    e.glyphs[id - 1] = g.codePoints && g.codePoints.length ? g : Object.create(g, { codePoints: { value: CGJ } });
    e.glyphIdMap.set(g.id, id);
    e.glyphCache.invalidate();
  }
  pf.modified = true;
  return id.toString(16).padStart(4, '0');
}

/** Glyphs of one run at page coordinates: [{ g, x, y, adv }] (adv: the width the PDF's /W gives the glyph). */
function glyphsOf(pf, r, x, y, size) {
  const font = pf.embedder.font, sc = size / font.unitsPerEm, out = [];
  if (r.face.lang) {
    const run = font.layout(r.text, undefined, undefined, undefined, r.rtl ? 'rtl' : 'ltr');
    let pen = 0;
    run.glyphs.forEach((g, i) => {
      const p = run.positions[i];
      out.push({ g, x: x + (pen + p.xOffset) * sc, y: y + p.yOffset * sc, adv: g.advanceWidth * sc });
      pen += p.xAdvance;
    });
    return out;
  }
  let pen = x;
  for (const ch of visualChars(r.text, r.rtl)) {
    const cp = ch.codePointAt(0), g = font.glyphForCodePoint(cp);
    if (g && g.id) out.push({ g, x: pen, y, adv: g.advanceWidth * sc });
    pen += charWidth(r.face, cp, size);
  }
  return out;
}

function drawRun(ctx, page, r, x, y, size, m) {
  const { PL } = ctx, { pf, name } = ctx.font(page, r.face);
  const glyphs = glyphsOf(pf, r, x, y, size);
  if (!glyphs.length) return;
  const fam = r.face.fam, synthI = !!(fam && fam.user && m.i), synthB = !!(fam && fam.user && m.b);
  const col = rgbOf(m.color, PL);
  const ops = [PL.beginText(), PL.setFontAndSize(name, size), PL.setFillingRgbColor(col.red, col.green, col.blue)];
  // shaped text whose glyphs do not spell it in order (Arabic marks, Indic vowel signs before their consonant) also carries
  // its own text as ActualText, for readers that copy and search by it
  const spelled = glyphs.map((q) => String.fromCodePoint(...(q.g.codePoints || []))), logical = r.rtl ? spelled.reverse().join('') : spelled.join('');
  const actual = r.face.lang && logical !== r.text;
  if (actual) ops.unshift(PL.PDFOperator.of(PL.PDFOperatorNames.BeginMarkedContentSequence, [PL.PDFName.of('Span'), ctx.pdf.context.obj({ ActualText: PL.PDFHexString.fromText(r.text) })]));
  if (synthB) ops.push(PL.setTextRenderingMode(PL.TextRenderingMode.FillAndOutline), PL.setStrokingRgbColor(col.red, col.green, col.blue), PL.setLineWidth(size * 0.03));
  let cur = null;
  const flush = () => { if (cur) ops.push(PL.setTextMatrix(1, 0, synthI ? 0.2 : 0, 1, cur.x, cur.y), PL.showText(PL.PDFHexString.of(cur.hex))); };
  for (const q of glyphs) {
    if (cur && Math.abs(q.x - cur.next) < 0.01 && Math.abs(q.y - cur.y) < 0.001) { cur.hex += gidHex(pf, q.g); cur.next += q.adv; continue; }
    flush();
    cur = { x: q.x, y: q.y, hex: gidHex(pf, q.g), next: q.x + q.adv };
  }
  flush();
  ops.push(PL.endText());
  if (actual) ops.push(PL.endMarkedContent());
  page.pushOperators(...ops);
}

/** A line item (layout/blocks.js emitLines) on a pdf-lib page. */
export function drawLine(ctx, page, it, H) {
  const { PL } = ctx;
  for (const f of it.line.frags) {
    const runs = fragRuns(f);
    if (!runs.length) continue;
    const st = f.st, m = st.m || {}, size = st.size;
    const base = it.y + it.line.baseline + (st.dy || 0), y = H - base, x0 = it.x + f.x;
    const vm = vmetrics(st.face, size);
    if (m.hl) page.drawRectangle({ x: x0, y: y - vm.desc, width: f.w, height: vm.asc + vm.desc, color: rgbOf(m.hl, PL) });
    for (const r of runs) if (r.face) drawRun(ctx, page, r, x0 + r.dx, y, size, m);
    const t = st.face && st.face.ttf, upm = t ? t.upm : 1000;
    const thick = Math.max(0.4, ((t ? t.ulThick : 50) / upm) * size);
    if (m.u && f.kind !== 'label') page.drawRectangle({ x: x0, y: y + ((t ? t.ulPos : -100) / upm) * size - thick / 2, width: f.w, height: thick, color: rgbOf(m.color, PL) });
    if (m.s) page.drawRectangle({ x: x0, y: y + ((t ? t.xH : 500) / upm) * size * 0.5 - thick / 2, width: f.w, height: thick, color: rgbOf(m.color, PL) });
    if (m.link && f.kind !== 'label') ctx.links.push({ link: m.link, rect: [x0, y - vm.desc, x0 + f.w, y + vm.asc] });
  }
}
