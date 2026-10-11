/* Slop Docs — ui/outline: the document outline sidebar. A tree of the Heading 1 to 3 paragraphs, read from the document
 * through model/outline.js. The current section is highlighted as the caret or the page moves. A header button hides the
 * sidebar to a rail; the rail button shows it again. On a phone the outline is a drawer opened by the rail button. The
 * desktop state is kept per session. Shortcuts: Ctrl+Shift+O, Alt+Up, Alt+Down (SlopCmd). ES module, loaded last. */
import * as M from '../model/outline.js';
import * as A from './outline-actions.js';
import * as MENU from './outline-menu.js';

const S = window.SlopDocs;
const KEY = 'slop-docs.outline';
const PHONE = window.matchMedia('(max-width: 640px)');
const ICON = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></svg>';
const PLUS = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const collapsed = new Set();   // ids of the collapsed headings (kept for the session)
const st = { root: null, app: null, stage: null, tree: null, tn: null, nodes: new Map(), desk: true, drawer: false, active: -1, timer: 0, raf: 0 };

const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
function button(cls, html, label, onClick) {
  const b = el('button', cls);
  b.type = 'button';
  b.innerHTML = html;
  b.setAttribute('aria-label', label);
  b.title = label;
  b.addEventListener('click', onClick);
  return b;
}

/* ---------- sidebar state: desktop open or rail, phone drawer ---------- */
function readOpen() { try { return sessionStorage.getItem(KEY) !== 'shut'; } catch (e) { return true; } }
function saveOpen() { try { sessionStorage.setItem(KEY, st.desk ? 'open' : 'shut'); } catch (e) { /* storage blocked */ } }
const isOpen = () => (PHONE.matches ? st.drawer : st.desk);

function applyMode() {
  const phone = PHONE.matches;
  st.app.classList.toggle('ol-phone', phone);
  st.app.classList.toggle('ol-shut', !phone && !st.desk);
  st.app.classList.toggle('ol-drawer', phone && st.drawer);
  const show = st.root.querySelector('.ol-show');
  show.setAttribute('aria-expanded', String(isOpen()));
  show.setAttribute('aria-label', phone ? 'Open outline' : 'Show outline');
  show.title = phone ? 'Open outline' : 'Show outline (Ctrl+Shift+O)';
  st.root.querySelector('.ol-hide').title = phone ? 'Close outline' : 'Hide outline (Ctrl+Shift+O)';
}
function setOpen(open) {
  if (PHONE.matches) st.drawer = open;
  else { st.desk = open; saveOpen(); }
  applyMode();
  if (!PHONE.matches) S.focusIme();
}

/* ---------- the tree ---------- */
function render() {
  if (!st.tn || !st.tree) return;
  st.nodes = new Map();
  const rows = M.visibleRows(st.tree, collapsed).map((r) => {
    const n = r.node;
    st.nodes.set(n.b, n);
    const row = el('div', 'ol-row');
    row.dataset.b = n.b;
    row.dataset.level = n.level;
    row.setAttribute('role', 'treeitem');
    row.setAttribute('aria-level', String(r.depth + 1));
    row.style.paddingLeft = (4 + r.depth * 14) + 'px';
    if (r.hasKids) {
      row.setAttribute('aria-expanded', String(r.open));
      const tw = el('button', 'ol-twist', r.open ? '▾' : '▸');
      tw.type = 'button';
      tw.dataset.id = n.id;
      tw.setAttribute('aria-label', (r.open ? 'Collapse ' : 'Expand ') + (n.text || 'heading'));
      row.append(tw);
    } else row.append(el('span', 'ol-gap'));
    const label = el('button', 'ol-label', n.text || 'Untitled heading');
    label.type = 'button';
    label.title = n.text;
    label.dataset.b = n.b;
    row.append(label);
    return row;
  });
  if (!rows.length) rows.push(el('p', 'ol-empty', 'No headings yet. Set a paragraph to Heading 1, 2 or 3 in the style menu, or use Add section.'));
  st.tn.replaceChildren(...rows);
  markActive();
}
/** Rebuild the tree from the document (debounced after edits). */
function rebuild() {
  st.timer = 0;
  if (!S.doc) return;
  st.tree = M.buildTree(S.doc.blocks);
  render();
  setActive(M.headingAt(S.doc.blocks, S.sel.f.b));
}
function schedule() { clearTimeout(st.timer); st.timer = setTimeout(rebuild, 120); }
function toggleNode(id) {
  if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
  render();
}
const bulk = {
  collapseAll: () => { if (st.tree) { for (const n of M.allNodes(st.tree)) if (n.children.length) collapsed.add(n.id); render(); } },
  expandAll: () => { collapsed.clear(); render(); },
};

