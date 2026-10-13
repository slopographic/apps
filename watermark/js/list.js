/* Slop Watermark: the picture list (thumbnail, name, size, state, and the Download and Remove buttons) and the
 * live preview of the first picture. Classic script. Exposes window.WMList and window.WMPreview. */
(function () {
  'use strict';
  const $ = window.WMUtil.$;
  const el = (tag, attrs, ...kids) => window.SlopUI.el(tag, attrs, ...kids);
  const size = (n) => window.SlopDrop.rules.size(n);

  function row(item) {
    const state = item.error ? el('span', { class: 'wm-state is-error' }, item.error)
      : item.out ? el('span', { class: 'wm-state is-done' }, 'Watermarked: ' + item.out.name)
      : el('span', { class: 'wm-state' }, 'Not applied yet');
    return el('li', { class: 'wm-row', 'data-id': item.id },
      el('img', { class: 'wm-thumb', src: item.url, alt: '', loading: 'lazy', decoding: 'async' }),
      el('div', { class: 'wm-meta' },
        el('strong', { class: 'wm-name', title: item.name }, item.name),
        el('span', { class: 'wm-dim' }, item.w + ' × ' + item.h + ' px · ' + size(item.file.size)),
        state),
      el('div', { class: 'wm-acts' },
        el('button', { type: 'button', class: 'sui-btn', 'data-act': 'dl', disabled: !item.out, 'aria-label': 'Download ' + item.name }, 'Download'),
        el('button', { type: 'button', class: 'sui-btn', 'data-act': 'rm', 'aria-label': 'Remove ' + item.name }, 'Remove')));
  }
  /** Rebuilds the list, the count line and the groups list from the items. */
  function render() {
    const items = window.WMItems.all(), n = items.length, done = window.WMItems.outCount();
    $('wm-list').replaceChildren(...items.map(row));
    $('wm-list-wrap').hidden = !n;
    $('wm-count').textContent = n ? n + (n === 1 ? ' picture' : ' pictures') + (done ? ' · ' + done + ' watermarked' : '') : '';
    document.body.classList.toggle('has-items', n > 0);
    window.WMGroupsUI.render();
  }

  /** Clicks on Download and Remove, one handler for the whole list. */
  function wire(onRemove) {
    $('wm-list').addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || b.disabled) return;
      const id = b.closest('.wm-row').dataset.id;
      if (b.dataset.act === 'dl') window.WMExport.downloadOne(window.WMItems.get(id));
      else onRemove(id);
    });
  }

  let cache = { id: '', img: null }, seq = 0;
  /** The preview: the first picture with the current setup, drawn at a size that fits the stage. Stale draws are dropped. */
  async function show() {
    const my = ++seq;
    const first = window.WMItems.first(), cv = $('wm-preview'), off = $('wm-off');
    const cfg = window.WMSettings.cfgFor(first && first.group), logo = window.WMSettings.logo();
    $('wm-preview-note').textContent = !first ? '' : cfg.kind === 'logo' && !logo ? 'Upload a logo to see it on the picture.'
      : cfg.kind === 'text' && !cfg.text ? 'Type some text to see it on the picture.' : '';
    if (!first) { cv.hidden = true; off.hidden = false; return; }
    if (cache.id !== first.id) {
      const img = await window.WMDecode.loadPicture(first.url);
      if (my !== seq) return;
      cache = { id: first.id, img };
    }
    const box = window.WMRender.fit(first.w, first.h, 960, 640);
    window.WMRender.drawInto(cv, cache.img, box.w, box.h, cfg, logo && logo.bitmap);
    cv.hidden = false; off.hidden = true;
  }
  let timer = 0;
  function schedule() { clearTimeout(timer); timer = setTimeout(show, 30); }

  window.WMList = { render, wire };
  window.WMPreview = { show, schedule };
})();
