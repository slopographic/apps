/* Slop Font for the assistant (the AI panel, Ctrl+K forms, macros and WebMCP), part 1: SlopCmd commands with argument
 * schemas, loaded on demand by SlopCmd.prepare() (commands.js). Each one is the page's own work through FC.state.edit, so
 * the person sees every change and each command is one undo step; "Undo all AI changes" is the project snapshot.
 * Coordinates are font units: y up, the baseline at 0, metrics.upm units per em (app_state has the metrics).
 *   new_font         family, style, upm, ascender, descender, capHeight, xHeight, characters (a set to add, empty)
 *   open_font        file (Slop Drive) | url        a .ttf, .otf, .woff, .woff2 or .sfont to edit
 *   add_characters   chars | set                    empty glyphs to draw
 *   draw_glyph       char, path (SVG path data), coords font | svg | fit, advance, lsb, add
 *   draw_glyphs      glyphs [{ char, path, advance? }], coords   several at once (one undo step)
 *   add_shape        char, shape rect | ellipse, x, y, width, height, radius, cut (subtract it instead)
 *   set_metrics      ascender, descender, capHeight, xHeight, lineGap
 *   set_info         family, style, weight, version, designer, designerURL, copyright, license (or 'OFL'), licenseURL, description
 *   set_glyph_metrics  char, advance, lsb, rsb      add_kerning  pairs [{ left, right, value }]
 *   get_glyph        char → its path data, width and side bearings (read-only) */
