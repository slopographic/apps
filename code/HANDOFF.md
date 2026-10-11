# Slop Code: handoff

Slop Code is a code editor that runs entirely in the browser, with its files in Slop Drive. It is registered in `shared/apps.js` as `code` (status `building`, group `creative`). Nothing is uploaded, and nothing is fetched at run time: CodeMirror 6 is vendored under `vendor/codemirror/`.

## What works
- **Editor:** CodeMirror 6 with line numbers, fold gutters, bracket matching, auto-close brackets, active-line highlight, undo history, search and replace (Ctrl+F, Ctrl+H), multiple cursors (Ctrl+click adds one, Alt+drag selects a block), and a line-wrap toggle. Each open file keeps its own undo history.
- **Languages:** JavaScript, TypeScript (also TSX), HTML, CSS, JSON, Markdown, Python and plain text. The language follows the file extension.
- **Completion:** Ctrl+Space opens the list. Enter or Tab accepts. Sources, in the order they are merged:
  - JavaScript and TypeScript: the package's keywords and snippets, plus the names in the local scope (`localCompletionSource`).
  - JavaScript and TypeScript globals: `window` names (`document`, `console`, `Array` and so on), read once from `globalThis` (`js/completion.js`).
  - HTML: the package's tags and attributes. CSS: property names and values. Python: keywords and builtins. Markdown: the HTML tags inside it.
  - JSON: `true`, `false` and `null`, outside strings. `@codemirror/lang-json` ships no completion source, so this is added here.
  - Word completion from the open document, for every language.
- **Slop Drive:** the file tree shows folders and files as Drive shows them (Trash hidden). Click a folder to open or close it. Right-click (or the Menu key) for New, Open, Rename, Copy path and Delete. Delete moves to the Trash through a SlopUI dialog.
- **Open, save, save as, new:**
  - Ctrl+O opens from Drive. `?drive=<id>` opens a file (used by Send to and Open with).
  - Ctrl+S writes back to the same Drive record (same id, same name, a new blob).
  - Save as writes a copy to a folder you pick, then opens it.
  - New asks for a type (which sets the extension and language) and a name.
  - Binary files are refused with a message.
- **Drafts:** unsaved text autosaves per file in IndexedDB (`slop-code` / `drafts`, about 400 ms after an edit). Reopening a file restores the draft as unsaved. Saving or discarding removes it.
- **Unsaved tabs:** a dot marks an unsaved tab. Closing one asks Save, Discard or Cancel in a SlopUI dialog. `SlopGuard.setUnsaved` makes a reload ask too.
- **Tabs** are remembered per viewer (localStorage `slop-code.tabs`).
- **Run:** an HTML file shows its page in the preview. A JavaScript file runs alone. Project CSS, JS and images come from the file's Drive folder (subfolders too). Open tabs use their unsaved text. Console output and uncaught errors show under the preview.
- **Commands (SlopCmd):** Open, New, Save, Save as, Close tab, Find, Replace, Toggle wrap, Show or hide files, Run. Shortcuts show in the palette and menus. Without SlopCmd, the same shortcuts are handled in `js/commands.js`.
- **Phone (390 px):** the file tree is a drawer behind the Files button. The preview covers the screen.

## Shortcuts
| Action | Keys |
|---|---|
| Open | Ctrl+O |
| New file | Ctrl+Alt+N |
| Save / Save as | Ctrl+S / Ctrl+Shift+S |
| Close tab | Ctrl+Alt+W |
| Find / Replace | Ctrl+F / Ctrl+H |
| Toggle wrap | Ctrl+Alt+Z |
| Show or hide files | Ctrl+B |
| Run | Ctrl+Enter |
| Complete | Ctrl+Space (Enter or Tab accepts) |

Ctrl+Alt is used instead of Alt alone. SlopCmd only passes Ctrl or Cmd shortcuts through while the editor has focus, because the editor is a text field.

## The run preview and its sandbox
- The preview is an iframe with `sandbox="allow-scripts"`. It has no `allow-same-origin`, so it cannot read storage or the app.
- Its document has `Content-Security-Policy: default-src 'none'; ... connect-src 'none'; ...`. Scripts and styles are allowed inline (`unsafe-inline`, `unsafe-eval`). Images and media are allowed as `data:` and `blob:` only. Every network request (fetch, XHR, WebSocket, beacon) is refused.
- Project files are inlined when the page references them by a relative path: stylesheets and scripts as text, images as data URLs. Other references are left alone, and the policy stops them loading.
- A console hook (inside the preview) posts `console.*` and uncaught errors to the app with `postMessage`. The app takes messages only from this frame.
- Each run builds a new srcdoc, so the frame reloads and the console clears.

## Vendored packages and licences
Vendored by `tools/vendor-codemirror.mjs` from `cdn.jsdelivr.net/npm/` (build time only). Version table, the licence texts (MIT, all packages) and the import map: `vendor/codemirror/README.md`, `vendor/codemirror/LICENSES.txt`, `vendor/codemirror/import-map.json`. The map is also inlined in `code/index.html`, and `tests/code/vendor.test.html` checks that the two match. Key packages: `@codemirror/state`, `view`, `language`, `commands`, `autocomplete`, `search`, `lint`, the `lang-*` packages, and the `@lezer/*` parsers.

## Files
- `index.html`: the shell, the import map and the scripts.
- `css/base.css`, `css/editor.css`: tokens (light and dark), layout, tree, tabs, status bar, preview and the CodeMirror theme.
- `js/main.js`: boot and the action table. `js/commands.js`: SlopCmd commands and fallback.
- `js/editor.js`, `js/completion.js`, `js/lang.js`: the CodeMirror setup, completion sources, language table.
- `js/docs.js`: open documents (one view, one state per document). `js/ops.js`: open, save, save as, new, close, drafts, tab restore.
- `js/drafts.js`: IndexedDB drafts. `js/drive.js`: reads and writes records, the folder tree, unique names, project files.
- `js/tree.js`: the file tree and its menu. `js/tabs.js`, `js/ui.js`, `js/dialogs.js`, `js/dom.js`: chrome and dialogs.
- `js/run.js`, `js/preview-doc.js`: Run, the srcdoc builder, the CSP and the console hook.

## Tests
`node tests/run.mjs code` runs `tests/code/*.test.html` (open-save, completion, preview, unsaved, commands, tree, vendor) and `tests/node/code-local.test.mjs`. The last one fails if `code/` makes a network call (fetch, XMLHttpRequest, http(s) URLs, WebSocket) outside comments, or if a file in `code/` is over 300 lines. `tests/run.mjs` ignores the browser's CSP refusal messages, because the sandbox test triggers one on purpose.

## Limits
- No language server: no type checking, go-to-definition, rename or diagnostics beyond the parsers' own. The completion is what the packages and word matching give.
- No git, no projects beyond the Drive folder tree, no terminal, no formatter, no linter.
- The editor works on one Drive record per tab. If another app or tab changes a file that is open here, Save overwrites it. The app does not watch for that yet.
- Run uses the folder of the file. A `../` path in an HTML file is not resolved, and a path that is not in Drive is not found.
- Delete moves to the Drive Trash (it does not remove the record).
- The service worker's PRECACHE list does not include `code/` or `vendor/codemirror/`, so offline use is not set up. Regenerate the list with `node tools/pwa-precache.mjs` when this app is ready to ship.
- Vendored CodeMirror files are the unminified upstream modules, so some exceed 300 lines. The limit applies to code Slop writes.
