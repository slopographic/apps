/* Slop Slides: the native file. A .sslide is the deck as JSON (mime application/x-slop-slides), media included.
   Reading turns what Slop Drive hands us into a deck: a zero-byte file of our type (what Drive's New menu makes)
   is a blank deck, an image becomes a one-picture slide, and anything else is reported as foreign so the editor
   never overwrites a file it could not read. Classic script; exposes window.SS.native. */
(function () {
  'use strict';
  var SS = window.SS, M = SS.model, U = SS.util;
  var N = SS.native = {};
  N.MIME = 'application/x-slop-slides';
  N.EXT = 'sslide';
  N.DEFAULT_NAME = 'Untitled presentation.sslide';

  N.blank = function (opts) { return M.newDeck(Object.assign({ title: 'Untitled presentation' }, opts || {})); };
  N.toBlob = function (deck) { return new Blob([JSON.stringify(deck)], { type: N.MIME }); };

  /** Validates and fills in a parsed deck (older or hand-made files may lack fields). Throws on a non-deck. */
  N.normalize = function (d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.slides) || !d.size) throw new Error('This is not a Slop Slides file');
    d.media = d.media || {};
    d.master = Object.assign({ footer: '', showNumber: false }, d.master);
    if (!d.theme || !d.theme.colors) d.theme = U.clone(SS.themes.byId(typeof d.theme === 'string' ? d.theme : 'slop'));
    d.slides.forEach(function (s) {
      s.objects = s.objects || [];
      s.builds = s.builds || [];
      s.notes = s.notes || '';
      s.hidden = !!s.hidden;
      s.transition = s.transition || { type: 'none', dur: 0.6 };
      s.layout = s.layout || 'blank';
    });
    if (!d.slides.length) M.addSlide(d, 'title');
    return d;
  };
  N.parse = function (text) {
    var d;
    try { d = JSON.parse(text); } catch (e) { throw new Error('This file is damaged and could not be read'); }
    return N.normalize(d);
  };

  /** A deck with one slide holding the picture, fitted and centred (for "Send to Slides" with an image). */
  N.fromImage = function (dataUrl, name) {
    var d = M.newDeck({ empty: true, title: (name || 'Picture').replace(/\.[^.]+$/, '') });
    var s = M.addSlide(d, 'blank');
    return new Promise(function (res) {
      var im = new Image();
      im.onload = im.onerror = function () {
        var iw = im.naturalWidth || 800, ih = im.naturalHeight || 600, k = Math.min(d.size.w * 0.9 / iw, d.size.h * 0.9 / ih, 1e9);
        var w = iw * k, h = ih * k;
        var o = SS.objects.make('image', { x: (d.size.w - w) / 2, y: (d.size.h - h) / 2, w: w, h: h, name: name || 'Picture', media: M.addMedia(d, dataUrl, name) });
        s.objects.push(o);
        res(d);
      };
      im.src = dataUrl;
    });
  };

  /**
   * Reads a Drive record's blob. Resolves with { deck, kind } where kind is 'deck' | 'blank' | 'image' | 'foreign'.
   * Rejects only when a native file is damaged (the caller then opens nothing over it).
   */
  N.read = async function (blob, type) {
    type = type || (blob && blob.type) || '';
    if (!blob || blob.size === 0) return { deck: N.blank(), kind: 'blank' };
    if (type === N.MIME || /json/.test(type)) return { deck: N.parse(await blob.text()), kind: 'deck' };
    if (/^image\//.test(type)) return { deck: await N.fromImage(await U.blobToDataUrl(blob), 'Picture'), kind: 'image' };
    return { deck: N.blank(), kind: 'foreign', type: type };
  };

  /** Plain file name for a deck title ("Gooey launch" → "Gooey launch.sslide"). */
  N.fileName = function (title) {
    var base = String(title || 'Untitled presentation').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();
    return (base || 'Untitled presentation') + '.' + N.EXT;
  };
})();
