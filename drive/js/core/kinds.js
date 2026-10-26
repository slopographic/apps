/* Slop Drive — core/kinds: what kind of file is this? Used for icons, filters, colours and previews. */
'use strict';
(function (DR) {
  const KINDS = [
    { id: 'folder', label: 'Folders', one: 'Folder', color: '#8f8a7e' },
    { id: 'image', label: 'Images', one: 'Image', color: '#d4ff3a' },
    { id: 'design', label: 'Design files', one: 'Design file', color: '#a86bff' },
    { id: 'model', label: '3D scenes', one: '3D scene', color: '#ff7ad9' },
    { id: 'doc', label: 'Slop documents', one: 'Slop document', color: '#7fb0ff' },
    { id: 'pdf', label: 'PDFs', one: 'PDF', color: '#ff5a6e' },
    { id: 'text', label: 'Text & data', one: 'Text', color: '#5cc8ff' },
    { id: 'audio', label: 'Audio', one: 'Audio', color: '#ffa23a' },
    { id: 'video', label: 'Video', one: 'Video', color: '#5fe0b0' },
    { id: 'archive', label: 'Archives', one: 'Archive', color: '#ffd23f' },
    { id: 'other', label: 'Other', one: 'File', color: '#9fb0d0' },
  ];
  const BY = Object.fromEntries(KINDS.map((k) => [k.id, k]));
  const ext = (name) => { const m = /\.([a-z0-9]{1,8})$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; };
  const TEXT_EXT = ['txt', 'md', 'csv', 'tsv', 'json', 'xml', 'html', 'htm', 'css', 'js', 'mjs', 'ts', 'zpl', 'prn', 'log', 'ini', 'yaml', 'yml', 'sloplabel'];
  const DESIGN_EXT = ['psd', 'ora', 'ai', 'eps', 'sketch', 'fig', 'xcf', 'kra'];
  const ARCH_EXT = ['zip', '7z', 'rar', 'tar', 'gz', 'tgz'];
  /** The backup ZIP's extension without the dot (SlopBackup.EXT, shared/backup/index.js), '' where that is not loaded. */
  const backupExt = () => ((typeof window !== 'undefined' && window.SlopBackup && window.SlopBackup.EXT) || '').slice(1).toLowerCase();
  /** Slop's own native files (JSON): documents, sheets, slides and invoices. Each app's colour, for the cards. */
  const DOC_COLOR = { sdoc: '#4f8cff', stab: '#3fbf7f', sslide: '#ff8a3d', sinv: '#e0b43c' };
  /** Kind id of a file record (or folder). */
  function kindOf(r) {
    if (!r) return 'other';
    if (r.isFolder) return 'folder';
    const t = (r.type || '').toLowerCase(), e = ext(r.name);
    if (e === 's3d' || t === 'application/x-slop-3d') return 'model';
    if (DOC_COLOR[e] || /x-slop-(doc|table|slides|invoice)/.test(t)) return 'doc';
    if (t === 'image/vnd.adobe.photoshop' || t === 'application/x-openraster' || DESIGN_EXT.includes(e)) return 'design';
    if (t.startsWith('image/')) return 'image';
    if (t === 'application/pdf' || e === 'pdf') return 'pdf';
    if (t.startsWith('audio/')) return 'audio';
    if (t.startsWith('video/')) return 'video';
    if (/zip|x-tar|gzip|x-7z|x-rar|slopographic-backup/.test(t) || ARCH_EXT.includes(e) || e === backupExt()) return 'archive';
    if (t.startsWith('text/') || /json|xml|javascript|csv|yaml/.test(t) || TEXT_EXT.includes(e)) return 'text';
    // Images, audio and video by name or MIME type, from the shared kind table (shared/kinds/kinds.js) that every app uses.
    const shared = window.SlopKinds ? window.SlopKinds.kindOf(r.name, r.type) : 'other';
    return shared === 'image' || shared === 'audio' || shared === 'video' ? shared : 'other';
  }
  const isSvg = (r) => /svg/.test(r.type || '') || ext(r.name) === 'svg';
  /** Adobe Illustrator files (.ai): a design file whose preview is the PDF page inside them (core/pdf.js). */
  const isAi = (r) => !!r && !r.isFolder && ext(r.name) === 'ai';
  /** Short label like "PNG image" or "PDF". */
  function kindLabel(r) {
    if (r.isFolder) return 'Folder';
    const k = BY[kindOf(r)], e = ext(r.name).toUpperCase();
    if (k.id === 'pdf') return 'PDF document';
    if (isAi(r)) return 'Illustrator design file';
    if (k.id === 'other') return e ? e + ' file' : 'File';
    return (e ? e + ' ' : '') + k.one.toLowerCase();
  }
  /** Best MIME type for a file the browser gave us with no type. */
  function guessType(name, type) {
    const e = ext(name);
    if (e === 'ai') return 'application/illustrator'; // browsers give .ai files all sorts of MIME types, or none
    if (type) return type;
    return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif',
      pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', html: 'text/html', css: 'text/css', js: 'text/javascript',
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', zip: 'application/zip',
      psd: 'image/vnd.adobe.photoshop', ora: 'application/x-openraster', slop: 'application/x-slopographic-backup', s3d: 'application/x-slop-3d', sdoc: 'application/x-slop-doc', stab: 'application/x-slop-table', sslide: 'application/x-slop-slides', sinv: 'application/x-slop-invoice', zpl: 'text/plain', sloplabel: 'application/json' })[e] || 'application/octet-stream';
  }
  DR.KINDS = KINDS; DR.KIND = BY; DR.kindOf = kindOf; DR.kindLabel = kindLabel; DR.ext = ext; DR.isSvg = isSvg; DR.guessType = guessType; DR.isAi = isAi;
  DR.kindColor = (r) => (kindOf(r) === 'doc' && DOC_COLOR[ext(r.name)]) || BY[kindOf(r)].color;
})(window.DR);
