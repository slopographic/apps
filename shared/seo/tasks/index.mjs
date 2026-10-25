// Task pages: the copy for every "how do I…" page, one file per family of apps. tools/seo/tasks.mjs checks and draws
// them; tools/seo/write.mjs writes them to /<app path><slug>/ with their head block and puts them in the sitemap.
// A task: { app, slug, title (≤ 75), description (120–160), h1, crumb?, lead, cta?, query? (the app's URL preset),
//   steps: [3–6], body?: [paragraphs], faq: [[question, answer], ≥ 3] }. Titles and descriptions are unique site-wide.
import { TASKS as cutout } from './cutout.mjs';
import { TASKS as creative } from './creative.mjs';
import { TASKS as creative2 } from './creative-2.mjs';
import { TASKS as creative3 } from './creative-3.mjs';
import { TASKS as documents } from './documents.mjs';
import { TASKS as documents2 } from './documents-2.mjs';
import { TASKS as documents3 } from './documents-3.mjs';
import { TASKS as documents4 } from './documents-4.mjs';
import { TASKS as business } from './business.mjs';
import { TASKS as business2 } from './business-2.mjs';
import { TASKS as business3 } from './business-3.mjs';
import { TASKS as everyday } from './everyday.mjs';
import { TASKS as everyday2 } from './everyday-2.mjs';
import { TASKS as threed } from './threed.mjs';
import { TASKS as finance } from './finance.mjs';
import { TASKS as raw } from './raw.mjs';
import { TASKS as compare } from './compare.mjs';
import { TASKS as recorder } from './recorder.mjs';

export const TASKS = [...cutout, ...creative, ...creative2, ...creative3, ...documents, ...documents2, ...documents3, ...documents4, ...business, ...business2, ...business3, ...everyday, ...everyday2, ...threed, ...finance, ...raw, ...compare, ...recorder];
