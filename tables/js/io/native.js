/* Slop Tables native file (.stab): a JSON document holding the whole workbook. Cells keep their input
   (formula text or value) and a style id into a deduplicated style table; computed values are not stored
   (they are recalculated on open). */
import { Workbook } from '../engine/index.js';
import { ERR, FErr, errFrom } from '../engine/values.js';

export const FORMAT = 'slop-tables', VERSION = 1;
export const MIME = 'application/x-slop-table', EXT = 'stab';

/** Workbook → plain object (JSON-safe). */
export function toNative(wb) {
  const sheetIndex = (id) => wb.sheets.findIndex((s) => s.id === id);
  return {
    format: FORMAT, version: VERSION, title: wb.props.title || '', active: wb.active || 0,
    styles: wb.styles,
    sheets: wb.sheets.map((sh) => ({
      name: sh.name, defW: sh.defW, defH: sh.defH, freeze: { ...sh.freeze }, merges: sh.merges.map((m) => ({ ...m })),
      cols: [...sh.cols].sort((a, b) => a[0] - b[0]), rows: [...sh.rows].sort((a, b) => a[0] - b[0]),
      cells: [...sh.cells].sort((a, b) => a[0] - b[0]).map(([k, cell]) => [Math.floor(k / 16384), k % 16384, encodeCell(cell)])
        .filter(([, , rec]) => Object.keys(rec).length),
    })),
    names: [...wb.names.values()].map((d) => ({ name: d.name, ref: d.ref, scope: d.scope ? sheetIndex(d.scope) : null })),
  };
}

function encodeCell(cell) {
  const rec = {};
  if (cell.f !== undefined) rec.f = cell.f;
  else if (cell.v instanceof FErr) rec.e = cell.v.code;
  else if (cell.v !== null && cell.v !== undefined) rec.v = cell.v;
  if (cell.s) rec.s = cell.s;
  return rec;
}

/** Plain object → Workbook. Throws if the object is not a Slop Tables file. */
export function fromNative(obj) {
  if (!obj || obj.format !== FORMAT || !Array.isArray(obj.sheets)) throw new Error('This is not a Slop Tables file.');
  const wb = new Workbook({ sheets: 0 });
  wb.auto = false;
  const smap = [0];
  for (let i = 1; i < (obj.styles || []).length; i++) smap[i] = wb.styleId(obj.styles[i]);
  const mapStyle = (s) => (s && smap[s]) || 0;
  const used = new Set();
  obj.sheets.forEach((so, i) => {
    let name = String(so.name || 'Sheet' + (i + 1)).slice(0, 31);
    if (used.has(name.toLowerCase())) name = 'Sheet' + (i + 1);
    used.add(name.toLowerCase());
    const sh = wb.addSheet(name);
    sh.defW = so.defW || sh.defW; sh.defH = so.defH || sh.defH;
    sh.freeze = { r: so.freeze?.r || 0, c: so.freeze?.c || 0 };
    sh.merges = (so.merges || []).map((m) => ({ ...m }));
    for (const [c, p] of so.cols || []) { p.s = mapStyle(p.s); sh.cols.set(c, p); }
    for (const [r, p] of so.rows || []) { p.s = mapStyle(p.s); sh.rows.set(r, p); }
    for (const [r, c, rec] of so.cells || []) {
      const cell = sh.ensure(r, c);
      if (rec.s) cell.s = mapStyle(rec.s);
      if (rec.f !== undefined) wb.setFormula(sh, r, c, rec.f, { lenient: true });
      else if (rec.e !== undefined) cell.v = errFrom(rec.e) || ERR.VALUE;
      else if (rec.v !== undefined) cell.v = rec.v;
    }
  });
  for (const d of obj.names || []) {
    try { wb.defineName(d.name, d.ref, d.scope !== null && d.scope !== undefined ? wb.sheets[d.scope] : null); } catch (e) { /* skip bad names */ }
  }
  wb.props.title = obj.title || '';
  wb.auto = true;
  wb.recalcAll();
  wb.active = Math.min(obj.active || 0, wb.sheets.length - 1);
  return wb;
}

export const toBlob = (wb) => new Blob([JSON.stringify(toNative(wb))], { type: MIME });
export async function fromBlob(blob) { return fromNative(JSON.parse(await blob.text())); }
