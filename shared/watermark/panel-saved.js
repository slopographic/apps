/* The watermark panel's "My watermarks" button (panel.js): a menu (SlopMenuButton) of the watermarks saved in any app
 * (saved.js), Save this watermark… (a name, through SlopUI.prompt) and Manage… (a SlopUI.dialog to delete them).
 * Classic script: SlopWatermarkPanel.savedButton({ get() → spec, use(spec, name) }) → { el, refresh(), destroy() }. */
(function () {
  'use strict';
  const P = (window.SlopWatermarkPanel = window.SlopWatermarkPanel || {});
  const S = window.SlopWatermarkSpec;
  const el = (...a) => window.SlopUI.el(...a);
  const toast = (m) => window.SlopUI.toast(m, 3200);

  P.savedButton = function (o) {
    const Saved = window.SlopWatermarkSaved;
    const btn = el('button', { type: 'button', class: 'sui-btn swp-saved', title: 'Watermarks you saved, in every Slopographic app' }, 'My watermarks ▾');
    let rows = [];
    async function refresh() { rows = Saved ? await Saved.list().catch(() => []) : []; btn.dataset.count = String(rows.length); }
    const off = Saved ? Saved.onChange(refresh) : () => {};
    refresh();

    async function saveAs() {
      const sp = o.get(), first = sp.layers.find((L) => L.show) || sp.layers[0];
      const guess = sp.name || (first ? S.label(first).replace(/[“”]/g, '') : 'Watermark');
      const name = await window.SlopUI.prompt('Save this watermark', 'Name', guess, { ok: 'Save', placeholder: 'For example: Studio logo' });
      if (name == null) return;
      try {
        const same = rows.find((r) => r.name.toLowerCase() === String(name).trim().toLowerCase());
        await Saved.save(name, sp, same && same.id);
        toast('Saved. It is in My watermarks in every Slopographic app.');
      } catch (e) { window.SlopUI.alert('Not saved', e.message); }
    }
    function manage() {
      const list = el('ul', { class: 'swp-manage' });
      const draw = () => {
        list.replaceChildren(...(rows.length ? rows.map((r) => {
          const del = el('button', { type: 'button', class: 'sui-btn sui-danger', 'aria-label': 'Delete ' + r.name }, 'Delete');
          del.addEventListener('click', async () => { await Saved.remove(r.id); await refresh(); draw(); });
          return el('li', null, el('span', null, r.name, el('small', null, ' · ' + r.spec.layers.length + (r.spec.layers.length === 1 ? ' layer' : ' layers'))), del);
        }) : [el('li', { class: 'swp-fine' }, 'Nothing saved yet.')]));
      };
      draw();
      window.SlopUI.dialog({ title: 'My watermarks', body: el('div', null, el('p', { class: 'sui-p' }, 'These are kept in this browser and show in every Slopographic app.'), list), buttons: [{ label: 'Done', primary: true }] });
    }

    const mb = window.SlopMenuButton.attach(btn, {
      label: 'My watermarks',
      items: () => [
        { heading: 'My watermarks' },
        ...(rows.length ? rows.map((r) => ({ value: 'use:' + r.id, label: r.name, keywords: [r.spec.layers.map((L) => L.text).join(' ')] })) : [{ value: 'none', label: 'Nothing saved yet', disabled: true }]),
        { heading: 'This watermark' },
        { value: 'save', label: 'Save this watermark…' },
        { value: 'manage', label: 'Manage saved watermarks…', disabled: !rows.length },
      ],
      onPick: (v) => {
        if (v === 'save') saveAs();
        else if (v === 'manage') manage();
        else if (v.startsWith('use:')) {
          const r = rows.find((x) => 'use:' + x.id === v);
          if (r) o.use(S.normalize(r.spec), r.name);
        }
      },
      search: 'auto',
    });
    return { el: btn, refresh, destroy: () => { off(); mb.destroy(); } };
  };
})();
