/* Markdown to HTML for Slop Notes (and the .html export). Everything is escaped first, so typed HTML shows as text.
 * Supported: ATX headings, paragraphs, **bold**, *italic*, ~~strike~~, `code`, fenced code, > quotes, - * 1. lists,
 * - [ ] task items, --- rules, [links](url) and ![images](data:image/…;base64,…). Links only use http, https, mailto,
 * #, / and relative paths. Remote images are never loaded: they show their alt text. Nested lists are not supported. */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const FENCE = /^```/;
const HEAD = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR = /^ {0,3}([-*_])( *\1){2,}\s*$/;
const QUOTE = /^>/;
const LIST = /^\s*([-*+]|\d+\.)\s+(.*)$/;

/** A link target that is safe to put in href (the text is already escaped). */
function safeHref(u) {
  const t = u.trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return /^(https?:|mailto:)/i.test(t) ? t : '';
  return t;
}

/** Inline Markdown on one line of text. Code spans are pulled out first so their contents stay literal. */
export function inline(raw) {
  const spans = [];
  let s = String(raw).replace(/`([^`\n]+)`/g, (_, c) => { spans.push('<code>' + esc(c) + '</code>'); return '\u0001' + (spans.length - 1) + '\u0001'; });
  s = esc(s);
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (m, alt, url) => (/^data:image\/(png|jpe?g|gif|webp);base64,[a-z0-9+/=]+$/i.test(url) ? `<img alt="${alt}" src="${url}">` : alt));
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    const h = safeHref(url);
    return h ? `<a href="${h}" target="_blank" rel="noopener noreferrer">${text}</a>` : text;
  });
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>').replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');
  s = s.replace(/~~([^~\n]+?)~~/g, '<del>$1</del>');
  s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>').replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, '$1<em>$2</em>');
  return s.replace(/\u0001(\d+)\u0001/g, (m, i) => spans[+i]);
}

/** True when a line starts a block (so a paragraph stops before it). Same tests the block loop uses. */
const startsBlock = (l) => FENCE.test(l) || HEAD.test(l) || HR.test(l) || QUOTE.test(l) || LIST.test(l);

function listBlock(lines, i, out) {
  const ordered = /^\s*\d+\./.test(lines[i]);
  const items = [];
  while (i < lines.length) {
    const m = LIST.exec(lines[i]);
    if (!m || /\d/.test(m[1]) !== ordered) break;
    let text = m[2], task = '';
    const t = /^\[( |x|X)\]\s+(.*)$/.exec(text);
    if (t) { task = '<input type="checkbox" disabled' + (t[1] !== ' ' ? ' checked' : '') + '> '; text = t[2]; }
    items.push('<li>' + task + inline(text) + '</li>');
    i++;
  }
  const tag = ordered ? 'ol' : 'ul';
  out.push('<' + tag + '>' + items.join('') + '</' + tag + '>');
  return i;
}

/** Markdown source to an HTML string. */
export function render(src) {
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    let m;
    if (FENCE.test(line)) {
      const lang = line.slice(3).trim().split(/\s/)[0] || '';
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      out.push('<pre class="md-code"><code' + (lang ? ' class="language-' + esc(lang) + '"' : '') + '>' + esc(body.join('\n')) + '</code></pre>');
      continue;
    }
    if (!line.trim()) { i++; continue; }
    if ((m = HEAD.exec(line))) { const n = m[1].length; out.push('<h' + n + '>' + inline(m[2]) + '</h' + n + '>'); i++; continue; }
    if (HR.test(line)) { out.push('<hr>'); i++; continue; }
    if (QUOTE.test(line)) {
      const q = [];
      while (i < lines.length && QUOTE.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push('<blockquote>' + render(q.join('\n')) + '</blockquote>');
      continue;
    }
    if (LIST.test(line)) { i = listBlock(lines, i, out); continue; }
    const para = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) para.push(lines[i++]);
    out.push('<p>' + para.map(inline).join('<br>') + '</p>');
  }
  return out.join('\n');
}

export { esc };
