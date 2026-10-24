// Task pages: the copy for every "how do I…" page, one file per family of apps. tools/seo/tasks.mjs checks and draws
// them; tools/seo/write.mjs writes them to /<app path><slug>/ with their head block and puts them in the sitemap.
// A task: { app, slug, title (≤ 75), description (120–160), h1, crumb?, lead, cta?, query? (the app's URL preset),
//   steps: [3–6], body?: [paragraphs], faq: [[question, answer], ≥ 3] }. Titles and descriptions are unique site-wide.
import { TASKS as cutout } from './cutout.mjs';
import { TASKS as creative } from './creative.mjs';
import { TASKS as documents } from './documents.mjs';
import { TASKS as business } from './business.mjs';
import { TASKS as everyday } from './everyday.mjs';

export const TASKS = [...cutout, ...creative, ...documents, ...business, ...everyday];
