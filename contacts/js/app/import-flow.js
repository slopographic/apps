/* Slop Contacts: one import from files (dropped or chosen). CSV files go through the column mapping first, then every
 * file's contacts go to the preview together. A cancelled mapping imports nothing. Adds SlopContacts.importFlow.run(files). */
(function () {
  'use strict';
  const SC = window.SlopContacts;
  const UI = window.SlopUI;

  /** Reads the files and shows the preview. Resolves with true when contacts were imported. */
  async function run(files) {
    const parts = [], names = [], errors = [];
    for (const f of files) {
      try {
        const r = await SC.importPlan.readFile(f);
        if (r.kind === 'csv') {
          const contacts = await SC.importMap.dialog(r.name, r);
          if (contacts === null) return false;
          parts.push(...contacts);
        } else parts.push(...r.contacts);
        names.push(r.name);
      } catch (e) {
        errors.push(`${(f && f.name) || 'A file'}: ${e.message}.`);
      }
    }
    if (!parts.length) {
      UI.alert('Nothing to import', errors.join(' ') || 'No contacts were found in those files.');
      return false;
    }
    return SC.importPreview.show(parts, names.length === 1 ? names[0] : `${names.length} files`, errors);
  }

  SC.importFlow = { run };
})();
