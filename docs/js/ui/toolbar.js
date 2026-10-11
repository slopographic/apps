/* Slop Docs — ui/toolbar: the formatting toolbar and the status bar. Controls call SlopDocs.A and never change the
 * document themselves; after every change the controls are read back from A.state() ('view' event). Classic script. */
(function () {
  'use strict';
  const S = window.SlopDocs, $ = (id) => document.getElementById(id);
  const E = () => window.SlopDocEngine;

  /** Fill the font list from the engine's families (names a Word user knows, plus the built-in ones). */
  function fillFonts() {
    const sel = $('selFont');
    const names = (E().FAMILIES || []).map((f) => f.name);
    sel.replaceChildren(...names.map((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; return o; }));
  }
  /** Keep focus in the hidden input when a toolbar button is pressed. */
  function keepFocus(root) {
    root.addEventListener('mousedown', (e) => { if (e.target.closest('button')) e.preventDefault(); });
  }
  function wire() {
    const A = () => S.A;
    const go = (fn) => () => { fn(); S.focusIme(); };
    $('tbUndo').addEventListener('click', go(() => A().undo()));
    $('tbRedo').addEventListener('click', go(() => A().redo()));
    $('tbBold').addEventListener('click', go(() => A().toggle('b')));
    $('tbItalic').addEventListener('click', go(() => A().toggle('i')));
    $('tbUnderline').addEventListener('click', go(() => A().toggle('u')));
    $('tbClear').addEventListener('click', go(() => A().clearFormat()));
    $('tbBigger').addEventListener('click', go(() => A().stepSize(1)));
    $('tbSmaller').addEventListener('click', go(() => A().stepSize(-1)));
    $('tbBullets').addEventListener('click', go(() => A().toggleList('bul')));
    $('tbNumbers').addEventListener('click', go(() => A().toggleList('num')));
    for (const b of document.querySelectorAll('[data-align]')) b.addEventListener('click', go(() => A().setAlign(b.dataset.align)));
    $('selStyle').addEventListener('change', (e) => { A().setStyle(e.target.value); S.focusIme(); });
    $('selFont').addEventListener('change', (e) => { A().setFont(e.target.value); S.focusIme(); });
    $('selSize').addEventListener('change', (e) => { A().setSize(e.target.value); S.focusIme(); });
    $('selSize').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); A().setSize(e.target.value); S.focusIme(); } });
    $('zoomSel').addEventListener('change', (e) => { S.zoom = Number(e.target.value) || 1; S.R.render(); S.R.reveal(); S.focusIme(); });
    $('tbRandom').addEventListener('click', () => S.random.open());
    keepFocus($('toolbar'));
    fillFonts();
  }
  /** Reflect the caret's formatting in the toolbar and status bar. */
  function refresh() {
    if (!S.doc || !S.A) return;
    const st = S.A.state(), pressed = (id, on) => $(id).setAttribute('aria-pressed', on ? 'true' : 'false');
    pressed('tbBold', st.b); pressed('tbItalic', st.i); pressed('tbUnderline', st.u);
    for (const b of document.querySelectorAll('[data-align]')) pressed(b.id, b.dataset.align === st.align);
    pressed('tbBullets', st.list === 'bul'); pressed('tbNumbers', st.list === 'num');
    $('tbUndo').disabled = !st.canUndo; $('tbRedo').disabled = !st.canRedo;
    const styleSel = $('selStyle'), want = st.style;
    if ([...styleSel.options].some((o) => o.value === want)) styleSel.value = want;
    else if (document.activeElement !== styleSel) styleSel.value = 'Normal';
    const fam = [...$('selFont').options].find((o) => o.value === st.font) || [...$('selFont').options].find((o) => E().familyOf(st.font).name === o.value);
    if (fam) $('selFont').value = fam.value;
    if (document.activeElement !== $('selSize')) $('selSize').value = String(st.size);
    const pi = S.R.pageInfo(), wc = E().M.wordCount(S.doc);
    $('pageInfo').textContent = `Page ${pi.page} of ${pi.of}`;
    $('wordInfo').textContent = `${wc.words} ${wc.words === 1 ? 'word' : 'words'}`;
    if (S.saveLabel) $('saveState').textContent = S.saveLabel();
    if (document.activeElement !== $('docName')) $('docName').value = S.displayName();
  }
  S.on('view', refresh);
  S.on('change', () => refresh());
  S.on('doc', () => refresh());
  S.toolbarRefresh = refresh;
  wire();
})();
