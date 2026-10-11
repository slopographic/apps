/* Slop Slides: the template dialogs. "New from template" lists the starter templates and "My templates" (each with a
   preview of its first slide, Export and Delete), and imports a .sslide-template from a file or from Slop Drive.
   "Save as template" keeps the whole deck or the current slide. An import is validated first: a bad file shows the
   reason in a SlopUI dialog and changes nothing. Exposes window.SS.templatesUI. */
(function () {
  'use strict';
  var SS = window.SS, A = SS.app, D = SS.dom, TF = SS.templateFile, S = SS.templateStore, U = SS.util;
  var TU = SS.templatesUI = {};
  var el = function () { return SlopUI.el.apply(null, arguments); };
  var previews = {};   // starter template id -> preview data URL (built once per page)
  function toast(msg, ms) { if (window.SlopUI) SlopUI.toast(msg, ms); else D.toast(msg, ms); }

  function starterPreview(t) {
    if (!(t.id in previews)) { try { previews[t.id] = TF.preview(t.build()); } catch (e) { previews[t.id] = null; } }
    return previews[t.id];
  }
  function card(name, sub, preview, pick, acts) {
    return el('div', { class: 'tpl-card' },
      el('button', { type: 'button', class: 'tpl-pick', onclick: pick, title: 'New presentation from ' + name },
        preview ? el('img', { class: 'tpl-img', src: preview, alt: 'First slide of ' + name }) : el('span', { class: 'tpl-img tpl-none' }),
        el('span', { class: 'tpl-name' }, name),
        el('span', { class: 'tpl-sub' }, sub)),
      acts ? el('div', { class: 'tpl-acts' }, acts) : null);
  }
  function fillBody(body, dlg, onChange) {
    body.replaceChildren();
    body.append(el('h3', { class: 'tpl-h' }, 'Starter templates'),
      el('div', { class: 'tpl-grid' }, SS.templates.list.map(function (t) {
        return card(t.name, 'Starter', starterPreview(t), function () { dlg.close(true); SS.files.fromTemplate(t.id); });
      })));
    var mine = el('div', { class: 'tpl-mine' }, el('h3', { class: 'tpl-h' }, 'My templates'));
    body.append(mine);
    S.list().then(function (recs) {
      if (!recs.length) { mine.append(el('p', { class: 'tpl-note' }, 'None yet. Use File > Save as template… to keep a deck or one slide here.')); return; }
      mine.append(el('div', { class: 'tpl-grid' }, recs.map(function (r) {
        var acts = [
          el('button', { type: 'button', class: 'sui-btn', onclick: function () { TU.exportFile(r); } }, 'Export'),
          el('button', { type: 'button', class: 'sui-btn sui-danger', onclick: async function () {
            var ok = await SlopUI.confirm('Delete “' + r.name + '”?', 'It is removed from this browser and its copy in the Templates folder of Slop Drive.', 'Delete', { danger: true });
            if (ok) { await S.remove(r.id); toast('Template deleted'); onChange(); }
          } }, 'Delete')];
        return card(r.name, r.slides + (r.slides === 1 ? ' slide' : ' slides'), r.preview, function () { dlg.close(true); SS.files.fromStored(r); }, acts);
      })));
    });
  }

  /** The "New from template" dialog. */
  TU.openNew = function () {
    var body = el('div', { class: 'tpl-body' });
    var dlg = SlopUI.dialog({ title: 'New from template', cls: 'tpl-dlg', body: body, buttons: [
      { label: 'Import file…', act: async function () { var rec = await TU.importFile(); if (rec) fillBody(body, dlg, render); return false; } },
      { label: 'Import from Slop Drive…', act: async function () { var rec = await TU.importDrive(); if (rec) fillBody(body, dlg, render); return false; } },
      { label: 'Close', primary: true }] });
    function render() { fillBody(body, dlg, render); }
    fillBody(body, dlg, render);
    return dlg;
  };

  /** The "Save as template" dialog: a name, and the whole presentation or only the current slide. */
  TU.openSave = function () {
    if (!A.deck) return null;
    var name = el('input', { class: 'sui-input', type: 'text', value: A.deck.title, maxlength: 80, 'aria-label': 'Template name' });
    var scope = SlopUI.select([['deck', 'Whole presentation (' + A.deck.slides.length + (A.deck.slides.length === 1 ? ' slide)' : ' slides)')],
      ['slide', 'Current slide only (slide ' + (A.idx + 1) + ')']], 'deck');
    var body = el('div', { class: 'tpl-save' }, SlopUI.field('Name', name), SlopUI.field('Keep', scope));
    return SlopUI.dialog({ title: 'Save as template', body: body, buttons: [{ label: 'Cancel' }, { label: 'Save template', primary: true, act: async function () {
      var n = name.value.trim();
      if (!n) { name.focus(); return false; }
      try { await TU.saveTemplate({ name: n, slideIndex: scope.value === 'slide' ? A.idx : null }); }
      catch (e) { SlopUI.alert('The template was not saved', e.message); return false; }
    } }] });
  };

  /** Keeps the current deck (or one slide) as a template. Validated the same way an import is. Resolves with the record. */
  TU.saveTemplate = async function (opts) {
    var file = TF.fromDeck(A.deck, opts);
    var checked = TF.parse(TF.toText(file));   // the file must pass the import check before it is kept
    var rec = await S.add(TF.wrap(checked.name, checked.deck), TF.preview(checked.deck));
    toast(rec.driveError ? 'Saved to My templates on this device. The Slop Drive copy failed.' : 'Saved “' + rec.name + '” to My templates and Slop Drive', 3600);
    return rec;
  };

  /** A record as file text (the same envelope the import reads). */
  TU.exportText = function (rec) { var f = TF.wrap(rec.name, rec.deck); f.created = rec.created; return TF.toText(f); };
  TU.exportFile = function (rec) {
    U.download(new Blob([TU.exportText(rec)], { type: TF.MIME }), TF.fileName(rec.name));
    toast('Downloaded ' + TF.fileName(rec.name));
  };

  /**
   * Validates template text and keeps it in My templates. On failure shows the reason in a dialog and changes nothing
   * (nothing is written before the check passes). Resolves with the new record, or null.
   */
  TU.importText = async function (text) {
    var parsed;
    try { parsed = TF.parse(text); }
    catch (e) { SlopUI.alert('This template was not added', e.message); return null; }
    try {
      var rec = await S.add(TF.wrap(parsed.name, parsed.deck), TF.preview(parsed.deck));
      toast(rec.driveError ? 'Added “' + rec.name + '” on this device. The Slop Drive copy failed.' : 'Added “' + rec.name + '” to My templates', 3600);
      return rec;
    } catch (e) { SlopUI.alert('The template was not added', e.message); return null; }
  };
  /** Picks a .sslide-template file from this computer and imports it. */
  TU.importFile = async function () {
    var files = await SlopUI.pickFiles({ accept: '.' + TF.EXT + ',application/json' });
    var f = files && files[0];
    if (!f) return null;
    var text;
    try { text = await f.text(); } catch (e) { SlopUI.alert('This template was not added', 'The file could not be read'); return null; }
    return TU.importText(text);
  };
  /** Picks a template from Slop Drive and imports it. */
  TU.importDrive = async function () {
    var hub = window.SlopHub;
    if (!hub) { toast('Slop Drive is not available'); return null; }
    var pick = await hub.pickFromDrive({ accept: [TF.MIME, 'application/json'], title: 'Import a template from Slop Drive' });
    if (!pick) return null;
    var full = pick.blob !== undefined ? pick : await hub.get(pick.id);
    if (!full || !full.blob) { toast('That file is no longer in Slop Drive'); return null; }
    return TU.importText(await full.blob.text());
  };
})();
