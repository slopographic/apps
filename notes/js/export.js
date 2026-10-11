/* Export a note as Markdown (.md, the body as it is) or as one standalone HTML page (.html, rendered, styles inline).
 * Nothing is uploaded: the file is made in the page and downloaded through SlopUI.download. */
import { render, esc } from './markdown.js';

const PAGE_CSS = 'body{max-width:44em;margin:2.5em auto;padding:0 16px;font:17px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#1d1c19;background:#fbfaf6}' +
  'h1,h2,h3{line-height:1.25}code{font:0.9em ui-monospace,Menlo,Consolas,monospace;background:#f1efe8;padding:0.1em 0.3em;border-radius:4px}' +
  'pre{background:#f1efe8;padding:12px;border-radius:8px;overflow:auto}pre code{background:none;padding:0}blockquote{margin:0;padding-left:14px;border-left:3px solid #b6b09f;color:#5f5b52}' +
  'img{max-width:100%}a{color:#3d6b00}';

/** A file name from a title: no slashes or control characters, short. */
export function fileBase(title) {
  return String(title || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Untitled';
}

export function noteToMarkdown(n) {
  return new Blob([n.body || ''], { type: 'text/markdown;charset=utf-8' });
}

export function noteToHtml(n) {
  const title = n.title || 'Untitled';
  const doc = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<meta name="generator" content="Slop Notes">\n<title>' + esc(title) + '</title>\n<style>' + PAGE_CSS + '</style>\n</head>\n<body>\n<article>\n' +
    render(n.body || '') + '\n</article>\n</body>\n</html>\n';
  return new Blob([doc], { type: 'text/html;charset=utf-8' });
}

/** Downloads the note in the given format ('md' or 'html'). Returns the file name. */
export function download(n, format) {
  const name = fileBase(n.title) + '.' + (format === 'html' ? 'html' : 'md');
  const blob = format === 'html' ? noteToHtml(n) : noteToMarkdown(n);
  SlopUI.download(blob, name);
  return name;
}
