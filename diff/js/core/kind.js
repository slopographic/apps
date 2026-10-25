/* Slop Compare: what two inputs are compared as, and the words for a result. Pure.
 *   kindOf(name, type) → 'pdf' | 'image' | 'json' | 'csv' | 'text' | ''   ('' : not something Slop Compare reads)
 *   modeOf(kA, kB, forced) → the comparison: forced ('text', 'json', 'csv') when given and both sides are text; else
 *     pdf and pdf, image and image, json and json, csv (or tsv) and csv; any other pair of texts is text; null when the two
 *     cannot be compared (a PDF and a picture)
 *   changes(result) → how many changes Next and Previous walk   summary(result) → one sentence
 *   TEXT_EXTS: the extensions read as text (code, markup, config, logs) */
export const TEXT_EXTS = ['txt', 'md', 'markdown', 'log', 'ini', 'cfg', 'conf', 'toml', 'yaml', 'yml', 'xml', 'html', 'htm', 'css', 'scss',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'json', 'jsonl', 'csv', 'tsv', 'py', 'rb', 'go', 'rs', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'cs',
  'php', 'sh', 'bash', 'ps1', 'sql', 'swift', 'lua', 'r', 'pl', 'vue', 'svelte', 'tex', 'srt', 'vtt', 'env', 'gitignore', 'diff', 'patch', 'svg'];
const IMAGE = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'];

const extOf = (name) => { const m = /\.([A-Za-z0-9]+)$/.exec(String(name || '')); return m ? m[1].toLowerCase() : ''; };

export function kindOf(name, type = '') {
  const e = extOf(name), t = String(type || '').toLowerCase();
  if (e === 'pdf' || t === 'application/pdf') return 'pdf';
  if (e === 'svg') return 'text';
  if (IMAGE.includes(e) || (t.startsWith('image/') && t !== 'image/svg+xml')) return 'image';
  if (e === 'json' || t === 'application/json') return 'json';
  if (e === 'csv' || e === 'tsv' || t === 'text/csv' || t === 'text/tab-separated-values') return 'csv';
  if (TEXT_EXTS.includes(e) || t.startsWith('text/') || /(json|xml|javascript|yaml|toml|x-sh|sql)/.test(t)) return 'text';
  if (!e && !t) return 'text';   // a pasted text or a file with no name
  return '';
}

export function modeOf(kA, kB, forced = 'auto') {
  const texty = (k) => k === 'text' || k === 'json' || k === 'csv';
  if (texty(kA) && texty(kB)) {
    if (forced && forced !== 'auto') return forced;
    return kA === kB ? kA : 'text';
  }
  if (kA === kB && (kA === 'pdf' || kA === 'image')) return kA;
  return null;
}

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

export function changes(r) {
  if (!r) return 0;
  if (r.kind === 'json') return r.json.entries.length;
  if (r.kind === 'csv') return r.csv.rows.filter((x) => x.t !== 'eq').length;
  if (r.kind === 'image') return r.image.boxes.length;
  if (r.kind === 'pdf' && r.view === 'visual') return r.pdf.visual.filter((p) => p.count > 0).length;
  return r.text.blocks.length + (r.text.stats.newlineOnly ? 1 : 0);
}

export function summary(r) {
  if (!r) return '';
  const n = changes(r);
  if (r.kind === 'json') {
    const s = r.json.stats;
    return n ? `${plural(n, 'difference')}: ${s.added} added, ${s.removed} removed, ${s.changed} changed.` : 'The two JSON documents hold the same data.';
  }
  if (r.kind === 'csv') {
    const s = r.csv.stats, cols = r.csv.added.length + r.csv.removed.length;
    const rows = n ? `${plural(n, 'row')} differ: ${s.added} added, ${s.removed} removed, ${s.changed} changed (${plural(s.cells, 'cell')}).` : 'Every row is the same.';
    return rows + (cols ? ` Columns: ${r.csv.added.length} added, ${r.csv.removed.length} removed.` : '') + (r.csv.key ? ` Rows matched by ${r.csv.key}.` : '');
  }
  if (r.kind === 'image') {
    const p = r.image.ratio * 100;
    return n ? `${plural(n, 'changed area')}, ${p < 0.1 ? 'under 0.1' : p.toFixed(1)}% of the pixels.` : 'The pictures look the same at this threshold.';
  }
  if (r.kind === 'pdf' && r.view === 'visual') {
    return n ? `${plural(n, 'page')} of ${Math.max(r.pdf.pagesA, r.pdf.pagesB)} ${n === 1 ? 'looks' : 'look'} different.` : 'Every page looks the same at this threshold.';
  }
  const s = r.text.stats;
  if (!n) return r.kind === 'pdf' ? 'The text of the two PDFs is the same.' : 'The two texts are the same.';
  if (s.newlineOnly) return 'The texts differ only in the line break at the end.';
  return `${plural(n, 'change')}: +${s.added} −${s.removed} lines${s.changed ? ` (${plural(s.changed, 'line')} changed in place)` : ''}.`;
}
