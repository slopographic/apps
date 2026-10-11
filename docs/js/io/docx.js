/* Slop Docs — io/docx: Word (.docx) export and import on top of shared/office (zip + xml).
 * Export writes direct formatting from the resolved styles (so Word shows what the editor shows): fonts,
 * sizes, marks, alignment, indents, spacing, lists (numbering.xml), shading, tables and page size and margins.
 * Import reads paragraphs, runs, lists, tables and page setup. Not carried yet: images, headers and footers,
 * footnotes, fields, comments and tracked changes (they are dropped on import and not written on export). */
import { writeZip, readZip, readText } from '../../../shared/office/zip.js';
import { x, doc as xmlDoc, xmlns, parseXml, kids, kid, path as pathOf, attr, NS } from '../../../shared/office/xml.js';
import { ptToTwips, twipsToPt, ptToHalfPt, halfPtToPt, hexToOoxml, ooxmlToHex, ptToEighths } from '../../../shared/office/units.js';
import { newDoc, normalizeDoc, para, uid, pageSize, OBJ, defaultSection } from '../model/doc.js';
import { runMarks } from '../model/styles.js';
import { resolvedProps } from '../layout/para.js';
import { bulletList, numberList } from '../model/styles.js';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const WORD_FONT = { Carlito: 'Calibri', Arimo: 'Arial', Tinos: 'Times New Roman', Caladea: 'Cambria', Cousine: 'Courier New' };
const JC = { left: 'left', center: 'center', right: 'right', justify: 'both' };
const numId = (id) => (id === 'num' ? 2 : 1);
/** Built-in Word style ids for the editor's paragraph styles (Word's navigation pane and styles gallery read these). */
const WORD_STYLE = { Title: 'Title', Subtitle: 'Subtitle', H1: 'Heading1', H2: 'Heading2', H3: 'Heading3', H4: 'Heading4', H5: 'Heading5', H6: 'Heading6', Quote: 'Quote', Code: 'Code' };
const HEAD_SZ = [40, 32, 28, 24, 22, 22];
const STYLES = xmlDoc(x('w:styles', xmlns('w'), [
  x('w:docDefaults', null, [
    x('w:rPrDefault', null, [x('w:rPr', null, [x('w:rFonts', { 'w:ascii': 'Calibri', 'w:hAnsi': 'Calibri', 'w:cs': 'Calibri' }), x('w:sz', { 'w:val': 22 })])]),
    x('w:pPrDefault', null, [x('w:pPr', null, [x('w:spacing', { 'w:after': 120, 'w:line': 259, 'w:lineRule': 'auto' })])]),
  ]),
  x('w:style', { 'w:type': 'paragraph', 'w:default': 1, 'w:styleId': 'Normal' }, [x('w:name', { 'w:val': 'Normal' }), x('w:qFormat')]),
  x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'Title' }, [x('w:name', { 'w:val': 'Title' }), x('w:basedOn', { 'w:val': 'Normal' }), x('w:next', { 'w:val': 'Normal' }), x('w:qFormat'), x('w:rPr', null, [x('w:sz', { 'w:val': 52 })])]),
  x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'Subtitle' }, [x('w:name', { 'w:val': 'Subtitle' }), x('w:basedOn', { 'w:val': 'Normal' }), x('w:next', { 'w:val': 'Normal' }), x('w:qFormat'), x('w:rPr', null, [x('w:color', { 'w:val': '595959' }), x('w:sz', { 'w:val': 30 })])]),
  ...[1, 2, 3, 4, 5, 6].map((l) => x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'Heading' + l }, [
    x('w:name', { 'w:val': 'heading ' + l }), x('w:basedOn', { 'w:val': 'Normal' }), x('w:next', { 'w:val': 'Normal' }), x('w:uiPriority', { 'w:val': 9 }), x('w:qFormat'),
    x('w:pPr', null, [x('w:keepNext'), x('w:keepLines'), x('w:spacing', { 'w:before': 240, 'w:after': 80 }), x('w:outlineLvl', { 'w:val': l - 1 })]),
    x('w:rPr', null, [x('w:b'), x('w:color', { 'w:val': '1F3A5F' }), x('w:sz', { 'w:val': HEAD_SZ[l - 1] })]),
  ])),
  x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'Quote' }, [x('w:name', { 'w:val': 'Quote' }), x('w:basedOn', { 'w:val': 'Normal' }), x('w:next', { 'w:val': 'Normal' }), x('w:qFormat'), x('w:pPr', null, [x('w:ind', { 'w:left': 720, 'w:right': 720 })]), x('w:rPr', null, [x('w:i')])]),
  x('w:style', { 'w:type': 'paragraph', 'w:styleId': 'Code' }, [x('w:name', { 'w:val': 'Code' }), x('w:basedOn', { 'w:val': 'Normal' }), x('w:next', { 'w:val': 'Code' }), x('w:pPr', null, [x('w:spacing', { 'w:after': 0 })]), x('w:rPr', null, [x('w:rFonts', { 'w:ascii': 'Courier New', 'w:hAnsi': 'Courier New' }), x('w:sz', { 'w:val': 20 })])]),
]));

