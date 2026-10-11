/* SlopVector: the shared config kind 'document' for app 'vector' (shared/config, HANDOFF.md there). The file holds the
   artboard size and the layers (name, colour, hidden, locked) with their objects: rectangles, ellipses, paths and text,
   with a flat fill, stroke, stroke width and opacity. Groups are flattened. Gradients, effects, clipping masks, symbols and
   placed images are not in the file yet. Import replaces the open document after the person confirms. Adds the four
   Config actions to SV.actions (the File menu and the palette read them). Classic script. */
(function () {
  'use strict';
  const SV = window.SV, G = window.SVGeom, C = window.SlopConfig, D = window.SlopConfigDialog, F = C && C.F;
  const APP = 'vector';
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const solid = (c) => (typeof c === 'string' && HEX.test(c) ? c : null);

  /** One layer's objects as file objects (groups flattened, gradients and other paint left out). */
  function objectsOf(layer) {
    const out = [];
    const leaves = [];
    for (const c of layer.children || []) SV.leaves(c, leaves);
    for (const o of leaves) {
      const st = o.style || {};
      const base = { name: String(o.name || o.type).slice(0, 120), fill: solid(st.fill), stroke: solid(st.stroke), strokeWidth: r3(num(st.sw, 0)), opacity: r3(num(st.opacity, 1)) };
      if (o.type === 'rect') out.push(Object.assign({ type: 'rect', x: r3(num(o.x)), y: r3(num(o.y)), w: r3(num(o.w)), h: r3(num(o.h)) }, base));
      else if (o.type === 'ellipse') out.push(Object.assign({ type: 'ellipse', x: r3(num(o.cx)), y: r3(num(o.cy)), rx: r3(num(o.rx)), ry: r3(num(o.ry)) }, base));
      else if (o.type === 'path') out.push(Object.assign({ type: 'path', d: G.toD(o.subpaths || []).slice(0, 20000) }, base));
      else if (o.type === 'text') out.push(Object.assign({ type: 'text', x: r3(num(o.x)), y: r3(num(o.y)), text: String(o.text || '').slice(0, 2000) }, base));
    }
    return out;
  }

  function read() {
    const S = SV._core.S, doc = S.doc;
    return {
      artboard: { width: doc.width, height: doc.height },
      layers: doc.layers.map((l) => ({
        name: String(l.name || 'Layer').slice(0, 120), color: solid(l.color) || undefined,
        hidden: !!l.hidden, locked: !!l.locked, objects: objectsOf(l),
      })),
    };
  }

  /** The file's objects as document objects (SV.mk builds them, so the app's own factories shape them). */
  function objectFrom(o) {
    const mk = SV.mk;
    const style = { fill: o.fill || null, stroke: o.stroke || null, sw: o.strokeWidth || 0, opacity: o.opacity == null ? 1 : o.opacity };
    if (o.type === 'rect') return mk.rect(o.x, o.y, o.w, o.h, 0, style, o.name);
    if (o.type === 'ellipse') return mk.ellipse(o.x, o.y, o.rx, o.ry, style, o.name);
    if (o.type === 'path') return mk.d(o.d, style, o.name);
    return mk.text(o.x, o.y, o.text, { family: 'Inter Tight', size: 48, weight: 400 }, Object.assign({}, style, { fill: style.fill || '#000000' }), o.name);
  }

  function docFrom(data) {
    const doc = SV.newDoc(data.artboard.width, data.artboard.height, 'Imported');
    doc.layers = data.layers.map((l) => {
      const layer = SV.mk.layer(l.name, l.color || '#4f8bff');
      layer.hidden = !!l.hidden; layer.locked = !!l.locked;
      layer.children = l.objects.map(objectFrom);
      return layer;
    });
    return doc;
  }

  async function apply(data, ctx) {
    const S = SV._core.S;
    if (window.SlopUI && S.doc && S.doc.layers.some((l) => l.children && l.children.length)) {
      const ok = await SlopUI.confirm('Open document', 'Replace the open document with “' + ctx.name + '”?', 'Open');
      if (!ok) return { ok: false, message: 'the open document was kept' };
    }
    const doc = docFrom(data);
    SV.loadDoc(doc, { fit: true, resetHistory: true });
    SV.commit('Import config');
  }

  const EXAMPLE = { kind: 'document', value: { artboard: { width: 800, height: 600 }, layers: [{ name: 'Shapes', color: '#4f8bff', hidden: false, locked: false,
    objects: [{ type: 'rect', name: 'Card', x: 40, y: 40, w: 320, h: 200, fill: '#ffd24a', stroke: '#0a0a0a', strokeWidth: 4, opacity: 1 }] }] } };

  if (C && D && F && SV) {
    const obj = F.obj({
      type: F.enum(['rect', 'ellipse', 'path', 'text'], { required: true, desc: 'rect, ellipse, path (d holds SVG path data) or text' }),
      name: F.str({ max: 120, desc: 'object name' }),
      x: F.num({ min: -1e6, max: 1e6, desc: 'x (rect, text) or centre x (ellipse)' }),
      y: F.num({ min: -1e6, max: 1e6, desc: 'y (rect, text) or centre y (ellipse)' }),
      w: F.num({ min: 0, max: 1e6, desc: 'width (rect)' }), h: F.num({ min: 0, max: 1e6, desc: 'height (rect)' }),
      rx: F.num({ min: 0, max: 1e6, desc: 'horizontal radius (ellipse)' }), ry: F.num({ min: 0, max: 1e6, desc: 'vertical radius (ellipse)' }),
      d: F.text({ max: 20000, desc: 'SVG path data such as M0 0L100 0L100 100Z (path)' }),
      text: F.text({ max: 2000, desc: 'the words (text)' }),
      fill: F.str({ max: 7, pattern: HEX, desc: 'fill colour #rrggbb, or leave out for none' }),
      stroke: F.str({ max: 7, pattern: HEX, desc: 'stroke colour #rrggbb, or leave out for none' }),
      strokeWidth: F.num({ min: 0, max: 200, desc: 'stroke width in pixels' }),
      opacity: F.num({ min: 0, max: 1, desc: '0 to 1' }),
    });
    C.registerKind('document', APP, {
      strict: true,
      fields: {
        artboard: F.obj({
          width: F.int({ min: 1, max: 20000, required: true, desc: 'artboard width in pixels' }),
          height: F.int({ min: 1, max: 20000, required: true, desc: 'artboard height in pixels' }),
        }, { required: true, desc: 'the artboard size' }),
        layers: F.list(F.obj({
          name: F.str({ max: 120, required: true, desc: 'layer name' }),
          color: F.str({ max: 7, pattern: HEX, desc: 'layer colour in the panel, #rrggbb' }),
          hidden: F.bool(), locked: F.bool(),
          objects: F.list(obj, { max: 2000, desc: 'the objects on this layer, bottom first' }),
        }), { min: 1, max: 100, required: true, desc: 'layers, bottom first' }),
      },
    }, apply, { label: 'Document', description: 'Artboard and layers with rectangles, ellipses, paths and text', read });
    const cfg = (id, label, act) => { SV.actions[id] = { id, label, keys: [], run: act }; };
    const ad = (fn) => () => fn();
    cfg('file.config.export', 'Config: export current config…', ad(() => D.exportDialog({ app: APP })));
    cfg('file.config.template', 'Config: export plain template…', ad(() => D.templateDialog({ app: APP, example: EXAMPLE })));
    cfg('file.config.import', 'Config: import config…', ad(() => D.importDialog({ app: APP })));
    cfg('file.config.ai', 'Config: ask AI to write a config…', ad(() => D.aiDialog({ app: APP })));
    D.install({ app: APP });
  }
})();
