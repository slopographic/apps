# shared/agent: AI agents use the apps through WebMCP

WebMCP lets a page offer tools to an AI agent in the browser. Here every app page offers what it already has, generated,
never written per app. The files stay in the browser: tools refer to them by ids and run in the page.

## The API this targets (checked 2026-10-24)

- Spec: W3C Web Machine Learning CG draft, https://webmachinelearning.github.io/webmcp/ (source:
  github.com/webmachinelearning/webmcp `index.bs`). Entry point **`document.modelContext`**. `navigator.modelContext`
  was the first name: Chrome 146–149 have only that, 150–151 both, 152+ only `document`. `boot.js api()` tries both.
- `registerTool(tool, { signal })` (a Promise from Chrome 151). There is no unregister call: aborting the signal removes
  the tool. `provideContext`, `clearContext` and `unregisterTool` were removed from the draft. `webmcp.js` uses
  `unregisterTool` and `provideContext` only on older builds that have them.
- A tool: `{ name, title?, description, inputSchema (JSON Schema), execute(input, { signal }), annotations }`. The
  annotations are `readOnlyHint`, `untrustedContentHint` and `consequentialHint`. MCP's `destructiveHint` is set as well,
  for MCP-B and desktop clients. Names are 1–128 characters of `A–Z a–z 0–9 _ - .` (`tools.js` keeps them to 64).
- `execute` may return any JSON value. Ours return MCP's `{ content: [{ type: 'text', text }], isError? }`, which MCP-B
  also reads.
- There is no confirmation hook in the current draft (`requestUserInteraction` was dropped from the drafts and is now
  only an open proposal). A destructive call asks with the app's own `SlopUI.confirm`. When an agent passes
  `requestUserInteraction` (older builds and some polyfills do), the dialog runs inside it.
- Chrome: origin trial "WebMCP", Chrome 149 to 156 (chromestatus 5117755740913664; an extension to 162 was asked for).
  Without a token, use `chrome://flags/#enable-webmcp-testing` or `--enable-features=WebMCP`. Edge: behind a flag (and its
  own trial from Edge 150; we have no Edge token). Firefox and Safari: no. Playwright 1.64's Chromium (156) has it with the
  flag, and `tests/node/agent-real.test.mjs` runs against it.
- MCP-B (`@mcp-b/global`) wraps `document.modelContext` (the native one, or its polyfill where there is none). Desktop
  agents reach the tools through an extension that injects it, or the MCP-B local relay. The site does not include the
  polyfill or the relay script: agents need a browser that has WebMCP, or an extension.

## Files

