# shared/intake: pasted files (window.SlopIntake)

One place for "paste an image or file into the app". Load after `shared/slopui.js`, before the app's own scripts.

    SlopIntake.attach({
      accept: (file) => file.type.startsWith('image/'),   // which files this app takes
      hasOpen: () => doc.layers.length > 0,               // is there something open to add to?
      openName: () => doc.name,                           // used in the question: "Add to <name>"
      onAdd: async (files) => { /* add to the open document */ },
      onNew: async (files) => { /* open as a new document */ },
    });

- With nothing open, a paste goes to `onNew`. With something open, the reader is asked: Add to <name>, New document, or
  Cancel.
- A paste is taken only when an accepted file is on the clipboard. The app's own paste still runs for everything else,
  and it should return early when `e.defaultPrevented` is set.
- Images copied from a web page arrive as HTML (`<img src="data:…">`); they are turned into a File here.
- Typing fields and open dialogs are left alone.

Every app with a drop zone gets paste for free: `SlopDrop.attach` registers its rules with the intake, so a pasted file
the rules accept goes through the same `process` as a dropped one. Its `paste` option gives `hasOpen`, `openName` and
`onAdd` (when the app wants Add or New to be asked), or `paste: false` to opt out. A page with a drop zone loads
`shared/intake/intake.js` just before `shared/drop/drop.js`.

Apps using the intake directly: PhotoSlop (layers in the open document or new tabs), Slop PDF (images on the current page).
One listener serves the whole page: the first registered app that accepts the paste takes it, and the intake loads once.
