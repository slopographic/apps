/* SlopLabel — ui/barcode-gen: random values for barcodes. "Generate" fills the selected barcode with one
 * random value; "Generate many" makes a data source with N values (column Barcode, one label per row) and
 * points the selected barcode at {Barcode}. Values come from shared/data/barcode.js (crypto.getRandomValues,
 * GS1 check digits on EAN and UPC). */
'use strict';

const GEN_SYMS = [['code128', 'Code 128'], ['ean13', 'EAN-13'], ['ean8', 'EAN-8'], ['upca', 'UPC-A'], ['code39', 'Code 39'], ['qrcode', 'QR Code'], ['datamatrix', 'Data Matrix']];
const GEN_KINDS = [['digits', 'Digits'], ['letters', 'Letters'], ['alnum', 'Letters and digits']];
const GEN_FIXED = { ean13: 13, ean8: 8, upca: 12 }; // total length, check digit included
const GEN_LEN = { code128: 12, code39: 10, qrcode: 16, datamatrix: 16 };
const GEN = { symbology: 'code128', kind: 'alnum', length: 12, prefix: '', count: 10 };

/** Random value(s) for the current generator settings. n = 0 gives one value. */
function genValues(n = 0) {
  const opts = { symbology: GEN.symbology, kind: GEN.kind, length: GEN.length, prefix: GEN.prefix };
  return n ? SlopData.barcode.randomValues(n, opts) : [SlopData.barcode.randomValue(opts)];
}

/** The generator block of the barcode Properties section. */
function barcodeGenSection() {
  const fixed = GEN_FIXED[GEN.symbology] !== undefined;
  const kind = fSel(GEN_KINDS, GEN.kind, (v) => { GEN.kind = v; }, { id: 'genKind' });
  kind.disabled = fixed;
  const len = fNum(GEN.length, (v) => { GEN.length = Math.floor(v); }, { min: 1, step: 1, id: 'genLen', title: fixed ? 'Fixed by the symbology' : 'Characters (or modules) in the value' });
  len.value = fixed ? String(GEN_FIXED[GEN.symbology]) : String(GEN.length);
  len.disabled = fixed;
  const sym = fSel(GEN_SYMS, GEN.symbology, (v) => {
    GEN.symbology = v;
    GEN.length = GEN_LEN[v] || GEN.length;
    GEN.kind = 'alnum';
    rebuildPanel();
  }, { id: 'genSym' });
  const prefix = fText(GEN.prefix, (v) => { GEN.prefix = v; }, { id: 'genPrefix', placeholder: fixed ? 'digits, e.g. 9 (for EAN-13 bodies)' : 'optional' });
  const count = fNum(GEN.count, (v) => { GEN.count = Math.floor(v); }, { min: 1, max: 10000, step: 1, id: 'genCount', title: 'How many labels Generate many makes' });
  const hint = fixed ? 'EAN and UPC values are digits with a valid check digit, so the scanner reads them.' : 'Each Generate picks a new random value.';
  return fSec('Generate random value',
    fRow('Symbology', sym),
    fRow('Value', kind),
    fRow('Length', len),
    fRow('Prefix', prefix),
    mk('div', { class: 'btnrow' }, fBtn('Generate', generateIntoBarcode, { cls: 'primary', title: 'Fill the selected barcode with one random value' })),
    mk('p', { class: 'hint' }, hint),
    fRow('Count', count),
    mk('div', { class: 'btnrow' }, fBtn('Generate many…', generateManyLabels, { title: 'Make one label per random value (data column Barcode)' })));
}
/** Re-renders the Properties panel so the generator fields match the chosen symbology. */
function rebuildPanel() { if (typeof renderPanels === 'function') renderPanels(); }

/** Fills the selected barcode with one random value of the chosen symbology. */
function generateIntoBarcode() {
  const o = selOne();
  if (!o || o.type !== 'barcode') { SlopUI.toast('Select a barcode first'); return; }
  let v;
  try { v = genValues(0)[0]; } catch (e) { SlopUI.toast(e.message); return; }
  const sym = GEN.symbology;
  editSel((x) => { applySymbology(x, sym); x.content = v; }, 'Generate barcode');
  SlopUI.toast(`Generated ${v}`);
}

/** N random values as data rows, one label each. The selected barcode shows {Barcode}. */
async function generateManyLabels() {
  const d = App.doc, o = selOne();
  if (!o || o.type !== 'barcode') { SlopUI.toast('Select a barcode first; it prints the generated value'); return; }
  let vals;
  try { vals = genValues(Math.max(1, GEN.count | 0)); } catch (e) { SlopUI.toast(e.message); return; }
  if (d.data && !(await SlopUI.confirm('Replace the data?', `The data "${d.data.name}" is replaced by ${vals.length} generated values in a column named Barcode.`, 'Replace'))) return;
  const src = { name: 'Generated barcodes', columns: ['Barcode'], rows: vals.map((v) => [v]), map: {}, qtyCol: '' };
  const sym = GEN.symbology, id = o.id;
  App.rec = 0;
  editDoc((x) => {
    x.data = src;
    const b = x.objects.find((ob) => ob.id === id);
    if (b) { applySymbology(b, sym); b.content = '{Barcode}'; }
  }, 'Generate labels');
  App.tab = 'data';
  refresh();
  SlopUI.toast(`${vals.length} labels, one random value each`);
}
