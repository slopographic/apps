/* SlopIntake: one place where pasted files become work, for every app. An app says what it takes and what each choice does:
 *   SlopIntake.attach({ accept(file), hasOpen(), openName(), onAdd(files), onNew(files) })
 * A paste with files the app accepts (a copied file, or an image copied from a web page) goes to onAdd when something is
 * open (after asking "Add to <name>" or "New document") and straight to onNew when nothing is. The paste is taken only
 * when there is an accepted file, so the app's own paste still runs for everything else (it checks e.defaultPrevented).
 * Typing fields and open dialogs are left alone. Classic script: window.SlopIntake. See shared/intake/HANDOFF.md. */
(function () {
  'use strict';
  if (window.SlopIntake) return; // loaded once per page: a second copy would hear every paste twice
  const SI = (window.SlopIntake = {});
  const typing = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) && !t.classList.contains('paste-catcher');
  const DATA_IMG = /<img[^>]+src="(data:image\/[^"]+)"/;

  /** The files on a clipboard, read at once (the paste event must be handled synchronously). A copied web image that
   *  arrives only as <img src="data:…"> is returned as a file too: its bytes are read later by SI.imageFromDataUrl. */
  function filesOf(cd) {
    if (!cd) return { files: [], dataUrl: null, mime: null };
    let files = [...(cd.files || [])];
    if (!files.length) files = [...(cd.items || [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter(Boolean);
    const dataUrl = files.length ? null : ((cd.getData('text/html') || '').match(DATA_IMG) || [])[1] || null;
    return { files, dataUrl, mime: dataUrl ? dataUrl.slice(5, dataUrl.indexOf(';')) : null };
  }
  SI.filesOf = filesOf;

  /** A data: image URL as a File named after its type (for apps that read files). */
  SI.imageFromDataUrl = async function (url) {
    const blob = await (await fetch(url)).blob();
    const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
    return new File([blob], 'pasted-image.' + ext, { type: blob.type });
  };

  /** "Add to <name>" or "New document" (or Cancel). Resolves 'add', 'new' or null. */
  SI.choose = function (count, name) {
    return new Promise((res) => {
      let pick = null;
      window.SlopUI.dialog({
        title: 'Paste',
        body: (count === 1 ? 'This image' : count + ' images') + ' can go into ' + name + ', or open as a new document.',
        buttons: [
          { label: 'Cancel' },
          { label: 'Add to ' + name, act: () => { pick = 'add'; } },
          { label: 'New document', primary: true, act: () => { pick = 'new'; } },
        ],
        onClose: () => res(pick),
      });
    });
  };

  // One paste listener for the page; each registered app says which files it takes. The first app (in the order they
  // attached) that takes a file gets the paste. Returns a function that detaches the app.
  const apps = [];
  let listening = false;
  async function onPaste(e) {
    if (e.defaultPrevented || typing(e.target) || (window.SlopUI && window.SlopUI.openDialogs)) return;
    const got = filesOf(e.clipboardData);
    if (!got.files.length && !got.dataUrl) return;
    // Which app takes it is decided from the type alone (a one-byte stand-in for a copied web image).
    const probe = got.files.length ? got.files : [new File([new Uint8Array(1)], 'pasted-image.png', { type: got.mime || 'image/png' })];
    const app = apps.find((a) => probe.some(a.accept));
    if (!app) return;
    e.preventDefault(); // taken here: the app's own paste does not also run
    let files = got.files;
    if (!files.length) { try { files = [await SI.imageFromDataUrl(got.dataUrl)]; } catch (err) { return; } }
    files = files.filter(app.accept);
    if (!files.length) return;
    const open = app.hasOpen ? app.hasOpen() : false;
    if (!open) { await app.onNew(files); return; }
    const pick = await SI.choose(files.length, app.openName ? app.openName() : 'the open document');
    if (pick === 'add') await app.onAdd(files);
    else if (pick === 'new') await app.onNew(files);
  }

  /** Attaches an app to pastes. o: { accept(file), hasOpen?(), openName?(), onAdd(files), onNew(files) }. */
  SI.attach = function (o) {
    const entry = { accept: o.accept, hasOpen: o.hasOpen, openName: o.openName, onAdd: o.onAdd || o.onNew, onNew: o.onNew || o.onAdd };
    apps.push(entry);
    if (!listening) { document.addEventListener('paste', onPaste); listening = true; }
    return () => { const i = apps.indexOf(entry); if (i >= 0) apps.splice(i, 1); };
  };
})();
