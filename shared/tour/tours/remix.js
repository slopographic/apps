/* SlopTour: Reel Remix. Targets are ids in remix/index.html. */
SlopTour.define({
  app: 'remix',
  title: 'Reel Remix tour',
  steps: [
    { id: 'clips', title: 'Add clips', text: 'Drop clips and photos here. Each one fills a slot in the reel.', target: '#rm-drop' },
    { id: 'preview', title: 'Preview', text: 'The reel plays here. Use Play, or drag the playhead under it to scrub.', target: '#rm-stage' },
    { id: 'keys', title: 'Keyframes', text: 'Pick a slot, then add keys at the playhead and choose an ease.', target: '#rm-keys' },
    { id: 'layout', title: 'Layout', text: 'Pick the grid layout. Random switches layouts at points you choose.', target: '#rm-base' },
    { id: 'export', title: 'Export', text: 'Render the reel at the export preset and save it.', target: '#rm-export' },
    { id: 'config', title: 'Config', text: 'Export or import the reel as a .slop.json config.', target: '#rm-config' },
  ],
});
