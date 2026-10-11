// Count view: start a count at a location, set counted quantities (scans in Count mode add to the same count),
// review the differences against the book, then post them in one step through SlopData.stock.postCount.
(function (g) {
  'use strict';
  const S = g.SlopData;
  const NS = (g.SlopInv = g.SlopInv || {});
  const U = NS.util;
  const UI = g.SlopUI;
  const { h } = U;
  const $ = (id) => document.getElementById(id);

  function say(text, bad) {
    const m = $('cMsg');
    m.textContent = text;
    m.className = `msg ${bad ? 'bad' : 'ok'}`;
  }

  async function productMap() {
    const r = await S.store.list('products');
    const list = r.ok ? r.value.slice().sort((a, b) => a.sku.localeCompare(b.sku)) : [];
    return { list, byId: new Map(list.map((p) => [p.id, p])) };
  }

  /** Redraws the start panel or the open count, from the session. */
  async function refresh() {
    const snap = NS.count.snapshot();
    $('cStart').hidden = !!snap;
    $('cOpen').hidden = !snap;
    if (!snap) { $('cReviewBox').hidden = true; return; }
    const { list, byId } = await productMap();
    $('cTitle').textContent = `Count open at ${snap.location} since ${U.stamp(snap.startedAt)}`;
    $('cPick').replaceChildren(...list.map((p) => h('option', { value: p.id, text: `${p.sku} · ${p.name}` })));
    $('cLines').replaceChildren(...(snap.lines.length ? snap.lines : [])
      .map((l) => {
        const p = byId.get(l.productId);
        const input = h('input', { type: 'number', min: 0, step: 1, value: l.counted, 'aria-label': `Counted ${p ? p.sku : ''}`, class: 'sui-input qty' });
        input.addEventListener('change', () => {
          const r = NS.count.set(l.productId, U.wholeOf(input.value));
          if (!r.ok) say(U.refusal(r), true); else refresh();
        });
        const rm = h('button', { type: 'button', class: 'btn small', text: 'Remove', onclick: () => { NS.count.remove(l.productId); refresh(); } });
        return h('li', null, h('span', { text: p ? `${p.sku} ${p.name}` : '(deleted product)' }), input, rm);
      }));
    if (!snap.lines.length) $('cLines').replaceChildren(h('li', { class: 'empty', text: 'Nothing counted yet. Scan with the Count action, or set a quantity above.' }));
  }

  /** The review: each counted product, the book quantity, the counted quantity and the change that will be written. */
  async function review() {
    const r = await NS.count.review();
    if (!r.ok) { say(U.refusal(r), true); return; }
    const v = r.value;
    const box = $('cDiffs');
    const same = v.rows.length - v.changes;
    box.replaceChildren(
      h('p', { class: 'note', text: `${v.changes} of ${v.rows.length} counted products differ from the book. Posting writes one count movement for each difference. ${same} match and are not written.` }),
      h('ul', { class: 'levels' }, v.rows.map((x) => h('li', { class: x.diff < 0 ? 'out' : x.diff > 0 ? 'in' : '' },
        h('span', { text: `${x.sku} ${x.name}` }),
        h('span', { class: 'sub', text: `book ${x.expected} · counted ${x.counted}` }),
        h('b', { class: 'num', text: x.diff === 0 ? 'no change' : x.diff > 0 ? `+${x.diff}` : String(x.diff) })))));
    $('cPost').disabled = v.rows.length === 0;
    $('cReviewBox').hidden = false;
    $('cReviewBox').scrollIntoView({ block: 'nearest' });
  }

  async function post() {
    const notes = $('cNotes').value.trim() || undefined;
    const r = await NS.count.post(notes);
    if (!r.ok) { say(U.refusal(r), true); return; }
    const written = r.value.lines.filter((l) => l.diff !== 0).length;
    say(`Posted. ${U.plural(written, 'count adjustment')} written at ${r.value.location}. The count is closed.`);
    $('cReviewBox').hidden = true;
    $('cNotes').value = '';
    refresh();
  }

  function mount() {
    $('cBegin').addEventListener('click', async () => {
      const r = NS.count.start($('cLoc').value);
      if (!r.ok) say(U.refusal(r), true); else { say('Count started. Nothing changes until you post it.'); refresh(); }
    });
    $('cSet').addEventListener('click', () => {
      const id = $('cPick').value;
      if (!id) return say('Choose a product first.', true);
      const r = NS.count.set(id, U.wholeOf($('cQty').value));
      if (!r.ok) return say(U.refusal(r), true);
      $('cQty').value = '';
      say('Counted quantity set.');
      refresh();
      return undefined;
    });
    $('cReview').addEventListener('click', review);
    $('cBack').addEventListener('click', () => { $('cReviewBox').hidden = true; });
    $('cPost').addEventListener('click', post);
    $('cCancel').addEventListener('click', async () => {
      const yes = await UI.confirm('Cancel this count?', 'Nothing has been written, so cancelling only discards the counted quantities.', 'Cancel count', { danger: true });
      if (!yes) return;
      NS.count.cancel();
      say('Count cancelled. No stock changed.');
      refresh();
    });
  }

  NS.views = NS.views || {};
  NS.views.count = { mount, refresh, onShow: () => refresh(), review, post };
})(typeof window !== 'undefined' ? window : globalThis);
