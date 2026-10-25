/* SlopTour: Slop Font. Targets are ids in fontcreator/index.html. */
SlopTour.define({
  app: 'fontcreator',
  title: 'Slop Font tour',
  steps: [
    { id: 'grid', title: 'Glyphs', text: 'Every character of your font. Pick one to draw it; a dashed box is not drawn yet. Type characters in the box above to add more.', target: '#fc-list' },
    { id: 'draw', title: 'Draw', text: 'The glyph on its metric lines. Pen (P) for curves, Rectangle (R), Ellipse (E) and Stroke (S) for shapes; Select (V) moves points.', target: '#fc-stage' },
    { id: 'start', title: 'Start from something', text: 'Print a handwriting sheet, paste an SVG, or open a TTF, OTF or WOFF2 to edit.', target: '#fc-start' },
    { id: 'kerning', title: 'Kerning', text: 'Close up pairs like AV and To, and watch the sample line change.', target: '#fc-tab-kerning' },
    { id: 'test', title: 'Type test', text: 'Your text in the real font, at several sizes, on light or dark.', target: '#fc-tab-test' },
    { id: 'panel', title: 'Settings and export', text: 'Width and side bearings, characters, the handwriting sheet, names and licence, metrics, and Download font at the foot.', target: '#fc-panel' },
  ],
});
