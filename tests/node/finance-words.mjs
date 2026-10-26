// The English words of the finance readers' warnings (shared/i18n/ui/en/data2.js, keys ui.fin.*) on this Node global,
// as a page has them: shared/finance/text.js say() reads globalThis.SlopI18n. Import it first. Not a test file itself.
import vm from 'node:vm';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const I18N = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'shared', 'i18n');
const run = (f) => vm.runInThisContext(`(function (window) {${readFileSync(path.join(I18N, f), 'utf8')}\n})(globalThis);`, { filename: f });
if (!globalThis.SlopI18n) {
  run('i18n.js');
  globalThis.SlopI18n = globalThis.SlopI18n.create({ defaultLang: 'en', profile: null });   // English in any build
  for (const f of ['ui/en.js', 'ui/en/data2.js']) run(f);
}

/** Runs fn with Swedish chosen (shared/i18n/ui/sv/data2.js), then puts the English instance back. */
export function inSwedish(fn) {
  const en = globalThis.SlopI18n;
  globalThis.SlopI18n = en.create({ defaultLang: 'sv', profile: null });
  try {
    for (const f of ['ui/en.js', 'ui/en/data2.js', 'ui/sv.js', 'ui/sv/data2.js']) run(f);
    return fn();
  } finally { globalThis.SlopI18n = en; }
}
