/* One icon per app, drawn as line art on a 48 × 48 grid (same style as the homepage tiles).
 * Classic script, exposes window.SLOP_ICONS: { <app id>: <svg inner markup> }. Keyed by the id in shared/apps.js.
 * Add an app: add one entry here. Apps with no entry fall back to their `icon` name, then to no icon. */
(function () {
  'use strict';
  window.SLOP_ICONS = Object.freeze({
    photoslop: '<path d="M14 34c4 0 7-3 7-7l-4-4c-4 0-7 3-7 7 0 2-1 3-3 4 2 0 5 0 7 0z"/><path d="M19 25 36 8l4 4-17 17"/>',
    vector: '<path d="M8 38C14 14 34 34 40 10"/><circle cx="8" cy="38" r="3"/><circle cx="40" cy="10" r="3"/><circle cx="24" cy="24" r="3"/>',
    pdf: '<path d="M12 6h17l9 9v27H12z"/><path d="M29 6v9h9"/><path d="M16 32h4a3 3 0 0 0 0-6h-4v10M26 26h3a4 4 0 0 1 0 8h-3zM34 36v-10h4"/>',
    label: '<path d="M6 8h18l18 18-16 16L8 24z"/><circle cx="15" cy="16" r="3"/>',
    cutout: '<rect x="6" y="6" width="36" height="36" rx="3" stroke-dasharray="4 3"/><circle cx="24" cy="18" r="5"/><path d="M15 38c0-6 4-10 9-10s9 4 9 10"/>',
    clean: '<path d="M24 6 8 12v12c0 10 7 17 16 18 9-1 16-8 16-18V12z"/><path d="m17 24 5 5 9-10"/>',
    ai: '<path d="M24 6l4 12 12 4-12 4-4 12-4-12-12-4 12-4z"/><path d="M38 6v6M35 9h6"/>',
    docs: '<path d="M12 6h17l9 9v27H12z"/><path d="M29 6v9h9M17 24h14M17 30h14M17 36h9"/>',
    tables: '<rect x="6" y="8" width="36" height="32" rx="2"/><path d="M6 17h36M6 26h36M6 33h36M17 8v32M29 8v32"/>',
    slides: '<rect x="6" y="8" width="36" height="24" rx="2"/><path d="M24 32v8M16 42h16M13 16h14M13 22h20"/>',
    press: '<rect x="6" y="8" width="36" height="32" rx="2"/><path d="M12 14h10v8H12zM26 14h10M26 20h10M26 26h10M12 28h24M12 34h24"/>',
    remix: '<path d="M10 20a14 14 0 0 1 26-6M38 28a14 14 0 0 1-26 6"/><path d="M36 8v6h-6M12 40v-6h6"/>',
    slopedit: '<rect x="6" y="10" width="36" height="28" rx="3"/><path d="M6 17h36M6 31h36M13 10v7M21 10v7M29 10v7M37 10v7M13 31v7M21 31v7M29 31v7M37 31v7"/><path d="m21 21 7 3-7 3z"/>',
    contacts: '<rect x="6" y="10" width="36" height="28" rx="3"/><circle cx="18" cy="22" r="4"/><path d="M11 33c1-4 4-6 7-6s6 2 7 6M29 19h8M29 25h8M29 31h5"/>',
    inventory: '<path d="M6 16 24 8l18 8v18L24 42 6 34z"/><path d="M6 16l18 8 18-8M24 24v18"/>',
    orders: '<rect x="10" y="8" width="28" height="34" rx="2"/><path d="M18 8V5h12v3M17 22l4 4 8-8M17 34h14"/>',
    invoices: '<path d="M12 6h24v36l-4-3-4 3-4-3-4 3-4-3-4 3z"/><path d="M18 16h12M18 22h12M18 28h6"/>',
    notes: '<path d="M10 6h28v36H10z"/><path d="M16 16h16M16 22h16M16 28h10"/><path d="M32 40l8-8-3-3-8 8z"/>',
    paste: '<rect x="10" y="10" width="28" height="34" rx="2"/><path d="M18 10V7h12v3M16 22h16M16 28h16M16 34h10"/>',
    convert: '<path d="M8 16h28l-6-6M40 32H12l6 6"/>',
    crm: '<circle cx="17" cy="16" r="5"/><circle cx="31" cy="16" r="5"/><path d="M6 38c1-7 5-10 11-10s10 3 11 10M24 38c1-7 5-10 11-10s8 3 7 10"/>',
    ledger: '<path d="M10 6h26v36H10z"/><path d="M10 6v36M20 12v24M28 12v24M16 16h-2M16 22h-2"/><path d="M24 15h9M24 21h9M24 27h9M24 33h9"/>',
    admin: '<circle cx="24" cy="24" r="6"/><path d="M24 6v6M24 36v6M6 24h6M36 24h6M11 11l4 4M33 33l4 4M37 11l-4 4M15 33l-4 4"/><circle cx="24" cy="24" r="14"/>',
    drive: '<path d="M6 12h13l4 5h19v21H6z"/><path d="M6 20h36"/>',
    code: '<path d="M16 14 6 24l10 10M32 14l10 10-10 10M27 10l-6 28"/>',
    gallery: '<rect x="12" y="6" width="30" height="26" rx="2"/><path d="M6 14v26h30"/><path d="M14 26l7-8 6 6 4-4 9 9"/><circle cx="32" cy="14" r="2"/>',
    '3d': '<path d="M24 6l16 9v18l-16 9-16-9V15z"/><path d="M8 15l16 9 16-9M24 24v18"/>',
    music: '<path d="M18 34V10l20-4v24"/><circle cx="13" cy="34" r="5"/><circle cx="33" cy="30" r="5"/>',
    authenticator: '<rect x="14" y="6" width="20" height="36" rx="3"/><path d="M22 36h4M20 14h8"/><path d="M19 24l3 3 6-6"/>',
    'paint-classic': '<path d="M24 6c-10 0-18 7-18 16 0 7 6 8 9 6 3-2 1 6 6 6 9 0 15-6 15-14 0-7-6-14-12-14z"/><circle cx="16" cy="18" r="2.5"/><circle cx="24" cy="14" r="2.5"/><circle cx="32" cy="18" r="2.5"/>',
  });
})();
