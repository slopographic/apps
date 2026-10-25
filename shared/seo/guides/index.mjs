// Guides: the tutorials of each app ("Getting started with PhotoSlop" and the like), one file per family (split into
// parts to stay short), drawn by tools/seo/guides.mjs (the shape of a guide is in its header) and listed in each app's
// guide sidebar.
import { GUIDES as creative } from './creative.mjs';
import { GUIDES as creative2 } from './creative-2.mjs';
import { GUIDES as creative3 } from './creative-3.mjs';
import { GUIDES as creative4 } from './creative-4.mjs';
import { GUIDES as documents } from './documents.mjs';
import { GUIDES as documents2 } from './documents-2.mjs';
import { GUIDES as documents3 } from './documents-3.mjs';
import { GUIDES as documents4 } from './documents-4.mjs';
import { GUIDES as business } from './business.mjs';
import { GUIDES as everyday } from './everyday.mjs';
import { GUIDES as compare } from './compare.mjs';
import { GUIDES as recorder } from './recorder.mjs';

export const GUIDES = [...creative, ...creative2, ...creative3, ...creative4, ...documents, ...documents2, ...documents3, ...documents4, ...business, ...everyday, ...compare, ...recorder];
