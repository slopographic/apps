// Round-up for Slop Recorder: free screen recorders. Every fact about another tool is from its own pages, listed in its
// sources, as they read on the checked date; what those pages do not say is 'unknown'.
const checked = '2026-10-24';
const S = (label, url) => ({ label, url });
const OBS = S('OBS Studio home page', 'https://obsproject.com/');
const SHAREX = S('ShareX home page', 'https://getsharex.com/');
const LOOM = S('Loom pricing', 'https://www.loom.com/pricing');

export const ROUNDUPS = [
  { slug: 'free-screen-recorders', app: 'recorder', checked, crumb: 'Free screen recorders',
    title: 'Best free screen recorders: browser, desktop and cloud compared',
    description: 'Slop Recorder in the browser, OBS Studio, ShareX and Loom\'s free plan compared: webcam overlay, system sound, trimming, formats, install and uploads.',
    h1: 'The best free screen recorders',
    lead: 'A screen recorder for a quick walkthrough, a bug report or a lesson. These free tools record your screen; they differ in what they need you to install, where the video goes and how much they can do.',
    criteria: ['Free to use for screen recording', 'Webcam in a corner and microphone', 'Sound from the computer', 'Where the video is kept: your device or a cloud', 'Install or browser'],
    columns: ['Price', 'Runs on', 'Video kept', 'Formats'],
    tools: [
      { name: 'Slop Recorder', ours: true, bestFor: 'A quick screen, webcam or screen + webcam recording in the browser, kept on your device.',
        cells: ['Free', 'Desktop browsers (webcam and microphone on phones too)', 'On your device', 'WebM, MP4, GIF, WAV'],
        pros: ['Nothing to install and no account', 'Screen with your webcam in a corner, countdown, pause and resume', 'Trim the ends, then WebM, MP4 or GIF; open it in SlopCut to edit', 'Says what your browser can record, including sound from the screen'],
        cons: ['Sound from the screen only where the browser shares it (Chrome and Edge)', 'No scenes, streaming or drawing on the screen', 'No share links: you send the file yourself'] },
      { name: 'OBS Studio', url: OBS.url, bestFor: 'Long recordings and live streaming with scenes, many sources and full control.',
        cells: ['Free, open source', 'Windows, macOS, Linux', 'On your computer', 'unknown'],
        pros: ['Records and streams', 'Scenes made of many sources: screens, windows, cameras, pictures', 'Open source'],
        cons: ['Has to be installed and set up; more to learn than a one-button recorder'], sources: [OBS] },
      { name: 'ShareX', url: SHAREX.url, bestFor: 'Windows users who want screenshots and screen recordings, including GIFs, in one tool.',
        cells: ['Free, open source', 'Windows', 'On your computer, or uploaded where you choose', 'Video, GIF'],
        pros: ['Screen recording to a video or a GIF', 'Screenshots with many capture modes', 'Open source'],
        cons: ['Windows only', 'Many settings to find your way through'], sources: [SHAREX] },
      { name: 'Loom', url: LOOM.url, bestFor: 'Teams that want a share link to every recording and comments on it.',
        cells: ['Free plan with limits; paid plans', 'Browser extension and desktop apps', 'In Loom\'s cloud', 'unknown'],
        pros: ['A share link right after recording', 'Screen and camera together'],
        cons: ['Needs an account, and the video is uploaded to Loom', 'The free plan has limits; more needs a paid plan'], sources: [LOOM] },
    ],
    matrix: [
      { feature: 'Record the screen', values: ['yes', 'yes', 'yes', 'yes'] },
      { feature: 'Webcam in a corner', values: ['yes', 'yes', 'unknown', 'yes'] },
      { feature: 'Microphone', values: ['yes', 'yes', 'yes', 'yes'] },
      { feature: 'Sound from the computer', values: ['partial', 'yes', 'unknown', 'unknown'] },
      { feature: 'Pause and resume', values: ['yes', 'unknown', 'unknown', 'unknown'] },
      { feature: 'Trim after recording', values: ['yes', 'no', 'unknown', 'unknown'] },
      { feature: 'GIF', values: ['yes', 'unknown', 'yes', 'unknown'] },
      { feature: 'Live streaming', values: ['no', 'yes', 'no', 'no'] },
      { feature: 'No install', values: ['yes', 'no', 'no', 'partial'] },
      { feature: 'No account', values: ['yes', 'yes', 'yes', 'no'] },
      { feature: 'Video stays on your device', values: ['yes', 'yes', 'partial', 'no'] },
      { feature: 'Mac and Linux', values: ['yes', 'yes', 'no', 'unknown'] },
    ],
    verdict: ['Slop Recorder is our pick for a quick recording you keep: open the page, choose the screen, the webcam or both, record, trim and save, with nothing installed and nothing uploaded. It does not stream, has no scenes and makes no share links.',
      'Choose OBS Studio for long recordings, many sources and streaming, ShareX on Windows for screenshots and GIFs in one tool, or Loom when your team wants a share link for every video and is happy to keep them in Loom\'s cloud.'],
    faq: [['Which free screen recorder records the computer\'s sound?', 'OBS Studio records desktop sound. In the browser, Slop Recorder gets the sound of a tab in Chrome and Edge, and of the whole screen on Windows and ChromeOS; Firefox and Safari share none.'],
      ['Can I record my screen without installing anything?', 'Yes. Slop Recorder runs in a desktop browser. Phones and tablets do not let web pages record the screen, so use the phone\'s own recorder there.'],
      ['Is my recording uploaded?', 'Not with Slop Recorder, OBS Studio or ShareX unless you choose to; Loom keeps your videos in its cloud so it can give you a link.']] },
];