(function (g) {
  'use strict';
  const C = g.SlopCmd, FC = g.FC, F = g.SlopFont;
  if (!C || C.get('fontcreator.ai.new-font')) return;
  const S = FC.state, M = F.model, P = F.paths, CS = F.charset;
  const add = (tool, title, args, run, extra) => Object.assign({ id: 'fontcreator.ai.' + tool.replace(/_/g, '-'), tool, title, group: 'AI', hidden: true, destructive: false, args,
    run: (a) => run(a || g.SlopCmdArgs.defaults(args)) }, extra);
  const CHAR = { name: 'char', type: 'string', required: true, maxLength: 40, description: 'the character ("A", "0", "å"), U+0041, or a glyph name' };
  const COORDS = { name: 'coords', type: 'enum', values: ['font', 'svg', 'fit'], default: 'font',
    description: 'font: font units, y up, baseline 0 (default). svg: y down, y 0 at the ascender line. fit: the path is scaled to the cap height and stood on the baseline' };
  /** The glyph for a character, made (empty) when the font has none, and shown in the editor. */
  function glyphId(ch) {
    const k = String(ch || '').trim(), p = S.project();
    const gl = M.find(p, k);
    if (gl) { S.select(gl.id); return gl.id; }
    const cp = /^U\+[0-9A-F]{4,6}$/i.test(k) ? parseInt(k.slice(2), 16) : [...k].length === 1 ? k.codePointAt(0) : null;
    if (cp == null) throw new Error(`“${k}” is not a character or a glyph in the font`);
    S.select(cp);
    return CS.idOf(cp);
  }
  const said = (id) => {
    const gl = M.find(S.project(), id), sd = M.sides(gl);
    return { char: gl.unicode != null ? CS.label(gl.unicode) : gl.name, contours: gl.contours.length, advance: gl.advance, lsb: sd.lsb, rsb: sd.rsb,
      box: sd.box ? { x: Math.round(sd.box.x), y: Math.round(sd.box.y), w: Math.round(sd.box.w), h: Math.round(sd.box.h) } : null };
  };
  function outline(a, m) {
    const height = a.coords === 'fit' ? (a.height || m.capHeight) : undefined;
    return P.fromSvg(String(a.path || ''), { coords: a.coords || 'font', ascender: m.ascender, height, left: a.lsb == null ? 50 : a.lsb });
  }
  function place(gl, contours, a) {
    gl.contours = a.add ? gl.contours.concat(contours) : contours;
    if (a.advance != null) gl.advance = Math.max(0, Math.round(a.advance));
    else if (!a.add) { const b = P.bbox(gl.contours); if (b) gl.advance = Math.round(b.x + b.w + (a.rsb == null ? Math.max(0, b.x) : a.rsb)); }
  }
  C.register([
    add('new_font', 'New font', [{ name: 'family', type: 'string', maxLength: 120, default: 'My Font' }, { name: 'style', type: 'string', maxLength: 60, default: 'Regular' },
      { name: 'upm', type: 'number', integer: true, min: 16, max: 16384, default: 1000, description: 'units per em' },
      { name: 'ascender', type: 'number', integer: true, min: 1, max: 16384 }, { name: 'descender', type: 'number', integer: true, min: -16384, max: 0 },
      { name: 'capHeight', type: 'number', integer: true, min: 0, max: 16384 }, { name: 'xHeight', type: 'number', integer: true, min: 0, max: 16384 },
      { name: 'characters', type: 'enum', values: ['none', ...CS.SETS.map((s) => s.id), 'all'], default: 'none', description: 'a character set to add as empty glyphs' }], (a) => {
      const p = M.create({ info: { family: a.family || 'My Font', style: a.style || 'Regular' }, metrics: { upm: a.upm, ascender: a.ascender, descender: a.descender, capHeight: a.capHeight, xHeight: a.xHeight } });
      if (a.characters && a.characters !== 'none') for (const cp of CS.codes(a.characters)) M.ensure(p, cp);
      S.load(p, 'New font');
      return { family: p.info.family, style: p.info.style, metrics: S.project().metrics, glyphs: S.project().glyphs.length };
    }, { destructive: true, description: 'Start a new, empty font (the one on the page is replaced; undo brings it back).' }),
    add('open_font', 'Open a font to edit', [{ name: 'file', type: 'string', maxLength: 300, description: 'Slop Drive name or id' },
      { name: 'url', type: 'string', maxLength: 500, description: 'a font on this site' }], async (a) => {
      const Src = g.SlopCmdSources;
      const r = a.file ? await Src.driveFile(a.file) : a.url ? await Src.siteFile(a.url) : null;
      if (!r) throw new Error('Give a file (a Slop Drive name or id) or a url');
      await FC.io.take(new File([r.blob], r.name, { type: r.type || r.blob.type || '' }));
      const p = S.project();
      return { family: p.info.family, style: p.info.style, glyphs: p.glyphs.length, kerningPairs: Object.keys(p.kerning).length, license: p.info.license.slice(0, 200) };
    }, { destructive: true, description: 'Open a .ttf, .otf, .woff, .woff2 or .sfont project to edit (replaces the font on the page).' }),
    add('add_characters', 'Add characters to the font', [{ name: 'chars', type: 'string', maxLength: 2000, description: 'the characters to add, as text' },
      { name: 'set', type: 'enum', values: CS.SETS.map((s) => s.id), description: 'or a whole set' }], (a) => {
      const cps = a.set ? CS.codes(a.set) : CS.parseChars(a.chars);
      if (!cps.length) throw new Error('Give chars or a set');
      S.edit(`Add ${cps.length} characters`, 'project', (p) => { for (const cp of cps) M.ensure(p, cp); });
      return `The font has ${S.project().glyphs.length} glyphs.`;
    }),
    add('draw_glyph', 'Draw a glyph from SVG path data', [CHAR, { name: 'path', type: 'string', required: true, maxLength: 100000, description: 'SVG path data (M L H V C S Q T A Z). Holes: draw them as separate subpaths inside; they are cut out' },
      COORDS, { name: 'advance', type: 'number', min: 0, max: 20000, description: 'the width; default: the outline plus its left side bearing' },
      { name: 'lsb', type: 'number', min: -2000, max: 2000, description: 'left side bearing for coords fit (default 50)' },
      { name: 'add', type: 'boolean', default: false, description: 'add to what is drawn instead of replacing it' }], (a) => {
      const id = glyphId(a.char), m = S.project().metrics, cs = outline(a, m);
      S.edit(`Draw ${a.char}`, { glyph: id }, (p, gl) => place(gl, cs, a));
      return said(id);
    }, { description: 'Draw one glyph from SVG path data, by default in font units (y up, baseline 0; see app_state metrics).' }),
    add('draw_glyphs', 'Draw several glyphs', [{ name: 'glyphs', type: 'array', required: true, maxItems: 200,
      items: { type: 'object', properties: { char: { type: 'string' }, path: { type: 'string' }, advance: { type: 'number' } }, required: ['char', 'path'] },
      description: 'one { char, path, advance? } per glyph' }, COORDS], (a) => {
      const m = S.project().metrics, list = (a.glyphs || []).map((x) => ({ id: glyphId(x.char), cs: outline({ path: x.path, coords: a.coords }, m), advance: x.advance }));
      S.edit(`Draw ${list.length} glyphs`, 'project', (p) => { for (const x of list) { const gl = M.find(p, x.id) || M.ensure(p, CS.cpOf(x.id)); place(gl, x.cs, { advance: x.advance }); } });
      return list.map((x) => said(x.id));
    }, { description: 'Draw many glyphs in one step, each from SVG path data (font units by default).' }),
    add('add_shape', 'Add a rectangle or ellipse to a glyph', [CHAR, { name: 'shape', type: 'enum', values: ['rect', 'ellipse'], default: 'rect' },
      { name: 'x', type: 'number', required: true, min: -5000, max: 20000 }, { name: 'y', type: 'number', required: true, min: -5000, max: 20000, description: 'bottom edge (y up)' },
      { name: 'width', type: 'number', required: true, min: 1, max: 20000 }, { name: 'height', type: 'number', required: true, min: 1, max: 20000 },
      { name: 'radius', type: 'number', min: 0, max: 5000, default: 0, description: 'corner radius of a rectangle' },
      { name: 'cut', type: 'boolean', default: false, description: 'subtract the shape from the glyph (a hole) instead of adding it' }], (a) => {
      const id = glyphId(a.char);
      const shape = a.shape === 'ellipse' ? P.ellipse(a.x + a.width / 2, a.y + a.height / 2, a.width / 2, a.height / 2) : P.rect(a.x, a.y, a.width, a.height, a.radius || 0);
      S.edit(a.cut ? `Cut a shape from ${a.char}` : `Add a shape to ${a.char}`, { glyph: id }, (p, gl) => {
        gl.contours = a.cut ? P.boolean(gl.contours, shape, 'minus') : gl.contours.concat(shape);
      });
      return said(id);
    }),
    add('set_metrics', 'Set the font metrics', [{ name: 'ascender', type: 'number', integer: true, min: 1, max: 16384 }, { name: 'descender', type: 'number', integer: true, min: -16384, max: 0 },
      { name: 'capHeight', type: 'number', integer: true, min: 0, max: 16384 }, { name: 'xHeight', type: 'number', integer: true, min: 0, max: 16384 }, { name: 'lineGap', type: 'number', integer: true, min: 0, max: 16384 }], (a) => {
      S.edit('Set the metrics', 'meta', (p) => { p.metrics = M.cleanMetrics(Object.assign({}, p.metrics, ...Object.entries(a).filter(([, v]) => v != null).map(([k, v]) => ({ [k]: v })))); });
      return S.project().metrics;
    }),
    add('set_info', 'Set the font names and licence', ['family', 'style', 'version', 'designer', 'designerURL', 'manufacturer', 'copyright', 'license', 'licenseURL', 'description'].map((k) => ({ name: k, type: 'string', maxLength: k === 'license' || k === 'description' ? 4000 : 300,
      description: k === 'license' ? 'licence text, or OFL for the SIL Open Font License 1.1' : undefined })).concat([{ name: 'weight', type: 'number', integer: true, min: 100, max: 900 }]), (a) => {
      const patch = Object.fromEntries(Object.entries(a).filter(([, v]) => v != null && v !== ''));
      if (/^ofl$/i.test(patch.license || '')) { patch.license = FC.panel.OFL; patch.licenseURL = patch.licenseURL || 'https://openfontlicense.org'; }
      S.edit('Set the font info', 'meta', (p) => { p.info = M.cleanInfo(Object.assign({}, p.info, patch)); });
      return S.project().info;
    }),
    add('set_glyph_metrics', 'Set a glyph\'s width and side bearings', [CHAR, { name: 'advance', type: 'number', min: 0, max: 20000 },
      { name: 'lsb', type: 'number', min: -5000, max: 5000, description: 'left side bearing (moves the outline)' }, { name: 'rsb', type: 'number', min: -5000, max: 5000, description: 'right side bearing (changes the width)' }], (a) => {
      const id = glyphId(a.char);
      S.edit(`Space ${a.char}`, { glyph: id }, (p, gl) => { M.setSides(gl, { advance: a.advance, lsb: a.lsb, rsb: a.rsb }); });
      return said(id);
    }),
    add('add_kerning', 'Add kerning pairs', [{ name: 'pairs', type: 'array', required: true, maxItems: 500,
      items: { type: 'object', properties: { left: { type: 'string' }, right: { type: 'string' }, value: { type: 'number' } }, required: ['left', 'right', 'value'] },
      description: '{ left: "A", right: "V", value: -80 } per pair; 0 removes a pair' }], (a) => {
      const p = S.project(), list = (a.pairs || []).map((x) => { const A = M.find(p, x.left), B = M.find(p, x.right); if (!A || !B) throw new Error(`${!A ? x.left : x.right} is not in the font`); return [A.id, B.id, Number(x.value) || 0]; });
      S.edit(`Kern ${list.length} pairs`, 'meta', (pp) => { for (const [l, r, v] of list) M.setKern(pp, l, r, v); });
      return `${Object.keys(S.project().kerning).length} kerning pairs in the font.`;
    }),
    add('get_glyph', 'Read a glyph', [CHAR], (a) => {
      const gl = M.find(S.project(), String(a.char).trim());
      if (!gl) throw new Error(`“${a.char}” is not in the font`);
      return Object.assign(said(gl.id), { path: P.toSvg(gl.contours) });
    }, { readOnly: true, description: 'A glyph\'s outline as SVG path data in font units (y up), its width and side bearings.' }),
  ]);
})(window);
