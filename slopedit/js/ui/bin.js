/* SlopEdit: the Project panel. Tabs for Media (imported files) and Effects (transitions, titles,
   generators; filled by effects.js). Media items drag onto the timeline, or double-click to add. */
(function () {
  'use strict';
  const SE = window.SE, U = SE.util, M = SE.model, A = SE.app;
  const h = U.h;
  const B = SE.bin = { tab: 'media', filter: '' };
  let root, list, info, search;

  const KIND_ICON = { video: 'film', audio: 'music', image: 'image' };
  function card(meta) {
    const it = SE.media.get(meta.id) || { status: 'missing' };
    const thumb = h('div', { class: 'bi-thumb k-' + meta.kind });
    if (it.poster) { const c = U.canvas(it.poster.width, it.poster.height); c.getContext('2d').drawImage(it.poster, 0, 0); thumb.append(c); }
    else thumb.append(SE.icon(KIND_ICON[meta.kind] || 'film', 'bi-ph'));
    if (it.status === 'loading' || it.status === 'analysing') thumb.append(h('span', { class: 'bi-spin', title: 'Analysing…' }));
    if (it.status === 'error' || it.status === 'missing') thumb.append(h('span', { class: 'bi-err', title: it.error || 'Error' }, '!'));
    const dur = meta.kind === 'image' ? 'Still' : U.dur(meta.dur);
    thumb.append(h('span', { class: 'bi-dur' }, dur));
    const used = SE.doc.clips.some((c) => c.media === meta.id);
    const el = h('div', {
      class: 'bi' + (used ? ' used' : ''), role: 'option', tabindex: '0', draggable: it.status === 'ready' ? 'true' : 'false', dataset: { id: meta.id },
      title: meta.name + (meta.w ? ' · ' + meta.w + '×' + meta.h : '') + (meta.kind !== 'image' ? ' · ' + U.dur(meta.dur) : '') + (meta.kind === 'video' ? (meta.hasAudio ? ' · with sound' : ' · no sound') : '')
    }, thumb, h('div', { class: 'bi-name' }, SE.icon(KIND_ICON[meta.kind] || 'film'), h('span', null, meta.name)));
    el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-slopedit-media', meta.id); e.dataTransfer.effectAllowed = 'copy'; SE.timeline && SE.timeline.dragMedia(meta.id); });
    el.addEventListener('dragend', () => SE.timeline && SE.timeline.dragMedia(null));
    el.addEventListener('dblclick', () => addAtPlayhead(meta));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') addAtPlayhead(meta); else if (e.key === 'Delete' || e.key === 'Backspace') { e.stopPropagation(); removeItem(meta); } });
    el.addEventListener('contextmenu', (e) => { e.preventDefault(); itemMenu(meta, e.clientX, e.clientY); });
    let lp = 0;
    el.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') lp = setTimeout(() => itemMenu(meta, e.clientX, e.clientY), 550); });
    el.addEventListener('pointerup', () => clearTimeout(lp));
    el.addEventListener('pointercancel', () => clearTimeout(lp));
    el.addEventListener('click', (e) => { if (e.pointerType && e.pointerType !== 'mouse') return; U.$$('.bi.on', list).forEach((x) => x.classList.remove('on')); el.classList.add('on'); });
    return el;
  }
  function addAtPlayhead(meta) {
    if (!SE.media.ready(meta.id)) { SlopUI.toast('Still analysing ' + meta.name); return; }
    A.appendToTimeline([meta], SE.player ? SE.player.time : null);
    A.status('Added ' + meta.name + ' at the playhead');
  }
  async function removeItem(meta) {
    const n = SE.doc.clips.filter((c) => c.media === meta.id).length;
    if (n && !(await SlopUI.confirm('Remove media', `“${meta.name}” is used by ${n} clip${n > 1 ? 's' : ''} on the timeline. Remove it and those clips?`, 'Remove', { danger: true }))) return;
    SE.media.remove(meta.id);
  }
  async function rename(meta) {
    const v = await SlopUI.prompt('Rename', 'Name', meta.name);
    if (v && v.trim()) { meta.name = v.trim(); B.render(); SE.emit('change', { label: 'Rename' }); }
  }
  function itemMenu(meta, x, y) {
    const ready = SE.media.ready(meta.id);
    SlopUI.menu([
      { label: 'Add at playhead', key: 'Enter', act: () => addAtPlayhead(meta), disabled: !ready },
      { label: 'Append to end of timeline', act: () => A.appendToTimeline([meta]), disabled: !ready },
      { label: 'Use as sequence size (' + meta.w + '×' + meta.h + ')', disabled: !meta.w || meta.kind === 'audio', act: () => SE.settings.apply({ w: meta.w + (meta.w % 2), h: meta.h + (meta.h % 2) }) },
      '-',
      { label: 'Rename…', act: () => rename(meta) },
      window.SlopHub && !SE.offline ? { label: 'Save to Slop Drive…', act: () => SlopHub.saveToDrive(SE.media.get(meta.id).blob, meta.name) } : null,
      { label: 'Download original', act: () => SlopUI.download(SE.media.get(meta.id).blob, meta.name) },
      '-',
      { label: 'Remove from project', key: 'Del', act: () => removeItem(meta) }
    ], x, y);
  }

  B.render = function () {
    if (!root) return;
    U.$$('.bin-tab', root).forEach((b) => b.classList.toggle('on', b.dataset.tab === B.tab));
    root.dataset.tab = B.tab;
    if (B.tab !== 'media') { if (SE.effectsPanel) SE.effectsPanel.render(list); return; }
    list.replaceChildren();
    const q = B.filter.toLowerCase();
    const items = SE.doc.media.filter((m) => !q || m.name.toLowerCase().includes(q));
    if (!SE.doc.media.length) {
      list.append(h('div', { class: 'bin-empty' },
        SE.icon('film', 'bin-empty-ic'),
        h('b', null, 'Import media to start'),
        h('p', null, 'Drop video, audio or images anywhere, or'),
        h('div', { class: 'bin-empty-actions' },
          h('button', { type: 'button', class: 'btn primary', onclick: A.openDialog }, SE.icon('open'), 'Import files'),
          h('button', { type: 'button', class: 'btn', onclick: () => SE.sample && SE.sample.load() }, SE.icon('sparkle'), 'Sample project')),
        h('p', { class: 'bin-privacy' }, 'Your footage never leaves this device.')));
    } else list.append(h('div', { class: 'bi-grid', role: 'listbox', 'aria-label': 'Media' }, items.map(card)));
    const total = SE.doc.media.length;
    info.textContent = total ? total + ' item' + (total > 1 ? 's' : '') : 'Empty';
  };
  B.init = function (el) {
    root = el;
    search = h('input', { class: 'inp bin-search', type: 'search', placeholder: 'Search media', 'aria-label': 'Search media', oninput: () => { B.filter = search.value; B.render(); } });
    info = h('span', { class: 'bin-info' });
    const tabs = h('div', { class: 'bin-tabs', role: 'tablist' },
      h('button', { type: 'button', class: 'bin-tab', role: 'tab', dataset: { tab: 'media' }, onclick: () => { B.tab = 'media'; B.render(); } }, 'Media'),
      h('button', { type: 'button', class: 'bin-tab', role: 'tab', dataset: { tab: 'effects' }, onclick: () => { B.tab = 'effects'; B.render(); } }, 'Effects'),
      h('span', { class: 'tb-flex' }), info);
    const tools = h('div', { class: 'bin-tools' },
      h('button', { type: 'button', class: 'btn sm', title: 'Import files (Ctrl+I)', onclick: A.openDialog }, SE.icon('plus'), 'Import'),
      window.SlopHub ? h('button', { type: 'button', class: 'btn sm', title: 'Import from Slop Drive', onclick: A.openFromDrive, id: 'binDrive' }, SE.icon('drive'), 'Drive') : null,
      search);
    list = h('div', { class: 'bin-list' });
    root.append(h('div', { class: 'pane-head' }, tabs), tools, list);
    SE.on('media', U.debounce(B.render, 60));
    SE.on('change', U.debounce(() => { if (B.tab === 'media') B.render(); }, 120));
    SE.on('doc', B.render);
    B.render();
  };
  B.show = function (tab) { B.tab = tab; B.render(); if (A.isPhone()) A.setPane(tab === 'effects' ? 'effects' : 'media'); };
})();
