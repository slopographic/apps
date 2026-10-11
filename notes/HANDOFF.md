# Slop Notes: handoff

Slop Notes keeps notebooks, folders and Markdown notes in Slop Drive. It is registered in `shared/apps.js` as `notes` (status `building`, group `business`). Nothing is uploaded. There is no build step and no CDN: the Markdown renderer and the layout are in this folder.

## What works
- **Notebooks:** the sidebar lists them with counts. "All notes" shows every notebook. New notebook asks for a name. Right-click (or the Menu key) gives Open, New note, New folder, Rename and Move to Trash.
- **Folders:** folders sit inside a notebook and nest (the sidebar indents them). A note can be moved to a folder or to the top of its notebook, or to another notebook, from its menu. "Whole notebook" shows every note in the notebook.
- **Notes:** a title, tags (comma separated, shown in the sidebar as filters) and a Markdown body. A pinned note sorts first and shows a star.
- **Live preview:** Write, Split or Preview (the buttons, or Ctrl+Alt+V to cycle). The preview updates as you type.
- **Markdown:** headings, paragraphs, bold, italic, strike, code spans and fenced code, quotes, bullet, numbered and task lists, rules, and links (http, https, mailto, `#`, relative). Typed HTML is escaped, so it shows as text. Images are shown only when they are `data:image/…;base64` (no remote loading). Nested lists are not supported.
- **Search:** the search box filters on title, text and tags, across the chosen notebook or all of them.
- **Saving:** every change is written to Slop Drive about 600 ms after the last keystroke (`store.js`, `touch` and `flush`). The indicator reads "Saving…", then "Saved to Slop Drive", or "Not saved: …" on an error (which retries). SlopGuard asks before a reload or close while a change is still waiting.
- **Reading back:** on open the app reads every Drive record with `meta.type === 'notes'` (`store.load`). The note last open is reopened through SlopSession.
- **Export:** a note downloads as `.md` (the body as written) or as one standalone `.html` page with its styles inline (`export.js`). The file name comes from the title.
- **Trash:** Delete moves a note to the Slop Drive Trash. Deleting a notebook or a folder moves everything in it to the Trash. Restore from the Drive Trash.
- **Commands (SlopCmd):** New note (Ctrl+Alt+N), New notebook, New folder, Export as .md or .html, Search notes (Ctrl+Shift+F), Pin or unpin (Ctrl+Alt+P), Move to Trash, Cycle view (Ctrl+Alt+V), Next and Previous note (Ctrl+Alt+Arrow keys).
- **Phone (390 px):** one pane at a time: Notebooks, the note list, or the editor. Back returns to the list.

## Where the data lives
- Each note is a Drive file: `text/markdown`, the body is the blob, the name is `<title>.md`. Its `meta` is `{ type: 'notes', kind: 'note', title, tags, pinned, notebook, folder }`.
- A notebook and a folder are small Drive files (`application/x-slop-notes`) with `meta.kind` `'notebook'` or `'folder'`. A folder has `notebook` and `parent`.
- New files go into the app's own Drive folder, named Slop Notes (`SlopHub.put` with `from: 'notes'`).
- Deleting moves to the Drive Trash, and `list` leaves the Trash out.
- The backup of Slop Drive (Slop Admin, "Export everything") covers these records, because they are Drive files. The app has no separate store.

## Files
- `index.html`: the shell and the shared scripts (apps, slopui, hub, ctxmenu, guard, commands, session).
- `css/notes.css`: tokens (light, dark), the three-pane layout and the phone layout, the Markdown look.
- `js/main.js`: boot, the top bar, the save indicator, SlopGuard and the reopen of the last note.
- `js/store.js`: the Drive model, the debounced saves and the Trash.
- `js/state.js`: the shared state and the filters the list, tags and folders use.
- `js/actions.js`: every change (new, rename, pin, move, trash, select). The views and menus call these.
- `js/side.js`, `js/list.js`, `js/editor.js`: the sidebar, the note list and the editor with the preview.
- `js/menus.js`: right-click and Export menus. `js/commands.js`: the SlopCmd commands.
- `js/markdown.js`: the renderer. `js/export.js`: the .md and .html downloads. `js/dom.js`: small DOM helpers.

## Tests
`node tests/run.mjs notes` (`tests/notes/notes.test.html`): notebook and note creation through the dialogs, Markdown and the live preview, HTML escaping, the save to Drive and the indicator, pin, search, the right-click menu, a reload that reads the notes back, the .md and .html exports, the renderer's link rules, SlopCmd registration and the phone layout. Drive is the shared hub on the test origin (its own IndexedDB, fresh per run), as in `tests/code`.

## Known limits
- No nested lists, tables, footnotes or math in the Markdown.
- Notebooks and folders are records in Slop Drive, so they also appear in the Drive app as files of an unknown type. Renaming them in Notes renames the record.
- Only one browser profile sees the notes (Slop Drive is per browser).
