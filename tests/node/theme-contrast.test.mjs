// SlopTheme: the --sl-border token of every theme reaches WCAG 3:1 against its surface (non-text UI boundaries that
// identify an input, a button or a panel edge). Run: node --test tests/node/theme-contrast.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadInto, plain } from './fx-env.mjs';

const lum = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

test('every theme border reaches 3:1 against its surface (WCAG 1.4.11)', async () => {
  const ctx = await loadInto(['profile/profile.js', 'theme/theme.js'], {
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  });
  for (const t of plain(ctx.SlopTheme.THEMES)) {
    const r = ratio(t.tokens.border, t.tokens.surface);
    assert.ok(r >= 3, `${t.id}: border ${t.tokens.border} on surface ${t.tokens.surface} is ${r.toFixed(2)}:1, need 3:1`);
  }
});

test('the contrast helper matches known values (black on white is 21:1)', () => {
  assert.equal(Math.round(ratio('#000000', '#ffffff')), 21);
  assert.equal(ratio('#777777', '#777777'), 1);
});
