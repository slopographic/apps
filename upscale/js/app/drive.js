/* Slop Upscale: Slop Drive. Results go to a "Slop Upscale" folder at the Drive root (tagged app: upscale). Classic script;
 * adds SlopUpscale.drive. Needs shared/hub.js (SlopHub); without it, available() is false.
 *   available()                  whether the hub is on this page
 *   save(blob, name, meta)       Promise<id>  saves a result into the folder
 *   open(id)                     Promise<record | null>  a Drive file with its blob (for ?drive=<id> and the picker)
 *   pick()                       Promise<record | null>  the Drive picker, for pictures and videos */
(function (g) {
  'use strict';
  const U = (g.SlopUpscale = g.SlopUpscale || {}), D = (U.drive = {});
  const FOLDER = 'Slop Upscale', APP = 'upscale';
  const hub = () => g.SlopHub || null;
  let folderP = null;

  D.available = () => !!hub();

  function folder() {
    if (!folderP) folderP = (async () => {
      const H = hub();
      const roots = await H.listFolders({ parentId: null, trashed: false });
      const found = roots.find((f) => f.app === APP) || roots.find((f) => f.name === FOLDER);
      return found ? found.id : H.createFolder(FOLDER, null, { app: APP });
    })().catch((e) => { folderP = null; throw e; });
    return folderP;
  }

  D.save = async function (blob, name, meta = {}) {
    const folderId = await folder();
    return hub().put(blob, { name, from: APP, folderId, meta });
  };

  D.open = async function (id) {
    if (!hub()) return null;
    return (await hub().get(id)) || null;
  };

  D.pick = async function () {
    if (!hub()) return null;
    const rec = await hub().pickFromDrive({ accept: ['image/*', 'video/*'], title: 'Open from Slop Drive' });
    return rec ? D.open(rec.id) : null;
  };
})(typeof window !== 'undefined' ? window : globalThis);
