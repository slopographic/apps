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
| `panel-run.js` | `K.panel.send` … | The panel's run: tool loop, steps, Stop, "Undo all AI changes". |
| `picker.js` | `K.picker` | The model choice (WebGPU check with a plain fallback message, models good at app control first, download/use with progress and Cancel) and the download notice (`consent`, the shared first-use notice `shared/firstrun/notice.js` with the real size and licence). Slop AI's own downloads use the same notice. |
| `cmdtools.js` | `K.cmdTools` | An app's SlopCmd commands as tools: one tool per command with an `args` schema (JSON schema in `definitions(cmd)`), `app_state`, `list_commands`, `run_command`; arguments are checked and clamped (SlopCmd.exec) before a command runs. |

## The AI button and app control (2026-10)
- Every app page with the shell header has an **AI** button (`shell/header.js`, `.sh-ai`, same look as Convert…). Nothing
  of the AI loads before the first click; then it injects `shared/ai/panel.js` (`data-button="false"`) and opens the
  panel. On Slop AI itself there is no button. When the header is full the button becomes an icon, then moves into the
  Theme menu ("Ask Slop AI…"); it is also "Ask Slop AI…" in the command palette (`shell.ai`).
- Layout: above 900 px the page narrows by the panel's width (`html.sap-beside body { margin-inline-end }`, plus a
  resize event so canvases refit); 641–900 px it overlays on the right; ≤640 px it is a bottom sheet (`SlopSheet`,
  `shared/ui/sheet.js`, unchanged: swipe down, ×, Escape, tap outside).
- No model: the panel shows `picker.js`. Without WebGPU it says so plainly and what still works. A model loaded in
  another tab (Slop AI) is used through the bridge.
- "Control <app>" on: before each request the panel calls `SlopCmd.prepare()` (the app's AI commands load), builds the
  tools from the commands (`cmdtools.js`) and takes `SlopCmd.checkpoint()`. Each tool call is a step
  ("Gaussian blur, radius 8 ✓", ✗ with the error). Stop (the send button while running) ends the run between actions.
  Limits: 6 model turns and 12 actions per request (`MAX_STEPS`, `MAX_CALLS` in `panel-run.js`). Destructive commands
  ask (`destructive: true`, or the word rule). After a request that changed something, **Undo all AI changes (n)** calls
  the checkpoint's rollback.
- How an app joins: `shared/commands/HANDOFF.md` ▸ "Arguments and app state". Wired: PhotoSlop
  (`photoslop/js/app/ai-*.js`, 33 commands), plus Slop Tables, Slop Docs and Slop Resize (see their HANDOFFs).
- Slop AI's workspace (`ai/js/ui/workspace.js`) uses the same pieces for framed apps: `prepare()` before listing,
  `exec` for `app_command` (arguments checked), `SlopCmd.state()` for `app_state` (falls back to `window.SlopAppState`).
- Which models drive apps well enough: tool calling is prompt-based (`tools.js`), so any model can try. Qwen2.5 1.5B
  (the default) follows the tool format and picks the right single tool reliably, and usually manages 2–3 step plans
  such as "blur the background"; Llama 3.2 3B, Qwen2.5 3B and 7B plan longer chains better. Qwen2.5 0.5B and Llama 3.2
  1B often answer in prose instead of calling a tool or invent argument names, so the panel's picker lists only the four
  (`picker.FIT`); the others stay in Slop AI's Models page. These are observations from the prompt design, not a benchmark: the browser tests use the
  scripted fake engine.

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

## Your own AI account (shared/ai/cloud/, 2026-10)
People connect their own key (Claude, ChatGPT/OpenAI, Gemini, OpenRouter, Ollama or LM Studio on their computer, or any
OpenAI-compatible address) in the panel's model choice ("Use your own AI account", also shown without WebGPU). The
browser calls the provider directly; there is no server. A provider is **just another engine** (`K.CloudEngine`,
`cloud/engine.js`) behind the same interface, so the one loop (`tools.run`), the one tool list (`appTools.build` +
`cmdTools`) and the one panel drive it. Tool calling is **native**: each tool goes out as JSON Schema
(`cmdTools.inputSchema(tool)`, the one schema maker; `cmdTools.specs(cmd)` gives the provider-neutral definitions that
WebMCP uses too), calls come back structured with ids, and each provider's own reply (`done.native`: Claude's thinking
blocks with signatures, OpenAI's reasoning items, Gemini's parts with `thoughtSignature`, OpenRouter's
`reasoning_details`) is sent back unchanged.

