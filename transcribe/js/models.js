/* Slop Transcribe: which language and model a file is read with, and the offer of a better model once it is read.
 * Start fast, upgrade on request: by default the quick model (Whisper tiny) finds the language of each new file and reads
 * it, so text shows at once; then the result offers the model the Language and model dialog ranks first for that language
 * (aitools/speech-models.js rank()). Nothing is remembered unless the person asks: "Always use Swedish" pins the language,
 * "Use it from now on for Swedish" makes a model the one for that language (shared/models/prefs.js).
 *   createChoice({ prefs, catalog, status }) -> { language, model, label(), set({ language, model, pin }), newFile(), chooseFor(lang) }
 *   suggestionOf(item, catalog) -> null | { language, p, used, better } (pure; the line under the transcript)
 *   drawSuggestion(box, item, { catalog, installed, preferred, act }) draws it; act(kind, item, model) does the work */
import { languageName } from './languages.js';

const pct = (p) => `${Math.round(p * 100)}%`;
const mb = (n) => `${Math.round(n / 1e6)} MB`;

export function createChoice({ prefs, catalog, status }) {
  const C = catalog;
  let language = prefs.pinned() || 'auto', model = null;   // model: one the person picked in the dialog, for this visit
  const api = {
    get language() { return language; },
    get model() { return model; },
    get pinned() { return !!prefs.pinned(); },
    /** The button's words: "Swedish · KB-Whisper small", "Detect automatically · Whisper tiny". */
    label() {
      const lang = language === 'auto' ? 'Detect automatically' : languageName(language);
      const id = model || (language !== 'auto' && prefs.preferred(language)) || C.QUICK;
      return `${lang} · ${(C.byId(id) || C.byId(C.QUICK)).name}`;
    },
    /** From the dialog: the language (kept only with pin), and the model for this visit. */
    set(c) {
      language = c.language || 'auto';
      model = c.model || null;
      if (c.pin) prefs.pin(language); else if (prefs.pinned() && prefs.pinned() !== language) prefs.pin(null);
    },
    /** A new file: back to Detect automatically, unless the person pinned a language. */
    newFile() { if (!prefs.pinned()) { language = 'auto'; } },
    /** The model for a file in this language: the one picked in the dialog if it fits, else the language's preferred model if
     *  it is installed, else the quick model. */
    async chooseFor(lang) {
      const fits = (id) => { const m = C.byId(id); return !!m && C.fits(m, lang); };
      if (model && fits(model)) return model;
      const pref = prefs.preferred(lang);
      if (pref && fits(pref) && /^(installed|update)$/.test(await status(pref))) return pref;
      return C.QUICK;
    },
  };
  return api;
}

/** Pure: what to say under a transcript. better: the recommended model for the language when it is not the one used. */
export function suggestionOf(item, catalog) {
  if (!item || item.status !== 'done' || !item.language) return null;
  const used = catalog.byId(item.model || catalog.QUICK) || catalog.byId(catalog.QUICK);
  const top = item.detected && item.detected[0];
  const p = top && top.code === item.language ? top.p : null;
  const rec = catalog.recommended(item.language);
  const better = rec && rec.id !== used.id && rec.accuracy > used.accuracy ? rec : null;
  return { language: item.language, p, used, better };
}

const btn = (text, cls, on) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; if (cls) b.className = cls; b.addEventListener('click', on); return b; };

/** The line under the transcript: "Detected Swedish (92%) · Whisper tiny. For better accuracy: KB-Whisper small, 248 MB —
 *  [Transcribe again in higher quality] [Choose another model…]", or with the better model installed:
 *  [Transcribe again with KB-Whisper small] [Use it from now on for Swedish]. */
export function drawSuggestion(box, item, { catalog, installed, preferred, act, busy }) {
  const s = suggestionOf(item, catalog);
  box.replaceChildren();
  box.hidden = !s;
  if (!s) return;
  const name = languageName(s.language);
  const head = document.createElement('p');
  head.className = 'tr-detect';
  head.textContent = (s.p != null ? `Detected ${name} (${pct(s.p)})` : name) + ` · read with ${s.used.name}.`;
  head.append(' ', btn(s.p != null ? 'Not right? Change language' : 'Change language', 'tr-link', () => act('choose', item)));
  box.append(head);
  const row = document.createElement('div');
  row.className = 'tr-upgrade';
  if (busy) {
    const t = document.createElement('span'); t.className = 'tr-upgrade-busy'; t.textContent = busy.text;
    row.append(t, btn('Cancel', '', () => act('cancel', item)));
  } else if (s.better) {
    const t = document.createElement('span');
    if (installed(s.better.id)) {
      t.textContent = `${s.better.name} is on this device and reads ${name} better. `;
      row.append(t, btn(`Transcribe again with ${s.better.name}`, 'ai-pri', () => act('redo', item, s.better)));
      if (preferred(s.language) !== s.better.id) row.append(btn(`Use it from now on for ${name}`, '', () => act('prefer', item, s.better)));
    } else {
      t.textContent = `For better accuracy: ${s.better.name} (${s.better.maker}), ${mb(catalog.bytesOf(s.better))}. `;
      row.append(t, btn('Transcribe again in higher quality', 'ai-pri', () => act('upgrade', item, s.better)));
    }
  } else if (s.used.id !== catalog.QUICK && preferred(s.language) !== s.used.id && catalog.fits(s.used, s.language)) {
    row.append(btn(`Use it from now on for ${name}`, '', () => act('prefer', item, s.used)));   // after an upgrade
  }
  row.append(btn('Choose another model…', '', () => act('choose', item)));
  box.append(row);
}
