/* Text recognition (OCR): the languages the OCR models read, for the Language and model chooser (shared/models/chooser.js,
 * through shared/ocr/family.js) and the pages that run OCR (Slop OCR, Slop PDF, AI Tools). The codes come from the one table
 * of script groups in aitools/ocr-models.js (SCRIPTS); the names are the site's language names (shared/speech/languages.js),
 * with the few that Whisper has no token for (traditional Chinese, Kyrgyz, Kurdish, Uyghur, Irish) added here.
 * ocrLanguages(models = window.SlopOcrModels) -> { LANGUAGES, name(code), filter(query), fromLocale(tag) } */
import { languageName } from '../speech/languages.js';

const EXTRA = { 'zh-Hant': 'Chinese (traditional)', zh: 'Chinese (simplified)', ky: 'Kyrgyz', ku: 'Kurdish', ug: 'Uyghur', ga: 'Irish' };
/** 'Detect automatically' in the page's language (shared/i18n/ui/<code>/models.js); the search also takes the English words. */
export const autoName = () => (globalThis.SlopI18n ? globalThis.SlopI18n.t('ui.models.auto') : 'ui.models.auto');
const fold = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** The English name for a code ('auto' is Detect automatically, in the page's language). */
export const ocrLanguageName = (code) => (code === 'auto' ? autoName() : EXTRA[code] || languageName(code));

export function ocrLanguages(models = globalThis.SlopOcrModels) {
  const LANGUAGES = models.CODES.map((code) => ({ code, name: ocrLanguageName(code) })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  /** Pure: the languages whose name or code starts a word with the query (case and accents ignored), sorted by name;
   *  'auto' first when the query is empty or matches "detect" / "auto". */
  function filter(query) {
    const q = fold(query).trim();
    const hit = (l) => !q || fold(l.code) === q || fold(l.name).split(/[\s()-]+/).some((w) => w.startsWith(q)) || fold(l.name).startsWith(q);
    const out = LANGUAGES.filter(hit);
    if (!q || 'detect automatically'.startsWith(q) || 'auto'.startsWith(q) || fold(autoName()).startsWith(q)) out.unshift({ code: 'auto', name: autoName() });
    return out;
  }
  /** The OCR language for a browser locale ('sv-SE' -> 'sv', 'zh-TW' -> 'zh-Hant', 'nb' -> 'no'), or null. */
  function fromLocale(tag) {
    const t = String(tag || '').toLowerCase();
    if (!t) return null;
    if (/^zh-(tw|hk|mo|hant)/.test(t)) return 'zh-Hant';
    const base = t.split('-')[0], code = base === 'nb' ? 'no' : base === 'jv' ? 'jw' : base;
    return models.CODES.includes(code) ? code : null;
  }
  return { LANGUAGES, name: ocrLanguageName, filter, fromLocale };
}
