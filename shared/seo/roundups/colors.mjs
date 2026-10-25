// Round-ups for Slop Colors (shape in index.mjs): colour palette and contrast tools. Every fact about another tool is from
// its own page, listed in its sources, and dated.
const checked = '2026-10-25';
const src = (label, url) => ({ label, url });
const COOLORS = src('Coolors home page', 'https://coolors.co/');
const ADOBE = src('Adobe Color, color wheel', 'https://color.adobe.com/create/color-wheel');
const WEBAIM = src('WebAIM Contrast Checker', 'https://webaim.org/resources/contrastchecker/');
const palette = { slug: 'free-color-palette-tools', app: 'colors', checked, crumb: 'Free colour palette tools',
  title: 'Best free colour palette tools: pickers, generators and contrast',
  description: 'Slop Colors, Coolors, Adobe Color and the WebAIM checker compared: picking colours from pictures, palette harmonies, WCAG contrast and export files.',
  h1: 'The best free colour palette and contrast tools',
  lead: 'A palette tool should find colours in a picture, make harmonies from one colour, check that text stays readable and hand the palette to your design or code tools. Here is what each offers, from its own pages.',
  criteria: ['Free, and what an account or plan adds', 'Colours from a picture', 'Harmonies and scales from one colour', 'WCAG contrast check', 'Export files (CSS, Tailwind, ASE, GPL)'],
  columns: ['Price', 'Runs on', 'Colours from a picture', 'Contrast check'],
  tools: [
    { name: 'Slop Colors', ours: true, bestFor: 'Picking colours from your own pictures privately, checking contrast and exporting a palette as code or a swatch file in one page.',
      cells: ['Free, no account', 'Any modern browser', 'Eyedropper and main colours (k-means)', 'Ratio, AA and AAA, with a fix'],
      pros: ['Pictures are read in the browser, never uploaded', 'CSS variables, Tailwind config, JSON, Adobe .ase and GIMP .gpl exports, and those files open again', 'HEX, RGB, HSL, OKLCH and CMYK, with out-of-gamut OKLCH mapped into sRGB'],
      cons: ['No library of shared palettes to browse', 'No colour blindness preview', 'No PDF or image export of the palette'] },
    { name: 'Coolors', url: COOLORS.url, bestFor: 'Generating and browsing palettes fast, with a large library and plugins for design tools.',
      cells: ['Free plan; Pro plan', 'Web, iOS app, Figma plugin, Chrome extension', 'Image Picker', 'Contrast Checker'],
      pros: ['Spacebar generator and over 10 million palettes to explore', 'Exports to PDF, image, CSS, ASE, SVG, code and Tailwind', 'Palette Visualizer previews colours on designs'],
      cons: ['The free plan keeps up to 10 palettes; its page lists Image Picker colour extraction and advanced export among the Pro features'], sources: [COOLORS] },
    { name: 'Adobe Color', url: ADOBE.url, bestFor: 'Designers in Adobe apps who want harmony rules on a colour wheel and palettes saved to their library.',
      cells: ['Free', 'Web', 'Extract from an image', 'Contrast ratios with WCAG guidance'],
      pros: ['Monochromatic, complementary, analogous, triadic and split-complementary rules on a colour wheel', 'Colour blindness preview', 'Saves palettes to your library for other projects'],
      cons: ['Its colour wheel page does not mention export files'], sources: [ADOBE] },
    { name: 'WebAIM Contrast Checker', url: WEBAIM.url, bestFor: 'Checking one text and background pair against WCAG, with a link to share the result.',
      cells: ['Free', 'Web', 'No (an eyedropper picks from the screen)', 'AA and AAA, normal and large text, UI'],
      pros: ['Lightness sliders to adjust either colour', 'Permalink and a JSON API for the result', 'Alpha for the foreground'],
      cons: ['Checks one pair; it does not make or export palettes'], sources: [WEBAIM] },
  ],
  matrix: [
    { feature: 'Colours from a picture', values: ['yes', 'yes', 'yes', 'no'] },
    { feature: 'Harmonies from one colour', values: ['yes', 'unknown', 'yes', 'no'] },
    { feature: 'WCAG contrast check', values: ['yes', 'yes', 'yes', 'yes'] },
    { feature: 'Large text and UI levels', values: ['yes', 'unknown', 'unknown', 'yes'] },
    { feature: 'Colour blindness preview', values: ['no', 'unknown', 'yes', 'no'] },
    { feature: 'CSS export', values: ['yes', 'yes', 'unknown', 'no'] },
    { feature: 'Tailwind export', values: ['yes', 'yes', 'unknown', 'no'] },
    { feature: 'Adobe .ase export', values: ['yes', 'yes', 'unknown', 'no'] },
    { feature: 'GIMP .gpl export', values: ['yes', 'unknown', 'unknown', 'no'] },
    { feature: 'OKLCH values', values: ['yes', 'unknown', 'unknown', 'no'] },
    { feature: 'No account needed', values: ['yes', 'partial', 'partial', 'yes'] },
    { feature: 'Pictures stay on your device', values: ['yes', 'unknown', 'unknown', 'yes'] },
  ],
  verdict: ['Slop Colors is our pick when the colours come from your own pictures and the palette has to end up in code or a design tool: the eyedropper, the main colours, the contrast check and the exports are on one page, and nothing is uploaded.',
    'Choose Coolors for its generator, library and plugins, Adobe Color for its colour wheel and Adobe library, and the WebAIM checker to check and share a single pair.'],
  faq: [['Which contrast ratio do I need?', 'WCAG AA asks for 4.5:1 for normal text and 3:1 for large text and UI parts; AAA asks for 7:1 and 4.5:1. All four tools show the ratio.'],
    ['Which file opens in Photoshop or Illustrator?', 'An Adobe Swatch Exchange (.ase) file. Slop Colors and Coolors both export one.'],
    ['Is my picture uploaded?', 'Not in Slop Colors: it is read in your browser. Check each other tool\'s own privacy notes.']] };

export const ROUNDUPS = [palette];
