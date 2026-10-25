// Round-up for Slop Compare (shape in index.mjs): free diff tools. Every fact about another tool is from its own page,
// listed in its sources, and dated.
import { INSTALL } from '../install-copy.mjs';
const checked = '2026-10-24';
const src = (label, url) => ({ label, url });

const DC = src('Diffchecker home page', 'https://www.diffchecker.com/');
const WM = src('WinMerge home page', 'https://winmerge.org/');
const MELD = src('Meld home page', 'https://meldmerge.org/');
const diff = { slug: 'free-diff-tools', app: 'diff', checked, crumb: 'Free diff tools',
  title: 'Best free diff tools: compare text, files, PDFs and images',
  description: 'Four free ways to see what changed between two files: Slop Compare in the browser, Diffchecker, WinMerge and Meld. Texts, folders, PDFs, images and tables.',
  h1: 'The best free diff tools to compare files',
  lead: 'A diff tool shows what changed between two versions of a file. These four are free to start with. Here is what each one compares and where it runs, from its own pages.',
  criteria: ['Free, with no account', 'What it compares: texts, folders, PDFs, pictures, tables', 'Where it runs and whether files stay on your device', 'Reports and patches you can keep'],
  columns: ['Price', 'Runs on', 'Compares', 'Licence'],
  tools: [
    { name: 'Slop Compare', ours: true, bestFor: 'Comparing two texts, data files, PDFs or pictures in any browser, and keeping a report or a .patch.',
      cells: ['Free', 'Any modern browser', 'Texts and code, JSON, CSV, PDFs, pictures', 'MIT'],
      pros: ['JSON by key path and CSV by row and cell, not only as text', 'PDF text per page, and the pages as pictures with the changes boxed',
        'Report as HTML or PDF, and a .patch; files read on your device', INSTALL.pro],
      cons: ['Two files at a time: no folders', 'No merging: it shows changes, it does not combine them', 'No three-way comparison'] },
    { name: 'Diffchecker', url: DC.url, bestFor: 'A quick text compare on the web, with a desktop app for offline work.',
      cells: ['Free text compare; Pro and Desktop paid', 'Web; desktop app', 'Text, images, documents, spreadsheets; folders on desktop', 'Proprietary'],
      pros: ['Its page says the comparison runs in your browser and nothing is published unless you save and share it', 'Compares images, documents and spreadsheets too', 'A desktop app for offline use, with a 14-day trial'],
      cons: ['Unified view, character-level precision and merge are Pro features after a trial, per its page', 'Saving a comparison needs an account'], sources: [DC] },
    { name: 'WinMerge', url: WM.url, bestFor: 'Windows users who compare and merge files and whole folders.',
      cells: ['Free, open source', 'Windows', 'Text, folders, images, CSV and TSV tables', 'Open source'],
      pros: ['Merges as well as compares, with moved lines detected', 'Folder comparison with filters', 'Image comparison with an overlay, and CSV/TSV shown as tables'],
      cons: ['Windows only'], sources: [WM] },
    { name: 'Meld', url: MELD.url, bestFor: 'Developers on Linux who want two- and three-way merges with version control.',
      cells: ['Free, open source', 'Linux, Windows', 'Text, folders', 'GPLv2 or later'],
      pros: ['Two- and three-way comparison of files and folders', 'Works with Git, Mercurial, Bazaar and Subversion', 'Open source'],
      cons: ['Not yet supported on macOS, per its page', 'Its page does not mention pictures or PDFs'], sources: [MELD] },
  ],
  matrix: [
    { feature: 'Texts and code', values: ['yes', 'yes', 'yes', 'yes'] },
    { feature: 'Word-level highlights', values: ['yes', 'partial', 'yes', 'unknown'] },
    { feature: 'JSON by key', values: ['yes', 'unknown', 'unknown', 'no'] },
    { feature: 'CSV as a table', values: ['yes', 'yes', 'yes', 'no'] },
    { feature: 'PDFs', values: ['yes', 'yes', 'unknown', 'no'] },
    { feature: 'Pictures', values: ['yes', 'yes', 'yes', 'no'] },
    { feature: 'Folders', values: ['no', 'partial', 'yes', 'yes'] },
    { feature: 'Merge', values: ['no', 'partial', 'yes', 'yes'] },
    { feature: 'Three-way', values: ['no', 'unknown', 'unknown', 'yes'] },
    { feature: 'Export a .patch', values: ['yes', 'unknown', 'unknown', 'unknown'] },
    { feature: 'No install', values: ['yes', 'yes', 'no', 'no'] },
    { feature: 'Mac', values: ['yes', 'yes', 'no', 'no'] },
  ],
  verdict: ['Slop Compare is our pick to compare two files of any common kind on any device, and keep a report: it reads JSON and CSV as data, PDFs by page and pictures by pixel, without uploading them. It does not merge or compare folders.',
    'Choose WinMerge on Windows or Meld on Linux to merge changes and compare folders, and Diffchecker if you want its desktop app or Pro features.'],
  faq: [['Are my files uploaded?', 'Not with Slop Compare: both files are read in your browser. Diffchecker\'s page says its comparison runs in your browser; WinMerge and Meld are programs on your computer.'],
    ['Can I compare two Word documents?', 'Slop Compare reads texts, PDFs and pictures: save the documents as PDF or text first. Diffchecker\'s page lists documents among what it compares.'],
    ['What is a .patch?', 'The changes between two texts in the unified diff format that git and the patch program read. Slop Compare writes one for two texts.']] };

export const ROUNDUPS = [diff];
