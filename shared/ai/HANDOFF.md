# shared/ai: the local-AI kit (and the API for the Sloppo buddy)

Everything here is a classic script that adds to `window.SlopAIKit` (`K`), except `slopai.js` (`window.SlopAI`) and
`panel.js` (`window.SlopAIPanel`). No build step; WebLLM is vendored in `vendor/web-llm/` and imported only when a
real model loads. The app that uses all of it is `ai/` (Slop AI, see `ai/HANDOFF.md`).

## For the Sloppo buddy (shared/buddy/): `window.SlopAI`

Include one tag. It loads `engines.js`, `tools.js`, `bridge.js` and `powerup.js` from its own folder:

```html
<script src="../shared/ai/slopai.js"></script>   <!-- path relative to the page -->
```

| Member | What |
|---|---|
| `SlopAI.ready` | `true` when a model is loaded in this page **or in any other open tab of the site** (normally the Slop AI tab). |
| `SlopAI.model` | `{ id, name, kind }` (`kind: 'remote'` when borrowed from another tab), or `null`. |
| `SlopAI.loaded` | Promise: resolves once the kit is loaded and other tabs have been asked (≈300 ms). Read `ready` after it. |
| `SlopAI.ask(prompt, opts)` | Returns a **stream**. `opts`: `persona: 'sloppo'` (default) or `'plain'`, `system` (overrides the persona), `history` (`[{role, content}]`), `temperature` (Sloppo 0.9), `max_tokens` (Sloppo 120), `signal`. |
| stream | `for await (const piece of stream) bubble.textContent += piece;` · `await stream.text` (the whole reply) · `stream.abort()` · `stream.offline` (true when no model: it then yields one canned "SLURP… load a model in Slop AI" line instead of failing). |
| `SlopAI.comment(what, opts)` | Sloppo reacts to something in one short line: `SlopAI.comment('the user just exported a PDF')`. Same stream; `max_tokens` 60. |
| `SlopAI.on(evt, fn)` | `'ready'` (became ready), `'unready'`, `'change'` (any change, incl. another model). Returns `off()`. |
| `SlopAI.look` | `{ hat: 'brain', aura: 'ai', sparkle: true }` while ready, else `null`. Merge it into his look. |
| `SlopAI.powerUp` | The drawing helpers below (`SlopAIKit.powerUp`), once loaded. |
| `SlopAI.SLOPPO`, `SlopAI.GREETING` | The persona text and his catchphrase "SLURP. I am the slop. ask me anything." |

### The "AI powered" look
`SlopAIKit.powerUp` (`powerup.js`) draws on a 2D canvas and matches the shared painter (`shared/sloppo/`):

```js
import { drawSloppo, HATS } from '../shared/sloppo/index.js';
await SlopAI.loaded;
SlopAI.powerUp.install(HATS);          // adds HATS.brain, so look.hat = 'brain' works in drawSloppo
function frame(g, W, H, look, t) {
  if (SlopAI.ready) SlopAI.powerUp.draw(g, W, H, look, t, drawSloppo);   // aura + Sloppo + brain hat + sparkles
  else drawSloppo(g, W, H, look, t);
}
// or piece by piece: powerUp.aura(g, cx, cy, r, t) before him, powerUp.sparkles(g, cx, cy, r, t) after,
// powerUp.brain(g, H, t) with the painter's head box H = { x, top, w, h, s, eyeY, base }.
```
A CSS glow also works for a DOM-positioned buddy: `filter: drop-shadow(0 0 8px rgba(212,255,58,.6))`.

### Suggested buddy behaviour
- Speech bubble: stream `SlopAI.ask(question)` into it; show `stream.offline` lines as-is (they are in character).
- "Ask Sloppo": an input in the bubble → `SlopAI.ask(text)`.
- Commenting: call `SlopAI.comment(...)` rarely (e.g. at most once a minute, on real events), and never while the
  person is typing; small models are slow on weak GPUs. Abort the previous stream before starting a new one.
- Listen to `SlopAI.on('ready'|'unready', …)` to switch the power-up look on and off.

## Files

