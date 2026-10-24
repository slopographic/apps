/* JSON Lines (.jsonl, .ndjson: one JSON value per line) to and from a JSON array. Pure (no DOM).
 *   jsonlToJson(text, { indent }) -> text     blank lines are skipped; a bad line is named with its line number and the
 *                                             place of the mistake (structured.js parseJson)
 *   jsonToJsonl(text) -> { text, count }      an array gives one line per item; any other value is one line */
import { parseJson, formatJson } from './structured.js';

export function jsonlToJson(text, { indent = 2 } = {}) {
  const lines = String(text).replace(/^\uFEFF/, '').split(/\r?\n/);
  const items = [];
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    try { items.push(JSON.parse(line)); } catch (e) {
      let why = '';
      try { parseJson(line); } catch (err) { why = err.message.replace(/^This is not valid JSON:?\s*/, '').replace(/line 1, /, '').replace(/^\.\s*/, ''); }
      throw new Error(`Line ${i + 1} is not valid JSON${why ? `: ${why}` : '.'}`);
    }
  });
  if (!items.length) throw new Error('The file is empty: there are no JSON lines to read.');
  return formatJson(JSON.stringify(items), { indent });
}

export function jsonToJsonl(text) {
  const v = parseJson(text);
  const items = Array.isArray(v) ? v : [v];
  return { text: items.map((x) => JSON.stringify(x)).join('\n') + (items.length ? '\n' : ''), count: items.length };
}
