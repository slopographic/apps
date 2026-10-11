/* SlopFaces panel: the Faces and people dialog, shared by Slop Gallery and Slop Drive. Two tabs:
 *   People    the groups (one card per person: name, count, a row of faces). Select two groups and Merge them (one name).
 *             Open a group to see its photos and its faces: select faces, then Move to another group, Split into a new
 *             group, or Not this person. Ungrouped faces and faces marked not-this-person are listed as "Not in a person".
 *   All faces every detected face as a thumbnail, with the photo it came from; a click opens that photo.
 * The header has the global switch (Show faces: Off / Boxes on photos / Count only), Undo, and Regroup (uses the threshold
 * in Settings). The adapter comes from the app: { scope, stampOf(id), blobOf(id), nameOf(id), openPhoto(id) }.
 * Classic script; adds to window.SlopFaces.panel: open(adapter), close(), isOpen(). See shared/faces/HANDOFF.md. */
(function (g) {
  'use strict';
  const F = (g.SlopFaces = g.SlopFaces || {});
  const PN = (F.panel = F.panel || {});
  const SU = () => g.SlopUI;
  const el = (t, a, ...k) => SU().el(t, a, ...k);
  const MODE_LABEL = { off: 'Off', boxes: 'Boxes on photos', count: 'Count only' };
  const NONE = '_none'; // the pseudo group of faces in no person
  let cur = null; // { d, A, P, tab, group, sel, fsel, body, cropBusy }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const label = (P, g2) => (g2.name ? g2.name : `Person ${P.list().findIndex((x) => x.id === g2.id) + 1}`);

  PN.open = function (adapter) {
    if (cur) { cur.d.close(false); cur = null; }
    if (!SU() || !F.peopleFor || !F.groups || !F.view || !F.crops) return null;
    const P = F.peopleFor(adapter.scope, adapter);
    const body = el('div', { class: 'faces-body' });
    const st = { tab: 'people', group: null, sel: new Set(), fsel: new Set(), body, cropBusy: false, A: adapter, P };
    cur = st;
    const d = SU().dialog({
      title: adapter.title || 'Faces and people', cls: 'sui-wide faces-panel', body,
      buttons: [{ label: 'Close', primary: true }],
      onClose: () => { if (cur === st) { cur = null; F.crops.clear(); } if (st.unsub) st.unsub(); },
    });
    st.d = d;
    st.unsub = P.subscribe(() => render(st));
    P.load().then(() => render(st));
    render(st);
    return d;
  };
  PN.close = () => { if (cur) cur.d.close(false); };
  PN.isOpen = () => !!cur;

  function render(st) {
    if (cur !== st) return;
    const { P, body } = st;
    const kids = [head(st), st.tab === 'people' ? peopleView(st) : allView(st)];
    body.replaceChildren(...kids);
    if (!st.cropBusy) {
      st.cropBusy = true;
      F.crops.load(P.faces(), st.A).then((n) => { st.cropBusy = false; if (n && cur === st) render(st); }, () => { st.cropBusy = false; });
    }
  }
  function say(st, text) { const n = st.body.querySelector('.faces-say'); if (n) n.textContent = text; }

  function head(st) {
    const { P, A } = st;
    const mode = F.view.mode();
    const sel = el('select', { class: 'set-select faces-mode', 'aria-label': 'Show faces', onchange: (e) => { F.view.setMode(e.target.value); } },
      ...F.view.modes().map((m) => el('option', { value: m, selected: m === mode ? 'selected' : null }, MODE_LABEL[m])));
    const tab = (id, text) => el('button', { type: 'button', class: 'sui-btn faces-tab' + (st.tab === id ? ' sui-primary' : ''), 'aria-pressed': st.tab === id ? 'true' : 'false', onclick: () => { st.tab = id; st.group = null; st.sel.clear(); st.fsel.clear(); render(st); } }, text);
    const undo = el('button', { type: 'button', class: 'sui-btn', disabled: P.canUndo() ? null : 'disabled', onclick: () => { P.undo(); say(st, 'Undone.'); } }, 'Undo');
    const regroup = el('button', { type: 'button', class: 'sui-btn', title: 'Groups the faces again at the threshold in Settings. Your own moves and merges stay.', onclick: () => { P.regroup(); say(st, `Grouped again at a threshold of ${F.threshold()}.`); } }, 'Regroup');
    const total = P.faces().length;
    return el('div', { class: 'faces-head' },
      el('label', { class: 'faces-modew' }, 'Show faces ', sel),
      el('div', { class: 'faces-tabs' }, tab('people', 'People'), tab('all', 'All faces')),
      el('div', { class: 'faces-tools' }, undo, regroup),
      el('p', { class: 'faces-say muted', role: 'status', 'aria-live': 'polite' }, total ? `${plural(total, 'face', 'faces')} found on this device.` : 'No faces yet. Find faces on pictures first.'));
  }

  /** One face: a checkbox (when selectable), its crop and the name of its photo. */
  function faceItem(st, f, selectable) {
    const url = F.crops.url(f.ref);
    const box = el('label', { class: 'fc' + (st.fsel.has(f.ref) ? ' on' : '') },
      selectable ? el('input', { type: 'checkbox', checked: st.fsel.has(f.ref) ? 'checked' : null, 'aria-label': 'Select this face', onchange: (e) => { if (e.target.checked) st.fsel.add(f.ref); else st.fsel.delete(f.ref); render(st); } }) : null,
      url ? el('img', { src: url, alt: '', width: 96, height: 96, loading: 'lazy' }) : el('span', { class: 'fc-empty', 'aria-hidden': 'true' }, '…'),
      el('span', { class: 'fc-cap' }, st.A.nameOf(f.id) || f.id));
    if (!selectable) box.addEventListener('click', (e) => { if (e.target.tagName !== 'INPUT') st.A.openPhoto(f.id); });
    return box;
  }

  function peopleView(st) {
    return st.group ? detailView(st) : groupsView(st);
  }

  function groupsView(st) {
    const { P } = st;
    const groups = P.list();
    const ids = new Set(groups.map((x) => x.id));
    for (const id of [...st.sel]) if (!ids.has(id)) st.sel.delete(id);
    const picked = groups.filter((x) => st.sel.has(x.id));
    const nameIn = el('input', { type: 'text', class: 'faces-merge-name', maxlength: '80', placeholder: 'Name for the merged person', 'aria-label': 'Name for the merged person', value: picked[0] ? picked[0].name : '' });
    const merge = picked.length === 2 ? el('div', { class: 'faces-merge' }, el('span', null, 'Merge into one person: '), nameIn,
      el('button', { type: 'button', class: 'sui-btn sui-primary', onclick: () => {
        const [a, b] = picked;
        P.merge(a.id, b.id, nameIn.value);
        st.sel.clear();
        say(st, 'Merged. Undo takes it back.');
      } }, 'Merge')) : el('p', { class: 'muted faces-hint' }, picked.length ? 'Select one more person to merge with.' : 'Select two people to merge them.');
    const cards = groups.map((x) => el('div', { class: 'fp-card' + (st.sel.has(x.id) ? ' on' : '') },
      el('label', { class: 'fp-pick' }, el('input', { type: 'checkbox', checked: st.sel.has(x.id) ? 'checked' : null, 'aria-label': 'Select this person', onchange: (e) => { if (e.target.checked) st.sel.add(x.id); else st.sel.delete(x.id); render(st); } })),
      el('input', { type: 'text', class: 'fp-name', maxlength: '80', value: x.name, placeholder: label(P, x), 'aria-label': 'Name of this person', onchange: (e) => { P.rename(x.id, e.target.value); say(st, 'Renamed.'); } }),
      el('p', { class: 'muted fp-n' }, plural(x.refs.length, 'face', 'faces'), ' · ', plural(new Set(x.faces.map((f) => f.id)).size, 'photo', 'photos')),
      el('div', { class: 'fp-strip' }, ...x.faces.slice(0, 6).map((f) => faceItem(st, f, false))),
      el('button', { type: 'button', class: 'sui-btn', onclick: () => { st.group = x.id; st.fsel.clear(); render(st); } }, 'Open')));
    const none = P.ungrouped().concat(P.rejected());
    const rest = none.length ? el('div', { class: 'fp-card fp-none' }, el('p', { class: 'fp-name' }, 'Not in a person'),
      el('p', { class: 'muted fp-n' }, plural(none.length, 'face', 'faces')),
      el('button', { type: 'button', class: 'sui-btn', onclick: () => { st.group = NONE; st.fsel.clear(); render(st); } }, 'Open')) : null;
    return el('div', { class: 'faces-people' },
      merge,
      groups.length ? el('div', { class: 'fp-grid' }, ...cards, rest) : el('p', { class: 'muted' }, 'No people yet. Faces that look alike are grouped here once they are found. Turn on Find faces for the pictures.'),
      !groups.length && rest ? el('div', { class: 'fp-grid' }, rest) : null);
  }

  function detailView(st) {
    const { P, A } = st;
    const real = st.group !== NONE && P.has(st.group);
    if (!real && st.group !== NONE) { st.group = null; return groupsView(st); }
    const faces = st.group === NONE ? P.ungrouped().concat(P.rejected()) : P.list().find((x) => x.id === st.group).faces;
    const others = P.list().filter((x) => x.id !== st.group);
    const photos = [...new Set(faces.map((f) => f.id))];
    const picked = faces.filter((f) => st.fsel.has(f.ref)).map((f) => f.ref);
    const ids = (refs) => { st.fsel.clear(); return refs; };
    const acts = el('div', { class: 'faces-acts' },
      el('select', { class: 'set-select faces-to', 'aria-label': 'Move the selected faces to', onchange: (e) => { const v = e.target.value; if (v && picked.length) { P.move(ids(picked), v); say(st, 'Moved. Undo takes it back.'); } e.target.value = ''; } },
        el('option', { value: '' }, 'Move selected to…'), ...others.map((x) => el('option', { value: x.id }, label(P, x)))),
      el('button', { type: 'button', class: 'sui-btn', disabled: picked.length ? null : 'disabled', onclick: () => { P.split(ids(picked), ''); say(st, 'Split into a new person. Undo takes it back.'); } }, 'Split into new person'),
      real ? el('button', { type: 'button', class: 'sui-btn', disabled: picked.length ? null : 'disabled', onclick: () => { P.notThis(ids(picked)); say(st, 'Removed from this person. Undo takes it back.'); } }, 'Not this person') : null);
    const nameIn = real ? el('input', { type: 'text', class: 'fp-name', maxlength: '80', value: P.name(st.group), placeholder: 'Name this person', 'aria-label': 'Name of this person', onchange: (e) => { P.rename(st.group, e.target.value); say(st, 'Renamed.'); } }) : el('h3', { class: 'fp-name' }, 'Not in a person');
    return el('div', { class: 'faces-detail' },
      el('div', { class: 'faces-detail-h' },
        el('button', { type: 'button', class: 'sui-btn', onclick: () => { st.group = null; st.fsel.clear(); render(st); } }, '← People'), nameIn),
      el('p', { class: 'muted' }, `${plural(faces.length, 'face', 'faces')} in ${plural(photos.length, 'photo', 'photos')}.`),
      el('div', { class: 'faces-photos' }, ...photos.map((id) => el('button', { type: 'button', class: 'link faces-photo', onclick: () => A.openPhoto(id) }, A.nameOf(id) || id))),
      real || st.group === NONE ? acts : null,
      el('div', { class: 'faces-grid' }, ...faces.map((f) => faceItem(st, f, true))));
  }

  function allView(st) {
    const faces = st.P.faces();
    return el('div', { class: 'faces-all' },
      faces.length ? el('div', { class: 'faces-grid' }, ...faces.map((f) => faceItem(st, f, false))) : el('p', { class: 'muted' }, 'No faces found yet.'));
  }

})(typeof window !== 'undefined' ? window : globalThis);
