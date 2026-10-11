/* Shared video core (window.SlopVideo.effects): the random effect layer, a single layer over the whole reel. The plan
   holds the choice: kind ('none', 'random', or one effect: 'grain', 'colour', 'glitch', 'zoom', 'vignette'), intensity
   (0 to 1) and change ('cut': a new pick at every cut; 'reel': one pick for the whole reel, used for Random only).
   plan() draws the picks from the seed with its own generator (a different salt from the cuts), so the same seed
   gives the same effects, and changing the effect never changes the cuts. Each pick is { kind, seed }: the seed
   drives the effect's own randomness (a hue, glitch frames, grain pattern). Pure: the drawing is in remix/js/fx.js. */
(function () {
  'use strict';
  const root = typeof window !== 'undefined' ? window : globalThis;
  const SV = (root.SlopVideo = root.SlopVideo || {});
  const FX = (SV.effects = {});
  const S = SV.seed;
  const SALT = 0x9e3779b9;

  FX.KINDS = [['none', 'None'], ['random', 'Random: one per cut, from the seed'], ['grain', 'Film grain'], ['colour', 'Colour shift'], ['glitch', 'Glitch'], ['zoom', 'Zoom pulse'], ['vignette', 'Vignette']];
  /** The effects Random chooses from. */
  FX.PICKS = ['grain', 'colour', 'glitch', 'zoom', 'vignette'];
  FX.CHANGE = [['cut', 'Changes at every cut'], ['reel', 'Once for the whole reel']];
  FX.DEFAULT = { kind: 'none', intensity: 0.5, change: 'cut' };
  FX.name = (kind) => (FX.KINDS.find((k) => k[0] === kind) || [kind, kind])[1];

  /** Options checked and defaulted: kind, intensity (0 to 1, two decimals) and change. */
  FX.norm = function (o) {
    const v = o || {};
    const kind = FX.KINDS.some((k) => k[0] === v.kind) ? v.kind : FX.DEFAULT.kind;
    const i = Number.isFinite(+v.intensity) && v.intensity !== null ? +v.intensity : FX.DEFAULT.intensity;
    return {
      kind,
      intensity: Math.round(Math.min(1, Math.max(0, i)) * 100) / 100,
      change: FX.CHANGE.some((c) => c[0] === v.change) ? v.change : FX.DEFAULT.change,
    };
  };
  /**
   * The effect layer for a plan's cuts: { kind, intensity, change, picks }, picks one per cut (empty for 'none').
   * Every cut draws its seed in order; Random also draws the kind (once for 'reel', per cut for 'cut').
   */
  FX.plan = function (o, cuts, seed) {
    const e = FX.norm(o), rng = S.rng((seed ^ SALT) >>> 0);
    const n = (cuts || []).length;
    if (e.kind === 'none' || !n) return Object.assign(e, { picks: [] });
    const pick = () => FX.PICKS[Math.floor(rng() * FX.PICKS.length)];
    let shared = e.kind === 'random' && e.change === 'reel' ? pick() : null;
    const picks = [];
    for (let i = 0; i < n; i++) {
      const kind = e.kind !== 'random' ? e.kind : shared || pick();
      picks.push({ kind, seed: (rng() * 4294967296) >>> 0 });
    }
    return Object.assign(e, { picks });
  };
  /** The pick of the cut at index ci in a plan's effect, or null. */
  FX.at = (effect, ci) => (effect && effect.picks && effect.picks[ci]) || null;
})();
