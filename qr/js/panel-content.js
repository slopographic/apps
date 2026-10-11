/* QR SLOP: the Content tab (name, kind chips, the form for the kind) and the Templates gallery. The callbacks report
 * every change; the app redraws. Classic script; exposes window.QRPanelContent. */
(function (g) {
  'use strict';
  if (g.QRPanelContent) return;
  const E = (tag, attrs, ...kids) => g.SlopUI.el(tag, attrs, ...kids);

  /** One toggle button per kind, the current one pressed. onPick(kind). */
  function drawKinds(host, current, onPick) {
    host.replaceChildren(...g.QRPayload.TYPES.map((t) => E('button', {
      type: 'button', class: 'qr-chip', 'aria-pressed': String(t === current), 'data-kind': t,
      onclick: () => onPick(t),
    }, g.QRPayload.LABELS[t])));
  }

  /** The form for one kind. onInput(key, value) on every change. */
  function drawForm(host, kind, values, onInput) {
    g.QRForms.draw(host, kind, values, onInput);
  }

  /** The gallery: a card per template with its group, name and description. onPick(id). */
  function drawTemplates(host, onPick) {
    host.replaceChildren(...g.QRTemplates.list().map((t) => E('button', {
      type: 'button', class: 'qr-tpl', 'data-id': t.id, onclick: () => onPick(t.id),
    }, E('span', { class: 'qr-tpl-group' }, t.group), E('b', null, t.name), E('small', null, t.desc))));
  }

  g.QRPanelContent = Object.freeze({ drawKinds, drawForm, drawTemplates });
})(typeof window !== 'undefined' ? window : globalThis);