| File | Adds | What |
|---|---|---|
| `catalog.js` | `K.catalog` | The models: WebLLM ids (checked against the vendored `prebuiltAppConfig` by a test), download size, `vramMB`/`vram32`, `lowResource`, licence (name, URL, commercial use), strengths, blurb, `f32Id` for GPUs without shader-f16. `byId`, `idFor(m, sys)`, `custom(id)`. |
| `sysinfo.js` | `K.sysinfo` | `collect({ bench })` snapshot (adapter info, limits, f16, deviceMemory, cores, UA-CH browser/OS, storage estimate/persisted); pure `verdict(sys, model)` → `{ level: good/slow/no, tps, id, vram, reason }`, `recommend(sys, list, 'chat'/'code')`, `help(sys)` (WebGPU how-to per browser), `budgetMB`, `bandwidth`. |
| `bench.js` | `K.bench` | WebGPU micro-benchmark: tiled f32 matmul (GFLOPS) and a storage-buffer copy (GB/s). Starts at 128² / 8 MB and scales up only on fast GPUs (~1 s; ~3 s on SwiftShader). |
| `engines.js` | `K.Engine`, `K.FakeEngine` | The engine interface `{ load(model, onProgress, {signal}), chat(messages, {tools, stream, temperature, max_tokens, signal}), unload(), info() }`. `chat` streams `{type:'delta', text}` then `{type:'done', text, raw, toolCalls, usage:{tokens, tps, ttft, ms}}`. The fake engine streams canned replies, emits tool calls for "open <app>", "run <cmd.id>", "save", writes an HTML app for "build/make … app", and takes scripted `replies`. |
| `tools.js` | `K.tools` | Prompt-based tool calling for any model: `<tool_call>{"name":…,"arguments":…}</tool_call>` (also fenced or bare JSON, lenient quotes); `prepare` (one system message, merged roles, tool results as `TOOL RESULT (name): …`), `parse`, `dispatch` (asks before destructive tools), `run` (the agent loop, max 4 steps). |
| `apptools.js` | `K.appTools` | "Control apps": `list_apps`, `open_app`, `save_to_drive`, `list_files`, plus `list_commands`/`run_command` when the page has `window.SlopCmd`. Commands whose id/title says delete/clear/close/reset/new/… are destructive and confirmed. |
| `webllm.js` | `K.WebLLMEngine`, `K.models` | The real engine (MLCEngine; Pause/Cancel abort `reload`, finished shards stay cached). Cache helpers that never load the library: `status(id)` → none/partial/ready + bytes, `remove(id)`, `importFolder(files)` for "Load from disk" (an MLC folder goes into the same caches under a private URL; needs the `.wasm` in the folder unless the folder name is a known prebuilt id). |
| `bridge.js` | `K.bridge`, `K.RemoteEngine` | BroadcastChannel `slop-ai-bridge`: a page with a loaded model hosts it; other tabs stream through it. Tools run in the asking page. |
| `slopai.js` | `window.SlopAI`, `K.load` | The API above; `SlopAI.use(engine)` is how a page that loaded a model shares it. |
| `powerup.js` | `K.powerUp` | Brain hat, aura, sparkles. |
| `md.js` | `K.md` | Safe Markdown for chat (escape first; http(s) links only; code blocks with Copy/Preview buttons; works on half-streamed text). |
| `panel.js` + `panel.css` | `window.SlopAIPanel` | The embeddable side panel (below). |

## The side panel (`panel.js`)
Any app can add it later with one tag: `<script src="../shared/ai/panel.js" defer></script>` (after `shared/apps.js`,
`slopui.js`, `hub.js` and, if it has one, `shared/commands/commands.js`). Attributes: `data-button="false"` hides the
floating button (call `SlopAIPanel.open()` from a menu instead); `data-app="photoslop"` names the app if
`SlopHub.register` was not called. It themes itself with the page's `--sui-*` tokens.

**Model sharing, as built:** a BroadcastChannel bridge, not a SharedWorker. WebGPU memory belongs to one tab, and a
SharedWorker cannot be relied on to have WebGPU, so the model lives in the tab that loaded it (normally Slop AI) and
other tabs stream through it. If that tab closes, clients see `ready = false`. "Load here" in the panel loads an
already-downloaded model into the current page instead (a second copy in GPU memory), and that page then hosts it for
others. Nothing is downloaded from the panel; downloads happen in Slop AI, after consent.

## Tests
`node tests/run.mjs ai` covers all of this; see `ai/HANDOFF.md`.
