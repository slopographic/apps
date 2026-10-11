/* SlopLabel — ui/props-types: type-specific property sections (text, barcode, image, shapes). */
'use strict';

const FONT_OPTS = Object.entries(FONTS).map(([k, f]) => [k, f.name]);
function symOptions() {
  const g1 = SYMBOLOGIES.filter((s) => s.kind === '1d'), g2 = SYMBOLOGIES.filter((s) => s.kind === '2d');
  return [{ group: 'Linear (1D)', items: g1.map((s) => [s.id, s.name]) }, { group: '2D', items: g2.map((s) => [s.id, s.name]) }];
}
function typeSections(o, it) {
  switch (o.type) {
    case 'text': case 'para': return textSections(o);
    case 'barcode': return barcodeSections(o, it);
    case 'image': return imageSections(o);
    case 'rect': case 'ellipse': return shapeSections(o);
    case 'line': return lineSections(o);
    case 'inverse': return [mk('p', { class: 'hint' }, 'Everything under an inverse box prints reversed: black becomes white and white becomes black (ZPL ^FR).')];
  }
  return [];
}
function textSections(o) {
  const out = [contentField(o, { multi: true, placeholder: 'Type text, or insert {Fields}' })];
  if (o.type === 'para') out.push(mk('p', { class: 'hint' }, 'Use **bold** and _italic_ inside paragraphs.'));
  out.push(fSec('Font',
    fRow('Family', fSel(FONT_OPTS, o.font, (v) => setProp('font', v, 'Font', true))),
    fRow('Size (pt)', fNum(o.size, (v) => setProp('size', v, 'Font size'), { min: 1, max: 999, step: 0.5 })),
    mk('div', { class: 'btnrow' }, fChk('Bold', o.bold, (v) => setProp('bold', v, 'Bold')), fChk('Italic', o.italic, (v) => setProp('italic', v, 'Italic')), fChk('White (on black)', o.color === 'white', (v) => setProp('color', v ? 'white' : 'black', 'Text colour'))),
    fRow('Align', fSeg([['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], o.align, (v) => setProp('align', v, 'Align text'))),
    fRow('Line spacing', fNum(o.lineSpacing, (v) => setProp('lineSpacing', v, 'Line spacing'), { min: 0.5, max: 4, step: 0.05 }))));
  const fit = [fRow('Sizing', fSeg([['grow', 'Auto size'], ['box', 'Fixed box']], o.fit, (v) => editSel((x) => { if (v === 'box' && x.fit === 'grow') { const b = boxOf(x); x.w = Math.max(5, b.w); x.h = Math.max(3, b.h); } x.fit = v; }, 'Text sizing'), { title: 'Auto size grows with the text; a fixed box can wrap and shrink text to fit' }))];
  if (o.fit !== 'grow') fit.push(
    fRow('Vertical', fSeg([['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']], o.valign || 'top', (v) => setProp('valign', v, 'Vertical align'))),
    mk('div', { class: 'btnrow' }, fChk('Wrap lines', o.wrap, (v) => setProp('wrap', v, 'Wrap')), fChk('Shrink to fit', o.shrink, (v) => setProp('shrink', v, 'Shrink to fit', true))),
    o.shrink ? fRow('Min size (pt)', fNum(o.minSize, (v) => setProp('minSize', v, 'Minimum size'), { min: 1, step: 0.5 })) : null);
  else fit.push(fRow('Anchor', fSeg([['left', '◧'], ['center', '▣'], ['right', '◨']], o.align, (v) => setProp('align', v, 'Anchor'), { title: 'The side that stays put when the text changes length' })));
  out.push(fSec('Fit', ...fit));
  return out;
}
function barcodeSections(o, it) {
  const S = SYM[o.symbology] || {}, is2d = S.kind === '2d', lin = !is2d;
  const out = [contentField(o, { placeholder: S.hint || '' }), mk('p', { class: 'hint' }, S.hint || '')];
  if (it && it.value != null && it.value !== o.content && !it.error) out.push(mk('p', { class: 'hint' }, 'Encodes: ', mk('span', { class: 'mono' }, it.value)));
  const sym = fSec('Symbology', fRow('Type', fSel(symOptions(), o.symbology, (v) => editSel((x) => {
    const was2d = (SYM[x.symbology] || {}).kind === '2d'; x.symbology = v;
    if (SYM[v].kind === '2d' && !was2d) { x.hr = 'none'; x.module = Math.max(x.module, 0.4); }
    if (SYM[v].kind === '1d' && was2d) { x.hr = 'below'; x.module = 0.33; }
  }, 'Barcode type'))));
  out.push(sym);
  const dims = [fRow('Module (mm)', fNum(o.module, (v) => setProp('module', v, 'Module width'), { min: 0.05, max: 5, step: 0.01, title: 'Width of the narrowest bar or one 2D cell' }))];
  const g = it && it.geom;
  if (g && g.ok) dims.push(mk('p', { class: 'hint' }, `${num(g.module, 3)} mm = ${Math.max(1, mmToDots(g.module, App.doc.dpi))} dots at ${App.doc.dpi} dpi${lin ? ` · ${g.modules} modules` : ` · ${g.modules} × ${g.rows} cells`}`));
  if (lin) dims.push(fRow('Height (' + unitLabel() + ')', fNum(toU(o.barHeight), (v) => setProp('barHeight', fromU(v), 'Bar height'), { min: 0 })));
  if (['code39', 'i2of5', 'itf14', 'codabar'].includes(o.symbology)) dims.push(fRow('Wide : narrow', fNum(o.ratio, (v) => setProp('ratio', v, 'Ratio'), { min: 2, max: 3, step: 0.1 })));
  dims.push(mk('div', { class: 'btnrow' }, fChk('Quiet zone', o.quiet, (v) => setProp('quiet', v, 'Quiet zone')), fChk('Snap to printer dots', o.snapDots, (v) => setProp('snapDots', v, 'Snap to dots'), 'Round bar widths to whole printer dots so scanners read them reliably')));
  out.push(fSec('Size', ...dims));
  const opts = [];
  if (lin) {
    opts.push(fRow('Text', fSeg([['below', 'Below'], ['above', 'Above'], ['none', 'None']], o.hr, (v) => setProp('hr', v, 'Human readable', true))));
    if (o.hr !== 'none') opts.push(fRow('Text size (pt)', fNum(o.hrSize, (v) => setProp('hrSize', v, 'Text size'), { min: 3, max: 72, step: 0.5 })), fRow('Text font', fSel(FONT_OPTS, o.hrFont || 'mono', (v) => setProp('hrFont', v, 'Text font'))));
  }
  const chk = { ean13: 1, ean8: 1, upca: 1, upce: 1, itf14: 1, 'gs1-128': 1, gs1qrcode: 1, gs1datamatrix: 1 }[o.symbology];
  if (chk) opts.push(fRow('Check digit', fSeg([['auto', 'Add / verify'], ['none', 'Verify only']], o.check === 'none' ? 'none' : 'auto', (v) => setProp('check', v, 'Check digit'))));
  if (o.symbology === 'code39') opts.push(fRow('Check digit', fSeg([['auto', 'None'], ['mod43', 'Mod 43']], o.check === 'mod43' ? 'mod43' : 'auto', (v) => setProp('check', v, 'Check digit'))));
  if (o.symbology === 'i2of5') opts.push(fRow('Check digit', fSeg([['auto', 'None'], ['mod10', 'Mod 10']], o.check === 'mod10' ? 'mod10' : 'auto', (v) => setProp('check', v, 'Check digit'))));
  if (o.symbology === 'itf14') opts.push(fChk('Bearer bars', o.bearer !== false, (v) => setProp('bearer', v, 'Bearer bars')));
  if (['qrcode', 'gs1qrcode', 'aztec'].includes(o.symbology)) opts.push(fRow('Error correction', fSeg([['L', 'L 7%'], ['M', 'M 15%'], ['Q', 'Q 25%'], ['H', 'H 30%']], o.ec || 'M', (v) => setProp('ec', v, 'Error correction'))));
  if (o.symbology === 'datamatrix') opts.push(fRow('Shape', fSeg([['square', 'Square'], ['rect', 'Rectangle']], o.dmShape || 'square', (v) => setProp('dmShape', v, 'Shape'))));
  if (o.symbology === 'pdf417') opts.push(fRow('Columns', fNum(o.columns || 0, (v) => setProp('columns', v | 0, 'Columns'), { min: 0, max: 30, step: 1, title: '0 = automatic' })), fRow('Security', fNum(o.security, (v) => setProp('security', v | 0, 'Security level'), { min: 0, max: 8, step: 1 })));
  opts.push(fRow('Anchor', fSeg([['left', 'Left'], ['center', 'Centre'], ['right', 'Right']], o.align || 'left', (v) => setProp('align', v, 'Anchor'), { title: 'The side that stays put when the data changes length' })));
  out.push(fSec('Options', ...opts));
  return out;
}
/** Asks for an image file and swaps it into every selected image object. */
async function replaceImage() {
  const f = (await SlopUI.pickFiles({ accept: 'image/*,.svg' }))[0]; if (!f) return;
  try { const a = await addImageAsset(App.doc, f); await preloadImages(App.doc); editSel((x) => { x.asset = a.id; x.aspect = a.aspect; }, 'Replace image'); pruneAssets(App.doc); } catch (e) { SlopUI.toast(e.message); }
}
/** Resets the selected image to its natural aspect ratio. */
function originalRatio() { editSel((x) => { if (x.aspect) x.h = round(x.w / x.aspect, 3); }, 'Original ratio'); }
function imageSections(o) {
  return [fSec('Image',
    mk('div', { class: 'btnrow' }, fBtn('Replace image…', replaceImage), fBtn('Original ratio', originalRatio)),
    mk('div', { class: 'btnrow' }, fChk('Keep proportions', o.keepAspect !== false, (v) => setProp('keepAspect', v, 'Keep proportions'))),
    fRow('Threshold', fNum(o.threshold, (v) => setProp('threshold', v | 0, 'Threshold'), { min: 1, max: 254, step: 1, title: 'Grey level that becomes black on thermal printers (ZPL, EPL, TSPL)' })),
    mk('div', { class: 'btnrow' }, fChk('Dither for thermal', o.dither !== false, (v) => setProp('dither', v, 'Dither'))),
    mk('p', { class: 'hint' }, 'PDF and browser printing keep the full image. Thermal formats convert it to black and white with this threshold.'))];
}
function shapeSections(o) {
  const out = [fRow('Fill', fSeg([['none', 'None'], ['black', 'Black'], ['white', 'White']], o.fill || 'none', (v) => setProp('fill', v, 'Fill', true)))];
  if (o.fill !== 'black') out.push(fRow('Border (mm)', fNum(o.stroke, (v) => setProp('stroke', v, 'Border'), { min: 0, max: 50, step: 0.1 })));
  if (o.type === 'rect') out.push(fRow('Corner (mm)', fNum(o.radius || 0, (v) => setProp('radius', v, 'Corner radius'), { min: 0, step: 0.5 })));
  return [fSec(o.type === 'rect' ? 'Box' : 'Ellipse', ...out)];
}
function lineSections(o) {
  return [fSec('Line',
    fRow('Thickness (mm)', fNum(o.stroke, (v) => editSel((x) => {
      x.stroke = v;
      if (x.dir === 'h') { const c = x.y + x.h / 2; x.h = v; x.y = round(c - v / 2, 3); } else if (x.dir === 'v') { const c = x.x + x.w / 2; x.w = v; x.x = round(c - v / 2, 3); }
    }, 'Line thickness', 'prop:stroke', { keepProps: true }), { min: 0.05, max: 20, step: 0.05 })),
    fRow('Direction', fSeg([['h', '—'], ['v', '|'], ['d1', '╲'], ['d2', '╱']], o.dir || 'h', (v) => editSel((x) => {
      const s = +x.stroke || 0.5;
      if (v === 'h') { const c = x.y + x.h / 2; x.h = s; x.y = round(c - s / 2, 3); if (x.w < 2) x.w = 20; }
      else if (v === 'v') { const c = x.x + x.w / 2; x.w = s; x.x = round(c - s / 2, 3); if (x.h < 2) x.h = 20; }
      else { if (x.w < 2) x.w = 20; if (x.h < 2) x.h = 20; }
      x.dir = v;
    }, 'Line direction'))))];
}
