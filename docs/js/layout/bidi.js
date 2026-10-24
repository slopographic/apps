/* Slop Docs — layout/bidi: right-to-left and mixed-direction lines. Lines are broken in logical order (lines.js); this
 * pass then puts each line's pieces where they show. A paragraph's direction is its first strong character (as HTML's
 * dir="auto"): an Arabic or Hebrew paragraph is laid out from the right, so its start alignment, indents and list label
 * are mirrored. Inside a line, the levels come from SlopBidi (shared/fonts/bidi.js, UAX #9); text frags are cut where
 * the level changes and the pieces are reordered (rule L2); bracket pairs follow rule N0 (pairBrackets). A piece at an odd level is right-to-left (frag.rtl): its
 * text stays in logical order, and the screen (dir="rtl") and the PDF (fontkit, or reversed characters) draw it
 * reversed. Tabs, labels and objects keep the paragraph level and split the line into separately ordered segments.
 *   paraRtl(text) → true for a right-to-left paragraph · bidiLine(line, rtl, width) rewrites line.frags in visual order */
import { textWidth } from '../fonts/registry.js';

const RTL_CHARS = /[\u0590-\u08ff\ufb1d-\ufdff\ufe70-\ufefc]/;
const SEG = new Set(['text', 'space']);
const B = () => globalThis.SlopBidi || null;
export const hasRtl = (s) => RTL_CHARS.test(s || '');
export function paraRtl(text) { const b = B(); return !!b && hasRtl(text) && b.baseOf(text) === 'rtl'; }

/** L2: reverse every run at or above each level, from the highest level down to the lowest odd one. */
export function reorder(items) {
  if (!items.length) return items;
  const lv = items.map((x) => x.level), max = Math.max(...lv);
  const odd = lv.filter((l) => l % 2);
  const minOdd = odd.length ? Math.min(...odd) : max + 1;
  let out = items.slice();
  for (let k = max; k >= minOdd && k >= 1; k--) {
    const next = [];
    for (let i = 0; i < out.length;) {
      if (out[i].level < k) { next.push(out[i++]); continue; }
      let j = i;
      while (j < out.length && out[j].level >= k) j++;
      next.push(...out.slice(i, j).reverse());
      i = j;
    }
    out = next;
  }
  return out;
}

const OPEN = { 0x28: 0x29, 0x5b: 0x5d, 0x7b: 0x7d, 0xab: 0xbb, 0x2039: 0x203a };
/** N0, the paired-bracket rule SlopBidi leaves out: a bracket pair takes the direction of the strong text inside it (the
 * embedding direction first; the other one when the text before the pair has it too), so "(عربي)" in English text keeps
 * both brackets with the Arabic. Changes lv in place. */
export function pairBrackets(cps, lv, base, typeOf) {
  const e = base % 2 ? 'R' : 'L', dir = (t) => (t === 'L' ? 'L' : t === 'R' || t === 'AL' || t === 'EN' || t === 'AN' ? 'R' : null);
  const stack = [], pairs = [];
  cps.forEach((cp, i) => {
    if (OPEN[cp]) { if (stack.length < 63) stack.push([OPEN[cp], i]); return; }
    for (let k = stack.length - 1; k >= 0; k--) if (stack[k][0] === cp) { pairs.push([stack[k][1], i]); stack.length = k; break; }
  });
  for (const [o, c] of pairs.sort((a, b) => a[0] - b[0])) {
    const inside = new Set();
    for (let k = o + 1; k < c; k++) { const d = dir(typeOf(cps[k])); if (d) inside.add(d); }
    let d = null;
    if (inside.has(e)) d = e;
    else if (inside.size) {
      let before = e;
      for (let k = o - 1; k >= 0; k--) { const t = dir(typeOf(cps[k])); if (t) { before = t; break; } }
      d = before === e ? e : before;
    }
    if (!d) continue;
    const level = d === 'R' ? (base % 2 ? base : base + 1) : (base % 2 ? base + 1 : base);
    lv[o] = level; lv[c] = level;
  }
  return lv;
}

/** One segment (consecutive text and space frags): cut at level changes, reorder, and place from its visual left edge. */
function segment(frs, base, width, rtl, bidi) {
  const cps = [];
  for (const f of frs) for (const ch of f.atomic ? [f.text[0] || ' '] : f.text) cps.push(ch.codePointAt(0));
  const lv = pairBrackets(cps, bidi.levels(cps, base), base, bidi.typeOf);
  const pieces = [];
  let k = 0;
  for (const f of frs) {
    if (f.atomic) { pieces.push({ f, level: lv[k++], whole: true }); continue; }
    if (!f.text) { pieces.push({ f, level: base, whole: true }); continue; }
    let cur = null, off = f.start;
    for (const ch of f.text) {
      const l = lv[k++];
      if (!cur || cur.level !== l) pieces.push((cur = { f, level: l, text: '', start: off }));
      cur.text += ch; off += ch.length; cur.end = off;
    }
    if (cur && pieces.filter((p) => p.f === f).length === 1) { cur.whole = true; }
  }
  if (!rtl && pieces.every((p) => p.level === 0)) return frs;
  const last = frs[frs.length - 1], x0 = frs[0].x, x1 = last.x + last.w;
  let x = rtl ? width - x1 : x0;
  return reorder(pieces).map((p) => {
    const f = p.f, w = p.whole ? f.w : textWidth(f.st.face, p.text, f.st.size);
    const out = p.whole ? { ...f, x, rtl: p.level % 2 === 1 } : { ...f, text: p.text, start: p.start, end: p.end, w, x, rtl: p.level % 2 === 1 };
    x += w;
    return out;
  });
}

export function bidiLine(line, rtl, width) {
  const bidi = B(), fr = line.frags;
  line.startX = rtl ? width - line.left - (line.shift || 0) : line.left + (line.shift || 0);
  if (!bidi || (!rtl && !fr.some((f) => SEG.has(f.kind) && hasRtl(f.text)))) return line;
  const base = rtl ? 1 : 0, out = [];
  for (let i = 0; i < fr.length;) {
    if (!SEG.has(fr[i].kind)) { const f = fr[i++]; out.push(rtl ? { ...f, x: width - f.x - f.w } : f); continue; }
    let j = i;
    while (j < fr.length && SEG.has(fr[j].kind)) j++;
    out.push(...segment(fr.slice(i, j), base, width, rtl, bidi));
    i = j;
  }
  line.frags = out;
  line.rtl = rtl;
  return line;
}
