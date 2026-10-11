/* Settings for the live preview. Pure: no DOM. The limits keep the preview light: large text shows its first
 * part, large pictures are drawn smaller, and only page 1 of a PDF is rendered. Download always converts all. */
export { TEXT_KINDS } from '../core/detect.js';

export const DEBOUNCE_MS = 150;
export const TEXT_LIMIT = 256 * 1024;   // bytes of text read for the preview
export const IMAGE_LIMIT = 12e6;        // picture bytes above which the preview draws a smaller copy
export const PREVIEW_PX = 1200;         // width of that smaller copy
export const MAX_LINES = 400;           // lines shown per text panel
export const IMAGE_KINDS = ['png', 'jpg', 'webp', 'bmp', 'gif', 'svg'];

/** Conversions whose preview shows the first page only, unless the page range is typed. */
export const FIRST_PAGE_ONLY = ['pdf-to-images', 'split-pdf'];

/** Each conversion and the one that undoes it. Swap feeds the output back in as the input. */
export const REVERSE = {
  'base64-encode': 'base64-decode', 'base64-decode': 'base64-encode',
  'url-encode': 'url-decode', 'url-decode': 'url-encode',
  'csv-to-json': 'json-to-csv', 'json-to-csv': 'csv-to-json',
};

/** True when a conversion takes typed text (any text kind, or any file for Base64 encode). */
export function acceptsText(conv) {
  return !!conv && (conv.from.includes('*') || conv.from.some((k) => ['csv', 'json', 'md', 'txt', 'html'].includes(k)));
}
