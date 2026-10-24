/* Slop Watermark for the assistant: SlopCmd commands with argument schemas. The watermark's options and their mapping to
 * the page's setup are the Workflows operation's (shared/ops/watermark.js WATERMARK_OPTIONS, toCfg, fromCfg; the
 * schema through the registry's argsOf), so the assistant, the page and Slop Workflows mean the same by each one. The
 * work is the page's own: WMItems.add, WMSettings.setCfg / setLogo, WMApp.applyAll. ES module, imported by commands.js.
 *   wm.ai.new-batch          new_batch          (none)                destructive: drops results not saved
 *   wm.ai.add-pictures       add_pictures       files[], urls[]
 *   wm.ai.set-watermark      set_watermark      the operation's options (mark text | logo, text, font, colour, size…)
 *   wm.ai.set-logo           set_logo           file | url
 *   wm.ai.apply-watermark    apply_watermark    (none) writes every picture and waits
 *   wm.ai.save-results       save_results       to drive | download | both */
import { argsOf } from '../../shared/ops/registry.js';
import { WATERMARK_OPS, toCfg, fromCfg } from '../../shared/ops/watermark.js';

const C = window.SlopCmd, A = window.WMApp, I = window.WMItems, S = window.WMSettings;
const OP = WATERMARK_OPS[0];
const notBusy = () => { if (A.busy()) throw new Error('Apply to all is running; wait for it first'); };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
// the operation's options, without their defaults (a command changes only what it is given) and without the logo picture
const ARGS = argsOf(OP).filter((a) => a.name !== 'logo').map((a) => {
  const o = Object.assign({}, a); delete o.default;
  if (o.name === 'mark') o.options = o.options.filter(([v]) => v !== 'both');
  return o;
});

async function filesOf(a) {
  const src = window.SlopCmdSources, out = [];
  for (const q of a.files || []) { const r = await src.driveFile(q); out.push(new File([r.blob], r.name, { type: r.type || r.blob.type || '' })); }
  for (const u of a.urls || []) { const r = await src.siteFile(u); out.push(new File([r.blob], r.name, { type: r.blob.type || '' })); }
  if (!out.length) throw new Error('Give files (Slop Drive names or ids) or urls (pictures on this site)');
  return out;
}
async function addPictures(a) {
  notBusy();
  const ok = [], bad = [];
  for (const f of await filesOf(a)) { try { await I.add(f); ok.push(f.name); } catch (e) { bad.push(`${f.name}: ${e.message}`); } }
  A.refresh();
  if (!ok.length) throw new Error('No picture could be added (' + bad.join('; ') + ')');
  return `Added ${plural(ok.length, 'picture', 'pictures')} (${I.count()} in the list).` + (bad.length ? ` Not added: ${bad.join('; ')}.` : '');
}
function setWatermark(a) {
  notBusy();
  if (!Object.keys(a).length) throw new Error('Nothing to change: give text, size, opacity, position…');
  const cur = fromCfg(S.cfg(), ''), mark = a.mark || cur.mark;
  const want = Object.assign(cur, a);
  if (a.size != null && mark === 'logo' && a.logoSize == null) want.logoSize = a.size;
  const cfg = toCfg(want, mark === 'logo' ? 'logo' : 'text');
  if (mark === 'logo') cfg.size = S.cfg().size; else cfg.logoScale = S.cfg().logoScale;
  S.setCfg(cfg);
  const c = S.cfg();
  return `The watermark is ${c.kind === 'logo' ? 'the logo' : `“${c.text}”`}, ${Math.round(c.opacity * 100)}% opaque, at ${c.position}${c.tile ? ', tiled' : ''}${c.rotate ? `, turned ${c.rotate}°` : ''}.`
    + (c.kind === 'logo' && !S.logo() ? ' Set the logo with set_logo.' : '');
}
async function setLogo(a) {
  notBusy();
  const p = await window.SlopCmdSources.picture({ file: a.file, url: a.url });
  await S.setLogo(p.blob, p.name);
  S.setCfg({ kind: 'logo' });
  return `The logo is ${p.name} (${p.w} × ${p.h} px).`;
}
async function apply() {
  notBusy();
  if (!I.count()) throw new Error('The list is empty: add_pictures first');
  const c = S.cfg();
  if (c.kind === 'logo' && !S.logo()) throw new Error('Set a logo first (set_logo), or use a text watermark');
  if (c.kind === 'text' && !String(c.text || '').trim()) throw new Error('The watermark text is empty: set_watermark with text');
  await A.applyAll();
  const done = I.all().filter((x) => x.out), failed = I.all().filter((x) => x.error);
  if (!done.length) throw new Error('Nothing was written' + (failed.length ? ': ' + failed[0].error : ''));
  return `Watermarked ${plural(done.length, 'picture', 'pictures')}: ${done.slice(0, 5).map((x) => x.out.name).join(', ')}${done.length > 5 ? ', …' : ''}.` + (failed.length ? ` ${failed.length} failed.` : '');
}
async function saveResults(a) {
  notBusy();
  const done = I.all().filter((x) => x.out);
  if (!done.length) throw new Error('Nothing is watermarked yet: run apply_watermark first');
  const out = [];
  if (a.to !== 'download') {
    const ids = [];
    for (const x of done) ids.push(await window.SlopCmdSources.put(x.out.blob, x.out.name, 'watermark'));
    out.push(`Saved ${plural(ids.length, 'picture', 'pictures')} to Slop Drive (${done.slice(0, 5).map((x, i) => `${x.out.name}, id ${ids[i]}`).join('; ')})`);
  }
  if (a.to !== 'drive') { await A.downloadZip(); out.push(`downloaded ${window.WMExport.ZIP_NAME}`); }
  return out.join(' and ') + '.';
}
function state() {
  return { app: 'Slop Watermark', busy: A.busy(), setup: fromCfg(S.cfg(), S.logo() ? '(set)' : ''), logo: S.logo() ? S.logo().name : null,
    pictures: I.all().slice(0, 40).map((x) => ({ name: x.name, width: x.w, height: x.h, output: x.out ? x.out.name : null, error: x.error || null })), count: I.count() };
}
function checkpoint() {
  const snap = Object.assign({}, S.cfg());
  return () => { if (A.busy()) return false; S.setCfg(snap); return true; };
}

