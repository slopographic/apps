/* Slop Workflows: a tool's workflows. The list (saved workflows, then the templates: the page's left column, the "Open ▾"
 * menu in a dialog), and the workflow as a file or a link. Saved workflows are in this browser (core/store.js, shared by
 * every tool on the site); a .slopflow file is the same JSON (shared/ops/flowdoc.js); a link carries the workflow
 * compressed in ?flow= (a logo picture over 16 KB is left out of a link, and the tool says so). Opening another workflow
 * is one Undo step, so nothing is lost by a wrong click.
 *   createLibrary(ctx, { saved, templates }) → { renderList, menuItems, newFlow, openSaved, openTemplate, load, save,
 *     exportFile, importFile, pickImport, shareLink, takeLink }   (saved, templates: list elements, or null) */
import * as store from '../core/store.js';
import { TEMPLATES, templateById, fromTemplate } from '../core/templates.js';
import { saveBlob } from '../../../convert/js/io/files.js';
import { h } from '../../../convert/js/ui/dom.js';
import { addStep } from './addmenu.js';

const g = globalThis;
const toast = (m) => { if (g.SlopUI) g.SlopUI.toast(m); };
const LINK_IMAGE_MAX = 16 * 1024;
const when = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const SITE = new URL('../../../', import.meta.url).href;   // the site root, from workflows/js/ui/

function row(title, meta, open, extra, current) {
  return h('li', { class: 'wf-li' + (current ? ' wf-cur' : '') },
    h('button', { type: 'button', class: 'wf-li-open', 'aria-current': current ? 'true' : undefined, onclick: open }, h('span', { class: 'wf-li-name' }, title), h('span', { class: 'wf-li-meta' }, meta)), extra);
}