/* ---------- export ---------- */
function runXml(doc, p, r) {
  if (r.obj === 'pb') return x('w:r', null, [x('w:br', { 'w:type': 'page' })]);
  if (r.obj) return '';
  const m = runMarks(doc, p, r);
  const font = WORD_FONT[m.font] || m.font || 'Calibri';
  const rpr = x('w:rPr', null, [
    x('w:rFonts', { 'w:ascii': font, 'w:hAnsi': font, 'w:cs': font }),
    m.b ? x('w:b') : '', m.i ? x('w:i') : '',
    m.s ? x('w:strike') : '',
    m.color ? x('w:color', { 'w:val': hexToOoxml(m.color) }) : '',
    x('w:sz', { 'w:val': ptToHalfPt(m.size || 11) }),
    m.u ? x('w:u', { 'w:val': 'single' }) : '',
    m.va ? x('w:vertAlign', { 'w:val': m.va === 'sup' ? 'superscript' : 'subscript' }) : '',
  ]);
  const pieces = r.text.split(/(\t|\n)/).filter((s) => s !== '').map((s) => (s === '\t' ? x('w:tab') : s === '\n' ? x('w:br') : x('w:t', { 'xml:space': 'preserve' }, s)));
  return x('w:r', null, [rpr, ...pieces]);
}
function paraXml(doc, p) {
  const P = resolvedProps(doc, p);
  const list = P.list && doc.lists[P.list.id] ? P.list : null;
  const sp = x('w:spacing', {
    'w:before': ptToTwips(P.before || 0), 'w:after': ptToTwips(P.after || 0),
    'w:line': P.lineExact ? ptToTwips(P.lineExact) : P.lineAtLeast ? ptToTwips(P.lineAtLeast) : Math.round((P.line || 1) * 240),
    'w:lineRule': P.lineExact ? 'exact' : P.lineAtLeast ? 'atLeast' : 'auto',
  });
  const first = P.indF || 0;
  const ind = x('w:ind', { 'w:left': ptToTwips(P.indL || 0), 'w:right': ptToTwips(P.indR || 0), 'w:firstLine': first > 0 ? ptToTwips(first) : null, 'w:hanging': first < 0 ? ptToTwips(-first) : null });
  const ppr = x('w:pPr', null, [
    WORD_STYLE[p.style] ? x('w:pStyle', { 'w:val': WORD_STYLE[p.style] }) : '',
    P.keepNext ? x('w:keepNext') : '', P.keepLines ? x('w:keepLines') : '', P.pageBreakBefore ? x('w:pageBreakBefore') : '',
    list ? x('w:numPr', null, [x('w:ilvl', { 'w:val': list.lvl || 0 }), x('w:numId', { 'w:val': numId(list.id) })]) : '',
    P.borderBottom ? x('w:pBdr', null, [x('w:bottom', { 'w:val': 'single', 'w:sz': ptToEighths(P.borderBottom.w || 1), 'w:space': 1, 'w:color': hexToOoxml(P.borderBottom.color || '#000000') })]) : '',
    P.shade ? x('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': hexToOoxml(P.shade) }) : '',
    sp, ind, x('w:jc', { 'w:val': JC[P.align] || 'left' }),
  ]);
  const runs = (p.runs || []).map((r) => runXml(doc, p, r));
  return x('w:p', null, [ppr, runs]);
}
function tableXml(doc, t) {
  const borders = t.border ? ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => x('w:' + s, { 'w:val': 'single', 'w:sz': ptToEighths(t.border.w || 0.5), 'w:space': 0, 'w:color': hexToOoxml(t.border.color || '#000000') })) : [];
  const tblPr = x('w:tblPr', null, [x('w:tblW', { 'w:w': ptToTwips(t.cols.reduce((a, b) => a + b, 0)), 'w:type': 'dxa' }), x('w:tblBorders', null, borders), x('w:tblLayout', { 'w:type': 'fixed' })]);
  const grid = x('w:tblGrid', null, t.cols.map((c) => x('w:gridCol', { 'w:w': ptToTwips(c) })));
  const rows = t.rows.map((row) => {
    let col = 0;
    const cells = row.cells.map((c) => {
      const span = c.span || 1, width = t.cols.slice(col, col + span).reduce((a, b) => a + b, 0);
      col += span;
      const inner = (c.blocks || []).map((b) => (b.type === 'table' ? tableXml(doc, b) : paraXml(doc, b))).join('') || '<w:p/>';
      const tcPr = x('w:tcPr', null, [
        x('w:tcW', { 'w:w': ptToTwips(width), 'w:type': 'dxa' }),
        span > 1 ? x('w:gridSpan', { 'w:val': span }) : '',
        c.vmerge ? x('w:vMerge', c.vmerge === 'restart' ? { 'w:val': 'restart' } : null) : '',
        c.shade ? x('w:shd', { 'w:val': 'clear', 'w:color': 'auto', 'w:fill': hexToOoxml(c.shade) }) : '',
      ]);
      return x('w:tc', null, [tcPr, inner]);
    });
    return x('w:tr', null, [row.header ? x('w:trPr', null, [x('w:tblHeader')]) : '', cells]);
  });
  return x('w:tbl', null, [tblPr, grid, rows]);
}
const NUMBERING = xmlDoc(x('w:numbering', xmlns('w'), [
  x('w:abstractNum', { 'w:abstractNumId': 0 }, [0, 1, 2].map((l) => x('w:lvl', { 'w:ilvl': l }, [
    x('w:start', { 'w:val': 1 }), x('w:numFmt', { 'w:val': 'bullet' }), x('w:lvlText', { 'w:val': ['•', '◦', '▪'][l] }), x('w:lvlJc', { 'w:val': 'left' }),
    x('w:pPr', null, [x('w:ind', { 'w:left': 720 * (l + 1), 'w:hanging': 360 })])]))),
  x('w:abstractNum', { 'w:abstractNumId': 1 }, [0, 1, 2].map((l) => x('w:lvl', { 'w:ilvl': l }, [
    x('w:start', { 'w:val': 1 }), x('w:numFmt', { 'w:val': ['decimal', 'lowerLetter', 'lowerRoman'][l] }), x('w:lvlText', { 'w:val': `%${l + 1}.` }), x('w:lvlJc', { 'w:val': 'left' }),
    x('w:pPr', null, [x('w:ind', { 'w:left': 720 * (l + 1), 'w:hanging': 360 })])]))),
  x('w:num', { 'w:numId': 1 }, [x('w:abstractNumId', { 'w:val': 0 })]),
  x('w:num', { 'w:numId': 2 }, [x('w:abstractNumId', { 'w:val': 1 })]),
]));

