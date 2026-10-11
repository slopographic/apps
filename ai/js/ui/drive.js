/* Slop AI — ui/drive: Slop Drive for conversations. A chat saved to Slop Drive is written as JSON (the same
 * format Import reads). Save writes back to that Drive file; the first save asks for a folder. Opening a chat
 * from Slop Drive links it to that file, so later saves go back to it. */
'use strict';
(function (AI) {
  const H = () => window.SlopHub || null;
  AI.saveChatToDrive = async function (c) {
    c = c || (AI.chat && AI.chat.conv);
    const hub = H();
    if (!hub || !c || !c.messages.length) return;
    const blob = new Blob([AI.toJSON(c)], { type: 'application/json' }), name = AI.slug(c.title) + '.json';
    try {
      if (!c.driveId) { const id = await hub.saveToDrive(blob, name, { from: 'ai' }); if (!id) return; c.driveId = id; }
      else if (!(await hub.update(c.driveId, { blob, name, type: blob.type }))) await hub.put(blob, { id: c.driveId, name, from: 'ai' });
      else window.SlopUI.toast('Saved “' + name + '” to Slop Drive');
      await AI.db.put(c, { touch: false });
    } catch (e) { window.SlopUI.alert('Could not save to Slop Drive', e.message || String(e)); }
  };
  AI.openChatFromDrive = async function () {
    const hub = H(); if (!hub) return;
    const rec = await hub.pickFromDrive({ accept: ['application/json'], title: 'Open chat from Slop Drive' });
    if (!rec) return;
    try {
      const c = AI.fromJSON(await rec.blob.text());
      c.driveId = rec.id;
      await AI.db.put(c, { touch: false });
      AI.setTab('chat');
      if (c.kind === 'build') AI.openBuild(c.id); else AI.openConv(c.id);
    } catch (e) { window.SlopUI.alert('Could not open that chat', e.message || String(e)); }
  };
})(window.AI);
