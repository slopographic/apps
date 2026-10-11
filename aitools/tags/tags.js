/* Auto tags page: a photo in, suggested tags out (MobileNetV3, ImageNet labels, in the inference worker). The person
 * accepts or edits them. Saving writes meta.tags on the photo's Slop Drive record through shared/tags (SlopTags).
 * An uploaded photo is put in Slop Drive only when the tags are saved, never just to get suggestions. */
(function () {
  'use strict';
  const T = window.SlopAITools, $ = (id) => document.getElementById(id), TAGS = window.SlopTags;
  let photo = null;          // { blob, name, driveId } for the picture on the page
  let suggestions = [];

  /** Suggestions as toggle buttons: a tap adds the tag to the text box, or removes it. */
  function renderSuggestions() {
    const box = $('sugg'); box.replaceChildren();
    for (const s of suggestions) {
      const b = document.createElement('button'), tag = TAGS.norm(s.label), on = TAGS.parse($('tagText').value).includes(tag);
      b.type = 'button'; b.textContent = `${tag} ${Math.round(s.p * 100)}%`; b.setAttribute('aria-pressed', on ? 'true' : 'false');
      b.addEventListener('click', () => {
        const cur = TAGS.parse($('tagText').value);
        $('tagText').value = (cur.includes(tag) ? TAGS.withoutTag(cur, tag) : TAGS.withAdded(cur, [tag])).join(', ');
        renderSuggestions();
      });
      box.append(b);
    }
  }
  function showPhoto(blob, name, driveId, text) {
    photo = { blob, name, driveId };
    const img = $('pic');
    if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(blob); img.hidden = false;
    suggestions = []; renderSuggestions();
    $('run').disabled = false; $('save').disabled = false;
    $('msg').textContent = text;
  }
  async function suggest() {
    if (!photo) return;
    $('run').disabled = true; $('msg').textContent = 'Reading the picture…';
    try {
      await T.ensure('mobilenetv3-l100', (s) => ($('msg').textContent = s));
      const img = await T.image(photo.blob);
      const r = await T.call('classify', { bitmap: img.bitmap, w: img.w, h: img.h }, { transfer: [img.bitmap] });
      suggestions = r.tags.filter((t) => t.p >= 0.02);
      renderSuggestions();
      $('msg').textContent = suggestions.length ? 'Tap a suggestion to accept it, or edit the text. Then save.' : 'Nothing confident enough. Type your own tags.';
    } catch (e) { $('msg').textContent = 'Could not suggest tags: ' + e.message; }
    finally { $('run').disabled = false; }
  }
  /** Saves the tags: onto the Drive record of a picked photo, or a new Drive record for an upload. */
  async function save() {
    if (!photo) return;
    const H = window.SlopHub;
    if (!H) { $('msg').textContent = 'Slop Drive is not available here, so tags cannot be saved.'; return; }
    const tags = TAGS.parse($('tagText').value);
    try {
      if (photo.driveId) {
        const rec = await H.get(photo.driveId);
        await H.update(photo.driveId, { meta: Object.assign({}, rec.meta || {}, { tags }) }, { touch: false });
      } else {
        photo.driveId = await T.toDrive(photo.name, photo.blob, 'ai-tags', { tags });
      }
      $('msg').textContent = `Saved ${tags.length} tag${tags.length === 1 ? '' : 's'} to ${photo.name} in Slop Drive.`;
    } catch (e) { $('msg').textContent = 'Could not save the tags: ' + e.message; }
  }
  function pick(f) {
    if (!f || !/^image\//.test(f.type)) { $('msg').textContent = 'Choose an image file.'; return; }
    $('tagText').value = '';
    showPhoto(f, f.name, null, 'Press Suggest tags. Saving puts the photo in Slop Drive with its tags.');
  }
  async function listDrive() {
    const box = $('driveList'); box.replaceChildren(); box.hidden = false;
    const rows = (await window.SlopHub.list()).filter((r) => !r.isFolder && /^image\//.test(r.type || '')).slice(0, 40);
    if (!rows.length) { box.textContent = 'No photos in Slop Drive yet.'; return; }
    for (const r of rows) {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = r.name;
      b.addEventListener('click', async () => {
        const rec = await window.SlopHub.get(r.id);
        box.hidden = true;
        $('tagText').value = TAGS.of(rec).join(', ');
        showPhoto(rec.blob, r.name, r.id, `${r.name} from Slop Drive. Press Suggest tags.`);
      });
      box.append(b);
    }
  }
  $('file').addEventListener('change', (e) => pick(e.target.files[0]));
  $('drop').addEventListener('dragover', (e) => e.preventDefault());
  $('drop').addEventListener('drop', (e) => { e.preventDefault(); pick(e.dataTransfer.files[0]); });
  $('pickDrive').addEventListener('click', () => (window.SlopHub ? listDrive() : null));
  $('run').addEventListener('click', suggest);
  $('save').addEventListener('click', save);
  T.gate('tags', () => { $('ui').hidden = false; });
})();
