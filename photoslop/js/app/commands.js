/* PhotoSlop: every menu item, tool and canvas key as a SlopCmd command (shared/commands), so the
 * Spotlight palette (⌘K) finds them and the person can rebind any shortcut. Without SlopCmd the
 * legacy keyboard handler in ui/doc-dialogs.js keeps working. */
'use strict';

let CMD_ON = false;
const cmdKey = (k) => k.replace(/Ctrl\+/g, 'Mod+');
const slug = (s) => s.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// The native paste event carries system images, so Ctrl+V stays with the legacy handler.
const NATIVE_KEYS = new Set(['Ctrl+V', 'Shift+Ctrl+V']);
/** Extra default keys that the menus don't show. */
const EXTRA_KEYS = { 'ps.edit-undo': ['Alt+Mod+Z'], 'ps.edit-redo': ['Mod+Y'], 'ps.edit-clear': ['Backspace'], 'ps.view-zoom-in': ['Shift+Mod+='] };

/** Menu label for an item's shortcut: the person's own binding when SlopCmd is active. */
function menuKey(it) {
  if (CMD_ON && it.cmdId && window.SlopCmd) return SlopCmd.keyFor(it.cmdId);
  return it.key ? keyLabel(it.key) : '';
}
function menuCommands() {
  const out = [];
  const walk = (items, group, path) => {
    for (const it of items) {
      if (!it || it === '-') continue;
      if (it.sub) { walk(it.sub, group, path.concat(it.label)); continue; }
      if (!it.act || /^cmd\./.test(it.cmdId || '')) continue;
      const id = it.cmdId || (it.cmdId = 'ps.' + slug([group].concat(path, it.label).join(' ')));
      const keys = NATIVE_KEYS.has(it.key) ? [] : [it.key].concat(it.alt || []).filter(Boolean).map(cmdKey).concat(EXTRA_KEYS[id] || []);
      out.push({ id, title: path.concat(it.label.replace(/…$/, '')).join(' › ') + (it.label.endsWith('…') ? '…' : ''), group, keys, keywords: [group].concat(path),
        when: () => menuEnabled(it), checked: it.check, run: () => it.act() });
    }
  };
  MENUS.forEach(([n, items]) => { if (Array.isArray(items)) walk(items, n, []); });
  return out;
}

