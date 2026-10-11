/* Page ranges: "1-3, 5, 8-" → [1, 2, 3, 5, 8, ...]. 1-based, validated against the page count. Pure.
 * An empty spec means every page. */
export function parseRange(spec, count) {
  const text = String(spec ?? '').trim();
  if (!text) return Array.from({ length: count }, (_, i) => i + 1);
  const out = [];
  for (const raw of text.split(',')) {
    const part = raw.trim();
    if (!part) continue;
    const m = /^(\d*)\s*(-)?\s*(\d*)$/.exec(part);
    if (!m || (!m[1] && !m[3])) throw new Error(`“${part}” is not a page number or range. Use 1, 3-5 or 7-.`);
    const hasDash = !!m[2];
    const a = m[1] ? Number(m[1]) : 1;
    const b = hasDash ? (m[3] ? Number(m[3]) : count) : a;
    if (a < 1 || b < 1) throw new Error('Page numbers start at 1.');
    if (b < a) throw new Error(`“${part}” runs backwards.`);
    if (b > count) throw new Error(`Page ${b} is past the end. This file has ${count} page${count === 1 ? '' : 's'}.`);
    for (let p = a; p <= b; p++) out.push(p);
  }
  if (!out.length) throw new Error('No pages selected.');
  return out;
}
