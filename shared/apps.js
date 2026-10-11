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
    A('photoslop', 'app', 'PhotoSLOP', 'paint/', 'Photoshop, rebuilt for the browser.', {
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
    A('platformer', 'game', 'Sloppo Land', 'games/platformer/', 'A 3D platformer across goo-soaked worlds.', { shot: 'assets/shots/platformer.jpg', status: 'beta' }),
    A('sloppo-bird', 'game', 'Sloppo Bird', 'games/sloppo-bird/', 'Tap to bloop. Do not touch the pipes.', { shot: 'assets/shots/sloppo-bird.jpg' }),
    A('runner', 'game', 'Sloppo Run', 'games/runner/', 'Endless running through the slopverse.', { shot: 'assets/shots/runner.jpg', status: 'building' }),
    A('star-defender', 'game', 'Star Defender', 'games/star-defender/', 'Defend the galaxy from the Slop Bots.', { shot: 'assets/shots/star-defender.jpg', status: 'beta' }),
    A('tower-defense', 'game', 'Goo Pool Defense', 'games/tower-defense/', 'Build Sloppo towers. Hold the line.', { shot: 'assets/shots/tower-defense.jpg' }),
    A('shots', 'game', 'Slop Shots', 'cards/', 'Holographic Sloppo cards. Collect all 60.', { shot: 'assets/shots/shots.jpg' }),
    A('2100', 'experiment', 'WWW 2100', '2100/', 'Browse the web as it will be in the year 2100.', { shot: 'assets/shots/2100.jpg', status: 'building' }),
    A('tank', 'experiment', 'Slop Tank', 'fluid/', 'A real-time fluid you can stir.', { shot: 'assets/shots/tank.jpg' }),
    A('lighter', 'experiment', 'Slop Lighter', 'lighter/', 'Flick it. Strike it. Slop flames.', { shot: 'assets/shots/lighter.jpg' }),
    A('reel', 'experiment', 'Sloppo Reel', 'reel/', 'The 3D showreel. Feed Sloppo, level him up.', { shot: 'assets/shots/reel.jpg', status: 'building' }),
    A('unsubscribe', 'experiment', 'Unsubscribe', 'annoying/', 'Every dark pattern on the internet, in one form.', { shot: 'assets/shots/unsubscribe.jpg' }),
    A('authenticator', 'experiment', 'The Authenticator', '#detector', 'Is your text secretly slop? Get it certified.', { shot: 'assets/shots/authenticator.jpg' }),
    A('paint-classic', 'experiment', 'Slop Paint Classic', 'paint/classic/', 'The 1998 experience. Every MS Paint tool.', { shot: 'assets/shots/paint-classic.jpg' }),
  ];
})();
