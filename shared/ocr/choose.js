/* Text recognition (OCR): the "Language and model" button of Slop OCR, Slop PDF (Recognise text) and AI Tools (OCR), the
 * dialog behind it (shared/models/chooser.js with the OCR family, shared/ocr/family.js) and the line that offers a better
 * model after a first read (shared/ocr/suggest.js).
 *   createOcrChoice({ catalog, manager, ui, storageHref, locale, storage, onChange }) ->
 *     { language, model, label(), pick(), open(preset), suggest(lines, model, skipped), suggestion(s, onChosen), button(el, onChosen) }
 * loadOcr() loads the catalog, the model list and the dialog's styles on a page that has not (Slop PDF).
 * Without a choice the language is "Detect automatically": the bundled PP-OCRv4 model reads first (or the model for the
 * browser's language, when it is on this device), and suggest(lines) says when another script's model would read the
 * text better. "Always use …" in the dialog keeps the language and its model (shared/models/prefs.js, family 'ocr');
 * otherwise the choice lasts for this page. Nothing downloads except from the dialog's Download button. */
import { openModelChooser } from '../models/chooser.js';
import { createPrefs } from '../models/prefs.js';
import { ocrFamily } from './family.js';
import { ocrLanguages } from './languages.js';
import { suggestModel } from './suggest.js';

const READY = /^(installed|update|bundled)$/;
const SITE = new URL('../../', import.meta.url);

/** Loads what the chooser needs on a page that did not load it up front (Slop PDF): the cdn hosts, the catalog, the OCR model list (which
 *  adds itself to the model index) and the dialog's styles. Resolves with window.SlopOcrModels. */
export async function loadOcr() {
  const script = (path) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL(path, SITE).href;
    s.onload = resolve; s.onerror = () => reject(new Error(path + ' could not load'));
    document.head.append(s);
  });
  if (!document.querySelector('link[href$="shared/models/chooser.css"]')) {
    document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: new URL('shared/models/chooser.css', SITE).href }));
  }
  if (!globalThis.SlopCdn) await script('shared/cdn/assets.js');   // the model URLs (jsDelivr, then GitHub)
  if (!globalThis.SlopModelCatalog) await script('shared/models/catalog.js');
  if (!globalThis.SlopOcrModels) await script('aitools/ocr-models.js');
  return globalThis.SlopOcrModels;
}

