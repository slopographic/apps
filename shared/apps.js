/* The Slopographic app registry: the single source of truth for every app, game and experiment.
 * Used by the homepage, the cross-app "Send to…" menus (hub.js) and the status board.
 * Classic script: sets window.SLOP_APPS. Paths are relative to the site root.
 *   kind:    app | game | experiment
 *   status:  live | beta | building
 *   accepts: MIME patterns the app can open from Slop Drive (for "Send to…") */
(function () {
  'use strict';
  const A = (id, kind, name, path, tagline, extra = {}) => Object.assign({ id, kind, name, path, tagline, status: 'live', accepts: [], features: [] }, extra);
  window.SLOP_APPS = [
    A('photoslop', 'app', 'PhotoSLOP', 'photoslop/', 'Photoshop, rebuilt for the browser.', {
      accepts: ['image/*', 'image/vnd.adobe.photoshop', 'application/x-openraster'],
      features: ['Layers, masks & 17 blend modes', 'Real PSD open & save', '50+ filters, brush packs, .abr import', 'Tabs, autosave, offline .html'],
      shot: 'assets/shots/photoslop.jpg', icon: 'brush' }),
    A('vector', 'app', 'Slop Vector', 'vector/', 'Illustrator, rebuilt for the browser.', {
      accepts: ['image/svg+xml', 'image/*'],
      features: ['Pen, shapes, type & layers', 'Real pathfinder booleans', 'SVG, PNG, PDF & .ai export', 'Offline .html'],
      shot: 'assets/shots/vector.jpg', icon: 'pen' }),
    A('pdf', 'app', 'Slop PDF', 'pdf/', 'Organise, edit and sign PDFs. Nothing uploaded.', {
      accepts: ['application/pdf', 'image/*'],
      features: ['Reorder, merge & split', 'Text, shapes, images & signatures', 'Page numbers, watermarks, forms', 'Compress & convert'],
      shot: 'assets/shots/pdf.jpg', icon: 'doc' }),
    A('label', 'app', 'SlopLabel', 'label/', 'Design and print barcode labels.', {
      accepts: ['image/*', 'text/csv'],
      features: ['Barcodes & QR, GS1', 'Data merge from CSV & Excel', 'Zebra ZPL export & import', 'Sheets & thermal rolls'],
      shot: 'assets/shots/label.jpg', icon: 'tag', status: 'beta' }),
    A('cutout', 'app', 'Slop Cutout', 'cutout/', 'Remove backgrounds with AI that runs on your device.', {
      accepts: ['image/*'],
      features: ['One-click AI background removal', 'Refine brush & soft edges', 'Replace with colour, blur or image', 'Batch, no uploads, no watermarks'],
      shot: 'assets/shots/cutout.jpg', icon: 'brush', status: 'building' }),
    A('ai', 'app', 'Slop AI', 'ai/', 'Chat with an AI that runs on your own computer.', {
      accepts: ['text/*', 'image/*'],
      features: ['Local models via WebGPU, works offline', 'System check: what can your PC run?', 'Drives every Slopographic app', 'Builds mini-apps for you'],
      shot: 'assets/shots/ai.jpg', icon: 'spark', status: 'beta' }),
    A('docs', 'app', 'Slop Docs', 'docs/', 'Word and Google Docs, rebuilt for the browser.', {
      accepts: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.oasis.opendocument.text', 'text/markdown', 'text/plain', 'text/html'],
      creates: [{ label: 'Document', ext: 'sdoc', mime: 'application/x-slop-doc' }],
      features: ['Real pages, headers & footers', 'Opens & saves DOCX and ODT', 'PDF that matches what you see', 'Offline .html'],
      shot: 'assets/shots/docs.jpg', icon: 'page', status: 'building' }),
    A('tables', 'app', 'Slop Tables', 'tables/', 'Excel and Google Sheets, rebuilt for the browser.', {
      accepts: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.oasis.opendocument.spreadsheet', 'text/csv', 'text/tab-separated-values'],
      creates: [{ label: 'Spreadsheet', ext: 'stab', mime: 'application/x-slop-table' }],
      features: ['400+ formulas, charts & pivots', 'Opens & saves XLSX, ODS and CSV', 'Print to PDF with page setup', 'Offline .html'],
      shot: 'assets/shots/tables.jpg', icon: 'grid', status: 'building' }),
    A('slides', 'app', 'Slop Slides', 'slides/', 'Keynote and PowerPoint, rebuilt for the browser.', {
      accepts: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.oasis.opendocument.presentation', 'image/*'],
      creates: [{ label: 'Presentation', ext: 'sslide', mime: 'application/x-slop-slides' }],
      features: ['Themes, layouts & Magic Move', 'Opens & saves PPTX and ODP', 'Presenter view & PDF export', 'Offline .html'],
      shot: 'assets/shots/slides.jpg', icon: 'slides', status: 'building' }),
    A('press', 'app', 'Slop Press', 'press/', 'InDesign, rebuilt for the browser.', {
      accepts: ['image/*', 'application/pdf', 'text/plain'],
      features: ['Master pages & threaded text frames', 'Paragraph & character styles', 'Print-ready PDF export', 'Offline .html'],
      shot: 'assets/shots/press.jpg', icon: 'layout', status: 'beta' }),
    A('slopedit', 'app', 'SlopEdit', 'slopedit/', 'A video editor that never uploads your footage.', {
      accepts: ['video/*', 'audio/*', 'image/*'],
      features: ['Multi-track timeline', 'Trim, split, transitions & titles', 'Hardware MP4 export (WebCodecs)', 'Offline .html'],
      shot: 'assets/shots/slopedit.jpg', icon: 'film', status: 'beta' }),
    A('drive', 'app', 'Slop Drive', 'drive/', 'Every file from every app, in one local drive.', {
      accepts: ['*'],
      features: ['Folders, stars, Trash & search', 'Grid, list, columns, node graph & disk usage', 'Duplicate finder', 'One-file backup & restore'],
      shot: 'assets/shots/drive.jpg', icon: 'folder', status: 'beta' }),
    A('platformer', 'game', 'Sloppo Land', 'games/platformer/', 'A 3D platformer across goo-soaked worlds.', { shot: 'assets/shots/platformer.jpg', status: 'beta' }),
    A('sloppo-bird', 'game', 'Sloppo Bird', 'games/sloppo-bird/', 'Tap to bloop. Do not touch the pipes.', { shot: 'assets/shots/sloppo-bird.jpg' }),
    A('runner', 'game', 'Sloppo Run', 'games/runner/', 'Endless running through the slopverse.', { shot: 'assets/shots/runner.jpg', status: 'beta' }),
    A('star-defender', 'game', 'Star Defender', 'games/star-defender/', 'Defend the galaxy from the Slop Bots.', { shot: 'assets/shots/star-defender.jpg', status: 'beta' }),
    A('tower-defense', 'game', 'Goo Pool Defense', 'games/tower-defense/', 'Build Sloppo towers. Hold the line.', { shot: 'assets/shots/tower-defense.jpg' }),
    A('shots', 'game', 'Slop Shots', 'shots/', 'Holographic Sloppo cards. Collect all 60.', { shot: 'assets/shots/shots.jpg' }),
    A('2100', 'experiment', 'WWW 2100', '2100/', 'Browse the web as it will be in the year 2100.', { shot: 'assets/shots/2100.jpg' }),
    A('tank', 'experiment', 'Slop Tank', 'tank/', 'A real-time fluid you can stir.', { shot: 'assets/shots/tank.jpg' }),
    A('lighter', 'experiment', 'Slop Lighter', 'lighter/', 'Flick it. Strike it. Slop flames.', { shot: 'assets/shots/lighter.jpg' }),
    A('reel', 'experiment', 'Sloppo Reel', 'reel/', 'The 3D showreel. Feed Sloppo, level him up.', { shot: 'assets/shots/reel.jpg' }),
    A('unsubscribe', 'experiment', 'Unsubscribe', 'unsubscribe/', 'Every dark pattern on the internet, in one form.', { shot: 'assets/shots/unsubscribe.jpg' }),
    A('authenticator', 'experiment', 'The Authenticator', '#detector', 'Is your text secretly slop? Get it certified.', { shot: 'assets/shots/authenticator.jpg' }),
    A('paint-classic', 'experiment', 'Slop Paint Classic', 'photoslop/classic/', 'The 1998 experience. Every MS Paint tool.', { shot: 'assets/shots/paint-classic.jpg' }),
  ];
})();
