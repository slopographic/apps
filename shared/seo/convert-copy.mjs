// The head copy of File convert's converter pages that write.mjs writes (PAGES in copy.mjs): taken from the page lists
// in convert/js/core/ (the same title and description the page and its hub card use), so they are written once.
// Each becomes { title, crumb (the page's label), category, description } under 'convert/<slug>'.
import { RAW_PAGES } from '../../convert/js/core/raw-pages.js';
import { MORE_PAGES } from '../../convert/js/core/more-pages.js';
import { DATA_PAGES } from '../../convert/js/core/data-pages.js';
import { CHAIN_PAGES } from '../../convert/js/core/chain-pages.js';
import { PDF_LOCK_PAGES } from '../../convert/js/core/pdf-lock-pages.js';
import { OFFICE_PAGES } from '../../convert/js/core/office-pages.js';
import { MORE_PAGES_2 } from '../../convert/js/core/more-pages-2.js';
import { MORE_PAGES_3 } from '../../convert/js/core/more-pages-3.js';

export const CONVERT_PAGES = Object.fromEntries([...RAW_PAGES, ...MORE_PAGES, ...DATA_PAGES, ...CHAIN_PAGES, ...PDF_LOCK_PAGES, ...OFFICE_PAGES, ...MORE_PAGES_2, ...MORE_PAGES_3].map((p) => [`convert/${p.slug}`,
  { title: p.title, crumb: p.label, category: p.appCat || 'UtilitiesApplication', description: p.description }]));