| File | What |
|---|---|
| `boot.js` | `window.SlopAgents`, loaded by `shell/shell.js` after load (idle). The setting (`localStorage 'slop.agents'`, only "off" is stored, on by default), `api()`, `start()`, `about()`, the Help command `agents.about` ("AI agents…"), and a fallback that adds the page's own origin token when the head has none. |
| `tools.js` | The pure generator (window + CommonJS): `fromCommands` (= `SlopAIKit.cmdTools.specs`), `unique` names, `checkSchema`, `toWebMCP` (annotations, the confirmation for destructive calls, MCP-style results). |
| `workspace.js` | The file and operations tools: `list_files` (results made in the page `result:n`, files open in the app `app:n` through `slop:convert-files`, Slop Drive `drive:<id>`), `open_file` (through `SlopIntake.take`; only where the app registered an intake spec), `save_to_drive`, `download`, `list_operations`, `run_operation`, `run_workflow` (a `.slopflow` document, `shared/ops/flowdoc.js`, run by `workflows/js/core/plan.js runWorkflow` over `shared/ops/all.js`). The ops modules load on the first call. |
| `webmcp.js` | `window.SlopWebMCP`: builds the tools, registers them, registers them again when the set changes (SlopCmd change/run/open/close, a command's `when()`, an app dialog opening or closing, files coming in, checked every 3 s while visible), withdraws them when the setting goes off. `refresh()`, `stop()`, `tools()`, `definitions()`, `ready`. |
| `about.js` | The Help note and the setting toggle (`open()`, `note()`, `LINES`); Settings shows the same note (`data-slop-agents-note`). |
| `trial-tokens.json` | The origin trial tokens, one per origin, with their expiry. |

The command tools are the AI panel's: `shared/ai/cmdtools.js` `cmdTools.specs(cmd, env)` (added for this, also for
cloud engines) gives each tool provider-neutral, with `inputSchema` from `cmdTools.inputSchema` (the one schema maker,
also behind the panel's `definitions()`). So the Slop AI panel, cloud models and WebMCP see one tool list: one tool per
command with `args` (`shared/commands/args.js`), commands with `ai: false` left out, `app_state` and `list_commands`
(read-only), `run_command` (any command by id; it asks first for a destructive one). While a SlopUI dialog of the app is
open, the command tools are withdrawn (the app is waiting on the person); the file tools stay.

Help: the command `agents.about` is in Ctrl+K on every page with SlopCmd and at the end of every `SlopMenuBar` Help menu;
PhotoSlop, Slop PDF and SlopCut have "AI agents…" in their own Help menus. Settings has an "AI agents" section.

## The origin trial: what the owner does

The tokens are public by design (they are in every page). One build serves both origins: main is slopographic.com and
testing is slopographic.github.io. Every page head carries both tokens on one line in the SEO block, and Chrome ignores
a token made for another origin.

1. Sign in at https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241 (the WebMCP trial; blog: https://developer.chrome.com/blog/ai-webmcp-origin-trial).
2. Web origin `https://slopographic.com`. Leave "third-party matching" and "subdomains" off. Expected usage: the
   default. Submit, then copy the token.
3. Register again for `https://slopographic.github.io` (the preview).
4. Paste each token into `shared/agent/trial-tokens.json` under its `origin`, with `expires` (YYYY-MM-DD, shown on the
   trial page and inside the token).
5. Run `node tools/seo/write.mjs`, which writes `<meta http-equiv="origin-trial" content="…">` into every page head,
   then commit.
6. Renewal: `tests/node/agent-trial.test.mjs` warns within 30 days of an expiry and fails after it. When Chrome
   extends the trial, renew on the same page (My registrations ▸ Renew) and paste the new token. When the trial ends
   and WebMCP ships, delete the tokens (keep `"tokens": []`).

Current tokens: slopographic.com and slopographic.github.io, both expiring 2027-03-30.

## Tests

- `tests/node/agent-tools.test.mjs`: commands and registry schemas give valid JSON Schema tools, `ai: false` is skipped,
  names are unique and valid, destructive tools are flagged and ask first, and the workspace schemas are valid.
- `tests/node/agent-trial.test.mjs`: the tokens (origin, feature, expiry), the heads, the renewal warning.
- `tests/node/agent-real.test.mjs`: the real API in Playwright's Chromium with `--enable-features=WebMCP`. It covers
  registration, `getTools`, `executeTool`, withdrawal with the setting off, and registering again.
- `tests/agent/apps.test.html` (with the fake context `tests/agent/fake.js`): tools on PhotoSlop, Slop PDF, SlopCut,
  Workflows and File convert; the setting off, then on and off again from the Help note.
- `tests/agent/run.test.html`: `run_workflow` on a generated picture from Slop Drive → a resized `result:` file, then
  `run_operation` and `save_to_drive`. SlopCut ripple trim through `run_command`. The confirmation for New project, and
  Cancel changing nothing. Registering again after a state change, and a dialog opening.

## Limits

- No tool gets the bytes of a file; agents act on ids. Text content can be saved (`save_to_drive` with `content`).
- `photoslop/classic/` and `sheetview/` load SlopCmd without the shell, so they offer no tools.
- The confirmation is the app's own dialog, meant for the person at the screen.
