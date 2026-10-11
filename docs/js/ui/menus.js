/* Slop Docs — ui/menus: the File, Edit, Format and Help menus in the top bar (SlopUI.menu). Every row is an action
 * from the command list, so the menu, the toolbar and the palette stay the same. Classic script. */
(function () {
  'use strict';
  const S = window.SlopDocs;
  const key = (id) => (window.SlopCmd ? window.SlopCmd.keyFor(id) : '');
  /** Run fn, then give focus back to the typing surface. */
  const act = (fn) => () => { try { fn(); } catch (e) { console.error(e); } if (S.focusIme) S.focusIme(); };
  const A = () => S.A;
  /** The saved templates, for File ▸ New ▸ My templates (the list is loaded by templates.js). */
  const mine = () => (S.tplList.length
    ? S.tplList.map((t) => ({ label: t.name, act: act(() => S.random.useDoc(t.doc)) }))
    : [{ label: 'No saved templates yet', disabled: true }]);

  S.menus = {
    file: () => [
      window.SlopDocsConfig ? window.SlopDocsConfig.menu() : null, '-',
      { label: 'New', sub: [
        { label: 'Blank document', key: key('file.new'), act: act(() => S.newDoc()) },
        { label: 'Random template…', key: key('file.random'), act: () => S.random.open() },
        '-',
        { label: 'My templates', sub: mine() },
      ] },
      { label: 'Open from Slop Drive…', key: key('file.open'), act: act(() => S.openFromDrive()), disabled: !window.SlopHub },
      '-',
      { label: 'Save to Slop Drive', key: key('file.save'), act: act(() => S.save()) },
      '-',
      { label: 'Download Word (.docx)', key: key('file.docx'), act: act(() => S.download('docx')) },
      { label: 'Download Markdown (.md)', key: key('file.md'), act: act(() => S.download('md')) },
      { label: 'Download plain text (.txt)', key: key('file.txt'), act: act(() => S.download('txt')) },
      { label: 'Download Slop Doc (.sdoc)', act: act(() => S.download('sdoc')) },
      '-',
      { label: 'Send to…', sub: S.sendItems ? S.sendItems() : [], disabled: !window.SlopHub },
      '-',
      { label: 'Print…', act: act(() => window.print()) },
    ],
    edit: () => [
      { label: 'Undo', key: key('edit.undo'), act: act(() => A().undo()), disabled: !S.canUndo() },
      { label: 'Redo', key: key('edit.redo'), act: act(() => A().redo()), disabled: !S.canRedo() },
      '-',
      { label: 'Select all', key: key('edit.selectAll'), act: act(() => A().selectAll()) },
    ],
    format: () => {
      const st = A().state();
      return [
        { label: 'Bold', key: key('format.bold'), check: st.b, act: act(() => A().toggle('b')) },
        { label: 'Italic', key: key('format.italic'), check: st.i, act: act(() => A().toggle('i')) },
        { label: 'Underline', key: key('format.underline'), check: st.u, act: act(() => A().toggle('u')) },
        '-',
        { label: 'Align', sub: [
          { label: 'Left', check: st.align === 'left', act: act(() => A().setAlign('left')) },
          { label: 'Centre', check: st.align === 'center', act: act(() => A().setAlign('center')) },
          { label: 'Right', check: st.align === 'right', act: act(() => A().setAlign('right')) },
          { label: 'Justify', check: st.align === 'justify', act: act(() => A().setAlign('justify')) },
        ] },
        { label: 'List', sub: [
          { label: 'Bulleted', key: key('format.bullets'), check: st.list === 'bul', act: act(() => A().toggleList('bul')) },
          { label: 'Numbered', key: key('format.numbers'), check: st.list === 'num', act: act(() => A().toggleList('num')) },
        ] },
        { label: 'Paragraph style', sub: [
          ['Normal', 'Normal text'], ['Title', 'Title'], ['H1', 'Heading 1'], ['H2', 'Heading 2'], ['H3', 'Heading 3'], ['Quote', 'Quote'], ['Code', 'Code'],
        ].map(([v, l]) => ({ label: l, check: st.style === v, act: act(() => A().setStyle(v)) })) },
        '-',
        { label: 'Clear formatting', key: key('format.clear'), act: act(() => A().clearFormat()) },
      ];
    },
    help: () => [
      { label: 'Search commands…', key: key('cmd.palette'), act: () => { if (window.SlopCmd) window.SlopCmd.open(); } },
      { label: 'Keyboard shortcuts…', act: () => { if (window.SlopCmd) window.SlopCmd.openKeymap(); } },
      '-',
      { label: 'About Slop Docs', act: () => { if (window.SlopUI) SlopUI.alert('Slop Docs', 'Your documents are stored in Slop Drive, in this browser. Nothing is uploaded, and there is no account or watermark.'); } },
    ],
  };

  /** Open a menu under its button. */
  S.openMenu = function (name, anchor) {
    if (!window.SlopUI || !S.menus[name]) return;
    const r = anchor.getBoundingClientRect();
    anchor.setAttribute('aria-expanded', 'true');
    SlopUI.menu(S.menus[name](), r.left, r.bottom + 4);
    const off = () => { anchor.setAttribute('aria-expanded', 'false'); };
    setTimeout(() => { const m = document.querySelector('.sui-menu'); if (!m) off(); else { const mo = new MutationObserver(() => { if (!document.querySelector('.sui-menu')) { off(); mo.disconnect(); } }); mo.observe(document.body, { childList: true }); } }, 0);
  };
  S.wireMenus = function () {
    for (const b of document.querySelectorAll('.menu-btn[data-menu]')) {
      b.addEventListener('click', (e) => { e.preventDefault(); S.openMenu(b.dataset.menu, b); });
    }
  };
})();
