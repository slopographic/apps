/* Speech to text page: audio or the audio track of a video, in 30-second windows through Whisper tiny in the
 * inference worker. Shows progress per window. The result is a list of timed segments, exported as .srt and .txt. */
(function () {
  'use strict';
  const T = window.SlopAITools, $ = (id) => document.getElementById(id);
  const MAX_SECONDS = 2 * 3600;
  let file = null, segments = [], baseName = 'transcript';

  const X = window.SlopTranscript;   // the transcript formats (aitools/transcript.js), shared with Slop Transcribe
  const clock = X.clock;

  async function run() {
    $('run').disabled = true; $('srt').disabled = $('txt').disabled = true;
    const prog = $('prog'); prog.hidden = false; prog.value = 0; $('msg').textContent = '';
    try {
      $('msg').textContent = 'Decoding the audio…';
      const samples = await T.audioSamples(file);
      if (samples.length / 16000 > MAX_SECONDS) throw new Error('The audio is longer than 2 hours.');
      if (samples.length < 16000 / 2) throw new Error('The audio is too short to transcribe.');
      await T.ensure('whisper-tiny', (s) => ($('msg').textContent = s));
      const r = await T.call('transcribe', { samples, language: $('lang').value }, {
        transfer: [samples.buffer],
        onProgress: (p) => { prog.value = p.total ? p.done / p.total : 0; $('msg').textContent = `Window ${Math.min(p.done + 1, p.total)} of ${p.total} (${clock(p.done * 30)} of ${clock(samples.length / 16000)})`; },
      });
      segments = r.segments;
      $('out').value = X.txt(segments, { times: true });
      const any = segments.length > 0;
      $('srt').disabled = $('txt').disabled = !any;
      $('msg').textContent = any ? `${segments.length} segments, language ${r.language}. Check the text before you use it.` : 'No speech found in this file.';
    } catch (e) {
      $('msg').textContent = 'Could not transcribe: ' + e.message;
    } finally { $('run').disabled = false; prog.hidden = true; }
  }
  function pick(f) {
    if (!f) return;
    if (!/^(audio|video)\//.test(f.type)) { $('msg').textContent = 'Choose an audio or video file.'; return; }
    file = f; segments = []; baseName = f.name.replace(/\.[^.]+$/, '') || 'transcript';
    $('fileName').textContent = f.name + ' · ' + window.SlopAIModels.formatSize(f.size);
    $('out').value = ''; $('run').disabled = false;
  }
  $('file').addEventListener('change', (e) => pick(e.target.files[0]));
  $('drop').addEventListener('dragover', (e) => e.preventDefault());
  $('drop').addEventListener('drop', (e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); });
  $('run').addEventListener('click', run);
  $('srt').addEventListener('click', () => T.download(baseName + '.srt', X.srt(segments), 'application/x-subrip'));
  $('txt').addEventListener('click', () => T.download(baseName + '.txt', X.txt(segments), 'text/plain'));
  T.gate('speech', () => { $('ui').hidden = false; });
})();