/* ---------- tools and canvas keys ---------- */
function pickToolKey(k, cycle) {
  const ids = TOOL_KEYS[k]; if (!ids) return;
  if (cycle && ids.includes(UI.tool)) selectTool(ids[(ids.indexOf(UI.tool) + 1) % ids.length]);
  else selectTool(ids.includes(store.get('lastOf.' + k)) ? store.get('lastOf.' + k) : ids[0]);
}
function brushStep(up, hard) {
  const o = BRUSH_OPTS()[UI.tool]; if (!o) return;
  if (hard) { if (o.hardness != null) o.hardness = clamp(Math.round((o.hardness + (up ? 0.25 : -0.25)) * 4) / 4, 0, 1); }
  else { const s = o.size, step = s < 10 ? 1 : s < 50 ? 5 : s < 100 ? 10 : s < 300 ? 25 : 50; o.size = clamp(s + (up ? step : -step), 1, 1000); }
  saveToolOptions(); buildOptions(); dirty();
}
function toolOpacity(n) { const o = BRUSH_OPTS()[UI.tool]; if (!o || o.opacity == null) return; o.opacity = n === 0 ? 1 : n / 10; saveToolOptions(); buildOptions(); toast(`Opacity ${Math.round(o.opacity * 100)}%`, 900); }
function toolCommands() {
  const out = [], hasBrush = () => !!BRUSH_OPTS()[UI.tool];
  for (const k in TOOL_KEYS) {
    const ids = TOOL_KEYS[k];
    ids.forEach((id, i) => out.push({ id: 'ps.tool.' + id, title: TOOL[id].name, group: 'Tools', icon: TOOL[id].icon, keys: i ? [] : [k], keywords: ['tool', k], checked: () => UI.tool === id, run: () => (i ? selectTool(id) : pickToolKey(k, false)) }));
    if (ids.length > 1) out.push({ id: 'ps.tool.cycle-' + slug(k), title: 'Cycle ' + ids.map((id) => TOOL[id].name.replace(/ Tool$/, '')).join(' / '), group: 'Tools', keys: ['Shift+' + k], run: () => pickToolKey(k, true) });
  }
  const C2 = (id, title, keys, run, extra) => out.push(Object.assign({ id: 'ps.' + id, title, group: 'Canvas', keys, run }, extra));
  C2('swap-colors', 'Swap foreground and background colours', ['X'], swapColors);
  C2('default-colors', 'Default colours (black / white)', ['D'], defaultColors);
  C2('brush-bigger', 'Brush size up', [']'], () => brushStep(true), { when: hasBrush, repeat: true });
  C2('brush-smaller', 'Brush size down', ['['], () => brushStep(false), { when: hasBrush, repeat: true });
  C2('brush-harder', 'Brush hardness up', ['Shift+]'], () => brushStep(true, true), { when: hasBrush });
  C2('brush-softer', 'Brush hardness down', ['Shift+['], () => brushStep(false, true), { when: hasBrush });
  for (let n = 0; n <= 9; n++) C2('opacity-' + n, `Tool opacity ${n ? n * 10 : 100}%`, [String(n)], () => toolOpacity(n), { when: hasBrush, hidden: true });
  for (const [dir, dx, dy] of [['left', -1, 0], ['right', 1, 0], ['up', 0, -1], ['down', 0, 1]]) {
    const A = 'Arrow' + dir[0].toUpperCase() + dir.slice(1), isMove = () => UI.tool === 'move' && !TRANSFORM.active;
    C2('nudge-' + dir, `Nudge ${dir} 1 px`, [A], () => nudge(dx, dy), { when: isMove, repeat: true });
    C2('nudge-' + dir + '-10', `Nudge ${dir} 10 px`, ['Shift+' + A], () => nudge(dx * 10, dy * 10), { when: isMove, repeat: true });
  }
  C2('next-doc', 'Next document', ['Mod+Tab'], () => cycleDoc(1), { group: 'Window', when: () => DOCS.length > 1 });
  C2('prev-doc', 'Previous document', ['Shift+Mod+Tab'], () => cycleDoc(-1), { group: 'Window', when: () => DOCS.length > 1 });
  for (let i = 1; i <= 9; i++) C2('doc-' + i, `Go to document ${i}`, ['Alt+' + i], () => { if (DOCS[i - 1]) switchToDoc(DOCS[i - 1]); }, { group: 'Window', when: () => !!DOCS[i - 1], hidden: true });
  C2('guides-panel', 'Guides panel (guide layouts)', [], () => openGuidesPanel(), { group: 'Window', keywords: ['guideguide', 'grid', 'columns', 'layout'] });
  return out;
}

/* ---------- keys that must run before the commands ---------- */
// Space-to-pan and tool keys (Enter/Esc/Backspace in transforms, crop, lassos) win over shortcuts, as before.
/** Keys pressed in an open menu (SlopUI or the menu bar) belong to the menu, not the tools. */
function inMenu(e) { return !!(e.target.closest && e.target.closest('.sui-menu, .menu')); }
function onEarlyKey(e) {
  if (!CMD_ON || SlopUI.openDialogs || isTyping(e.target) || inMenu(e) || (window.SlopCmd && SlopCmd.isOpen)) return;
  if (e.code === 'Space' && !e.ctrlKey && !e.metaKey) { if (!e.repeat) { V.space = true; V.el.classList.add('space'); } e.preventDefault(); e.stopImmediatePropagation(); return; }
  const t = currentTool();
  if (t.onKey && t.onKey(e)) { e.preventDefault(); e.stopImmediatePropagation(); dirty(); return; }
  if (openMenu && e.key === 'Escape') { closeMenus(); e.stopImmediatePropagation(); }
}
function wireCommands() {
  window.addEventListener('keydown', onEarlyKey, true);
  if (!window.SlopCmd || !SlopCmd.register) return false;
  try {
    SlopCmd.init({ app: 'photoslop' });
    SlopCmd.register(menuCommands().concat(toolCommands()));
    CMD_ON = true;
    const b = $('#cmdBtn'); if (b) { b.hidden = false; b.title = 'Search commands (' + SlopCmd.keyFor('cmd.palette') + ')'; }
  } catch (err) { console.warn(err); CMD_ON = false; }
  return CMD_ON;
}
function openCommandPalette(q) { if (CMD_ON) SlopCmd.open(q); else dlgShortcuts(); }
function openKeymap() { if (CMD_ON) SlopCmd.openKeymap(); else dlgShortcuts(); }
