/* Slop Watermark: the list of pictures in this visit. Each item: { id, file, name, type, url, w, h, group, out, error }.
 * group is the shape group from WMGroups.classify, worked out when the picture is added.
 * out = { blob, name } after Apply to all. The picture is read again when it is drawn, so the list keeps no decoded
 * pictures in memory (only object URLs). Classic script. Exposes window.WMItems. */
(function () {
  'use strict';
  const MAX = 500;
  const list = [];
  let seq = 0;

  /** Reads a picture into the list. Rejects with a reason when the list is full or the file cannot be read. */
  async function add(file) {
    if (list.length >= MAX) throw new Error('the list is full (' + MAX + ' pictures); clear some first');
    const type = window.WMDecode.typeOf(file);
    const url = URL.createObjectURL(file);
    try {
      const img = await window.WMDecode.loadPicture(url);
      const { w, h } = await window.WMDecode.sizeOf(img, file);
      const group = window.WMGroups.classify(w, h);
      const item = { id: 'wm' + (++seq), file, name: file.name, type, url, w, h, group, out: null, error: '' };
      list.push(item);
      return item;
    } catch (err) { URL.revokeObjectURL(url); throw err; }
  }
  function remove(id) {
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return;
    URL.revokeObjectURL(list[i].url);
    list.splice(i, 1);
  }
  function clear() { list.forEach((x) => URL.revokeObjectURL(x.url)); list.length = 0; }
  function setOut(id, out) { const x = get(id); if (x) { x.out = out; x.error = ''; } }
  function setError(id, msg) { const x = get(id); if (x) { x.out = null; x.error = msg; } }
  function clearOuts() { list.forEach((x) => { x.out = null; x.error = ''; }); }
  function get(id) { return list.find((x) => x.id === id) || null; }

  window.WMItems = {
    MAX, add, remove, clear, get, setOut, setError, clearOuts,
    all: () => list.slice(),
    first: () => list[0] || null,
    count: () => list.length,
    outCount: () => list.filter((x) => x.out).length,
  };
})();
