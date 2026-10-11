// Clippy mode: context tips per app (keyed by SlopHub app id), with 1-2 buttons that run an app
// command when the app registered one with SlopCmd, plus "Don't show tips again".
import { M, now, pick } from './state.js';
import { say } from './fx.js';
import { line } from './lines.js';
import { CFG } from './config.js';
import { getPrefs, setPrefs } from './prefs.js';

// cmd: words to look up in the app's SlopCmd registry; the first match becomes a button.
export const TIPS = {
  photoslop: [
    { text: "It looks like you're editing a photo! Want to try a filter?", cmd: 'filter' },
    { text: 'Need guides? Try the Guides panel.', cmd: 'guides' },
    { text: 'Layers make everything undoable-er. Want a new layer?', cmd: 'new layer' },
  ],
  vector: [
    { text: "It looks like you're drawing a vector! The pen tool is on P.", cmd: 'pen' },
    { text: 'Need guides? Try the Guides panel.', cmd: 'guides' },
  ],
  pdf: [
    { text: "It looks like you're redacting a PDF… want me to black things out?", cmd: 'redact' },
    { text: 'Merging PDFs? Drag pages between files.', cmd: 'merge' },
  ],
  label: [
    { text: "It looks like you're designing a label! Want a barcode?", cmd: 'barcode' },
    { text: 'Printing a sheet? Check the label size first.', cmd: 'print' },
  ],
  cutout: [{ text: "It looks like you're cutting something out! Want the background gone?", cmd: 'background' }],
  press: [{ text: "It looks like you're writing a story! Need a headline?", cmd: 'headline' }],
  slopedit: [{ text: "It looks like you're editing a video! Add a title?", cmd: 'title' }],
  drive: [{ text: "It looks like you're organising files! A new folder, maybe?", cmd: 'folder' }],
  ai: [{ text: "It looks like you're talking to an AI. I am also an AI. Sort of.", cmd: null }],
  platformer: [{ text: 'You call that a jump?' }, { text: 'I could do this level blindfolded. I have no eyelids.' }],
  'sloppo-bird': [{ text: 'flap harder.' }, { text: 'the pipes are winning.' }],
  runner: [{ text: 'run faster. the slop is catching up.' }, { text: 'jump. JUMP. ok too late.' }],
  'star-defender': [{ text: 'pew pew. miss miss.' }, { text: 'the Slop Bots say hi.' }],
  'tower-defense': [{ text: 'more towers. MORE.' }, { text: 'goo pool status: leaking.' }],
  shots: [{ text: 'open another pack. you know you want to.' }],
  default: [{ text: 'Psst: Ctrl+K finds every command.', cmd: null }, { text: 'Everything here runs in your browser. No uploads. No watermarks.' }],
};

let shownAt = 0, last = null, current = '';
export const tipsFor = (app = CFG.app) => TIPS[app] || TIPS.default;
export const enabled = () => CFG.tips && getPrefs().tips !== false;
/** The text of the last tip (context for the AI's comments). */
export const context = () => current;

/** Buttons for a tip: the app command it suggests (if the app has one), then the opt-out. */
export function actionsFor(tip) {
  const out = [];
  const C = window.SlopCmd;
  if (tip.cmd && C && C.search) {
    const hit = (C.search(tip.cmd) || [])[0];
    if (hit) out.push({ label: hit.title || tip.cmd, run: () => C.run(hit.id, { source: 'buddy' }) });
  }
  if (!out.length) out.push({ label: 'Thanks', run: null });
  out.push({ label: "Don't show tips again", run: () => { setPrefs({ tips: false }); say(line('tipsoff'), 1600, { force: true }); } });
  return out;
}

/** Show a tip if tips are on and it's been a while. Returns true if one was shown. */
export function maybeTip(force = false) {
  if (!enabled() || !M.visible || M.mode !== 'perched' || M.chaos || M.raging) return false;
  const t = now();
  if (!force && t - shownAt < 60000) return false;
  const list = tipsFor().filter((x) => x !== last);
  const tip = pick(list.length ? list : tipsFor());
  shownAt = t;
  last = tip;
  current = tip.text;
  M.squash = 0.4;
  say(tip.text, 12000, { actions: actionsFor(tip) });
  return true;
}
