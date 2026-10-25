/* PhotoSlop Auto retouch: what is there from the start. The retouch code itself (js/retouch/*.js, shared/retouch/*.js and
 * css/retouch.css) loads on first use (psRetouch()). Here:
 *   the menu entries: Filter ▸ Auto Retouch… (and Image ▸ Auto Retouch…, Image ▸ Straighten…), Filter ▸ Repair ▸ Remove
 *   Object Tool;
 *   the SlopCmd commands with argument schemas (psRetouchCommands(), registered by wireCommands in app/commands.js), so the
 *   Slop AI panel, Ctrl+K, macros, WebMCP and the Claude Code plugin all get the same five: ps.retouch.auto-enhance,
 *   ps.retouch.portrait, ps.retouch.remove-object, ps.retouch.straighten and ps.retouch.detect-tilt. Each change is one
 *   history step; the results are new layers above the picture (with masks), so the original stays as it was.
 * Runs on this device; no key is needed. Only "Edit with AI" (remove-object with engine 'ai') uses the person's own key,
 * through the shared Edit with AI dialog (js/app/imagegen.js). Loads after ui/menus.js and before app/commands.js. */
'use strict';

const RT_FILES = ['../shared/retouch/horizon.js', '../shared/retouch/portrait.js', 'js/retouch/source.js', 'js/retouch/enhance.js',
  'js/retouch/portrait.js', 'js/retouch/remove.js', 'js/retouch/dialog-view.js', 'js/retouch/dialog.js'];
let rtLoading = null;
/** Loads the retouch code once (in order), and its styles. */
function psRetouch() {
  if (rtLoading) return rtLoading;
  const add = (src) => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = false;
    s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src + ' (offline?)'));
    document.head.append(s);
  });
  if (!document.querySelector('link[data-retouch]')) document.head.append(h('link', { rel: 'stylesheet', href: 'css/retouch.css', 'data-retouch': '' }));
  rtLoading = RT_FILES.reduce((p, src) => p.then(() => add(src)), Promise.resolve()).catch((e) => { rtLoading = null; throw e; });
  return rtLoading;
}
const psRetouchDialog = (tab) => psRetouch().then(() => rtOpenDialog(tab)).catch((e) => toast(e.message));

