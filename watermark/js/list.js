/* Slop Watermark: the file list (thumbnail, name, size, state, and Preview, Download, Save or open… and Remove) and the
 * live preview of the chosen file (shared/watermark/preview.js: a picture, a playing video or a PDF page, with the
 * watermark drawn the way apply() writes it). Classic script. Exposes window.WMList and window.WMPreview. */
(function () {
  'use strict';
  const $ = window.WMUtil.$;
  const el = (tag, attrs, ...kids) => window.SlopUI.el(tag, attrs, ...kids);
  const size = (n) => window.SlopDrop.rules.size(n);
  const clock = (s) => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

  function dims(item) {
    const parts = [];
    if (item.media === 'pdf') parts.push('PDF, ' + item.pages + (item.pages === 1 ? ' page' : ' pages'));
    else if (item.w) parts.push(item.w + ' × ' + item.h + ' px');
    if (item.media === 'video') parts.push('video ' + clock(item.duration));
    parts.push(size(item.file.size));
    return parts.join(' · ');
  }
  function row(item, chosen) {
    const state = item.error ? el('span', { class: 'wm-state is-error' }, item.error)
      : item.out ? el('span', { class: 'wm-state is-done' }, 'Watermarked: ' + item.out.name + (item.note ? '. ' + item.note : ''))
      : el('span', { class: 'wm-state' }, 'Not applied yet');
    const thumb = item.url ? el('img', { class: 'wm-thumb', src: item.url, alt: '', loading: 'lazy', decoding: 'async' }) : el('span', { class: 'wm-thumb wm-thumb-none', 'aria-hidden': 'true' }, item.type.split('/')[1] || '?');
    return el('li', { class: 'wm-row' + (chosen ? ' is-chosen' : ''), 'data-id': item.id, 'data-media': item.media },
      thumb,
      el('div', { class: 'wm-meta' },
        el('strong', { class: 'wm-name', title: item.name }, item.name),
        el('span', { class: 'wm-dim' }, dims(item)),
        state),
      el('div', { class: 'wm-acts' },
        el('button', { type: 'button', class: 'sui-btn', 'data-act': 'pv', 'aria-pressed': String(chosen), 'aria-label': 'Preview ' + item.name }, 'Preview'),
        el('button', { type: 'button', class: 'sui-btn', 'data-act': 'dl', disabled: !item.out, 'aria-label': 'Download ' + item.name }, 'Download'),
        el('button', { type: 'button', class: 'sui-btn', 'data-act': 'more', disabled: !item.out, 'aria-haspopup': 'menu', 'aria-label': 'Save or open ' + item.name }, 'Save or open…'),
        el('button', { type: 'button', class: 'sui-btn', 'data-act': 'rm', 'aria-label': 'Remove ' + item.name }, 'Remove')));
  }
  /** Rebuilds the list, the count line and the groups list from the items. */
  function render() {
    const items = window.WMItems.all(), n = items.length, done = window.WMItems.outCount(), chosen = window.WMItems.selected();
    $('wm-list').replaceChildren(...items.map((x) => row(x, chosen && x.id === chosen.id)));
    $('wm-list-wrap').hidden = !n;
    const noun = items.every((x) => x.media === 'picture') ? ['picture', 'pictures'] : ['file', 'files'];
    $('wm-count').textContent = n ? n + ' ' + noun[n === 1 ? 0 : 1] + (done ? ' · ' + done + ' watermarked' : '') : '';
    document.body.classList.toggle('has-items', n > 0);
    window.WMGroupsUI.render();
  }

  /** Clicks on the rows' buttons, one handler for the whole list. A click on a row's picture or name previews it. */
  function wire(onRemove) {
    $('wm-list').addEventListener('click', (e) => {
      const li = e.target.closest('.wm-row');
      if (!li) return;
      const b = e.target.closest('[data-act]'), id = li.dataset.id;
      if (b && b.disabled) return;
      const act = b ? b.dataset.act : e.target.closest('.wm-thumb, .wm-name') ? 'pv' : '';
      if (act === 'dl') window.WMExport.downloadOne(window.WMItems.get(id));
      else if (act === 'more') { const r = b.getBoundingClientRect(); window.WMExport.moreMenu(window.WMItems.get(id), r.left, r.bottom + 4); }
      else if (act === 'rm') onRemove(id);
      else if (act === 'pv') { window.WMItems.select(id); render(); show(); window.WMMain.view(); }
    });
  }

  let pv = null, shown = '', seq = 0;
  /** The preview: the chosen file with the watermark it gets (its group's). Stale loads are dropped. */
  async function show() {
    const my = ++seq, item = window.WMItems.selected();
    if (!pv) pv = window.SlopWatermarkPreview.mount($('wm-preview'), { maxW: 960, maxH: 560 });
    const spec = window.WMSettings.specFor(item && item.group), problem = window.SlopWatermarkSpec.check(spec);
    $('wm-preview-note').textContent = !item ? '' : problem ? problem + ' Then it shows here.' : item.media === 'video' ? 'Play the video to see the watermark over it.' : '';
    $('wm-preview-name').textContent = item ? item.name : '';
    $('wm-preview').hidden = !item; $('wm-off').hidden = !!item;
    if (!item) { shown = ''; await pv.show(null); return; }
    if (shown !== item.id) {
      shown = item.id;
      try { await pv.show(item.file); } catch (e) { if (my === seq) $('wm-preview-note').textContent = item.name + ' cannot be shown here: ' + e.message; }
      if (my !== seq) return;
    }
    pv.draw(spec);
  }
  let timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(show, 30); }
  const preview = () => pv;

  window.WMList = { render, wire };
  window.WMPreview = { show, schedule, preview };
})();
