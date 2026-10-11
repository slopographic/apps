/* SlopLabel — ui/view-state: the active tool and the zoom and pan of the label are kept in SlopSession, so leaving
 * SlopLabel and coming back returns to the same tool and view with the restored label. The label itself autosaves
 * (io/files.js) and the rulers are already kept in localStorage. Classic script; uses App and toolById from ui/. */
const LABEL_APP = 'label';
let viewReady = false; // nothing is saved until the saved view has been applied, so boot cannot overwrite it
const viewAuto = SlopSession.autosave(LABEL_APP, 'view', () => ({ tool: App.tool, zoom: App.zoom, panX: App.panX, panY: App.panY }), { delay: 300 });
const viewTouch = () => { if (viewReady) viewAuto.touch(); };
['pointerup', 'click', 'keyup'].forEach((t) => document.addEventListener(t, viewTouch, true));
document.addEventListener('wheel', viewTouch, { capture: true, passive: true });

/** Boot, after the label is in place. `restoredDoc` is true when the label came back from autosave, so the zoom and pan belong to it. */
async function applyView(restoredDoc) {
  const v = await SlopSession.load(LABEL_APP, 'view', null);
  const saved = v && typeof v === 'object' ? v : null;
  setTool(saved && typeof saved.tool === 'string' && toolById(saved.tool) ? saved.tool : 'select');
  if (saved && restoredDoc && saved.zoom > 0 && isFinite(saved.panX) && isFinite(saved.panY)) {
    App.zoom = saved.zoom; App.panX = saved.panX; App.panY = saved.panY;
  }
  viewReady = true;
  refreshNow();
}
