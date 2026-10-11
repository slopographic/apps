/* Slop Contacts: the detail panel. It shows one contact: a preview (photo, name, phones, e-mails, addresses, groups,
 * details, notes) with Edit, Duplicate and Delete, or the edit form in place with Save and Cancel. Clicking another row
 * switches it and the list stays open. A form with unsaved changes asks before it is left. On a wide screen it is a
 * column on the right; on a phone it is a bottom sheet (contacts-panel.css). Adds SlopContacts.panel. */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const S = SC.state;
  const UI = window.SlopUI;
  const el = UI.el;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  /** mode: 'none' (closed), 'preview', or 'edit'. id is the contact shown (null for a new contact in the form). */
  const st = { mode: 'none', id: null, form: null, base: null };

  const tag = (t) => (t ? `<em class="pv-type">${esc(t)}</em>` : '');
  const addr = (a) => [[a.po, a.ext, a.street].filter(Boolean).join(' '), [a.locality, a.region, a.postal].filter(Boolean).join(' '), a.country]
    .filter(Boolean).map(esc).join('<br>');
  const ul = (items) => (items.length ? `<ul class="pv-list">${items.map((x) => `<li>${x}</li>`).join('')}</ul>` : '');
  const sec = (title, body) => (body ? `<section class="pv-sec"><h3>${title}</h3>${body}</section>` : '');
  const btn = (label, cls, act) => { const b = el('button', { type: 'button', class: cls }, label); b.addEventListener('click', act); return b; };

  /** The preview of one contact (static HTML; every value is escaped). */
  function previewHtml(c) {
    const T = SC.editor.typeLabel;
    const work = [c.title, c.org, c.dept].filter(Boolean).join(' · ');
    const more = [c.bday && `<p><b>Birthday</b> ${esc(c.bday)}</p>`, c.url && `<p><b>Website</b> ${esc(c.url)}</p>`];
    const photoNote = c.photo && !SC.photo.isImage(c.photo) ? `<p class="pv-sub">Photo link: ${esc(c.photo)}</p>` : '';
    return `<div class="pv-head">${SC.photoUi.avatarHtml(c, true)}<div class="pv-names"><p class="pv-name">${esc(SC.model.displayName(c))}</p>` +
      (work ? `<p class="pv-sub">${esc(work)}</p>` : '') + photoNote + '</div></div>' +
      sec('Phones', ul(c.phones.map((p) => `${tag(T(p.types))}<span>${esc(p.value)}</span>`))) +
      sec('E-mails', ul(c.emails.map((e) => `${tag(T(e.types))}<span>${esc(e.value)}</span>`))) +
      sec('Addresses', ul(c.adr.map((a) => `${tag(T(a.types))}<span>${addr(a)}</span>`))) +
      sec('Groups', c.groups.length ? `<div class="pv-chips">${c.groups.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div>` : '') +
      sec('Details', more.filter(Boolean).join('')) +
      sec('Note', c.note ? `<p class="pv-note">${esc(c.note)}</p>` : '');
  }

  function setOpen(on) {
    $('detail').hidden = !on;
    const shell = $('shell');
    if (shell) shell.classList.toggle('has-detail', on);
  }
  function close() {
    st.mode = 'none'; st.id = null; st.form = null; st.base = null;
    setOpen(false);
    S.emit('render');
  }
  function paintPreview() {
    const c = S.byId(st.id);
    if (!c) { close(); return; }
    $('detailTitle').textContent = 'Contact';
    $('detailBody').innerHTML = previewHtml(c);
    $('detailBody').scrollTop = 0;
    $('detailFoot').replaceChildren(
      btn('Edit', 'btn primary', () => edit(c.id)),
      btn('Duplicate', 'tb-btn', () => duplicate(c.id)),
      btn('Delete', 'tb-btn danger', () => remove(c.id)));
  }
  function showPreview(id) {
    st.mode = 'preview'; st.id = id; st.form = null; st.base = null;
    if (!S.byId(id)) { close(); return; }
    paintPreview();
    setOpen(true);
    S.emit('render');
  }
  function startEdit(id) {
    const base = id ? S.byId(id) : SC.model.blank();
    if (!base) return;
    st.mode = 'edit'; st.id = id; st.base = base; st.form = SC.editor.form(base);
    $('detailTitle').textContent = id ? 'Edit contact' : 'New contact';
    $('detailBody').replaceChildren(st.form.body);
    $('detailBody').scrollTop = 0;
    $('detailFoot').replaceChildren(btn('Cancel', 'tb-btn', cancel), btn('Save', 'btn primary', save));
    setOpen(true);
    S.emit('render');
  }
  const isDirty = () => st.mode === 'edit' && !!st.form && !SC.model.sameContent(st.form.read(), st.base);
  /** Runs go() now when the form has no unsaved changes, else after the person says to discard them. */
  function leaving(go) {
    if (!isDirty()) { go(); return; }
    UI.confirm('Discard changes?', 'The form has changes that are not saved. Discard them?', 'Discard', { danger: true })
      .then((ok) => { if (ok) go(); });
  }
  function cancel() { if (st.id) showPreview(st.id); else close(); }
  function save() {
    const c = st.form.read();
    if (!SC.model.hasContent(c) && !c.phones.length && !c.emails.length) { UI.toast('Add a name, a phone or an e-mail'); return; }
    if (st.id) S.replaceMany([c]); else S.setList([...S.list, c]);
    showPreview(c.id);
  }

  /** Show a contact (preview). Leaves an edit form only after the person agrees to discard it. */
  function show(id) { leaving(() => showPreview(id)); }
  /** Edit a contact in the panel, or a new one (id null). */
  function edit(id) { leaving(() => startEdit(id)); }
  /** A copy placed under the original, opened in the form so it can be changed. */
  function duplicate(id) {
    const c = S.byId(id);
    if (!c) return;
    const copy = SC.model.normalise({ ...c, id: SC.model.uid() });
    const list = S.list.slice();
    list.splice(list.findIndex((x) => x.id === id) + 1, 0, copy);
    S.setList(list);
    startEdit(copy.id);
  }
  async function remove(id) {
    const c = S.byId(id);
    if (!c) return;
    const ok = await UI.confirm('Delete this contact?', `“${SC.model.displayName(c)}” is removed from this list. Undo is not available.`, 'Delete', { danger: true });
    if (!ok || !S.byId(id)) return;
    S.setList(S.list.filter((x) => x.id !== id));
    close();
  }

  /** The list changed (saved, bulk change, deleted). A preview follows the contact; a form is left alone unless its contact is gone. */
  function onChange() {
    if (st.mode === 'none') return;
    if (st.id && !S.byId(st.id)) { close(); return; }
    if (st.mode === 'preview') paintPreview();
  }

  function mount() {
    $('detailClose').addEventListener('click', () => leaving(close));
    S.on('change', onChange);
    S.on('open', close);
  }

  SC.panel = {
    show, edit, duplicate, remove, mount,
    close: () => leaving(close),
    openId: () => (st.mode === 'none' ? null : st.id),
    isDirty,
  };
  mount();
})();