/* ---------- the current section ---------- */
/** Highlight the row of block b (the heading, or the collapsed ancestor that hides it). */
function setActive(b) {
  st.active = b;
  markActive();
}
function markActive() {
  if (!st.tn) return;
  const path = st.active >= 0 && st.tree ? M.pathTo(st.tree, st.active) : null;
  let show = -1;
  if (path) { const hidden = path.slice(0, -1).find((n) => collapsed.has(n.id)); show = (hidden || path[path.length - 1]).b; }
  let cur = null;
  for (const row of st.tn.querySelectorAll('.ol-row')) {
    const on = +row.dataset.b === show;
    row.classList.toggle('ol-active', on);
    if (on) { row.setAttribute('aria-selected', 'true'); cur = row; } else row.removeAttribute('aria-selected');
  }
  if (cur) {
    const r = cur.getBoundingClientRect(), t = st.tn.getBoundingClientRect();
    if (r.height && (r.top < t.top || r.bottom > t.bottom)) st.tn.scrollTop += r.top - t.top - t.height / 2 + r.height / 2;
  }
}
/** As the page scrolls, the section under the top of the page area is current. */
function scrollActive() {
  st.raf = 0;
  if (!st.tree || !S.R || !S.layout) return;
  const top = st.stage.getBoundingClientRect().top + 48, k = S.R.k();
  let pick = -1;
  for (const n of M.allNodes(st.tree)) {
    const c = S.R.caretBox({ b: n.b, o: 0 });
    const pg = c && document.querySelector(`#pages .page[data-pi="${c.pi}"]`);
    if (!pg) continue;
    if (pg.getBoundingClientRect().top + c.top * k > top) break;
    pick = n.b;
  }
  setActive(pick);
}

/* ---------- menus and shortcuts ---------- */
function onContext(e) {
  e.preventDefault();
  e.stopPropagation();
  if (!S.doc || !window.SlopUI) return;
  const row = e.target.closest('.ol-row');
  const node = row && st.nodes.get(+row.dataset.b);
  const items = node ? MENU.sectionItems(node, bulk) : MENU.panelItems(bulk);
  SlopUI.menu(items, e.clientX, e.clientY);
}
function moveAtCaret(dir) {
  const b = M.headingAt(S.doc.blocks, S.sel.f.b);
  if (b < 0) { if (window.SlopUI) SlopUI.toast('The caret is not in a section'); return; }
  A.move(b, dir);
}
function registerKeys() {
  if (!window.SlopCmd) return;
  SlopCmd.register([
    { id: 'outline.toggle', title: 'Show or hide the outline', group: 'Outline', keys: ['Shift+Mod+O'], run: () => setOpen(!isOpen()) },
    { id: 'outline.up', title: 'Move section up', group: 'Outline', keys: ['Alt+ArrowUp'], run: () => moveAtCaret(-1) },
    { id: 'outline.down', title: 'Move section down', group: 'Outline', keys: ['Alt+ArrowDown'], run: () => moveAtCaret(1) },
    { id: 'outline.add', title: 'Add section', group: 'Outline', keys: [], run: () => A.add() },
  ]);
}

/* ---------- mount ---------- */
function build() {
  const rail = el('div', 'ol-rail');
  rail.append(button('ol-show', ICON, 'Show outline', () => setOpen(true)));
  const panel = el('div', 'ol-panel');
  const head = el('div', 'ol-head');
  head.append(el('span', 'ol-title', 'Outline'));
  const add = button('ol-add', PLUS + '<span>Add section</span>', 'Add section', () => A.add());
  head.append(add, button('ol-hide', ICON, 'Hide outline', () => setOpen(false)));
  st.tn = el('div', 'ol-tree');
  st.tn.setAttribute('role', 'tree');
  st.tn.setAttribute('aria-label', 'Sections');
  st.tn.addEventListener('click', (e) => {
    const tw = e.target.closest('.ol-twist');
    if (tw) { e.stopPropagation(); toggleNode(tw.dataset.id); return; }
    const lb = e.target.closest('.ol-label');
    if (!lb) return;
    A.goTo(+lb.dataset.b);
    if (PHONE.matches) setOpen(false);
  });
  panel.append(head, st.tn);
  st.root.setAttribute('aria-label', 'Document outline');
  st.root.append(rail, panel);
  st.root.addEventListener('contextmenu', onContext);
  const scrim = el('div', 'ol-scrim');
  scrim.addEventListener('click', () => setOpen(false));
  st.app.append(scrim);
}
function injectCss() {
  if (document.querySelector('link[data-outline]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = new URL('../../css/outline.css', import.meta.url).href;
  l.dataset.outline = '';
  document.head.append(l);
}
function init() {
  st.root = document.getElementById('outline');
  st.app = document.getElementById('app');
  st.stage = document.getElementById('stage');
  if (!S || !st.root || !st.app || !st.stage) return;
  injectCss();
  st.desk = readOpen();
  build();
  applyMode();
  PHONE.addEventListener('change', applyMode);
  st.stage.addEventListener('scroll', () => { if (!st.raf) st.raf = requestAnimationFrame(scrollActive); }, { passive: true });
  S.on('sel', () => { if (S.doc) setActive(M.headingAt(S.doc.blocks, S.sel.f.b)); });
  S.on('change', () => { if (S.doc) setActive(M.headingAt(S.doc.blocks, S.sel.f.b)); schedule(); });
  S.on('doc', schedule);
  S.on('layout', schedule);
  registerKeys();
  if (S.doc) rebuild();
}
init();
