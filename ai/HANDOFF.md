# Slop AI: handoff

Chat with a language model that runs entirely on the person's device, in the browser, with WebGPU (WebLLM 0.2.85,
vendored in `vendor/web-llm/`). Registry id `ai` in `shared/apps.js` (icon `spark`).

**Recommended status: beta.** Everything works end to end with the fake engine and the real WebLLM path is wired and
reaches the network only after consent (checked in Chromium: the click → consent → fetch from huggingface.co). It has
not run a real model here because huggingface.co is blocked in this container: someone should load one model on a
real GPU (for example Qwen2.5 1.5B) and chat, use Control apps, and build a mini-app before calling it live.

## What the person sees
Four tabs (`#chat`, `#build`, `#models`, `#sys` in the URL hash):

1. **Can my PC run it?** (`js/ui/sysview.js`, `shared/ai/sysinfo.js`, `shared/ai/bench.js`): WebGPU yes/no/software,
   adapter vendor/architecture/description, `maxBufferSize`, `maxStorageBufferBindingSize`, shader-f16, RAM
   (`deviceMemory`, capped at 8 by browsers), threads, browser/OS (UA-CH), storage estimate/persisted ("Ask to keep it"),
   a ~1 s WebGPU benchmark (GFLOPS + GB/s), then a verdict per model: ✅ runs well ~X tok/s, ⚠️ slow, ❌ won't fit, with
   the reason. When WebGPU is missing: per-browser instructions and a "Try the demo engine" button. **Spec card**:
   a 1200×675 PNG (`js/ui/speccard.js`) to download, save to Slop Drive or share (Web Share with files when available).
2. **Models** (`js/ui/models.js`): the catalog (`shared/ai/catalog.js`: Qwen2.5 0.5/1.5/3/7B, Qwen2.5 Coder 1.5/7B,
   Llama 3.2 1/3B, Phi-3.5 mini, Gemma 2 2B; exact WebLLM ids) with download size, GPU memory, context, licence
   (link + commercial use), strengths, Recommended / Best for code badges, verdict badge. Download asks for consent
   ("downloads about N MB from huggingface.co … once … your chats never leave your device", licence line), then shows
   progress with **Pause** (aborts; finished shards stay cached so it resumes), **Cancel** (aborts and deletes the
   partial files), **Delete**, **Set default** (the default loads by itself on the next visit, but only if it is already
   downloaded), disk usage per model and in total. GPUs without shader-f16 get the `q4f32` build automatically.
   **Load from disk…**: pick an MLC model folder (`showDirectoryPicker`, falling back to `<input webkitdirectory>`);
   it is copied into WebLLM's caches under a private URL (`shared/ai/webllm.js importFolder`). No GGUF/wllama fallback.
3. **Chat** (`js/ui/chatlist.js`, `chat.js`, `messages.js`, `settings.js`): streaming Markdown (safe renderer
   `shared/ai/md.js`), code blocks with Copy (and Preview for HTML, which opens it in Build), conversations in IndexedDB
   (`slop-ai` → `convs`) with a sidebar (open, rename, delete, export), export to Slop Drive or download as `.md`/`.json`,
   import `.json`, persona/system-prompt editor (Helpful, Sloppo, Code helper, Writing coach, Custom), temperature,
   max tokens, Stop, Regenerate, attach text files from disk or Slop Drive (first 24k characters each; images are
   refused with a message), drag-and-drop files, tokens · tok/s · time to first token under every reply.
   "Send to Slop AI" from another app (`?drive=<id>`) attaches the text file.
