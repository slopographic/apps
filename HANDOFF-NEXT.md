# Slopographic: handoff for the next session

Branch: `claude/gifted-maxwell-xh5kfq`. `main` was last merged at `3d7f146`; the branch is ahead
with WIP commits and a few finished fixes. Merge to `main` only after the full suite is green
(`node tests/run.mjs`, run alone; the physics and Slop Isolate browser pages can crash under load).

## Unfinished work, with the next step for each

1. **Import of file names with brackets or parentheses** (`invoice (2).pdf`, `photo [final].png`).
   Errors on import. Next: find the regex or selector built from the file name (shared/drop,
   the open paths in pdf/, docs/, slides/, tables/, convert/, sheetview/, contacts/), fix it in
   one filename helper, add `tests/node/filenames.test.mjs` and a drop test in `tests/drop/`.

2. **Label editor**: tabs on the shared document tabs, saved configs, built-in presets.
   Partly in WIP commits. Next: check `label/` for the tab and config code, run `node tests/run.mjs label`
   alone, then the node tests `tests/node/label-*.test.mjs`.

3. **Slop PDF zoom buttons drift to the left** (the + and − buttons, the zoom percentage box, and the
   menu zoom). Next: measure the page centre before and after each click in a real browser (a
   Playwright script in /tmp), then anchor zoom to the workspace centre in
   `pdf/js/editor/view-zoom.js` and `zoom-math.js`.

4. **Slop PDF selection actions**: a floating bar on selected text (highlight, underline,
   strikethrough, copy, comment, edit text, colour, remove by redaction, replace, find).
   Next: check `pdf/js/editor/textlayer.js` and `texthl.js`, then add the bar and its tests.

5. **Earlier items still open**: the mascot can cover the Accept button while perched on the consent
   strip (`shared/buddy`); content scrolls under the consent strip mid-scroll; the Drive local-folder
   test is timing-sensitive under load (passes alone).

## Done and merged (for orientation)

Homepage sections, search and the shared finder; the List and Table views; document tabs in Docs,
Slides, Tables, Notes, Hex and PDF; rename; Slop Contacts (Drive bundle, dialog fix, drop import);
the review-before-cleanup dialog; PDF find, replace, text selection, page actions, tabs and drop,
the Convert dialog and PDF-to-HTML; Slop OCR; Slop Sheets; Slop EML attachments; the QR rewrite;
Slop Remix auto-remix and Randomise; Reports and the shared query module; the service worker (v28).

## How to test

- Per app: `node tests/run.mjs <name>` (for example `pdf`, `contacts`, `label`).
- Node: `node --test tests/node/<file>`.
- Service worker: after adding files, run `node tools/pwa-precache.mjs` and bump `VERSION` in
  `service-worker.js`; `tests/pwa` checks it.
- SEO pages: `node tools/seo/write.mjs` after changing app entries or copy.
