/* Slop Watermark: the watermark setup (the form and the saved copy in this browser), the logo, and the per-group
 * overrides. Classic script. Exposes window.WMSettings. The saved copy is one localStorage record,
 * { v: 1, data: { cfg, logo, groups } }; the logo is kept as a data URL only when it is under 500 KB.
 * Every storage call is in try/catch: without storage the page still works.
 *   init({ onChange }) ; restore() → Promise ; cfg() ; setCfg(patch) ; logo() → { name, bitmap, dataUrl } | null ; setLogo(blob, name) → Promise
 *   group(kind) → the override of a shape group (off, from the shared setup, unless it is on) ; setGroup(kind, patch)
 *   cfgFor(kind) → the setup a picture of that group is drawn with (WMGroups.applyOverride) */
(function () {
  'use strict';
  const KEY = 'slopwatermark.setup', VERSION = 1, LOGO_LIMIT = 500 * 1024;
  const $ = window.WMUtil.$;
  const G = window.WMGroups;
  const TEXT_ONLY = ['wm-text', 'wm-font', 'wm-colour', 'wm-shadow'];
  const DEFAULTS = window.SlopWatermark.defaults();
  const state = { cfg: Object.assign({}, DEFAULTS), logo: null, groups: {} };
  let onChange = () => {}, saveTimer = 0, restoring = false;

  const num = (id) => parseFloat($(id).value) || 0;

  /** Reads every control except the size slider (write() keeps that one in step with the kind). */
  function pull() {
    const c = state.cfg;
    c.kind = $('wm-kind').value === 'logo' ? 'logo' : 'text';
    c.text = $('wm-text').value;
    c.font = $('wm-font').value;
    c.opacity = num('wm-opacity') / 100;
    c.tile = $('wm-tile').checked;
    c.rotate = num('wm-rotate');
    c.margin = num('wm-margin') / 100;
    c.colour = $('wm-colour').value;
    c.shadow = $('wm-shadow').checked;
  }
  /** Writes state.cfg to every control. */
  function write() {
    const c = state.cfg, logoKind = c.kind === 'logo';
    $('wm-kind').value = c.kind;
    $('wm-text').value = c.text;
    $('wm-font').value = c.font;
    const size = $('wm-size'), range = G.scaleRange(c.kind);
    size.min = range.min; size.max = range.max; size.step = range.step;
    size.value = c[G.scaleKey(c.kind)] * 100;
    $('wm-size-label').textContent = logoKind ? 'Logo size (% of the shorter side)' : 'Text size (% of the shorter side)';
    $('wm-opacity').value = Math.round(c.opacity * 100);
    $('wm-rotate').value = c.rotate;
    $('wm-margin').value = c.margin * 100;
    $('wm-colour').value = c.colour;
    $('wm-tile').checked = !!c.tile;
    $('wm-shadow').checked = !!c.shadow;
    for (const b of document.querySelectorAll('#wm-grid [data-pos]')) b.setAttribute('aria-pressed', String(b.dataset.pos === c.position));
    for (const id of TEXT_ONLY) $(id).disabled = logoKind;
    $('wm-size-out').textContent = G.fmtScale(c.kind, c[G.scaleKey(c.kind)]);
    $('wm-opacity-out').textContent = Math.round(c.opacity * 100) + '%';
    $('wm-rotate-out').textContent = c.rotate + '°';
    $('wm-margin-out').textContent = (c.margin * 100).toFixed(1).replace(/\.0$/, '') + '%';
    $('wm-logo-name').textContent = state.logo ? state.logo.name : 'No logo yet';
    $('wm-logo-clear').disabled = !state.logo;
    $('wm-logo-kind-note').hidden = !logoKind || !!state.logo;
  }

  function readUrl(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
  }
  function setStatus(text) { $('wm-saved').textContent = text; }
  /** Saves now (the caller debounces). The status line says whether the logo was kept. */
  function saveNow() {
    const L = state.logo;
    try {
      const logo = L && L.dataUrl ? { name: L.name, dataUrl: L.dataUrl } : null;
      localStorage.setItem(KEY, JSON.stringify({ v: VERSION, data: { cfg: state.cfg, logo, groups: state.groups } }));
      setStatus(!L ? 'Saved on this device.' : L.dataUrl ? 'Saved on this device, with the logo.'
        : 'Saved on this device. The logo is 500 KB or more, so it is not kept: upload it again next time.');
    } catch (e) { setStatus('This browser would not save the setup. It still works for this visit.'); }
  }
  function persist() {
    if (restoring) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
  }
  /** A change from the form or the logo: save, and tell the page (which clears results made with the old setup). */
  function changed() {
    write(); persist();
    if (!restoring) onChange();
  }

  /** Reads the logo file and makes its bitmap. Throws when it cannot be read. Keeps a data URL when it is small. */
  async function setLogo(blob, name) {
    const bitmap = await window.WMDecode.loadLogo(blob);
    const dataUrl = blob.size < LOGO_LIMIT ? await readUrl(blob) : null;
    state.logo = { name, bitmap, dataUrl };
    changed();
    return state.logo;
  }
  function clearLogo() {
    state.logo = null;
    changed();
  }

  function onInput(e) {
    if (e.target.type === 'file') return; // the logo inputs have their own handlers
    if (e.target.id === 'wm-size') state.cfg[G.scaleKey(state.cfg.kind)] = num('wm-size') / 100;
    else pull();
    changed();
  }
  /** A logo file from the picker: read it, or say why it cannot be used. */
  async function pickLogo(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'].includes(window.WMDecode.typeOf(file))) {
      window.SlopUI.toast('A logo must be a PNG, SVG, JPEG or WebP picture');
      return;
    }
    try { await setLogo(file, file.name); }
    catch (err) { window.SlopUI.toast(file.name + ' could not be read'); }
  }
  /** Back to the shared defaults; the groups' own settings are turned off too. The logo is kept. */
  function resetDefaults() {
    const keepLogo = state.logo;
    state.cfg = Object.assign({}, DEFAULTS);
    state.logo = keepLogo;
    state.groups = {};
    changed();
  }
  /** A group's override. Turning it on copies the shared setup; turning it off drops it, so the group follows the shared setup again. */
  function setGroup(kind, patch) {
    const next = Object.assign({}, group(kind), patch);
    if (next.on) state.groups[kind] = next; else delete state.groups[kind];
    changed();
  }
  function group(kind) { return state.groups[kind] || G.overrideFrom(state.cfg); }

  function init(opts) {
    onChange = (opts && opts.onChange) || onChange;
    const form = $('wm-panel');
    form.addEventListener('input', onInput);
    form.addEventListener('change', onInput);
    for (const b of document.querySelectorAll('#wm-grid [data-pos]')) {
      b.addEventListener('click', () => { state.cfg.position = b.dataset.pos; changed(); });
    }
    $('wm-reset').addEventListener('click', resetDefaults);
    $('wm-logo-file').addEventListener('change', pickLogo);
    $('wm-logo-clear').addEventListener('click', clearLogo);
    write();
  }

  /** Puts back the saved setup (and logo) when there is one. Storage that is blocked or corrupt means the defaults. */
  async function restore() {
    let rec = null;
    try { rec = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { rec = null; }
    const data = rec && rec.v === VERSION ? rec.data : null;
    if (!data || !data.cfg || typeof data.cfg !== 'object') { write(); return; }
    restoring = true;
    try {
      for (const k of Object.keys(DEFAULTS)) if (k in data.cfg) state.cfg[k] = data.cfg[k];
      for (const k of G.KINDS) { const ov = G.clean(data.groups && data.groups[k], state.cfg); if (ov) state.groups[k] = ov; }
      write();
      if (data.logo && data.logo.dataUrl) {
        try { await setLogo(await (await fetch(data.logo.dataUrl)).blob(), String(data.logo.name || 'logo')); }
        catch (e) { state.logo = null; }
      }
    } finally { restoring = false; }
    write();
    setStatus(state.logo ? 'Saved on this device, with the logo.' : 'Saved on this device.');
  }

  window.WMSettings = {
    init, restore, setLogo, clearLogo, setGroup, group,
    cfg: () => state.cfg,
    /** Changes part of the setup (the assistant's set_watermark); the page updates as if the form had changed. */
    setCfg: (patch) => { Object.assign(state.cfg, patch); changed(); return state.cfg; },
    logo: () => state.logo,
    cfgFor: (kind) => G.applyOverride(state.cfg, state.groups[kind]),
  };
})();
