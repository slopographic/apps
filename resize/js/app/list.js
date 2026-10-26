/* Slop Resize: the queue list. One row per file: a thumbnail, the name, the size before and after (pixels and file
 * size), the progress bar, the status, and the row's actions. Built with SlopUI.el, so file names are never parsed as HTML.
 * Classic script; exposes window.SlopResize.list.
 *   render(box, items, act)   act = { download(item), save(item), upscale(item), remove(item) }
 *   summary(items)            "3 files · 12.4 MB → 2.1 MB · 2 done" for the status line */
(function (g) {
  'use strict';
  const NS = g.SlopResize, L = (NS.list = {});
  const el = (...a) => g.SlopUI.el(...a);
  const fmt = (n) => NS.format.bytes(n);
  const dims = (s) => (s ? `${s.w} × ${s.h}` : '');
  const t = (k, v) => (g.SlopI18n ? g.SlopI18n.t(k, v) : k);

  function statusText(it) {
    switch (it.status) {
      case 'loading': return t('resize.list.reading');
      case 'waiting': return t('resize.list.waiting');
      case 'working': return it.msg || t('resize.list.resizing');
      case 'done': return [t('resize.list.done'), it.note, it.drive ? t('resize.list.saved_drive') : ''].filter(Boolean).join(' · ');
      case 'error': return t('resize.list.error', { error: it.err || t('resize.err.unknown') });
      case 'cancelled': return t('resize.list.cancelled');
      default: return '';
    }
  }

  function row(it, act) {
    const thumb = it.thumb
      ? el('img', { class: 'rs-thumb-img', src: it.thumb, alt: '', draggable: 'false' })
      : el('span', { class: 'rs-thumb-kind', 'aria-hidden': 'true' }, it.kind === 'video' ? t('resize.list.kind_video') : it.kind === 'image' ? t('resize.list.kind_image') : '?');
    const from = [dims(it.src), it.file ? fmt(it.file.size) : ''].filter(Boolean).join(' · ');
    const to = it.out ? [dims({ w: it.out.w, h: it.out.h }), fmt(it.out.size)].join(' · ') : '—';
    const acts = [];
    if (it.status === 'done') {
      acts.push(el('button', { type: 'button', class: 'sui-btn', onclick: () => act.download(it) }, t('resize.app.download')));
      if (!it.drive) acts.push(el('button', { type: 'button', class: 'sui-btn', onclick: () => act.save(it) }, t('resize.list.save_drive')));
    }
    if (act.upscale && it.file && it.status !== 'working' && it.status !== 'loading') {
      acts.push(el('button', { type: 'button', class: 'sui-btn', onclick: () => act.upscale(it) }, t('resize.list.upscale')));
    }
    if (it.status !== 'working' && it.status !== 'loading') {
      acts.push(el('button', { type: 'button', class: 'sui-btn rs-x', 'aria-label': t('resize.list.remove', { name: it.name }), onclick: () => act.remove(it) }, '×'));
    }
    return el('li', { class: 'rs-row', 'data-status': it.status },
      el('div', { class: 'rs-thumb' }, thumb),
      el('div', { class: 'rs-body' },
        el('div', { class: 'rs-name', title: it.name }, it.name),
        el('div', { class: 'rs-ba' },
          el('span', { class: 'rs-from' }, from || t('resize.list.unknown_size')),
          el('span', { class: 'rs-arrow', 'aria-hidden': 'true' }, '→'),
          el('span', { class: 'rs-to' }, to)),
        el('div', { class: 'rs-status', role: 'status' }, statusText(it)),
        it.status === 'working' || it.status === 'done'
          ? el('div', { class: 'rs-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round((it.progress || 0) * 100)) },
            el('i', { style: `width:${Math.round((it.progress || 0) * 100)}%` }))
          : null),
      el('div', { class: 'rs-acts' }, acts));
  }

  L.render = function (box, items, act) {
    box.replaceChildren(...items.map((it) => row(it, act)));
  };

  L.summary = function (items) {
    if (!items.length) return '';
    const done = items.filter((i) => i.status === 'done');
    const before = items.reduce((n, i) => n + (i.file ? i.file.size : 0), 0);
    const after = done.reduce((n, i) => n + (i.out ? i.out.size : 0), 0);
    const parts = [t('resize.list.n_files', { n: items.length })];
    if (before) parts.push(t('resize.list.size_in', { size: fmt(before) }));
    if (done.length) parts.push(t('resize.list.size_out', { size: fmt(after), n: done.length }));
    const failed = items.filter((i) => i.status === 'error').length;
    if (failed) parts.push(t('resize.list.n_failed', { n: failed }));
    return parts.join(' · ');
  };
})(typeof window !== 'undefined' ? window : globalThis);
