/* SlopLabel — ui/keys: keyboard shortcuts, clipboard (copy/cut/paste, pasted images and text),
 * arrange commands (align, distribute, order, group, rotate, lock) and the canvas context menu. */
'use strict';

/* ---------------- arrange commands ---------------- */
function alignSel(how) {
  const objs = selObjs(); if (!objs.length) return;
  const L = App.doc.label, ref = objs.length === 1 ? { x: 0, y: 0, w: L.w, h: L.h } : selBox();
  // align uses drawn boxes: shift each object by the offset between its box and its stored position
  const get = previewGet();
  for (const o of objs) {
    if (o.locked) continue;
    const b = boxOf(o), tmp = { x: b.x, y: b.y, w: b.w, h: b.h, locked: false };
    alignObjects([tmp], how, ref);
    o.x = round(o.x + tmp.x - b.x, 3); o.y = round(o.y + tmp.y - b.y, 3);
    syncAutoSize(App.doc, o, get);
  }
  commit('Align ' + how);
}
function distributeSel(axis) { if (distributeObjects(selObjs(), axis)) commit('Distribute'); else SlopUI.toast('Select three or more objects to distribute'); }
function orderSel(how) { if (!App.sel.length) return; reorder(App.doc, App.sel, how); commit({ front: 'Bring to front', back: 'Send to back', forward: 'Bring forward', backward: 'Send backward' }[how]); }
function groupSel() { if (groupObjects(App.doc, App.sel)) commit('Group'); }
function ungroupSel() { if (ungroupObjects(App.doc, App.sel)) commit('Ungroup'); }
/** Rotate 90° steps about the object's centre. */
function rotateSel(deg) {
  editSel((o) => {
    if (o.locked) return;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    o.rot = (((o.rot || 0) + deg) % 360 + 360) % 360;
    if (deg % 180) { const w = o.w; o.w = o.h; o.h = w; o.x = round(cx - o.w / 2, 3); o.y = round(cy - o.h / 2, 3); }
  }, 'Rotate');
}
function setRotation(o, r) { const d = ((r - (o.rot || 0)) % 360 + 360) % 360; if (d) { App.sel = [o.id]; rotateSel(d); } }
function toggleLock() { const objs = selObjs(), lock = !objs.every((o) => o.locked); editSel((o) => { o.locked = lock; }, lock ? 'Lock' : 'Unlock'); }
function toggleHide() { const objs = selObjs(), hide = !objs.every((o) => o.hidden); editSel((o) => { o.hidden = hide; }, hide ? 'Hide' : 'Show'); }
function nudge(dx, dy) {
  if (!App.sel.length) return;
  editSel((o) => { if (!o.locked) { o.x = round(o.x + dx, 3); o.y = round(o.y + dy, 3); } }, 'Nudge', 'nudge', { keepProps: false });
}

