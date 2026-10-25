// The AI in the apps, said once and in plain words, for the round-ups (shared/seo/roundups/*.mjs), the task FAQs and the
// app pages. Checked against the code:
//   - the AI button on every app page (shell/header.js) opens the AI panel (shared/ai/panel.js); it works the apps that
//     have AI commands (shared/commands/AI-COVERAGE.md) with:
//       a model on this device: WebLLM on WebGPU (shared/ai/webllm.js, shared/ai/catalog.js), downloaded once;
//       a local server: Ollama, LM Studio and others (shared/ai/cloud/catalog/local.js, cloud/local.js);
//       the person's own key: Claude, ChatGPT, Gemini, OpenRouter, Groq and about 50 services (shared/ai/cloud/catalog/).
//     With a key the browser calls that provider directly (shared/ai/cloud/net.js); there is no Slopographic server.
//   - pictures: generate_image / edit_image and PhotoSlop's Generate Image… and Edit with AI… (shared/ai/imagegen/,
//     photoslop/js/app/imagegen.js) need the person's own OpenAI, Gemini or OpenRouter key; an edit changes only the
//     selection (OpenAI with a mask, the others put back inside it, imagegen/pixels.js). Nothing generates pictures on
//     the device.
//   - on the device, with no key: SlopIsolate (shared/cutout), Slop Upscale, Slop OCR, Slop Transcribe (Whisper),
//     Slop Image to 3D, Slop AI Tools and PhotoSlop's Select Subject.
// tests/node/seo-stale.test.mjs keeps the copy from drifting back to claims these facts contradict.
export const AI = {
  /** The feature row for the AI panel in a comparison table, and our value in it. */
  row: 'AI assistant that uses the app',
  short: 'Local model or your own key',
  /** A pro in a round-up. */
  pro: 'An AI button that can do the work in the app for you, with a model on your device, Ollama or LM Studio on your computer, or your own key for Claude, ChatGPT, Gemini and others',
  /** What a key means, in one sentence. */
  key: 'With your own key, what you ask (and any file you allow) goes to that provider, and its terms and prices apply.',
  /** The free ways to use it. */
  free: 'Models on your device and on your own computer cost nothing, and some services, such as Gemini, Groq and OpenRouter, have free tiers.',
  /** Pictures made or changed by AI: never on the device. */
  images: 'Generate Image… and Edit with AI… make or change a picture with your own OpenAI, Gemini or OpenRouter key; Edit with AI changes only the selected area',
  /** Our value for a "Generative fill" row. */
  imagesShort: 'With your own key',
};

/** The full answer for an FAQ: "Does it have AI?" */
AI.how = `Yes, if you want it. The AI button can do the work in the app for you. It can use a model that runs on your device (WebGPU, downloaded once), Ollama or LM Studio on your computer, or your own key for a service such as Claude, ChatGPT or Gemini. ${AI.key} ${AI.free}`;