| File | What |
|---|---|
| `cloud/net.js` | `K.cloud`: `sse(body)` (Server-Sent Events), `call(url, init, { secret, provider })` (every failure a `CloudError` with a plain message: key, rate (Retry-After), money, cors (with local-server help), network, model, request, server, refusal), `redact` (no key in any message), `seal` (calls that never ran get "Not run" before the next turn). |
| `cloud/anthropic.js` | Messages API, `anthropic-version: 2026-10-21`, `anthropic-dangerous-direct-browser-access: true`; no temperature (that version refuses it); effort medium on 4.6+/5.x; `fallbacks: "default"` + `anthropic-beta: server-side-fallback-2026-07-01` on Opus/Sonnet/Fable 5.x (not Haiku). |
| `cloud/openai.js` | Responses API (`/v1/responses`, OpenAI's recommended API for tools), `store: false`, output items passed back. |
| `cloud/compat.js` | Chat Completions for OpenRouter, Ollama, LM Studio and custom addresses (tool_calls deltas by index; pictures as a user message after the tool messages). |
| `cloud/gemini.js` | `streamGenerateContent?alt=sse`, key in `x-goog-api-key`, `functionDeclarations` with `parametersJsonSchema`. |
| `cloud/providers.js` | The list in plain words, default models (Claude Opus/Sonnet/Haiku 5.5; others from the fetched list by pattern), Anthropic prices and OpenRouter's from its list, `checkBase` (https, or http only for localhost), `localHelp` (OLLAMA_ORIGINS, LM Studio's Enable CORS, Chrome's local network prompt). |
| `cloud/keys.js` | Keys: IndexedDB `slop-ai-keys` when "Remember on this device" is on, else this tab only (memory + sessionStorage). Settings (`slop-ai.cloud` in localStorage) never hold a key. `shared/backup/core.js` and `central.js` leave the database out. |
| `cloud/meter.js` | Tokens per reply and this visit (sessionStorage), cost when the price is known, the cap, and the one-time notice per provider (`slop-firstrun:ai-cloud:<id>`). |
| `cloud/connect.js` | The form: provider, address, key (password field, autocomplete off), Test connection, Forget key, model, cap, steps, Use; `restore()` brings the last provider back on the next page when its key is still here. |
| `filetools.js` | `look_at_file`: asks every time ("Send a copy to Anthropic?"), sends a picture scaled to 1024 px (JPEG) or the first 8,000 characters of a text. |
| `optools.js` | `list_operations`, `run_operation`, `run_workflow` from `shared/ops/registry.js` and the one runner (`workflows/js/core/plan.js`); results saved to Slop Drive. |

The panel: the header names the provider and model (click it to change), the foot says where requests go; before
the first request to a provider, the notice; cloud runs get `look`, `ops` and up to `steps` model turns (12 by default,
1–30); after each reply a line with its tokens and this visit's total; the cap stops the loop after the turn that reaches
it and refuses new requests; Stop aborts the request in flight. A key-based engine is never shared with other tabs.

## Permissions, handoff, model menu (2026-10, wip/ai-permissions)
- **One permission module**, `permissions.js` (`window.SlopAIPermissions`, also CommonJS) + `permissions-ui.js` (the
  question and the settings view). `tools.dispatch` asks through `env.permit(req)` (the panel passes
  `SlopAIPermissions.ask`); a tool says which approval it needs with `kind(args)`: `change` (marked app changes: crop,
  flatten, merge…), `delete` (delete, clear, close, overwrite…, `kindOf(text)` is the one word rule), `send` (a copy of a
  file or a picture of the work goes to the provider: `look_at_file`, `look_at_canvas`). Modes: Ask each time (default),
  Allow app changes (never covers `send` or `delete`), Allow everything (with a warning). Answers: Allow once · for this
  request (ends with the reply: `startRequest`/`endRequest`) · for this visit (sessionStorage) · Always in this app (a rule,
  listed in ⚙ AI permissions with Remove) · Deny. Reading and ordinary edits never ask; Undo all works in every mode.
  WebMCP (shared/agent/) should call `SlopAIPermissions.ask({ kind, app, appName, action, detail })` the same way.
  The Slop AI app page (`ai/js/ui/chat.js`) still uses its plain confirm.
- **Prompt caching**: Anthropic requests carry a cache breakpoint on the system prompt (tools come first, so they are
  cached too) plus top-level automatic caching; usage reports `cacheRead`/`cacheWrite`, the cost prices them (reads
  0.1× or the listed price, writes 1.25×). OpenAI gets `prompt_cache_key`; Gemini and OpenRouter cache on their own and
  report cached tokens. Measured live (Haiku 5.5, 5 steps, 34 tools): 42,898 tokens either way; cost $0.0044 → $0.0014
  (Sonnet 5.5 prices: $0.088 → $0.028); `tests/node/ai-permissions.test.mjs` keeps those numbers.
- **The site in the prompt**: own-key models get `appTools.catalog(SLOP_APPS)` (each app: what it is, what it makes and
  opens), "be resourceful" and "never refuse because this app cannot: run_operation here, or open_app with a task".
- **One task through several apps** (`handoff.js`), in this tab: file in → file out jobs run on any page
  (`run_operation`); editing that needs an app moves there with `open_in_app({ app, files, task })`, which sends the files
  the way "Open in…" does (SlopOuttake items now carry `to`; an app's own handover first, e.g. SlopIsolate → PhotoSlop as
  a layer with its mask; `SlopHub.sameTab` makes `sendTo` stay in this tab). `open_app({ id, task })` moves without files.
  The record (conversation, task, the line "Continuing in PhotoSlop with photo.png.", chain id and hop) is in
  sessionStorage; on arrival the shell header opens the panel, which shows the line and sends the task as soon as a model
  is there. Stop ends the chain in every app (`cancel`); at most 8 hops. Setting (⚙): "When a task uses other apps" —
  Stay on this page when possible (default) / Show me in each app; the prompt honours "do it here" / "show me".
  `tests/ai/chain.test.html`: Drive → PhotoSlop (stay) and Drive → SlopIsolate → PhotoSlop → export (show), real pages.
- **look_at_canvas** (`filetools.js`): `SlopCmd.snapshot()` when the app provides one (`SlopCmd.provide({ snapshot })`),
  else the file the app hands to Convert; scaled to 1024 px, kind `send`, a thumbnail in the chat.
- **Model menu** (`model-menu.js`): the header's model name is a SlopMenuButton: the connected providers' models (hint
  per model), AI settings…, AI permissions…, Disconnect. A pick is remembered for that app (`lastByApp`). With a
  provider in use, the full model choice shows it first and the local models under "Models on this device".
- Steps show the app's answer as a dimmed line; more than 3 steps in a row fold into "9 steps ✓" (open to see them).

## GPUs that cannot compile a model (2026-10)
- WebLLM is 0.2.86 (model libraries `v0_2_86/base`, rebuilt by MLC with current compilers); `vendor/web-llm/README.md`.
- `WebLLMEngine.load`: a shader or pipeline validation error on the f16 build ("Invalid ShaderModule … index_kernel")
  loads the model's q4f32 build once, and `catalog.markF16Broken(adapter)` remembers it (localStorage
  `slop-ai.f16-broken`, by vendor/architecture/description), so `catalog.idFor` and later loads go straight to f32. A
  failure carries `err.tried` and `err.shader`; the model choice then shows `gpu-help.js`: what was tried, browser and
  GPU (sysinfo), Copy details, Try a smaller model, Use your own AI account. `tests/ai/shader.test.html`.
- Real WebGPU: `tools/webgpu-check.mjs` + `.github/workflows/webgpu.yml` (nightly, by hand, on WebLLM changes): Chromium
  with WebGPU on SwiftShader (`--enable-unsafe-webgpu --enable-features=Vulkan --use-webgpu-adapter=swiftshader`, page on
  http://localhost) loads Qwen2.5 0.5B q4f32 and generates 8 tokens (about 3.5 minutes with a cold cache; the model is
  kept in the Actions cache). SwiftShader has no shader-f16, so the q4f16 build is reported as not testable there. The
  tokens SwiftShader produces are gibberish: the check is that every shader compiles and generation runs.

## Tests
`node tests/run.mjs ai` covers all of this; see `ai/HANDOFF.md`. Own keys: `tests/node/ai-cloud-formats.test.mjs`
(request building, streams from documented SSE fixtures, conversion both ways), `tests/node/ai-cloud-engine.test.mjs`
(the loop per provider, errors, cap, redaction, settings), `tests/ai/cloud.test.html`, `tests/ai/cloud-keys.test.html`
and `tests/photoslop/ai-cloud.test.html` (a fake fetch per provider, `tests/ai/cloud-util.js`).
