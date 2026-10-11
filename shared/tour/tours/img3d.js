/* SlopTour: Slop Image to 3D (the img3d folder). Targets are ids in img3d/index.html. */
SlopTour.define({
  app: 'img3d',
  title: 'Slop Image to 3D tour',
  steps: [
    { id: 'picture', title: 'Picture', text: 'Drop a picture here, or open one.', target: '#vp' },
    { id: 'drive', title: 'From Slop Drive', text: 'Take a picture from Slop Drive instead.', target: '#btnDrive' },
    { id: 'invert', title: 'Depth', text: 'Invert depth to make the far parts near.', target: '#invert' },
    { id: 'subject', title: 'Subject only', text: 'Remove the background so only the subject becomes 3D. Runs on your device.', target: '#subject' },
    { id: 'scale', title: 'Depth scale', text: 'How tall the relief is. Smoothing and point size are below it.', target: '#scale' },
    { id: 'send', title: 'Open in Slop 3D', text: 'Send the finished model to Slop 3D to edit it.', target: '#btnSend' },
  ],
});