/* ---------- the commands ---------- */
function psRetouchCommands() {
  const N = (name, min, max, def, description, extra) => Object.assign({ name, type: 'number', min, max, default: def, description }, extra);
  const E = (name, values, def, description) => ({ name, type: 'enum', values, default: def, description });
  const B = (name, def, description) => ({ name, type: 'boolean', default: def, description });
  const hasLayer = () => !!activeLayer();
  const go = (fn, args) => (a) => psRetouch().then(() => fn(a || (window.SlopCmdArgs ? SlopCmdArgs.defaults(args) : {})));
  const kw = ['retouch', 'auto', 'photo', 'fix', 'enhance', 'on device'];
  const enhanceArgs = [N('strength', 0, 100, 100, '% of the automatic correction'), B('levels', true, 'auto levels and contrast'),
    B('white_balance', true, 'neutralise a colour cast'), B('exposure', true, 'brighten or darken towards mid-grey'),
    B('shadows_highlights', true, 'lift shadows, recover highlights'), B('vibrance', true, 'more colour where there is little, skin protected'),
    N('sharpen', 0, 100, 25, 'gentle sharpening, %'), E('denoise', ['none', 'light', 'medium', 'strong'], 'none', 'edge-keeping noise reduction'),
    B('straighten', false, 'level a tilted horizon (rotates and crops the image)')];
  const portraitArgs = [N('smoothing', 0, 100, 45, 'skin smoothing strength, %; pores and edges are kept'), B('blemishes', true, 'heal small spots on the skin'),
    N('blemish_size', 0, 40, 0, 'largest spot radius in px; 0 = from the image size'), B('red_eye', true, 'fix red pupils (needs face detection)'),
    N('teeth', 0, 100, 0, 'teeth whitening, %'), N('eyes', 0, 100, 0, 'whites of the eyes, %'),
    E('faces', ['auto', 'off'], 'auto', 'auto uses on-device face detection when it is turned on in Profile'), B('subject', true, 'limit the skin to the person (on-device subject model)')];
  const removeArgs = [N('x', -16384, 16384, undefined, 'left edge, px (omit to use the selection)'), N('y', -16384, 16384, undefined, 'top edge, px'),
    N('width', 1, 16384, undefined, 'px'), N('height', 1, 16384, undefined, 'px'), E('shape', ['ellipse', 'rect'], 'ellipse', 'the area given by x, y, width, height'),
    E('engine', ['device', 'ai'], 'device', 'device: fill from the surroundings on this device; ai: open Edit with AI (your own key) for the area')];
  return [
    { id: 'ps.retouch.auto-enhance', tool: 'auto_enhance', title: 'Auto Retouch › Auto enhance', group: 'Filter', keywords: kw.concat(['levels', 'white balance', 'exposure', 'vibrance', 'sharpen']),
      when: hasLayer, args: enhanceArgs, run: go((a) => rtAutoEnhance(a), enhanceArgs),
      description: 'One-click photo fix on this device: levels, white balance, exposure, shadows and highlights, vibrance, gentle sharpening, optional denoise and straighten. Adds an “Auto Enhance” layer above the picture.' },
    { id: 'ps.retouch.portrait', tool: 'portrait_retouch', title: 'Auto Retouch › Portrait retouch', group: 'Filter', keywords: kw.concat(['skin', 'smooth', 'blemish', 'face', 'teeth', 'red eye']),
      when: hasLayer, args: portraitArgs, run: go((a) => rtPortrait(a), portraitArgs),
      description: 'Portrait retouch on this device: skin smoothing (frequency separation, skin only), blemish healing, red-eye, optional teeth and eye whitening, each on its own masked layer.' },
    { id: 'ps.retouch.remove-object', tool: 'remove_object', title: 'Auto Retouch › Remove object', group: 'Filter', keywords: kw.concat(['remove', 'erase', 'content aware', 'inpaint', 'object']),
      when: hasLayer, args: removeArgs, run: go((a) => rtRemoveObjectCmd(a), removeArgs),
      description: 'Remove an object: the selection (or the given area) is filled with texture from its surroundings on this device, on a new layer. engine ai opens Edit with AI for it instead (the person’s own key).' },
    { id: 'ps.retouch.straighten', tool: 'straighten', title: 'Auto Retouch › Straighten', group: 'Image', keywords: kw.concat(['horizon', 'level', 'tilt', 'rotate']), destructive: true,
      when: hasLayer, args: [N('angle', -45, 45, undefined, 'tilt in degrees (positive falls to the right); omit to detect it'), B('crop', true, 'crop away the empty corners')],
      run: go((a) => rtStraightenCmd(a), []), description: 'Level a tilted picture: detects the horizon (or the verticals) and rotates the whole image, cropping the corners.' },
    { id: 'ps.retouch.detect-tilt', tool: 'detect_tilt', title: 'Auto Retouch › Detect horizon tilt', group: 'Image', hidden: true, readOnly: true, when: hasLayer, args: [],
      run: go(() => rtDetectTilt(), []), description: 'Measure how far the picture is tilted (degrees), without changing it.' },
  ];
}

/* ---------- the menus ---------- */
(function () {
  const menu = (n) => MENUS.find(([m]) => m === n)[1];
  const filter = menu('Filter'), image = menu('Image');
  const auto = filter.findIndex((it) => it && it.label === 'Auto Enhance…');
  filter.splice(auto + 1, 0, { label: 'Auto Retouch…', cmdId: 'ps.retouch.dialog', act: () => psRetouchDialog(), need: 'layer' });
  const repair = filter.find((it) => it && it.label === 'Repair');
  repair.sub.splice(3, 0, { label: 'Remove Object Tool', act: () => selectTool('remove') });
  const adj = image.findIndex((it) => it && it.label === 'Adjustments');
  image.splice(adj + 1, 0, { label: 'Auto Retouch…', act: () => psRetouchDialog(), need: 'layer' },
    { label: 'Straighten…', act: () => psRetouch().then(() => rtStraightenAsk()).catch((e) => toast(e.message)), need: 'layer' });
})();
