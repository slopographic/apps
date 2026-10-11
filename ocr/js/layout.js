/* Slop OCR: how OCR lines become text. Pure functions (no DOM), so the page and the tests use the same rules.
 *   groupLines(lines)           lines (reading order, { text, box }) → groups; a gap of more than 0.9 line heights starts a group
 *   linesToText(lines)          groups joined with "\n"; groups separated by a blank line (one paragraph per group)
 *   paragraphsOf(text)          the paragraphs of an edited text: blocks separated by blank lines, lines trimmed
 *   pairBoxes(text, lines)      each non-blank text line with the OCR box it was read from (for the searchable PDF)
 *                               lines past the last box are placed under it, one line height apart */

export function groupLines(lines) {
  if (!lines.length) return [];
  const hs = lines.map((l) => l.box.h).sort((a, b) => a - b);
  const median = hs[Math.floor(hs.length / 2)] || 1;
  const groups = [[lines[0]]];
  for (let i = 1; i < lines.length; i++) {
    const prev = lines[i - 1].box, cur = lines[i].box;
    const gap = cur.y - (prev.y + prev.h);
    if (gap > 0.9 * median) groups.push([lines[i]]);
    else groups[groups.length - 1].push(lines[i]);
  }
  return groups;
}

export function linesToText(lines) {
  return groupLines(lines)
    .map((g) => g.map((l) => l.text.trim()).filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n');
}

export function paragraphsOf(text) {
  return String(text || '')
    .split(/\n[ \t]*\n/)
    .map((block) => block.split('\n').map((l) => l.trim()).filter(Boolean).join('\n'))
    .filter(Boolean);
}

export function pairBoxes(text, lines) {
  const rows = String(text || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const boxes = lines.map((l) => l.box);
  const last = boxes[boxes.length - 1] || null;
  return rows.map((t, i) => {
    if (i < boxes.length) return { text: t, box: boxes[i] };
    if (!last) return { text: t, box: null };
    const k = i - boxes.length + 1;
    return { text: t, box: { x: last.x, y: last.y + k * last.h, w: last.w, h: last.h } };
  });
}
