/* Slop Drive — core/kinds: what kind of file is this? Used for icons, filters, colours and previews. */
'use strict';
(function (DR) {
  const KINDS = [
    { id: 'folder', label: 'Folders', one: 'Folder', color: '#8f8a7e' },
    { id: 'image', label: 'Images', one: 'Image', color: '#d4ff3a' },
    { id: 'design', label: 'Design files', one: 'Design file', color: '#a86bff' },
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
  const ARCH_EXT = ['zip', 'slop', '7z', 'rar', 'tar', 'gz', 'tgz'];
  /** Kind id of a file record (or folder). */
  function kindOf(r) {
    if (!r) return 'other';
    if (r.isFolder) return 'folder';
    const t = (r.type || '').toLowerCase(), e = ext(r.name);
    if (t === 'image/vnd.adobe.photoshop' || t === 'application/x-openraster' || DESIGN_EXT.includes(e)) return 'design';
    if (t.startsWith('image/')) return 'image';
    if (t === 'application/pdf' || e === 'pdf') return 'pdf';
    if (t.startsWith('audio/')) return 'audio';
    if (t.startsWith('video/')) return 'video';
    if (/zip|x-tar|gzip|x-7z|x-rar|slopographic-backup/.test(t) || ARCH_EXT.includes(e)) return 'archive';
    if (t.startsWith('text/') || /json|xml|javascript|csv|yaml/.test(t) || TEXT_EXT.includes(e)) return 'text';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'].includes(e)) return 'image';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(e)) return 'audio';
    if (['mp4', 'webm', 'mov', 'mkv'].includes(e)) return 'video';
    return 'other';
  }
  const isSvg = (r) => /svg/.test(r.type || '') || ext(r.name) === 'svg';
  /** Short label like "PNG image" or "PDF". */
  function kindLabel(r) {
    if (r.isFolder) return 'Folder';
    const k = BY[kindOf(r)], e = ext(r.name).toUpperCase();
    if (k.id === 'pdf') return 'PDF document';
    if (k.id === 'other') return e ? e + ' file' : 'File';
    return (e ? e + ' ' : '') + k.one.toLowerCase();
  }
  /** Best MIME type for a file the browser gave us with no type. */
  function guessType(name, type) {
    if (type) return type;
    const e = ext(name);
    return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', bmp: 'image/bmp', avif: 'image/avif',
      pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', csv: 'text/csv', tsv: 'text/tab-separated-values', json: 'application/json', html: 'text/html', css: 'text/css', js: 'text/javascript',
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', zip: 'application/zip',
      psd: 'image/vnd.adobe.photoshop', ora: 'application/x-openraster', slop: 'application/x-slopographic-backup', zpl: 'text/plain', sloplabel: 'application/json' })[e] || 'application/octet-stream';
  }
  DR.KINDS = KINDS; DR.KIND = BY; DR.kindOf = kindOf; DR.kindLabel = kindLabel; DR.ext = ext; DR.isSvg = isSvg; DR.guessType = guessType;
  DR.kindColor = (r) => BY[kindOf(r)].color;
})(window.DR);
