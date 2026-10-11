/* Slop Slides: every app script in load order, by package (paths relative to the site root).
   index.html, the tests and the offline build all follow this list. */
window.SS_MANIFEST = {
  core: ['slides/js/core/util.js', 'slides/js/core/themes.js', 'slides/js/core/objects.js', 'slides/js/core/layouts.js', 'slides/js/core/model.js', 'slides/js/core/history.js'],
  render: ['slides/js/render/ttf.js', 'slides/js/render/fonts.js', 'slides/js/render/text.js', 'slides/js/render/shapes.js', 'slides/js/render/scene.js', 'slides/js/render/table.js', 'slides/js/render/canvas.js'],
  anim: [],
  io: ['slides/js/io/templates.js', 'slides/js/io/templates-decks.js', 'slides/js/io/native.js', 'slides/js/io/draft.js', 'slides/js/io/pptx.js'],
  ui: ['slides/js/ui/dom.js', 'slides/js/ui/app.js', 'slides/js/ui/canvas-view.js', 'slides/js/ui/overlay.js', 'slides/js/ui/snap.js',
    'slides/js/ui/textedit-parse.js', 'slides/js/ui/textedit.js', 'slides/js/ui/pointer.js', 'slides/js/ui/ops.js', 'slides/js/ui/sorter.js',
    'slides/js/ui/sorter-drag.js', 'slides/js/ui/inspector.js', 'slides/js/ui/toolbar.js', 'slides/js/ui/files.js', 'slides/js/ui/present.js',
    'slides/js/ui/commands.js', 'slides/js/ui/ctxmenu.js', 'slides/js/ui/main.js']
};
