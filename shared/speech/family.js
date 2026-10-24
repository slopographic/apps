/* Speech to text as a family of the shared model chooser (shared/models/chooser.js): its words, its languages (the 99
 * Whisper languages, shared/speech/languages.js) and its models (aitools/speech-models.js, window.SlopSpeechModels).
 * speechFamily() -> the family object openModelChooser({ family }) takes. See shared/models/HANDOFF.md. */
import { filterLanguages, languageName } from './languages.js';

export function speechFamily(catalog = globalThis.SlopSpeechModels) {
  return {
    id: 'speech',
    title: 'Language and model',
    languageStep: '1. The language you want to transcribe',
    modelStep: '2. The model',
    usageWords: 'Speech models',
    autoName: 'Detect automatically',
    catalog,
    languages: { filter: filterLanguages, name: (code) => (code === 'auto' ? 'Detect automatically' : languageName(code)) },
  };
}
