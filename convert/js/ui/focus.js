/* Keeps the keyboard focus through a redraw of the file list and the bulk bar: the control that had it (a row's
 * checkbox, Convert to or Remove, matched by the row's data-id) gets it back. When its row is gone (removed), the same
 * control on the row now in its place does, else the one above, else the drop zone's Choose files button.
 *   keepFocus(hosts, fallback, draw) */
const KINDS = ['.cv-bulk-allbox', '.cv-file-check', '.cv-to', '[data-remove]', '.cv-bulk-rm', '.cv-bulk-clear'];

export function keepFocus(hosts, fallback, draw) {
  const a = document.activeElement;
  const host = a && hosts.find((x) => x.contains(a));
  if (!host) { draw(); return; }
  const kind = KINDS.find((k) => a.matches(k));
  const li = a.closest('li[data-id]');
  const rows = li ? [...host.querySelectorAll('li[data-id]')] : [];
  const at = rows.indexOf(li);
  draw();
  let next = null;
  if (kind && li) {
    const same = host.querySelector(`li[data-id="${li.dataset.id}"] ${kind}`);
    const now = [...host.querySelectorAll('li[data-id]')];
    const near = now[at] || now[at - 1];
    next = same || (near && (near.querySelector(kind) || near.querySelector('[data-remove]')));
  } else if (kind) next = host.querySelector(kind) || hosts.map((x) => x.querySelector('.cv-file-check, .cv-to')).find(Boolean);
  if (!next && fallback) next = fallback.querySelector('button');
  if (next && !next.disabled) next.focus({ preventScroll: true });
}
