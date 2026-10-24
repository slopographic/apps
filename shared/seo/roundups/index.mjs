// Round-up pages (/best/<slug>/): a fair comparison of one of our apps with well-known tools, drawn by
// tools/seo/roundups.mjs. One file per family of apps. A round-up:
//   { slug, app (ours), title (≤ 75), description (120–160), h1, crumb?, lead, checked: 'YYYY-MM-DD' (the day the facts were
//     checked), criteria: [≥ 3], columns: [table headings], tools: [3–8 of { name, ours?, url, bestFor, summary?, cells:
//     [one per column], pros, cons (≥ 1), sources: [{ label, url }] (required for every tool that is not ours) }],
//     verdict?: paragraphs, faq: [[question, answer], ≥ 3] }
import { ROUNDUPS as creative } from './creative.mjs';
import { ROUNDUPS as documents } from './documents.mjs';
import { ROUNDUPS as business } from './business.mjs';

export const ROUNDUPS = [...creative, ...documents, ...business];
