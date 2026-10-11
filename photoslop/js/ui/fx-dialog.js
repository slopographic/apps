/* PhotoSlop UI: the Layer Style dialog. Edits one effect of a layer, or adds a new one, with live
 * preview: each change patches the layer's stack at once. OK is one history step; Cancel restores
 * the stack as it was, with no history step. */
'use strict';

/** Layer ▸ Layer Style ▸ <effect>: adds that effect to the active layer. */
function addStyleEffect(typeId) { const L = activeLayer(); if (L) openFxDialog(L.id, null, typeId); }

function openFxDialog(layerId, fxId, typeId) {
  const L0 = D.layers.find((l) => l.id === layerId); if (!L0) return;
  const orig = L0.fx || null, base = orig || [];
  const isNew = fxId == null;
  const entry = isNew ? (FX_BY_ID[typeId] ? { id: uid(), type: typeId, on: true, p: fxDefaults(typeId) } : null) : base.find((e) => e.id === fxId);
  if (!entry) return;
  const def = FX_BY_ID[entry.type], name = def.name.replace('…', '');
  const params = fxClone(entry.p);
  const apply = () => {
    const cur = { id: entry.id, type: entry.type, on: entry.on, p: fxClone(params) };
    patchLayer(layerId, { fx: isNew ? base.concat([cur]) : base.map((e) => (e.id === entry.id ? cur : e)) });
    emit('doc');
  };
  const body = h('div', { class: 'fparams' });
  if (isNew) apply(); // a new effect shows in the stack while the dialog is open
  for (const p of def.params) body.append(paramControl(p, params, L0.canvas, apply));
  dialog({ title: 'Layer Style · ' + name, body, cls: 'fx-dialog',
    buttons: [{ label: 'Cancel' }, { label: 'OK', primary: true }],
    onClose: (ok) => {
      if (!ok) { patchLayer(layerId, { fx: orig }); emit('doc'); return; }
      const changed = JSON.stringify(params) !== JSON.stringify(entry.p);
      if (isNew || changed) commit((isNew ? 'Add ' : 'Edit ') + name);
      else emit('doc');
    } });
}
