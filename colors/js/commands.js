/* Slop Colors: SlopCmd commands (Ctrl+K and the shortcut editor) for the page's own actions, and the assistant's commands
 * with arguments (ai-commands.js), loaded by SlopCmd.prepare() when the AI panel (or WebMCP, a macro) first asks, after
 * shared/commands/sources.js. Classic script, after main.js. */
(function (g) {
  'use strict';
  const HERE = (document.currentScript && document.currentScript.src) || location.href;
  const load = (src) => new Promise((res, rej) => {
    const s = Object.assign(document.createElement('script'), { src: new URL(src, HERE).href });
    s.onload = () => res(); s.onerror = () => rej(new Error('Could not load ' + src)); document.head.append(s);
  });
  function init() {
    const C = g.SlopCmd, CO = g.CO;
    if (!C || !CO || !CO.state) return;
    C.init({ app: 'colors' });
    const has = () => CO.state.get().palette.colors.length > 0;
    const safe = (fn) => () => Promise.resolve().then(fn).catch((e) => g.SlopUI.toast(e.message));
    C.register([
      { id: 'colors.open', title: 'Open a picture or palette…', group: 'File', keywords: ['image', 'photo', 'gpl', 'ase', 'import'], run: () => g.SlopIntake.pick({ to: 'colors' }) },
      { id: 'colors.download', title: 'Download the palette', group: 'File', keywords: ['export', 'css', 'tailwind', 'json', 'ase', 'gpl'], when: has, run: safe(() => CO.io.download()) },
      { id: 'colors.drive', title: 'Save the palette to Slop Drive', group: 'File', when: has, run: safe(() => CO.io.saveToDrive()) },
      { id: 'colors.copy', title: 'Copy the palette as code', group: 'Edit', when: has, run: safe(() => CO.io.copyCode()) },
      { id: 'colors.add', title: 'Add the colour to the palette', group: 'Palette', keywords: ['swatch', 'save colour'], run: safe(() => CO.state.addColor(CO.state.get().current)) },
      { id: 'colors.clear', title: 'Clear the palette', group: 'Palette', when: has, run: () => CO.state.set({ palette: { name: CO.state.get().palette.name, colors: [] } }) },
      { id: 'colors.harmony', title: 'Use the harmony as the palette', group: 'Palette', keywords: ['complementary', 'triadic', 'analogous'], run: () => CO.swatches.usePalette('harmony') },
      { id: 'colors.ramp', title: 'Use the 50–950 ramp as the palette', group: 'Palette', keywords: ['tailwind', 'shades', 'scale'], run: () => CO.swatches.usePalette('ramp') },
      { id: 'colors.swap', title: 'Swap text and background', group: 'Contrast', keywords: ['contrast', 'wcag'], run: () => CO.contrast.swap() },
      { id: 'colors.fix', title: 'Fix the text colour (reach AA)', group: 'Contrast', keywords: ['contrast', 'wcag', 'accessible'], run: safe(() => CO.contrast.fix()) },
      { id: 'colors.screen', title: 'Pick a colour from the screen', group: 'Colour', keywords: ['eyedropper', 'picker'], when: () => typeof g.EyeDropper === 'function', run: safe(() => CO.picture.pickScreen()) },
    ]);
    C.provide({
      prepare: () => (g.SlopCmdSources ? Promise.resolve() : load('../../shared/commands/sources.js')).then(() => (C.get('colors.ai.new-palette') ? null : load('ai-commands.js'))),
      state: () => {
        const s = CO.state.get(), c = CO.contrast.check(s.fg, s.bg);
        return { app: 'Slop Colors', current: g.SlopColors.convert.all(s.current), palette: s.palette, contrast: { fg: s.fg, bg: s.bg, ratio: c.ratio, levels: c.levels },
          picture: CO.picture.info(), pictureColors: CO.picture.colors().map((d) => d.hex), format: s.format };
      },
      checkpoint: () => { const snap = CO.state.snapshot(); return () => CO.state.restore(snap); },
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window);
