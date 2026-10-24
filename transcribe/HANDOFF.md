# Slop Transcribe: handoff

Voice, MP3 or video to text, on the device. `transcribe/index.html`, ES modules in `transcribe/js/`.

| File | What it does |
|---|---|
| `js/app.js` | Wires the page: SlopDrop (drop, Choose files), the recorder, the language, Transcribe and Stop, the transcript box, exports, Slop Drive and Slop Docs. Sets `window.SlopTranscribe = { queue, engine, add, run, select, selected }`. |
| `js/queue.js` | The files and their results, read one after another through an engine that is passed in (`createQueue({ engine, onChange })`). Pure apart from the engine. 2 hours at most per file. |
| `js/record.js` | Microphone recording with MediaRecorder; the file joins the queue like any other. Plain reasons when the microphone is blocked or missing. |
| `js/exports.js` | TXT, Word (shared/office/docx.js), SRT and WebVTT. Text and Word use the person's corrections; subtitles keep the timed segments. |
| `js/view.js` | Draws the list and the transcript pane. |
| `../aitools/transcript.js` | `SlopTranscript`: the one place for transcript formats, shared with the AI Tools Speech page. |

The engine is Slop AI Tools' Whisper tiny (`aitools/common.js`: `ensure('whisper-tiny')`, `audioSamples`, `call('transcribe')`),
so the model is the same download as the Speech page, offered by `SlopAITools.gate('speech')` (nothing downloads until the
person presses Get more and confirms). The SlopFlow picture (shared/ui/flow.js) shows the file kind to TXT and runs while
transcribing.

Tests: `tests/transcribe/units.test.html` (formats, queue with a fake engine, exports read back as .docx, recorder with a fake
microphone) and `tests/transcribe/app.test.html` (the page with a fake engine at 1280 and 390 px).

Limits: Whisper tiny is fast but makes mistakes on names and noisy audio; there is no speaker separation and no live
(streaming) dictation. A larger model (base or small) would read better and needs its own entry in aitools/model-registry.js.
