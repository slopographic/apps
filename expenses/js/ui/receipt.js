// Slop Expenses: "From a receipt…". A photo of a receipt (the camera on a phone, or a picture chosen) is read on this device by
// the Slop AI Tools text reader (PP-OCRv4; Get more offers it the first time, nothing downloads before), and what it says
// fills the new expense: supplier, date, amount and tax (SlopExpenses.receipt.parse). The photo is kept in Slop Drive and
// linked to the expense (receiptId) when it is recorded. Everything stays on the device. Exposes SlopExpenses.receiptScan.
(function (g) {
  'use strict';
  const NS = (g.SlopExpenses = g.SlopExpenses || {});
  const $ = (id) => document.getElementById(id);
  const MODEL = 'ppocr-v4', MAX_SIDE = 2000;
  let pending = null;   // the Drive id of the photo read for the form now shown, until it is recorded or the form changes

  /** True once the reader's model is on this device; the first time, the Get more dialog asks (and may be cancelled). */
  async function ensureModel() {
    const M = g.SlopAIManager;
    if (!M || !g.SlopAITools) throw new Error('The text reader is not available on this page.');
    if ((await M.status(MODEL)) !== 'needs-download') return true;
    return new Promise((resolve) => g.SlopAIGetMore.open(MODEL, { onInstalled: () => resolve(true), onClose: () => resolve(false) }));
  }

  /** Reads one photo: its lines of text, top to bottom. */
  async function readLines(file, onStatus) {
    const T = g.SlopAITools;
    await T.ensure(MODEL, onStatus);
    onStatus('Reading the receipt…');
    const { bitmap, w, h } = await T.image(file, { maxSide: MAX_SIDE });
    const r = await T.call('ocr', { bitmap, w, h }, { transfer: [bitmap] });
    return r.lines.map((l) => l.text);
  }

  /** What was read goes into the form; the person checks it before Record. */
  function fill(got, settings) {
    const S = g.SlopData, cur = ($('eCurrency').value || settings.currency || 'USD').toUpperCase();
    if (got.supplier) $('eSupplier').value = got.supplier;
    if (got.date) $('eDate').value = got.date;
    if (got.currency && got.currency !== cur) $('eCurrency').value = got.currency;
    const c = $('eCurrency').value || cur;
    if (got.total !== null) $('eAmount').value = S.money.plainMinor(got.total, c);
    if (got.tax !== null) { $('eTax').value = S.money.plainMinor(got.tax, c); $('eTax').dispatchEvent(new Event('input')); }
  }

  /** The whole flow for one photo. say(text, bad) writes the editor's message line. */
  async function scan(file, say) {
    if (!file) return null;
    pending = null;
    try {
      if (!(await ensureModel())) { say('The receipt was not read: the text reader is needed first.', true); return null; }
      const settings = await g.SlopBiz.settings();
      const lines = await readLines(file, (s) => say(s));
      const got = NS.receipt.parse(lines, { currency: settings.currency, dayFirst: !/^en-US$/i.test(settings.locale || '') });
      fill(got, settings);
      const T = g.SlopAITools;
      pending = await T.toDrive(file.name || 'Receipt.jpg', file, 'expenses', { kind: 'receipt' }).catch(() => null);
      const missing = ['supplier', 'date', 'total'].filter((k) => !got.found.includes(k)).map((k) => (k === 'total' ? 'amount' : k));
      say(got.found.length ? `Read from the receipt${missing.length ? `; not found: ${missing.join(', ')}` : ''}. Check it, then Record.` : 'No supplier, date or amount could be read. Type them in.', !got.found.length);
      return got;
    } catch (e) {
      say('The receipt could not be read: ' + ((e && e.message) || e), true);
      return null;
    }
  }

  function mount(say) {
    $('eReceipt').addEventListener('click', () => $('eReceiptPick').click());
    $('eReceiptPick').addEventListener('change', async (e) => { const f = e.target.files[0]; e.target.value = ''; await scan(f, say); });
  }

  /** The photo's Drive id for the expense being recorded (the editor clears it once the expense is recorded or replaced). */
  NS.receiptScan = { mount, scan, current: () => pending, clear: () => { pending = null; } };
})(typeof window !== 'undefined' ? window : globalThis);
