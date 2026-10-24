// Guides: the tutorials of each app ("Getting started with PhotoSlop" and the like), one file per family, drawn by
// tools/seo/guides.mjs (the shape of a guide is in its header) and listed in each app's guide sidebar.
import { GUIDES as creative } from './creative.mjs';
import { GUIDES as documents } from './documents.mjs';
import { GUIDES as business } from './business.mjs';
import { GUIDES as everyday } from './everyday.mjs';

export const GUIDES = [...creative, ...documents, ...business, ...everyday];
