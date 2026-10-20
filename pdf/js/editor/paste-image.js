/* Slop PDF — images: one way to turn an image file into an image on the current page. The image tool (Ed.pickImage) and
   pasting both use Ed.addImageFile. A pasted image (or one copied from a web page) comes in through the shared intake
   (shared/intake): it goes on the current page; with no PDF open it says how to get one. */
(function () {
  'use strict';
  var SP = window.SP, U = SP.util, E = SP.engine, Ed = SP.editor;

  /** One image file → an asset in the document, placed on the current page. Throws if the picture cannot be read. */
  Ed.addImageFile = async function (file) {
    var bytes = await U.readFile(file), im = await E.prepareImage(bytes);
    var asset = E.addAsset({ mime: im.mime, url: U.bytesToDataURL(im.bytes, im.mime), w: im.w, h: im.h, name: file.name });
    Ed.placeImage(asset, 'Add image');
  };

  SlopIntake.attach({
    accept: function (f) { return f.type.startsWith('image/'); },
    hasOpen: function () { return !!(E.state && E.state.pages.length) && !!Ed.page(); },
    openName: function () { return 'this page'; },
    onAdd: async function (files) {
      for (var i = 0; i < files.length; i++) {
        try { await Ed.addImageFile(files[i]); } catch (e) { SlopUI.alert('Image not added', 'That image could not be read: ' + (e.message || e)); }
      }
    },
    onNew: function () { SlopUI.toast('Open a PDF first, then paste the picture onto a page.', 4200); },
  });
})();
