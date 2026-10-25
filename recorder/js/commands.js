/* Slop Recorder: SlopCmd commands (Ctrl+K, the shortcut editor, macros) for the page's own actions, and the assistant's
 * commands with arguments (ai-commands.js), loaded by SlopCmd.prepare() when the AI panel first asks. Classic script, after
 * main.js. Alt+R records or stops, Alt+P pauses or resumes (Ctrl and ⌘ keys are the browser's: Ctrl+Shift+R reloads). */
(function () {
  'use strict';
  const script = (src) => new Promise((res, rej) => {
    const s = Object.assign(document.createElement('script'), { src: new URL(src, location.href).href });
    s.onload = () => res(); s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s);
  });
  /** The assistant's commands, with the shared file sources they read Slop Drive through. */
  const loadAI = () => (window.SlopCmdSources ? Promise.resolve() : script('../shared/commands/sources.js')).then(() => script('js/ai-commands.js'));
  function init() {
    const C = window.SlopCmd, A = window.SlopRec && window.SlopRec.app;
    if (!C || !A) return;
    C.init({ app: 'recorder' });
    const on = () => ['recording', 'paused'].includes(A.state());
    const quiet = (p) => Promise.resolve(p).catch(() => {});
    C.register([
      { id: 'recorder.record', title: 'Record or stop', group: 'Record', keys: ['Alt+R'], keywords: ['start', 'capture', 'screen', 'webcam', 'microphone'],
        run: () => quiet(A.state() === 'countdown' ? A.cancel() : on() ? A.stop() : A.record()) },
      { id: 'recorder.pause', title: 'Pause or resume', group: 'Record', keys: ['Alt+P'], keywords: ['hold', 'continue'], when: on, run: () => A.togglePause() },
      { id: 'recorder.open', title: 'Open recording…', group: 'File', keys: [], keywords: ['trim', 'convert', 'webm'], when: () => !on(), run: () => window.SlopIntake.pick({ to: 'recorder', multiple: false }) },
      { id: 'recorder.download', title: 'Download the recording', group: 'File', keys: [], when: () => !!A.recording() && !on(), run: () => quiet(window.SlopRec.save.download()) },
      { id: 'recorder.drive', title: 'Save the recording to Slop Drive', group: 'File', keys: [], when: () => !!A.recording() && !on(), run: () => quiet(window.SlopRec.save.toDrive()) },
      { id: 'recorder.discard', title: 'Discard the recording', group: 'Edit', keys: [], when: () => !!A.recording() && !on(), run: () => A.discard() },
    ]);
    if (C.provide) C.provide({ prepare: loadAI });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
