/* SlopTour: Slop AI Tools. Targets are ids in aitools/index.html (a page without a header). */
SlopTour.define({
  app: 'aitools',
  title: 'Slop AI Tools tour',
  steps: [
    { id: 'tools', title: 'Tools', text: 'Five tools run on your device: OCR, speech to text, denoise, auto tags and portrait blur.', target: '#toolList' },
    { id: 'models', title: 'Models', text: 'Each model is optional. It downloads only when you press Get more, and shows its licence first.', target: '#modelList' },
    { id: 'storage', title: 'Storage', text: 'What the downloaded models take up on this device.', target: '#storeNote' },
    { id: 'status', title: 'Status', text: 'Messages from your last action appear here.', target: '#status' },
  ],
});
