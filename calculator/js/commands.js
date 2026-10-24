/* Slopculator commands for SlopCmd (the palette, shortcut editor and menu labels). Classic script, loaded after
 * shared/commands/commands.js. Every command calls window.SlopCalcApp, so the palette and the buttons do the same work. */
(function () {
  'use strict';
  const A = () => window.SlopCalcApp;
  const has = (fn) => () => !!(A() && fn());

  function register() {
    if (!window.SlopCmd) return;
    SlopCmd.init({ app: 'calculator' });
    SlopCmd.register([
      { id: 'calc.calculate', title: 'Calculate the expression', group: 'Calculate', keys: [], keywords: ['equals', 'enter', 'result'], run: () => A().commit() },
      { id: 'calc.copy', title: 'Copy result', group: 'Calculate', keys: ['Mod+Alt+C'], keywords: ['clipboard'], when: has(() => A().copyText() !== null), run: () => A().copyResult() },
      { id: 'calc.save', title: 'Save calculation to Slop Drive', group: 'File', keys: ['Mod+Alt+S'], keywords: ['drive', 'note', 'file'], when: has(() => A().copyText() !== null), run: () => A().saveDrive() },
      { id: 'calc.clear', title: 'Clear the expression', group: 'Calculate', keys: [], keywords: ['reset', 'empty'], run: () => A().clearInput() },
      { id: 'calc.focus', title: 'Focus the expression line', group: 'Calculate', keys: ['Mod+Alt+K'], keywords: ['input', 'type'], run: () => A().focus() },
      { id: 'calc.ans', title: 'Insert the last result (ans)', group: 'Insert', keys: [], keywords: ['previous', 'last'], run: () => A().insert('ans') },
      { id: 'calc.tax', title: 'Insert tax(base, rate)', group: 'Insert', keys: [], keywords: ['vat', 'sales'], run: () => A().insert('tax(') },
      { id: 'calc.discount', title: 'Insert discount(price, rate)', group: 'Insert', keys: [], keywords: ['sale', 'off'], run: () => A().insert('discount(') },
      { id: 'calc.markup', title: 'Insert markup(cost, rate)', group: 'Insert', keys: [], keywords: ['margin', 'price'], run: () => A().insert('markup(') },
      { id: 'calc.tape-clear', title: 'Clear the paper tape', group: 'Edit', keys: [], keywords: ['history', 'session'], run: () => A().clearTape() },
      { id: 'calc.rates', title: 'Exchange rates…', group: 'Edit', keys: [], keywords: ['currency', 'fx', 'manual'], run: () => { const d = document.getElementById('sc-rates'); if (d) { d.open = true; document.getElementById('sc-rate-from').focus(); } } },
    ]);
  }

  /** The assistant's commands with arguments (ai-commands.js), loaded when the AI panel first asks. */
  const HERE = (document.currentScript && document.currentScript.src) || location.href;
  if (window.SlopCmd && SlopCmd.provide) SlopCmd.provide({ prepare: () => new Promise((res, rej) => {
    const s = Object.assign(document.createElement('script'), { src: new URL('ai-commands.js', HERE).href });
    s.onload = res; s.onerror = () => rej(new Error('Could not load ai-commands.js')); document.head.append(s);
  }) });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register); else register();
})();