export function createOcrChoice(o = {}) {
  const C = o.catalog || globalThis.SlopOcrModels, M = o.manager || globalThis.SlopAIManager;
  const prefs = o.prefs || createPrefs('ocr', o.storage);
  const L = ocrLanguages(C);
  const locale = o.locale !== undefined ? o.locale : L.fromLocale(globalThis.navigator && navigator.language);
  const state = { language: prefs.pinned() || 'auto', model: null };
  const drawers = [];   // the buttons' titles, redrawn on every choice
  const ready = async (id) => !!id && READY.test(await M.status(id));

  /** The model to run for the language: the one chosen, the preferred one, the first installed one that reads it. */
  async function modelFor(language) {
    if (state.model && (language === 'auto' || C.fits(C.byId(state.model), language))) return state.model;
    if (language === 'auto') {
      const own = locale ? C.modelFor(locale) : null;
      return own && (await ready(own.id)) ? own.id : C.QUICK;
    }
    const pref = prefs.preferred(language);
    if (pref && C.fits(C.byId(pref), language) && (await ready(pref))) return pref;
    for (const r of C.rank(language)) if (await ready(r.model.id)) return r.model.id;
    return null;
  }
  /** Words for the button: "Swedish · Latin script (PP-OCRv5)" or "Detect automatically". */
  function label() {
    const m = state.model && C.byId(state.model);
    const lang = L.name(state.language);
    return m ? `${lang} · ${m.name}` : lang;
  }
  /** Opens the dialog. preset: { language, model } to show first (a suggestion). Resolves with the choice, or null. */
  function open(preset = {}) {
    return new Promise((resolve) => {
      const language = preset.language || state.language;
      let done = false;
      const dlg = openModelChooser({
        family: ocrFamily(C), language, model: preset.model || state.model || (language === 'auto' ? C.QUICK : (C.recommended(language) || {}).id),
        pinned: !!prefs.pinned(), installer: M, ui: o.ui, storageHref: o.storageHref || '../settings/#storage',
        onChoose: (c) => {
          done = true;
          const fits = c.language === 'auto' || C.fits(C.byId(c.model), c.language);
          state.language = c.language;
          state.model = fits ? c.model : null;
          if (c.pin) { prefs.pin(c.language); if (fits) prefs.prefer(c.language, c.model); } else if (prefs.pinned() && prefs.pinned() !== c.language) prefs.pin(null);
          for (const d of drawers) d();
          if (o.onChange) o.onChange(state);
          resolve({ language: state.language, model: state.model });
        },
      });
      // the dialog closes on Use (above) or on Cancel / Escape, which resolves with nothing
      const box = dlg && dlg.box;
      if (box && typeof MutationObserver !== 'undefined') {
        const mo = new MutationObserver(() => { if (!box.isConnected) { mo.disconnect(); if (!done) resolve(null); } });
        mo.observe(document.body, { childList: true, subtree: true });
      }
    });
  }
  /** What to run now: { language, model } with the model installed, or null when the person must choose or download first
   *  (the dialog opens for it). */
  async function pick() {
    let model = await modelFor(state.language);
    if (!model) {
      const c = await open({ language: state.language });
      if (!c) return null;
      model = await modelFor(c.language);
      if (!model) return null;
    }
    return { language: state.language, model };
  }
  /** After a read with no language chosen: the better model to offer, or null (shared/ocr/suggest.js). */
  function suggest(lines, model, skipped = 0) {
    if (state.language !== 'auto' || state.model) return null;
    return suggestModel(lines, { model, catalog: C, locale, skipped });
  }
  /** The sentence for a suggestion. */
  function sentence(s) {
    const m = s.model && C.byId(s.model), lang = s.language ? L.name(s.language) : '';
    if (s.reason === 'script') return `This looks like ${lang || C.SCRIPTS[s.script].name} text. ${m.name} reads it.`;
    if (s.reason === 'accents') return `${m.name} reads accented letters (å, ä, ö, é …) that the quick model drops${lang ? `, for ${lang}` : ''}.`;
    if (m) return `Some lines were not read clearly. If the text is in ${lang}, ${m.name} reads it.`;
    return 'Some lines were not read clearly. If the text is not in Chinese or English, choose its language.';
  }
  /** A notice with the suggestion and a button that opens the dialog on it; null when there is nothing to say. */
  function suggestion(s, onChosen) {
    if (!s) return null;
    const p = document.createElement('p'), b = document.createElement('button');
    p.className = 'ocr-suggest';
    p.setAttribute('role', 'status');
    b.type = 'button'; b.className = 'sui-btn';
    b.textContent = s.model ? `Use ${C.byId(s.model).name}…` : 'Choose the language…';
    b.addEventListener('click', async () => { const c = await open({ language: s.language || 'auto', model: s.model }); if (c && onChosen) onChosen(c); });
    p.append(sentence(s) + ' ', b);
    return p;
  }
  /** The Language and model button (the page's own, or a new one); its title says the current choice. onChosen(choice)
   *  runs after the person pressed Use. */
  function button(b = null, onChosen = null) {
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'sui-btn'; }
    b.classList.add('ocr-lang-btn');
    const draw = () => { b.textContent = 'Language and model'; b.title = label(); b.setAttribute('aria-description', label()); };
    draw();
    drawers.push(draw);
    b.addEventListener('click', async () => { const c = await open(); if (c && onChosen) onChosen(c); });
    return b;
  }
  return {
    get language() { return state.language; }, get model() { return state.model; },
    label, pick, open, suggest, sentence, suggestion, button, modelFor,
  };
}
