/* Slop Docs — ui/render: draws the laid-out pages as absolutely placed text (one span per fragment, placed
 * from the same line boxes the PDF uses) and maps between document positions and page points: caret and
 * selection geometry, hit-testing and vertical movement. Classic script; window.SlopDocs.R. */
(function () {
  'use strict';
  const S = window.SlopDocs, R = (S.R = {});
  const E = () => window.SlopDocEngine;
  const pagesEl = () => document.getElementById('pages');
  /** Pixels per point on screen (the page is 1pt = 4/3 px at 100%). */
  R.k = () => (4 / 3) * S.zoom;

  /** Flat list of the body's laid-out lines in document order: { pi, b, y, x, last, line }. */
  function buildLines() {
    S.lineList = [];
    if (!S.layout) return;
    S.layout.pages.forEach((pg, pi) => {
      for (const it of pg.items) {
        if (it.kind !== 'line' || it.story !== 'body' || !it.path || it.path.length !== 1) continue;
        S.lineList.push({ pi, b: it.path[0], y: it.y, x: it.x, last: it.last, line: it.line });
      }
    });
  }
  /** Offset (in the frags' own x space, relative to the content box) at x for a line. */
  function offsetAt(line, x) {
    for (const f of line.frags) {
      if (f.kind === 'label' || f.kind === 'float' || f.kind === 'img') continue;
      if (x < f.x) return f.start;
      if (x > f.x + f.w + 0.001 && f === line.frags[line.frags.length - 1]) return f.end;
      if (x > f.x + f.w) continue;
      if (f.kind !== 'text' && f.kind !== 'space') return x < f.x + f.w / 2 ? f.start : f.end;
      let acc = f.x, i = f.start;
      for (const ch of f.text) {
        const cw = E().textWidth(f.st.face, ch, f.st.size);
        if (x < acc + cw / 2) return i;
        acc += cw; i += ch.length;
      }
      return f.end;
    }
    return line.end;
  }
  /** x (content-box space) of an offset in a line. */
  function xOf(line, o) {
    const frags = line.frags.filter((f) => f.kind !== 'label');
    if (!frags.length) return line.left || 0;
    for (const f of frags) {
      if (o < f.start || o > f.end) continue;
      if (o === f.start) return f.x;
      if (o === f.end) return f.x + f.w;
      if (f.kind !== 'text' && f.kind !== 'space') return f.x;
      return f.x + E().textWidth(f.st.face, f.text.slice(0, o - f.start), f.st.size);
    }
    const last = frags[frags.length - 1];
    return o < frags[0].start ? frags[0].x : last.x + last.w;
  }
  /** Index in S.lineList of the line that shows position pos, or -1. */
  function lineIndex(pos) {
    const L = S.lineList;
    for (let i = 0; i < L.length; i++) if (L[i].b === pos.b && pos.o >= L[i].line.start && pos.o < L[i].line.end) return i;
    for (let i = 0; i < L.length; i++) if (L[i].b === pos.b && pos.o === L[i].line.end) return i;
    return -1;
  }
  R.lineIndex = lineIndex;
  R.lineAt = (i) => S.lineList[i] || null;
  R.offsetAt = offsetAt;
  R.xOf = xOf;
  /** Caret box for pos in page points: { pi, x, top, h } (x absolute on the page). */
  R.caretBox = function (pos) {
    const i = lineIndex(pos);
    if (i < 0) return null;
    const L = S.lineList[i], ln = L.line;
    return { pi: L.pi, x: L.x + xOf(ln, pos.o), top: L.y + ln.baseline - ln.asc, h: ln.asc + ln.desc || ln.h, i };
  };
  /** Position reached by moving up (dir -1) or down (dir 1) from pos, aiming at page x goalX. */
  R.vertical = function (pos, dir, goalX) {
    const i = lineIndex(pos);
    const t = i < 0 ? null : S.lineList[i + dir];
    if (!t) return null;
    return { b: t.b, o: offsetAt(t.line, goalX - t.x) };
  };
  /** Position under a client point (clamped to the nearest page and line). */
  R.hit = function (cx, cy) {
    const pages = [...document.querySelectorAll('#pages .page')];
    if (!pages.length) return null;
    let el = null, bd = Infinity;
    for (const p of pages) {
      const r = p.getBoundingClientRect();
      const d = cy < r.top ? r.top - cy : cy > r.bottom ? cy - r.bottom : 0;
      if (d < bd) { bd = d; el = p; }
      if (d === 0) break;
    }
    const pi = +el.dataset.pi, r = el.getBoundingClientRect(), k = R.k();
    const x = (cx - r.left) / k, y = (cy - r.top) / k;
    let best = null, dist = Infinity;
    for (const L of S.lineList) {
      if (L.pi !== pi) continue;
      const d = y < L.y ? L.y - y : y > L.y + L.line.h ? y - (L.y + L.line.h) : 0;
      if (d < dist) { dist = d; best = L; }
      if (d === 0) break;
    }
    if (!best) return null;
    return { b: best.b, o: offsetAt(best.line, x - best.x), pi, x };
  };
  /** Selection segments in page points, one per line the selection crosses. */
  function segments() {
    const sel = S.sel;
    if (E().O.collapsed(sel)) return [];
    const [a, f] = E().O.ordered(sel), out = [];
    for (const L of S.lineList) {
      if (L.b < a.b || L.b > f.b) continue;
      const ln = L.line;
      if (L.b === a.b && a.o > ln.end) continue;
      if (L.b === f.b && f.o < ln.start) continue;
      const from = L.b === a.b ? Math.max(a.o, ln.start) : ln.start;
      const to = L.b === f.b ? Math.min(f.o, ln.end) : ln.end;
      const x1 = xOf(ln, from), x2 = xOf(ln, to);
      let w = Math.max(0, x2 - x1);
      if (L.last && L.b < f.b && to >= ln.end) w += 4; // the paragraph mark
      if (!w && !(L.b < f.b)) continue;
      out.push({ pi: L.pi, x: L.x + x1, y: L.y, w: Math.max(w, 3), h: ln.h });
    }
    return out;
  }

  function el(tag, cls, css) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (css) Object.assign(n.style, css);
    return n;
  }
  function addFrag(page, it, f, k) {
    if (!f.text || f.kind === 'tab' || f.kind === 'nl' || f.kind === 'pb' || f.kind === 'float' || f.kind === 'img') return;
    const st = f.st, m = st.m || {}, vm = E().vmetrics(st.face, st.size);
    const s = el('span', 't', {
      left: (it.x + f.x) * k + 'px',
      top: (it.y + it.line.baseline - vm.asc + (st.dy || 0)) * k + 'px',
      fontFamily: `${E().cssFamily(E().familyOf(m.font))}, Arimo, Arial, sans-serif`,
      fontSize: st.size * k + 'px',
      lineHeight: (vm.asc + vm.desc) * k + 'px',
      fontWeight: m.b ? '700' : '400',
      fontStyle: m.i ? 'italic' : 'normal',
    });
    s.textContent = f.text;
    if (m.color) s.style.color = m.color;
    const deco = [m.u ? 'underline' : '', m.s ? 'line-through' : ''].filter(Boolean).join(' ');
    if (deco) s.style.textDecoration = deco;
    if (m.hl) s.style.background = m.hl;
    page.append(s);
  }
  function addItem(page, it, k) {
    if (it.kind === 'rect') page.append(el('div', 'r', { left: it.x * k + 'px', top: it.y * k + 'px', width: it.w * k + 'px', height: it.h * k + 'px', background: it.fill }));
    else if (it.kind === 'rule') {
      const x = Math.min(it.x1, it.x2), y = Math.min(it.y1, it.y2);
      page.append(el('div', 'r', { left: x * k + 'px', top: y * k + 'px', width: Math.max(Math.abs(it.x2 - it.x1), it.w) * k + 'px', height: Math.max(Math.abs(it.y2 - it.y1), it.w) * k + 'px', background: it.color || '#000' }));
    } else if (it.kind === 'img' && /^data:image\//.test(it.src || '')) {
      const img = el('img', 'r', { left: it.x * k + 'px', top: it.y * k + 'px', width: it.w * k + 'px', height: it.h * k + 'px' });
      img.src = it.src; img.alt = '';
      page.append(img);
    }
  }

  /** Redraw every page, the selection and the caret. */
  R.render = function () {
    const host = pagesEl();
    if (!host || !S.layout) return;
    const k = R.k();
    const sels = segments(), caret = R.caretBox(S.sel.f);
    const pages = S.layout.pages.map((pg, pi) => {
      const page = el('div', 'page', { width: pg.w * k + 'px', height: pg.h * k + 'px' });
      page.dataset.pi = pi;
      for (const s of sels) if (s.pi === pi) page.append(el('div', 'sel-r', { left: s.x * k + 'px', top: s.y * k + 'px', width: s.w * k + 'px', height: s.h * k + 'px' }));
      for (const it of pg.items) {
        if (it.kind === 'line') for (const f of it.line.frags) addFrag(page, it, f, k);
        else addItem(page, it, k);
      }
      if (caret && caret.pi === pi) page.append(el('div', 'caret', { left: caret.x * k - 1 + 'px', top: caret.top * k + 'px', height: caret.h * k + 'px' }));
      return page;
    });
    host.replaceChildren(...pages);
    R.placeIme();
  };
  /** Keep the hidden text input beside the caret, so IME popups and mobile keyboards appear there. */
  R.placeIme = function () {
    const c = document.querySelector('.caret'), ime = document.getElementById('ime');
    if (!c || !ime) return;
    const r = c.getBoundingClientRect();
    ime.style.left = Math.round(r.left) + 'px';
    ime.style.top = Math.round(r.top) + 'px';
  };
  R.reveal = function () {
    const c = document.querySelector('.caret');
    if (c) c.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  /** 1-based page number of the caret, and the page count. */
  R.pageInfo = function () {
    const c = R.caretBox(S.sel.f);
    return { page: c ? c.pi + 1 : 1, of: S.layout ? S.layout.pages.length : 1 };
  };

  S.on('layout', () => { buildLines(); R.render(); S.emit('view'); });
  S.on('sel', () => { R.render(); R.reveal(); S.emit('view'); });
  S.on('doc', () => { buildLines(); R.render(); S.emit('view'); });
  window.addEventListener('resize', () => R.placeIme());
})();
