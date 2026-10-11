/* Slop EML: SlopCmd commands (the palette and the shortcuts) and the Menu button's items. Classic script; exposes
 * window.EmlCommands. Shortcuts go through SlopCmd only. Mod+P is left to the palette and the browser. */
(function () {
  'use strict';
  if (window.EmlCommands) return;
  const A = () => window.EmlApp;
  const X = () => window.EmlActions;
  const has = () => !!A().current();
  const hasHtml = () => has() && A().current().msg.html != null;
  const hasText = () => has() && A().current().msg.text != null;
  const hasCids = () => has() && window.EmlMime.cidRefs(A().current().msg.html) > 0;
  const many = () => A().docs().length > 1;

  function list() {
    const C = (id, title, group, keys, extra = {}) => Object.assign({ id: 'eml.' + id, title, group, keys, run: () => {} }, extra);
    return [
      C('open', 'Open message…', 'File', ['Mod+O'], { keywords: ['load', 'file', 'eml', 'picker', 'computer'], run: () => X().pick() }),
      C('print', 'Print message', 'File', [], { keywords: ['printer', 'paper', 'pdf'], when: has, run: () => X().print() }),
      C('pdf', 'Convert to PDF…', 'File', [], { keywords: ['pdf', 'save', 'export', 'document'], when: has, run: () => X().convertPdf() }),
      C('close', 'Close message', 'File', [], { keywords: ['tab', 'remove'], when: has, run: () => A().close(A().current().id) }),
      C('next', 'Next message', 'View', [], { keywords: ['tab', 'forward'], when: many, run: () => A().step(1) }),
      C('prev', 'Previous message', 'View', [], { keywords: ['tab', 'back'], when: many, run: () => A().step(-1) }),
      C('html', 'Show HTML body', 'View', [], { keywords: ['layout', 'rich'], when: () => hasHtml() && hasText(), run: () => A().setView('html') }),
      C('plain', 'Show plain text body', 'View', [], { keywords: ['text', 'plain'], when: () => hasHtml() && hasText(), run: () => A().setView('text') }),
      C('images', 'Show embedded images', 'View', [], { keywords: ['cid', 'inline', 'pictures', 'logo'], when: hasCids, run: () => A().toggleCids() }),
    ];
  }

  function register() {
    if (!window.SlopCmd) return;
    SlopCmd.init({ app: 'eml' });
    SlopCmd.register(list());
  }

  const key = (id) => (window.SlopCtx ? SlopCtx.keyFor('eml.' + id) : '');
  /** The Menu button: file actions, then the view. */
  function menuItems() {
    return [
      { label: 'Open message…', key: key('open'), act: () => X().pick() },
      '-',
      { label: 'Print message', disabled: !has(), act: () => X().print() },
      { label: 'Convert to PDF…', disabled: !has(), act: () => X().convertPdf() },
      '-',
      { label: 'Show HTML body', disabled: !(hasHtml() && hasText()), act: () => A().setView('html') },
      { label: 'Show plain text body', disabled: !(hasHtml() && hasText()), act: () => A().setView('text') },
      { label: 'Show embedded images', disabled: !hasCids(), act: () => A().toggleCids() },
      '-',
      { label: 'Next message', disabled: !many(), act: () => A().step(1) },
      { label: 'Previous message', disabled: !many(), act: () => A().step(-1) },
      { label: 'Close message', disabled: !has(), act: () => A().close(A().current().id) },
    ];
  }

  window.EmlCommands = { list, register, menuItems };
})();
