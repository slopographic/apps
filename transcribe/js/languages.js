/* Slop Transcribe: every language Whisper (tiny, multilingual) can be told to hear. The code is the one in its language
 * token, <|code|>, which aitools/workers/speech-engine.js looks up among the tokenizer's language tokens; note Javanese
 * is "jw" there, not "jv". Names are in English. LANGUAGES is sorted by name; fillLanguages puts Detect first. */
const TABLE = {
  en: 'English', zh: 'Chinese', de: 'German', es: 'Spanish', ru: 'Russian', ko: 'Korean', fr: 'French', ja: 'Japanese',
  pt: 'Portuguese', tr: 'Turkish', pl: 'Polish', ca: 'Catalan', nl: 'Dutch', ar: 'Arabic', sv: 'Swedish', it: 'Italian',
  id: 'Indonesian', hi: 'Hindi', fi: 'Finnish', vi: 'Vietnamese', he: 'Hebrew', uk: 'Ukrainian', el: 'Greek', ms: 'Malay',
  cs: 'Czech', ro: 'Romanian', da: 'Danish', hu: 'Hungarian', ta: 'Tamil', no: 'Norwegian', th: 'Thai', ur: 'Urdu',
  hr: 'Croatian', bg: 'Bulgarian', lt: 'Lithuanian', la: 'Latin', mi: 'Maori', ml: 'Malayalam', cy: 'Welsh', sk: 'Slovak',
  te: 'Telugu', fa: 'Persian', lv: 'Latvian', bn: 'Bengali', sr: 'Serbian', az: 'Azerbaijani', sl: 'Slovenian',
  kn: 'Kannada', et: 'Estonian', mk: 'Macedonian', br: 'Breton', eu: 'Basque', is: 'Icelandic', hy: 'Armenian',
  ne: 'Nepali', mn: 'Mongolian', bs: 'Bosnian', kk: 'Kazakh', sq: 'Albanian', sw: 'Swahili', gl: 'Galician',
  mr: 'Marathi', pa: 'Punjabi', si: 'Sinhala', km: 'Khmer', sn: 'Shona', yo: 'Yoruba', so: 'Somali', af: 'Afrikaans',
  oc: 'Occitan', ka: 'Georgian', be: 'Belarusian', tg: 'Tajik', sd: 'Sindhi', gu: 'Gujarati', am: 'Amharic',
  yi: 'Yiddish', lo: 'Lao', uz: 'Uzbek', fo: 'Faroese', ht: 'Haitian Creole', ps: 'Pashto', tk: 'Turkmen',
  nn: 'Nynorsk', mt: 'Maltese', sa: 'Sanskrit', lb: 'Luxembourgish', my: 'Burmese', bo: 'Tibetan', tl: 'Tagalog',
  mg: 'Malagasy', as: 'Assamese', tt: 'Tatar', haw: 'Hawaiian', ln: 'Lingala', ha: 'Hausa', ba: 'Bashkir',
  jw: 'Javanese', su: 'Sundanese',
};

/** [{ code, name }] sorted by English name. */
export const LANGUAGES = Object.entries(TABLE).map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name, 'en'));

/** The English name for a Whisper code ('auto' is Detect); an unknown code comes back as it is. */
export const languageName = (code) => (code === 'auto' ? 'Detect' : TABLE[code] || code || '');

/** Fills a <select> with Detect then every language, keeping its value (or the given one) when it is still offered. */
export function fillLanguages(select, value = select.value || 'auto') {
  const opt = (v, t) => Object.assign(document.createElement('option'), { value: v, textContent: t });
  select.replaceChildren(opt('auto', 'Detect'), ...LANGUAGES.map((l) => opt(l.code, l.name)));
  select.value = value === 'auto' || TABLE[value] ? value : 'auto';
  return select;
}
