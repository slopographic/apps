/* SlopClean: the picture list. One card per picture: a preview, what it holds (grouped by category, each line marked
 * Removed or Kept against the current choices), and its own actions. Classic script; sets window.CL.report. */
(function () {
  'use strict';
  const CL = (window.CL = window.CL || {});
  const el = (...a) => window.SlopUI.el(...a);
  const C = () => window.SlopClean;

  /** True when a finding is (or will be) removed: from the real result when there is one, else from the choices. */
  function gone(item, f, remove) {
    if (item.out) return !item.out.after.some((a) => a.cat === f.cat && a.label === f.label && a.value === f.value);
    return !!remove[f.cat];
  }
  const fmtSize = (n) => window.SlopHub.fmtSize(n);   // SlopHub.fmtSize (shared/hub.js)

  /** The "What it holds" list for one item, grouped by category in the order of CATS. */
  function holdings(item, remove) {
    const wrap = el('div', { class: 'cl-holds' });
    if (!item.findings.length) { wrap.append(el('p', { class: 'cl-none' }, 'No metadata found. Nothing to remove.')); return wrap; }
    for (const c of C().CATS) {
      const rows = item.findings.filter((f) => f.cat === c.id);
      if (!rows.length) continue;
      wrap.append(el('h4', { class: 'cl-cat' }, c.label, el('span', { class: 'cl-count' }, String(rows.length))));
      for (const f of rows) {
        const removed = gone(item, f, remove);
        wrap.append(el('div', { class: 'cl-row' + (removed ? ' is-gone' : ' is-kept') },
          el('span', { class: 'cl-k' }, f.label), el('span', { class: 'cl-v' }, f.value || ''),
          el('span', { class: 'cl-pill' }, removed ? 'Removed' : 'Kept')));
      }
    }
    return wrap;
  }

  function summaryLine(item, remove) {
    if (item.error) return item.error;
    if (!item.findings.length) return `${item.label} · ${fmtSize(item.size)} · no metadata`;
    const cats = [...new Set(item.findings.filter((f) => gone(item, f, remove)).map((f) => f.cat))];
    const names = cats.map((id) => (C().CATS.find((c) => c.id === id) || { label: id }).label.toLowerCase());
    const head = `${item.label} · ${fmtSize(item.size)}`;
    if (item.out) return `${head} · cleaned to ${fmtSize(item.out.bytes.length)}${names.length ? ' · removed ' + names.join(', ') : ''}`;
    return `${head} · will remove ${names.length ? names.join(', ') : 'nothing'}`;
  }

  /** One card. h: { view, download, save, replace, close } handlers, each called with the item. */
  function card(item, remove, h) {
    const thumb = item.thumb ? el('img', { src: item.thumb, alt: '' }) : el('span', { class: 'cl-nothumb' }, item.format === 'tiff' ? 'TIFF' : '?');
    const btn = (label, fn, cls = '') => el('button', { type: 'button', class: 'sui-btn ' + cls, onclick: () => fn(item) }, label);
    const actions = [
      item.error ? null : btn('View metadata', h.view),
      item.out ? btn('Download', h.download, 'sui-primary') : null,
      item.out ? btn('Save to Slop Drive…', h.save) : null,
      item.out && item.driveId ? btn('Replace original…', h.replace, 'cl-danger') : null,
      btn('Remove from list', h.close),
    ].filter(Boolean);
    return el('article', { class: 'cl-card' + (item.error ? ' is-error' : ''), 'data-id': item.id },
      el('div', { class: 'cl-thumb' }, thumb),
      el('div', { class: 'cl-main' },
        el('h3', { class: 'cl-name', title: item.name }, item.name),
        el('p', { class: 'cl-sum' }, summaryLine(item, remove)),
        item.error ? null : holdings(item, remove),
        el('div', { class: 'cl-acts' }, actions)));
  }

  CL.report = {
    render(state, handlers) {
      const list = document.getElementById('cl-list');
      list.replaceChildren(...state.items.map((it) => card(it, state.remove, handlers)));
      document.body.classList.toggle('has-items', state.items.length > 0);
    },
    /** The view dialog: the picture and every field it holds. */
    view(item) {
      const img = item.thumb ? el('img', { class: 'cl-view-img', src: item.thumb, alt: item.name }) : el('p', { class: 'cl-none' }, 'No preview for this format in this browser.');
      const rows = item.findings.length
        ? item.findings.map((f) => el('tr', null, el('td', null, f.where || ''), el('th', null, f.label), el('td', null, f.value || '')))
        : [el('tr', null, el('td', { colspan: '3' }, 'No metadata fields.'))];
      window.SlopUI.dialog({
        title: item.name, cls: 'cl-view', buttons: [{ label: 'Close', primary: true }],
        body: el('div', { class: 'cl-view-body' }, img,
          el('table', { class: 'cl-table' }, el('thead', null, el('tr', null, el('th', null, 'Where'), el('th', null, 'Field'), el('th', null, 'Value'))), el('tbody', null, rows))),
      });
    },
  };
})();
