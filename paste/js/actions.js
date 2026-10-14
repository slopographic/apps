/* Paste actions: new pastes (typed, pasted or an image), opening, copy, download, the share link, Trash, and
 * the open paste remembered for the next visit. The share link is local: ?paste=<id> opens the paste in this browser. */
import * as store from './store.js';
import { S, byId, byLink, visible } from './state.js';
import { EXT } from './highlight.js';
import { renderAll, showLink, onOpen } from './view.js';

const toast = (m) => { if (window.SlopUI) SlopUI.toast(m); };
const remember = () => { try { SlopSession.save('paste', 'last', { id: S.id }).catch(() => {}); } catch (e) { /* no session store */ } };
const refresh = () => renderAll();

export function setPane(pane) { S.pane = pane; refresh(); }

export function open(id) {
  if (!byId(id)) return;
  S.id = id;
  S.pane = 'editor';
  remember();
  refresh();
}

/** Opens the paste with this link ID (?paste=<id>). Resolves with false when this browser has no such paste. */
export function openLink(pasteId) {
  const p = byLink(pasteId);
  if (!p) { toast('No paste with that link is in this browser'); return false; }
  open(p.id);
  return true;
}

export async function newPaste(o = {}) {
  let p;
  try { p = await store.create(o); }
  catch (e) { toast('Could not start a paste: ' + ((e && e.message) || 'Slop Drive is unavailable')); return null; }
  S.pastes.unshift(p);
  S.id = p.id;
  S.pane = 'editor';
  remember();
  refresh();
  const src = document.getElementById(p.kind === 'image' ? 'pb-title' : 'pb-src');
  if (src) src.focus();
  return p;
}

/** Paste handling for the whole page: an image makes an image paste; text pasted outside a field makes a text paste. */
export async function onPaste(e) {
  const items = [...((e.clipboardData && e.clipboardData.items) || [])];
  const img = items.find((i) => i.kind === 'file' && i.type.startsWith('image/'));
  if (img) {
    e.preventDefault();
    const blob = img.getAsFile();
    if (blob) await newPaste({ kind: 'image', blob, title: 'Image' });
    return;
  }
  const t = e.target;
  const typing = t && t.matches && t.matches('input, textarea, [contenteditable]');
  const text = e.clipboardData && e.clipboardData.getData('text/plain');
  if (!typing && text) {
    e.preventDefault();
    // The open paste is still blank (for example the one opened on the first visit): fill it, rather than add an empty one.
    const cur = byId(S.id);
    if (cur && cur.kind === 'text' && !cur.body && !cur.title) {
      cur.body = text;
      store.touch(cur);
      refresh();
      toast('Pasted into the open paste');
      return;
    }
    await newPaste({ kind: 'text', body: text });
    toast('Pasted as a new paste');
  }
}

export async function addImage() {
  const files = await SlopUI.pickFiles({ accept: 'image/*' });
  const f = files && files[0];
  if (f) await newPaste({ kind: 'image', blob: f, title: f.name.replace(/\.[^.]+$/, '') || 'Image' });
}

export async function copy(p) {
  if (!p) return;
  try {
    if (p.kind === 'image') await navigator.clipboard.write([new ClipboardItem({ [p.blob.type]: p.blob })]);
    else await navigator.clipboard.writeText(p.body);
    toast('Copied');
  } catch (e) { toast('Could not copy here. Use Download instead.'); }
}

const baseName = (p) => (p.title || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').trim().slice(0, 80) || 'paste-' + p.pasteId.slice(0, 6);

export function download(p) {
  if (!p) return;
  let name;
  if (p.kind === 'image') {
    name = baseName(p) + '.' + ((p.blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg'));
    SlopUI.download(p.blob, name);
  } else {
    name = baseName(p) + '.' + (EXT[p.language] || 'txt');
    SlopUI.download(new Blob([p.body], { type: 'text/plain;charset=utf-8' }), name);
  }
  toast('Downloaded ' + name);
}

/** The link to this paste inside the app: this page with ?paste=<link ID>. Nothing is sent anywhere. */
export function shareUrl(p) {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('paste', p.pasteId);
  return u.href;
}

export function share(p) {
  if (!p) return;
  const url = shareUrl(p);
  showLink(url);
  navigator.clipboard.writeText(url).then(() => toast('Link copied. It opens this paste in this browser.'), () => toast('Link ready. It opens this paste in this browser.'));
}

export async function remove(p) {
  if (!p) return;
  const ok = await SlopUI.confirm('Move to Trash?', `“${p.title || 'This paste'}” goes to the Slop Drive Trash, where you can restore it.`, 'Move to Trash', { danger: true });
  if (!ok) return;
  store.forget(p.id);
  try { await store.trash(p.id); } catch (e) { toast('Could not move to Trash: ' + e.message); return; }
  if (p.url) URL.revokeObjectURL(p.url);
  S.pastes = S.pastes.filter((x) => x.id !== p.id);
  if (S.id === p.id) { S.id = null; S.pane = 'list'; }
  remember();
  refresh();
  toast('Moved to Trash');
}

/** The next (+1) or previous (-1) paste in the list. */
export function step(dir) {
  const list = visible();
  if (!list.length) return;
  const i = list.findIndex((p) => p.id === S.id);
  const j = i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length;
  open(list[j].id);
}

onOpen(open);