/* ---------------- clipboard ---------------- */
function copySel() {
  const objs = selObjs(); if (!objs.length) return false;
  const assets = {}; for (const o of objs) if (o.asset && App.doc.assets[o.asset]) assets[o.asset] = App.doc.assets[o.asset];
  App.clip = { objects: deepClone(objs), assets };
  lsSet('sloplabel-clip', JSON.stringify(App.clip).length < 2e6 ? JSON.stringify(App.clip) : '');
  status(`Copied ${objs.length} object${objs.length > 1 ? 's' : ''}`, '', 1500);
  return true;
}
function cutSel() { if (copySel()) deleteSel(); }
function pasteClip() {
  let c = App.clip;
  if (!c) { try { c = JSON.parse(lsGet('sloplabel-clip') || 'null'); } catch (e) { c = null; } }
  if (!c || !c.objects || !c.objects.length) return false;
  Object.assign(App.doc.assets, c.assets || {});
  const off = c.objects.some((o) => App.doc.objects.some((p) => p.x === o.x && p.y === o.y)) ? 2 : 0, gmap = {};
  const out = c.objects.map((o) => Object.assign(deepClone(o), { id: uid(), x: round(o.x + off, 3), y: round(o.y + off, 3), group: o.group ? gmap[o.group] || (gmap[o.group] = uid('g')) : null }));
  App.doc.objects.push(...out);
  App.sel = out.map((o) => o.id);
  if (c === App.clip) c.objects = out.map((o) => deepClone(o));
  commit('Paste');
  return true;
}
/** System paste: images become image objects, plain text becomes a text object. */
async function onPaste(e) {
  if (isTyping(e.target)) return;
  const items = [...((e.clipboardData && e.clipboardData.items) || [])];
  const img = items.find((i) => i.kind === 'file' && /^image\//.test(i.type));
  if (img) { e.preventDefault(); await insertImageFile(img.getAsFile()); return; }
  e.preventDefault();
  if (pasteClip()) return;
  const text = e.clipboardData && e.clipboardData.getData('text/plain');
  if (text && /^\s*\^XA/.test(text)) { await importZPLText(text); return; }
  if (text) addObject(makeObject(text.length > 40 || text.includes('\n') ? 'para' : 'text', { content: text.slice(0, 2000), x: 4, y: 4 }));
}

/* ---------------- keyboard: Space-to-pan (held); the rest lives in ui/commands.js ---------------- */
const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
function onKeyDown(e) {
  if (e.key === ' ' && !isTyping(e.target)) { spaceDown = true; $('stage').classList.add('panning'); if (e.target === $('stage')) e.preventDefault(); }
  // every other shortcut is a command in ui/commands.js, dispatched (and rebindable) by SlopCmd
}
function onKeyUp(e) { if (e.key === ' ') { spaceDown = false; $('stage').classList.remove('panning'); } }

/* ---------------- context menu ---------------- */
function contextItems() {
  const n = App.sel.length, one = selOne();
  if (!n) return [
    { label: 'Paste', key: 'Ctrl+V', act: () => pasteClip() || SlopUI.toast('Nothing to paste') },
    { label: 'Select all', key: K('selectAll'), act: selectAll }, '-',
    { label: 'Label setup…', act: () => labelSetupDialog() }, { label: 'Fit label', key: K('fit'), act: fitView },
  ];
  const grouped = selObjs().some((o) => o.group);
  return [
    { label: 'Cut', key: K('cut'), act: cutSel }, { label: 'Copy', key: K('copy'), act: copySel }, { label: 'Paste', key: 'Ctrl+V', act: pasteClip },
    { label: 'Duplicate', key: K('duplicate'), act: () => duplicateSel() }, { label: 'Delete', key: K('delete'), act: deleteSel }, '-',
    one ? { label: 'Edit content…', key: K('editContent'), act: focusContent } : null,
    { label: 'Rotate 90° clockwise', act: () => rotateSel(90) }, { label: 'Rotate 90° counter-clockwise', act: () => rotateSel(270) },
    { label: 'Align', sub: alignItems() },
    { label: 'Arrange', sub: [{ label: 'Bring to front', key: K('front'), act: () => orderSel('front') }, { label: 'Bring forward', key: K('forward'), act: () => orderSel('forward') }, { label: 'Send backward', key: K('backward'), act: () => orderSel('backward') }, { label: 'Send to back', key: K('back'), act: () => orderSel('back') }] },
    n > 1 ? { label: 'Group', key: K('group'), act: groupSel } : null,
    grouped ? { label: 'Ungroup', key: K('ungroup'), act: ungroupSel } : null, '-',
    { label: selObjs().every((o) => o.locked) ? 'Unlock' : 'Lock', key: K('lock'), act: toggleLock },
    { label: selObjs().every((o) => o.hidden) ? 'Show' : 'Hide', act: toggleHide },
  ];
}
function alignItems() {
  const one = App.sel.length === 1, to = one ? ' (to label)' : '';
  return [
    { label: 'Left' + to, act: () => alignSel('left') }, { label: 'Centre horizontally' + to, act: () => alignSel('hcenter') }, { label: 'Right' + to, act: () => alignSel('right') }, '-',
    { label: 'Top' + to, act: () => alignSel('top') }, { label: 'Centre vertically' + to, act: () => alignSel('vcenter') }, { label: 'Bottom' + to, act: () => alignSel('bottom') }, '-',
    { label: 'Distribute horizontally', disabled: App.sel.length < 3, act: () => distributeSel('h') }, { label: 'Distribute vertically', disabled: App.sel.length < 3, act: () => distributeSel('v') },
  ];
}
function initKeys() {
  addEventListener('keydown', onKeyDown);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', () => { spaceDown = false; });
  document.addEventListener('paste', onPaste);
  document.addEventListener('copy', (e) => { if (!isTyping(e.target) && copySel()) e.preventDefault(); });
  document.addEventListener('cut', (e) => { if (!isTyping(e.target) && App.sel.length) { e.preventDefault(); cutSel(); } });
}