const base = { group: 'AI', hidden: true };
const FILES = [{ name: 'files', type: 'array', maxItems: 500, items: { type: 'string' }, description: 'Slop Drive file names or ids' },
  { name: 'urls', type: 'array', maxItems: 50, items: { type: 'string' }, description: 'or addresses of pictures on this site' }];
C.register([
  Object.assign({ id: 'wm.ai.new-batch', tool: 'new_batch', title: 'Start a new batch', destructive: true, args: [],
    run: () => { notBusy(); const n = I.count(); A.clearAll(); return `Emptied the list (${plural(n, 'picture', 'pictures')} removed; the setup stays).`; },
    description: 'Empty the list of pictures to start a new batch (results not saved are dropped).' }, base),
  Object.assign({ id: 'wm.ai.add-pictures', tool: 'add_pictures', title: 'Add pictures', destructive: false, args: FILES, run: addPictures,
    description: 'Add pictures from Slop Drive to the list.' }, base),
  Object.assign({ id: 'wm.ai.set-watermark', tool: 'set_watermark', title: 'Set the watermark', destructive: false, args: ARGS, run: setWatermark,
    description: OP.description + ' Only the options given change.' }, base),
  Object.assign({ id: 'wm.ai.set-logo', tool: 'set_logo', title: 'Set the logo', destructive: false,
    args: [{ name: 'file', type: 'string', maxLength: 300, description: 'a Slop Drive picture (PNG with a see-through background looks best)' }, { name: 'url', type: 'string', maxLength: 500, description: 'or a picture on this site' }],
    run: setLogo, description: 'Use a picture as the watermark logo.' }, base),
  Object.assign({ id: 'wm.ai.apply-watermark', tool: 'apply_watermark', title: 'Apply to all', destructive: false, args: [], run: apply,
    description: 'Watermark every picture in the list and wait until it is done.' }, base),
  Object.assign({ id: 'wm.ai.save-results', tool: 'save_results', title: 'Save the results', destructive: false,
    args: [{ name: 'to', type: 'enum', options: [['drive', 'Slop Drive'], ['download', 'a ZIP download'], ['both', 'both']], default: 'drive' }], run: saveResults,
    description: 'Save the watermarked pictures to Slop Drive and/or download them as a ZIP.' }, base),
]);
C.provide({ state, checkpoint });
