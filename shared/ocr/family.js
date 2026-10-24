/* Text recognition (OCR) as a family of the shared model chooser (shared/models/chooser.js): its words, its languages
 * (shared/ocr/languages.js, from the script table in aitools/ocr-models.js) and its models (window.SlopOcrModels).
 * ocrFamily() -> the family object openModelChooser({ family }) takes. See shared/models/HANDOFF.md.
 * Used by Slop OCR, Slop PDF (Recognise text) and AI Tools (OCR), through shared/ocr/choose.js. */
import { ocrLanguages, AUTO } from './languages.js';

export function ocrFamily(catalog = globalThis.SlopOcrModels) {
  const L = ocrLanguages(catalog);
  return {
    id: 'ocr',
    title: 'Language and model',
    languageStep: '1. The language of the text',
    modelStep: '2. The model',
    usageWords: 'Text recognition models',
    autoName: AUTO,
    catalog,
    languages: { filter: L.filter, name: L.name },
  };
}
