/* Slopographic content engine, Node entry: loads the five parts in order and exports window.Slop.
 *   const Slop = require('./slop/index.js');   // also sets globalThis.Slop
 * In the browser, index.html loads the parts with plain <script> tags instead. */
(function () {
  'use strict';
  if (typeof module === 'undefined' || typeof require === 'undefined') return;
  for (const part of ['core', 'gen-feeds', 'gen-more', 'engine', 'detect']) require('./' + part + '.js');
  module.exports = globalThis.Slop;
})();
