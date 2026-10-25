# Slop Colors (colors/)

A colour picker, palette maker and contrast checker. Pictures and palette files are read in the browser; nothing is
uploaded. Registry id `colors` (shared/apps.js), group creative.

## Layout

The suite's View · Panel (shared/frame, SlopFrame; no list). The view: the current colour with Copy for HEX, RGB, HSL,
OKLCH and CMYK; Pick from a picture (canvas eyedropper with a magnifier, the picture's main colours, the drop zone); the
Palette; Made from this colour (harmony, scale, 50–950 ramp); the Contrast check. The panel: Colour (native picker and
the five fields), Made from it, Picture (colours to find), Export (name, format); its foot: Download palette (primary),
Save to Slop Drive…, Copy code, Open in…. Phones (≤ 860 px): the panel is a bottom sheet whose foot always shows.

## Files

| File | What |
|---|---|
| `js/core/convert.js` | HEX ↔ RGB, HSL, OKLab/OKLCH (gamut mapped into sRGB by chroma), CMYK; `parse` any of them; `format`. Every HEX round trips through every format. |
| `js/core/harmony.js` | harmonies (HSL wheel), tints/shades/tones, the OKLCH ramp, `suggest` (nearest colour that reaches a contrast). |
| `js/core/kmeans.js` | seeded k-means++ in OKLab on sampled pixels; means in RGB so a flat block gives its exact colour. |
| `js/core/formats.js`, `js/core/ase.js` | CSS variables, Tailwind config, JSON, GIMP .gpl, Adobe .ase (RGB written; RGB, CMYK, Lab, Gray read). |
| `../shared/color/contrast.js` | the site's one copy of the WCAG maths (also used by tests/a11y/contrast.js and tests/node/theme-contrast.test.mjs). |
| `js/state.js` | the one state (current, palette, fg/bg, panel choices), kept in localStorage `slop-colors`. |
| `js/swatches.js`, `js/picture.js`, `js/contrast-ui.js`, `js/panel.js`, `js/io.js`, `js/main.js` | the page. |
| `js/commands.js`, `js/ai-commands.js` | Ctrl+K commands; the assistant's commands with schemas (loaded on demand). |
| `../shared/ops/colors.js` | the operation `colors.palette` (a picture → a palette file) for Workflows and the AI panel. |

Core modules are UMD factories: in a page they attach to `window.SlopColors` (load `shared/color/model.js` and
`shared/color/contrast.js` first); in Node they export the factory (tests/node/colors-env.mjs wires them).

## In and out

In: spec `colors` (js/io.js): pictures go to the eyedropper; `.gpl`, `.ase`, `.json`, `.css` become the palette. Sources:
Open… (header), Open picture… (card), the drop zone and the picture, paste, ?drive= and launchQueue, the sample photo.
`colors/` is in rule 4's STRICT list. Out: SlopUI.download, SlopHub.put, SlopOuttake.items.

## Tests

Node: `tests/node/colors-core.test.mjs`, `tests/node/colors-files.test.mjs`. Browser: `tests/colors/app.test.html`
(blocks picture → its four colours, eyedropper by pointer and keys, fields, rows, contrast, every format back through the
intake, Drive, reload), `tests/colors/ai-commands.test.html`, `tests/colors/op.test.html`, `tests/colors/look.test.html`,
`tests/intake/colors.test.html`, contrast sweep `tests/a11y/sweep-39.test.html`.

## Limits

CMYK is the naive formula (no ICC profile). No colour blindness preview yet. The EyeDropper (pick from screen) exists
only in Chromium browsers; the button hides elsewhere. tests/harness.js keeps its own small `contrast()` helper (older
0.03928 threshold) because every test page loads it without shared/color/contrast.js.