/** Document → DOCX Blob. */
export async function exportDocx(doc) {
  const [W, H] = pageSize(doc.section), m = doc.section.margin;
  const sect = x('w:sectPr', null, [
    x('w:pgSz', { 'w:w': ptToTwips(W), 'w:h': ptToTwips(H), 'w:orient': W > H ? 'landscape' : null }),
    x('w:pgMar', { 'w:top': ptToTwips(m.top), 'w:right': ptToTwips(m.right), 'w:bottom': ptToTwips(m.bottom), 'w:left': ptToTwips(m.left), 'w:header': ptToTwips(m.header), 'w:footer': ptToTwips(m.footer), 'w:gutter': 0 }),
  ]);
  const body = doc.blocks.map((b) => (b.type === 'table' ? tableXml(doc, b) : b.type === 'p' ? paraXml(doc, b) : '')).join('');
  const docXml = xmlDoc(x('w:document', xmlns('w', 'r'), [x('w:body', null, [body, sect])]));
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const core = xmlDoc(x('cp:coreProperties', xmlns('cp', 'dc', 'dcterms', 'xsi'), [
    x('dc:title', null, doc.meta.title || ''), x('dc:creator', null, doc.meta.author || ''),
    x('dcterms:created', { 'xsi:type': 'dcterms:W3CDTF' }, now), x('dcterms:modified', { 'xsi:type': 'dcterms:W3CDTF' }, now),
  ]));
  const types = xmlDoc(x('Types', { xmlns: NS.ct }, [
    x('Default', { Extension: 'rels', ContentType: 'application/vnd.openxmlformats-package.relationships+xml' }),
    x('Default', { Extension: 'xml', ContentType: 'application/xml' }),
    x('Override', { PartName: '/word/document.xml', ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml' }),
    x('Override', { PartName: '/word/numbering.xml', ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml' }),
    x('Override', { PartName: '/word/styles.xml', ContentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml' }),
    x('Override', { PartName: '/docProps/core.xml', ContentType: 'application/vnd.openxmlformats-package.core-properties+xml' }),
  ]));
  const rels = xmlDoc(x('Relationships', { xmlns: NS.rel }, [
    x('Relationship', { Id: 'rId1', Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument', Target: 'word/document.xml' }),
    x('Relationship', { Id: 'rId2', Type: 'http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties', Target: 'docProps/core.xml' }),
  ]));
  const docRels = xmlDoc(x('Relationships', { xmlns: NS.rel }, [
    x('Relationship', { Id: 'rId1', Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering', Target: 'numbering.xml' }),
    x('Relationship', { Id: 'rId2', Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', Target: 'styles.xml' }),
  ]));
  return writeZip([
    { path: '[Content_Types].xml', data: types },
    { path: '_rels/.rels', data: rels },
    { path: 'word/document.xml', data: docXml },
    { path: 'word/numbering.xml', data: NUMBERING },
    { path: 'word/styles.xml', data: STYLES },
    { path: 'word/_rels/document.xml.rels', data: docRels },
    { path: 'docProps/core.xml', data: core },
  ]);
}

/* ---------- import ---------- */
const STYLE_IN = { title: 'Title', subtitle: 'Subtitle', quote: 'Quote', intensequote: 'Quote', code: 'Code' };
function styleIn(v) {
  const k = String(v || '').replace(/\s+/g, '').toLowerCase();
  const h = /^heading([1-6])$/.exec(k);
  if (h) return 'H' + h[1];
  return STYLE_IN[k] || 'Normal';
}
const onOff = (el) => { if (!el) return false; const v = attr(el, NS.w, 'val'); return !(v === 'false' || v === '0' || v === 'none'); };
function markIn(rPr) {
  const m = {};
  if (!rPr) return m;
  if (onOff(kid(rPr, NS.w, 'b'))) m.b = true;
  if (onOff(kid(rPr, NS.w, 'i'))) m.i = true;
  if (onOff(kid(rPr, NS.w, 'strike'))) m.s = true;
  const u = kid(rPr, NS.w, 'u'); if (u && attr(u, NS.w, 'val') !== 'none') m.u = true;
  const f = kid(rPr, NS.w, 'rFonts'), fn = f && (attr(f, NS.w, 'ascii') || attr(f, NS.w, 'hAnsi')); if (fn) m.font = fn;
  const sz = kid(rPr, NS.w, 'sz'); if (sz && Number(attr(sz, NS.w, 'val'))) m.size = halfPtToPt(attr(sz, NS.w, 'val'));
  const c = kid(rPr, NS.w, 'color'), hex = c && attr(c, NS.w, 'val'); if (hex && hex !== 'auto' && ooxmlToHex(hex)) m.color = ooxmlToHex(hex);
  const va = kid(rPr, NS.w, 'vertAlign'), v = va && attr(va, NS.w, 'val');
  if (v === 'superscript') m.va = 'sup'; else if (v === 'subscript') m.va = 'sub';
  return m;
}
/** Runs of a w:p (or a hyperlink in it). */
function runsIn(pEl) {
  const out = [];
  for (const el of kids(pEl, NS.w, '*')) {
    const rs = el.localName === 'hyperlink' ? kids(el, NS.w, 'r') : el.localName === 'r' ? [el] : [];
    for (const r of rs) {
      const m = markIn(kid(r, NS.w, 'rPr'));
      for (const c of kids(r, NS.w, '*')) {
        if (c.localName === 't') { if (c.textContent) out.push({ ...m, text: c.textContent }); }
        else if (c.localName === 'tab') out.push({ ...m, text: '\t' });
        else if (c.localName === 'br' || c.localName === 'cr') {
          if (attr(c, NS.w, 'type') === 'page') out.push({ obj: 'pb', text: OBJ });
          else out.push({ ...m, text: '\n' });
        }
      }
    }
  }
  return out;
}
function paraIn(pEl, lists) {
  const pPr = kid(pEl, NS.w, 'pPr'), p = para();
  p.runs = runsIn(pEl);
  if (!pPr) return p;
  p.style = styleIn(attr(pathOf(pPr, NS.w, 'pStyle'), NS.w, 'val'));
  const props = {};
  const jc = attr(kid(pPr, NS.w, 'jc'), NS.w, 'val');
  if (jc) props.align = { both: 'justify', center: 'center', right: 'right', end: 'right' }[jc] || 'left';
  const ind = kid(pPr, NS.w, 'ind');
  if (ind) {
    const L = attr(ind, NS.w, 'left') ?? attr(ind, NS.w, 'start'), R = attr(ind, NS.w, 'right') ?? attr(ind, NS.w, 'end');
    if (L != null) props.indL = twipsToPt(L);
    if (R != null) props.indR = twipsToPt(R);
    if (attr(ind, NS.w, 'firstLine') != null) props.indF = twipsToPt(attr(ind, NS.w, 'firstLine'));
    if (attr(ind, NS.w, 'hanging') != null) props.indF = -twipsToPt(attr(ind, NS.w, 'hanging'));
  }
  const sp = kid(pPr, NS.w, 'spacing');
  if (sp) {
    if (attr(sp, NS.w, 'before') != null) props.before = twipsToPt(attr(sp, NS.w, 'before'));
    if (attr(sp, NS.w, 'after') != null) props.after = twipsToPt(attr(sp, NS.w, 'after'));
    const ln = Number(attr(sp, NS.w, 'line')), rule = attr(sp, NS.w, 'lineRule') || 'auto';
    if (ln) { if (rule === 'exact') props.lineExact = twipsToPt(ln); else if (rule === 'atLeast') props.lineAtLeast = twipsToPt(ln); else props.line = ln / 240; }
  }
  const np = kid(pPr, NS.w, 'numPr');
  if (np) {
    const id = attr(kid(np, NS.w, 'numId'), NS.w, 'val');
    if (id && id !== '0') props.list = { id: lists.get(id) || 'bul', lvl: Number(attr(kid(np, NS.w, 'ilvl'), NS.w, 'val') || 0) };
  }
  if (kid(pPr, NS.w, 'keepNext')) props.keepNext = true;
  if (kid(pPr, NS.w, 'keepLines')) props.keepLines = true;
  if (kid(pPr, NS.w, 'pageBreakBefore')) props.pageBreakBefore = true;
  const shd = kid(pPr, NS.w, 'shd'), fill = shd && attr(shd, NS.w, 'fill');
  if (fill && fill !== 'auto' && ooxmlToHex(fill)) props.shade = ooxmlToHex(fill);
  p.props = props;
  p.runs = p.runs.filter((r) => r.text);
  return p;
}
function tableIn(tEl, lists) {
  const grid = kids(kid(tEl, NS.w, 'tblGrid'), NS.w, 'gridCol');
  const cols = grid.length ? grid.map((c) => twipsToPt(attr(c, NS.w, 'w') || 0) || 36) : [468];
  const rows = kids(tEl, NS.w, 'tr').map((tr) => ({
    header: !!kid(kid(tr, NS.w, 'trPr'), NS.w, 'tblHeader'),
    cells: kids(tr, NS.w, 'tc').map((tc) => {
      const tcPr = kid(tc, NS.w, 'tcPr');
      const span = Number(attr(kid(tcPr, NS.w, 'gridSpan'), NS.w, 'val') || 1);
      const vm = kid(tcPr, NS.w, 'vMerge');
      const shd = kid(tcPr, NS.w, 'shd'), fill = shd && attr(shd, NS.w, 'fill');
      const blocks = blocksIn(tc, lists);
      return { blocks: blocks.length ? blocks : [para()], span, vmerge: vm ? (attr(vm, NS.w, 'val') === 'restart' ? 'restart' : 'continue') : undefined, shade: fill && fill !== 'auto' ? ooxmlToHex(fill) : undefined };
    }),
  }));
  const bd = pathOf(tEl, NS.w, 'tblPr', 'tblBorders');
  return { type: 'table', id: uid('t'), cols, rows, border: bd ? { w: 0.5, color: '#000000' } : null, align: 'left' };
}
function blocksIn(el, lists) {
  const out = [];
  for (const c of kids(el, NS.w, '*')) {
    if (c.localName === 'p') out.push(paraIn(c, lists));
    else if (c.localName === 'tbl') out.push(tableIn(c, lists));
  }
  return out;
}
function listKinds(xml) {
  const kinds = new Map();
  if (!xml) return kinds;
  const d = parseXml(xml);
  const abs = new Map();
  for (const a of kids(d.documentElement, NS.w, 'abstractNum')) {
    const lvl = kids(a, NS.w, 'lvl').find((l) => attr(l, NS.w, 'ilvl') === '0') || kid(a, NS.w, 'lvl');
    const fmt = attr(kid(lvl, NS.w, 'numFmt'), NS.w, 'val');
    abs.set(attr(a, NS.w, 'abstractNumId'), fmt === 'bullet' ? 'bul' : 'num');
  }
  for (const n of kids(d.documentElement, NS.w, 'num')) kinds.set(attr(n, NS.w, 'numId'), abs.get(attr(kid(n, NS.w, 'abstractNumId'), NS.w, 'val')) || 'num');
  return kinds;
}

/** DOCX Blob/bytes → document. Throws when the file is not a Word document. */
export async function importDocx(src) {
  const files = await readZip(src);
  const xml = readText(files, 'word/document.xml');
  if (!xml) throw new Error('Not a Word document');
  const d = parseXml(xml), body = kid(d.documentElement, NS.w, 'body');
  const lists = listKinds(readText(files, 'word/numbering.xml'));
  const out = newDoc();
  out.blocks = blocksIn(body, lists);
  const sp = kid(body, NS.w, 'sectPr'), sz = pathOf(sp, NS.w, 'pgSz'), mar = pathOf(sp, NS.w, 'pgMar');
  if (sz) {
    const w = twipsToPt(attr(sz, NS.w, 'w')), h = twipsToPt(attr(sz, NS.w, 'h'));
    out.section = { ...defaultSection(), size: { w: Math.min(w, h), h: Math.max(w, h) }, orient: w > h ? 'landscape' : 'portrait' };
  }
  if (mar) {
    const g = (k) => (attr(mar, NS.w, k) != null ? twipsToPt(attr(mar, NS.w, k)) : undefined);
    out.section.margin = { ...out.section.margin, top: g('top') ?? 72, right: g('right') ?? 72, bottom: g('bottom') ?? 72, left: g('left') ?? 72, header: g('header') ?? 36, footer: g('footer') ?? 36 };
  }
  const usesBul = [...lists.values()].includes('bul'), usesNum = [...lists.values()].includes('num');
  if (usesBul) out.lists.bul = bulletList();
  if (usesNum) out.lists.num = numberList();
  return normalizeDoc(out);
}