4. **Build** (`js/ui/builder.js`, `builder-prompts.js`): the model writes one HTML file; it runs in an iframe with
   `sandbox="allow-scripts"` (no same-origin, no pop-ups, no forms, no top navigation) plus a CSP meta
   (`default-src 'none'`, inline script/style only) so it cannot read the page, storage or the network. Iterate by
   chatting (every reply with a complete ```html block replaces the preview), switch Preview/Code, restart, save to
   Slop Drive, download. Templates: Game (Catch the Slop), Calculator, Landing page. The builder system prompt
   (`AI.BUILDER_SYSTEM`) is written for small models (one file, no CDNs, define before use, whole file every time).

**Control apps** (toggle in the chat bar): the model gets `list_apps`, `open_app`, `save_to_drive`, `list_files`
(`shared/ai/apptools.js`). In other apps the side panel (`shared/ai/panel.js`) also gives it that app's
`SlopCmd.list()` as `list_commands` / `run_command`; destructive commands always ask first. Tool calls are
prompt-based (`<tool_call>{…}</tool_call>`, `shared/ai/tools.js`) so they work with every model, not only Hermes.

**Sloppo** sits in the top bar (shared painter `shared/sloppo/`). With a model loaded he is "AI powered": aura,
sparkles, star eyes and a brain hat (`shared/ai/powerup.js`). Click him: "Ask Sloppo" streams his reply through
`window.SlopAI.ask` (persona: "SLURP. I am the slop. ask me anything."). The API for the buddy is documented in
`shared/ai/HANDOFF.md`.

**Engines**: `?engine=fake` (or ⋯ ▸ "Use the demo engine") swaps WebLLM for the fake engine (canned streamed replies,
tool calls, HTML apps, simulated downloads in localStorage `slop-ai.fake-cache`). A model loaded here is shared with
other tabs (BroadcastChannel bridge); if another tab already has one, this tab borrows it ("(other tab)" in the chip).

Also: SlopCmd commands (`js/ui/commands.js`, ids `ai.*`; a small private key map when SlopCmd is missing), three
themes (Pro / Light / Classic 98 via the shared token block and `--sui-*`), `shared/guard.js`, `SlopHub.register('ai')`,
`SlopGuard.setUnsaved` while a reply streams.

## Code map
`index.html` loads the shared kit, `shared/ai/*.js`, then classic scripts sharing `window.AI`:
- `js/core/util.js` (prefs `slop-ai.prefs`, icons, bus `AI.on/emit`), `store.js` (IndexedDB, Markdown/JSON export;
  `?db=` overrides the database name for tests), `engine.js` (`AI.E`: load/consent/pause/cancel/unload/status/remove,
  borrowing from other tabs).
- `js/ui/`: `shell.js` (tabs, theme, chip, ⋯ menu), `sysview.js`, `speccard.js`, `models.js`, `chatlist.js`,
  `messages.js`, `chat.js` (`AI.ChatPanel`, used by Chat and Build), `settings.js`, `builder-prompts.js`, `builder.js`,
  `sloppo.js`, `commands.js`. `js/app/main.js` boots.
- `css/`: `base.css` (tokens, top bar), `chat.css`, `models.css`, `build.css`, `mobile.css` (≤ 760 px: icon tabs,
  drawer for chats, Build shows chat first with a Preview button).

## Tests
`node tests/run.mjs ai` → 64 tests on 8 pages, all green:

| Page | Covers |
|---|---|
| `sysinfo.test.html` | verdicts with mocked adapters (no WebGPU, 8 GB laptop, discrete GPU, no shader-f16 → q4f32, 128 MB binding limit, software adapter), speed estimates, recommendations (never the research-only licence), WebGPU help per browser, real `collect()` shape, the benchmark (when the runner has WebGPU) |
| `catalog.test.html` | requested families, licences, every id and f32 id exists in the vendored `prebuiltAppConfig` with the same memory figures, the WebLLM API the adapter uses |
| `tools.test.html` | tool-call parsing (tags, lenient JSON, fenced/bare JSON, unknown names), `prepare`, dispatch (destructive confirm), fake engine streaming/max_tokens/abort, the agent loop and its step limit, Control apps tools with a stub SlopCmd, save_to_drive, the cross-tab bridge (two iframes) |
| `store.test.html` | IndexedDB conversations, personas/system prompts, Markdown/JSON export and import, sidebar open/rename/delete, export to Slop Drive |
| `sandbox.test.html` | preview iframe attributes, a probe app cannot read the parent, storage, cookies or the network, CSP injection, `extractHtml`, templates, save, iterating by chat |
| `ui.test.html` | smoke with the fake engine: models (badges, pause/cancel, download, default), chat (markdown, copy, stats, stop, regenerate, attachments, Control apps → open_app, settings dialog), Ask Sloppo, system check + spec card, SlopCmd registration, themes, no sideways scroll |
| `panel.test.html` | `window.SlopAI` offline fallback, discovering a model loaded in Slop AI, Sloppo persona over the bridge, `comment()`, the panel running a page's SlopCmd commands with a confirm for destructive ones, going offline on unload |
| `mobile.test.html` | 390×844: every tab fits, chat drawer, chatting, Build preview toggle |

Helpers: `tests/ai/util.js` (`AT.app()` opens the app with the fake engine and its own database; `AT.SYS` mocked
snapshots), `bridge-frame.html`, `panel-page.html` (a pretend app with a stub SlopCmd and the panel).

## Known limits / next steps
- Not yet verified with a real model on a real GPU (blocked network here). Check: consent → download progress →
  Pause/Resume → chat speed → Control apps with Qwen2.5 1.5B/3B → mini-app with a Coder model.
- Disk usage per model reads `content-length` of cached responses; WebLLM's own `cacheBackend` must stay `'cache'`
  (the default), the IndexedDB backend is not counted.
- "Load from disk" needs the model's `.wasm` in the folder unless the folder name is a known prebuilt id. GGUF
  (wllama) is not supported.
- The side panel is ready (`shared/ai/panel.js`) but no app includes it yet: adding the one tag is up to each app.
- Chat history sent to the model is not trimmed to the context window (4k tokens for most models); very long chats
  will error, and the error shows in the chat. A sliding window would be a good next step.

## Slop Drive (shared storage)

- **Save chat to Slop Drive (Ctrl+S)** writes the conversation JSON (the Import format) back to the Drive file it was opened from (`conv.driveId`, via `SlopHub.update`). The first save asks for a folder. `More ▸ Open a chat from Slop Drive…` opens a JSON chat and links it. Attach ▸ From Slop Drive and the `?drive=` launch (text attached to a chat) are unchanged. Code: `js/ui/drive.js`.