export function createLibrary(ctx, els = {}) {
  const { S, R, F, on, emit, setDoc, markSaved } = ctx;
  let saved = [];

  async function renderList() {
    saved = await store.list();
    if (els.saved) els.saved.replaceChildren(...(saved.length ? saved.map((r) => {
      const n = (F.fromText(r.text).doc || { steps: [] }).steps.length;
      return row(r.name, `${plural(n, 'step')} · ${when(r.modified)}`, () => openSaved(r.id),
        h('button', { type: 'button', class: 'sui-btn wf-li-x', 'aria-label': `Delete ${r.name}`, title: 'Delete', onclick: () => removeSaved(r) }, '×'), r.id === S.id);
    }) : [h('li', { class: 'wf-li-empty' }, 'Nothing saved yet. Save keeps the workflow in this browser.')]));
    if (els.templates) els.templates.replaceChildren(...TEMPLATES.map((t) => row(t.name, t.blurb, () => openTemplate(t.id), null, false)));
    return saved;
  }
  /** The same list as menu items (a dialog's "Open ▾"): New, Import…, the saved workflows, the templates. */
  function menuItems() {
    return [{ label: 'New workflow', act: newFlow }, { label: 'Import a .slopflow file…', act: pickImport },
      ...(saved.length ? [{ heading: 'Saved' }] : []), ...saved.map((r) => ({ label: r.name, act: () => openSaved(r.id) })),
      { heading: 'Templates' }, ...TEMPLATES.map((t) => ({ label: t.name, keywords: [t.blurb], act: () => openTemplate(t.id) }))];
  }

  function open(doc, { id = null, label }) {
    setDoc(doc, { id, label });
    emit('opened', doc);
    renderList();
  }
  const newFlow = () => open(F.normalize({ kind: 'slopflow', v: 1, name: 'Untitled workflow', steps: [] }).doc, { label: 'New workflow' });
  async function openSaved(id) {
    const r = await store.get(id);
    if (!r) { toast('That workflow is not here any more.'); return false; }
    const { doc, errors } = F.fromText(r.text);
    if (!doc) { toast(errors[0]); return false; }
    open(doc, { id, label: `Open ${doc.name}` });
    return true;
  }
  function openTemplate(id) {
    const t = templateById(id);
    if (!t) return false;
    open(fromTemplate(t, F), { label: `Template ${t.name}` });
    toast(`${t.name}: a copy to change and save as your own.`);
    return true;
  }
  /** A workflow given to the tool (mountWorkflow's workflow): a template id, a document, or .slopflow text. */
  function load(w) {
    if (!w) return false;
    if (typeof w === 'string' && templateById(w)) return openTemplate(w);
    const { doc, errors } = typeof w === 'string' ? F.fromText(w) : F.normalize(w);
    if (!doc) { toast(errors[0]); return false; }
    open(doc, { label: `Open ${doc.name}` });
    return true;
  }
  async function removeSaved(r) {
    const ok = g.SlopUI ? await g.SlopUI.confirm(`Delete “${r.name}”?`, 'It is removed from this browser. A file you exported stays.', 'Delete', { danger: true }) : true;
    if (!ok) return;
    await store.remove(r.id);
    if (S.id === r.id) { S.id = null; S.saved = ''; emit('saved', null); }
    renderList();
  }

  async function save() {
    try {
      const id = await store.save({ id: S.id, name: S.doc.name, text: F.toText(S.doc) });
      markSaved(id);
      await renderList();
      toast(`Saved “${S.doc.name}” in this browser`);
      return { ok: true, id };
    } catch (e) { toast(e.message); return { ok: false, message: e.message }; }
  }

  const fileName = () => `${(S.doc.name || 'workflow').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'workflow'}${F.EXT}`;
  function exportFile() { saveBlob(new Blob([F.toText(S.doc)], { type: F.MIME }), fileName()); return fileName(); }
  async function importFile(file) {
    const { doc, errors } = F.fromText(await file.text());
    if (!doc) { toast(errors[0]); return { ok: false, message: errors[0] }; }
    open(doc, { label: `Import ${doc.name}` });
    if (errors.length) toast(errors[0]);
    return { ok: true, errors };
  }
  /** Import a .slopflow file…: a part of the one intake of its own ('workflows.import'). */
  async function pickImport() {
    const SI = g.SlopIntake;
    if (!SI.spec('workflows.import')) {
      SI.register({ id: 'workflows.import', main: false, paste: false, toast: false, limit: 1,
        accept: { types: [F.MIME, 'application/json'], exts: [F.EXT, '.json'], noun: 'a workflow (.slopflow)' },
        process: async (file) => { const r = await importFile(file); if (!r.ok) throw new Error(r.message || 'was not imported'); return r; } });
    }
    const r = await SI.pick({ to: 'workflows.import', multiple: false, accept: '.slopflow,application/json,.json' });
    return r.added[0] ? r.added[0].value : { ok: false, message: r.skipped[0] && r.skipped[0].reason };
  }

  /** A link to Slop Workflows with this workflow in it. Big pictures (a logo) are left out, so the link stays short. */
  async function shareLink({ copy = true } = {}) {
    let dropped = 0;
    const doc = { ...S.doc, steps: S.doc.steps.map((s) => {
      const op = R.byId(s.id), o = { ...s.options };
      for (const opt of (op ? op.options : [])) if ((opt.type === 'image' || opt.type === 'watermark') && String(o[opt.key] || '').length > LINK_IMAGE_MAX) { delete o[opt.key]; dropped++; }
      return { ...s, options: o };
    }) };
    const url = new URL('workflows/', SITE);
    url.searchParams.set('flow', await F.encode(doc));
    let copied = false;
    if (copy) try { await navigator.clipboard.writeText(url.href); copied = true; } catch (e) { copied = false; }
    if (copy) toast((copied ? 'Link copied.' : 'Link made.') + (dropped ? ' The logo picture is too big for a link, so it is left out: send the .slopflow file for that.' : ''));
    return { url: url.href, dropped, copied };
  }

  /** A page address's workflow: ?flow= (a shared link), ?template=, ?add= (a step from another app's "Add to a workflow…"). */
  async function takeLink(q) {
    if (q.get('flow')) {
      const { doc, errors } = await F.decode(q.get('flow'));
      if (doc) open(doc, { label: `Open ${doc.name}` }); else toast(errors[0]);
    } else if (q.get('template')) openTemplate(q.get('template'));
    if (!q.get('add')) return;
    const got = await F.takeAdd(q.get('add'));
    if (got && got.doc) for (const s of got.doc.steps) {
      const op = R.byId(s.id);
      if (!op) { toast(`This page has no step ${s.id}.`); continue; }
      addStep(ctx, s.id, got.settings && op.fromApp ? op.fromApp(got.settings) : s.options);
      toast(`Added ${op.label} with ${R.appLabel(op.app)}’s settings`);
    } else if (got) toast(got.errors[0]);
  }

  on('saved', renderList);
  return { renderList, menuItems, newFlow, openSaved, openTemplate, load, save, exportFile, importFile, pickImport, shareLink, takeLink };
}
