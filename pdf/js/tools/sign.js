/* Slop PDF — signatures: draw (mouse / touch / pen pressure) or type in a script font.
   Saved signatures live only in this browser's localStorage and can be cleared. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine;
  var S = SP.sign = {};
  S.FONTS = [
    ['Dancing Script', '"Dancing Script", "Segoe Script", "Brush Script MT", "Snell Roundhand", cursive'],
    ['Great Vibes', '"Great Vibes", "Edwardian Script ITC", "Snell Roundhand", "Segoe Script", cursive'],
    ['Caveat', 'Caveat, "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive']
  ];
  S.COLORS = [['#111111', 'Black'], ['#1a3fb0', 'Blue'], ['#b3122e', 'Red']];

  S.saved = function () { var v = U.store.get('signatures', []); return Array.isArray(v) ? v : []; };
  S.save = function (sig) {
    var list = S.saved().filter(function (x) { return x.url !== sig.url; });
    list.unshift(sig); list = list.slice(0, 6);
    if (!U.store.set('signatures', list)) SlopUI.toast('Could not save the signature (browser storage is blocked or full).');
  };
  S.remove = function (id) { U.store.set('signatures', S.saved().filter(function (x) { return x.id !== id; })); };
  S.clear = function () { U.store.del('signatures'); };
  S.toAsset = function (sig) { return E.addAsset({ mime: 'image/png', url: sig.url, w: sig.w, h: sig.h, name: 'signature' }); };

  /** Crops a canvas to its painted pixels (+margin). Returns {url, w, h} or null if empty. */
  S.trim = function (c, margin) {
    margin = margin == null ? 8 : margin;
    var cx = c.getContext('2d', { willReadFrequently: true }), d = cx.getImageData(0, 0, c.width, c.height).data;
    var x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (var y = 0; y < c.height; y++) for (var x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return null;
    x0 = Math.max(0, x0 - margin); y0 = Math.max(0, y0 - margin); x1 = Math.min(c.width - 1, x1 + margin); y1 = Math.min(c.height - 1, y1 + margin);
    var o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
    o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
    return { url: o.toDataURL('image/png'), w: o.width, h: o.height };
  };
  S.renderTyped = async function (text, fontCss, color) {
    var size = 120, font = size + 'px ' + fontCss;
    try { if (document.fonts && document.fonts.load) await Promise.race([document.fonts.load(font, text), U.sleep(1500)]); } catch (e) { /* offline: fallback fonts */ }
    var c = document.createElement('canvas'), cx = c.getContext('2d');
    cx.font = font;
    var w = Math.ceil(cx.measureText(text).width) + 80;
    c.width = Math.min(4000, Math.max(200, w)); c.height = Math.round(size * 1.9);
    cx.font = font; cx.fillStyle = color; cx.textBaseline = 'middle';
    cx.fillText(text, 40, c.height / 2);
    return S.trim(c, 6);
  };

  /** Opens the signature dialog; onPlace(asset) is called with the chosen signature. */
  S.open = function (onPlace) {
    var h = U.h, tab = S.saved().length ? 'saved' : 'draw', color = S.COLORS[0][0], fontIdx = 0, chosen = null;
    var tabs = h('div', { class: 'sg-tabs', role: 'tablist' });
    var panes = {};
    // draw pane
    var pad = h('canvas', { class: 'sg-pad', 'aria-label': 'Signature pad: draw your signature with a mouse, finger or pen' });
    var strokes = 0;
    var colorRow = function (onPick) {
      var row = h('div', { class: 'sg-colors', role: 'radiogroup', 'aria-label': 'Ink colour' });
      S.COLORS.forEach(function (c) {
        var b = h('button', { type: 'button', class: 'sg-color' + (c[0] === color ? ' on' : ''), title: c[1], 'aria-label': c[1] + ' ink', role: 'radio', 'aria-checked': c[0] === color ? 'true' : 'false', style: { '--c': c[0] } });
        b.addEventListener('click', function () { color = c[0]; U.$$('.sg-color', dlg.box).forEach(function (x) { var on = x.style.getPropertyValue('--c') === color; x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); }); if (onPick) onPick(); });
        row.appendChild(b);
      });
      return row;
    };
    var clearBtn = h('button', { type: 'button', class: 'btn sm', onclick: function () { var cx = pad.getContext('2d'); cx.clearRect(0, 0, pad.width, pad.height); strokes = 0; } }, 'Clear');
    panes.draw = h('div', { class: 'sg-pane' },
      h('div', { class: 'sg-padwrap' }, pad, h('div', { class: 'sg-line', 'aria-hidden': 'true' }, h('span', null, '✕'))),
      h('div', { class: 'sg-row' }, colorRow(), h('span', { class: 'sg-hint' }, 'Draw with mouse, finger or stylus'), clearBtn));
    // type pane
    var nameIn = h('input', { class: 'sui-input sg-name', type: 'text', placeholder: 'Type your name', maxlength: '60', 'aria-label': 'Your name' });
    var fontRow = h('div', { class: 'sg-fonts', role: 'radiogroup', 'aria-label': 'Signature style' });
    function paintFonts() {
      fontRow.innerHTML = '';
      S.FONTS.forEach(function (f, i) {
        var b = h('button', { type: 'button', class: 'sg-font' + (i === fontIdx ? ' on' : ''), role: 'radio', 'aria-checked': i === fontIdx ? 'true' : 'false', style: { fontFamily: f[1], color: color } }, nameIn.value || 'Your Name');
        b.addEventListener('click', function () { fontIdx = i; paintFonts(); });
        fontRow.appendChild(b);
      });
    }
    nameIn.addEventListener('input', paintFonts);
    panes.type = h('div', { class: 'sg-pane' }, nameIn, fontRow, h('div', { class: 'sg-row' }, colorRow(paintFonts)));
    // saved pane
    panes.saved = h('div', { class: 'sg-pane' });
    function paintSaved() {
      var list = S.saved(); panes.saved.innerHTML = '';
      if (!list.length) { panes.saved.appendChild(h('p', { class: 'sg-empty' }, 'No saved signatures yet. Draw or type one and tick “Save for next time”.')); return; }
      var grid = h('div', { class: 'sg-saved' });
      list.forEach(function (sig) {
        var card = h('div', { class: 'sg-card' + (chosen && chosen.id === sig.id ? ' on' : '') },
          h('button', { type: 'button', class: 'sg-pick', 'aria-label': 'Use this signature', onclick: function () { chosen = sig; paintSaved(); } }, h('img', { src: sig.url, alt: 'Saved signature' })),
          h('button', { type: 'button', class: 'sg-del', title: 'Delete', 'aria-label': 'Delete saved signature', html: U.icon('trash'), onclick: function () { S.remove(sig.id); if (chosen && chosen.id === sig.id) chosen = null; paintSaved(); paintTabs(); } }));
        card.addEventListener('dblclick', function () { chosen = sig; place(); });
        grid.appendChild(card);
      });
      panes.saved.append(grid, h('button', { type: 'button', class: 'btn sm danger-text', onclick: function () { SlopUI.confirm('Clear saved signatures', 'Remove every signature saved in this browser?', 'Clear', { danger: true }).then(function (ok) { if (ok) { S.clear(); chosen = null; paintSaved(); paintTabs(); } }); } }, 'Clear all saved signatures'));
    }
    function paintTabs() {
      tabs.innerHTML = '';
      [['draw', 'Draw'], ['type', 'Type'], ['saved', 'Saved (' + S.saved().length + ')']].forEach(function (t) {
        var b = h('button', { type: 'button', role: 'tab', class: 'sg-tab' + (tab === t[0] ? ' on' : ''), 'aria-selected': tab === t[0] ? 'true' : 'false' }, t[1]);
        b.addEventListener('click', function () { tab = t[0]; paintTabs(); show(); });
        tabs.appendChild(b);
      });
    }
    var body = h('div', { class: 'sg' }, tabs, panes.draw, panes.type, panes.saved);
    var saveChk = SlopUI.check('Save for next time (stored only in this browser)', true);
    body.appendChild(h('div', { class: 'sg-save' }, saveChk.el));
    function show() {
      Object.keys(panes).forEach(function (k) { panes[k].hidden = k !== tab; });
      saveChk.el.parentNode.hidden = tab === 'saved';
      if (tab === 'draw') sizePad();
      if (tab === 'type') { paintFonts(); setTimeout(function () { nameIn.focus(); }, 0); }
      if (tab === 'saved') paintSaved();
    }
    async function place() {
      var sig = null;
      if (tab === 'saved') { sig = chosen || S.saved()[0]; if (!sig) { SlopUI.toast('Pick a saved signature first.'); return false; } }
      else if (tab === 'draw') { if (!strokes) { SlopUI.toast('Draw your signature first.'); return false; } var t = S.trim(pad, 8); if (!t) return false; sig = { id: U.uid('sig'), url: t.url, w: t.w, h: t.h }; }
      else {
        var txt = nameIn.value.trim(); if (!txt) { SlopUI.toast('Type your name first.'); nameIn.focus(); return false; }
        var r = await S.renderTyped(txt, S.FONTS[fontIdx][1], color); if (!r) return false;
        sig = { id: U.uid('sig'), url: r.url, w: r.w, h: r.h };
      }
      if (tab !== 'saved' && saveChk.input.checked) S.save(sig);
      dlg.close(true);
      onPlace(S.toAsset(sig));
      return false;
    }
    var dlg = SlopUI.dialog({ title: 'Add a signature', body: body, cls: 'sui-wide sp-sign-dlg', buttons: [{ label: 'Cancel' }, { label: 'Place signature', primary: true, act: place }] });
    paintTabs(); show();

    function sizePad() {
      requestAnimationFrame(function () {
        var r = pad.getBoundingClientRect(), dpr = Math.min(3, window.devicePixelRatio || 1);
        if (!r.width) return;
        var w = Math.round(r.width * dpr), hh = Math.round(r.height * dpr);
        if (pad.width === w && pad.height === hh) return;
        var keep = strokes ? pad.toDataURL() : null;
        pad.width = w; pad.height = hh;
        if (keep) { var im = new Image(); im.onload = function () { pad.getContext('2d').drawImage(im, 0, 0, w, hh); }; im.src = keep; }
      });
    }
    var last = null;
    pad.addEventListener('pointerdown', function (e) {
      e.preventDefault(); pad.setPointerCapture(e.pointerId);
      var r = pad.getBoundingClientRect(), k = pad.width / r.width;
      last = { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, mx: null, my: null, w: lineW(e, k) };
      var cx = pad.getContext('2d'); cx.fillStyle = color; cx.beginPath(); cx.arc(last.x, last.y, last.w / 2, 0, Math.PI * 2); cx.fill();
      strokes++;
    });
    function lineW(e, k) { var p = e.pointerType === 'pen' && e.pressure > 0 ? 0.45 + e.pressure * 1.3 : 1; return 2.6 * k * p; }
    pad.addEventListener('pointermove', function (e) {
      if (!last) return;
      var r = pad.getBoundingClientRect(), k = pad.width / r.width;
      var pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      if (!pts.length) pts = [e];
      var cx = pad.getContext('2d'); cx.strokeStyle = color; cx.lineCap = 'round'; cx.lineJoin = 'round';
      pts.forEach(function (ev) {
        var x = (ev.clientX - r.left) * k, y = (ev.clientY - r.top) * k, mx = (last.x + x) / 2, my = (last.y + y) / 2;
        var w = last.w * 0.6 + lineW(ev, k) * 0.4;
        cx.lineWidth = w; cx.beginPath();
        cx.moveTo(last.mx == null ? last.x : last.mx, last.my == null ? last.y : last.my);
        cx.quadraticCurveTo(last.x, last.y, mx, my); cx.stroke();
        last = { x: x, y: y, mx: mx, my: my, w: w };
      });
    });
    function end() { last = null; }
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
    return dlg;
  };
})();
