/* Slop Slides: every app script in load order, by package (paths relative to the site root).
   index.html, the tests and the offline build all follow this list. */
window.SS_MANIFEST = {
  core: ['slides/js/core/util.js', 'slides/js/core/themes.js', 'slides/js/core/objects.js', 'slides/js/core/layouts.js', 'slides/js/core/model.js', 'slides/js/core/history.js'],
  render: ['slides/js/render/ttf.js', 'slides/js/render/fonts.js', 'slides/js/render/text.js', 'slides/js/render/shapes.js', 'slides/js/render/scene.js', 'slides/js/render/table.js', 'slides/js/render/canvas.js'],
  anim: [],
  io: ['slides/js/io/templates.js', 'slides/js/io/templates-decks.js'],
  ui: []
};
