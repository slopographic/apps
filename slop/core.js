/* Slopographic content engine, part 1 of 5: seeded random numbers and shared word lists.
 * The engine is pure (no DOM), so it also runs under Node: require('./slop/index.js').
 * Browser load order: core.js, gen-feeds.js, gen-more.js, engine.js, detect.js. */
(function (root) {
  'use strict';
  const S = (root.Slop = root.Slop || {});

  // ---------------------------------------------------------------- random

  function hashString(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  function makeRand(seed) {
    let a = seed >>> 0;
    const f = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const R = {
      f,
      int: (lo, hi) => lo + Math.floor(f() * (hi - lo + 1)),
      pick: (arr) => arr[Math.floor(f() * arr.length)],
      chance: (p) => f() < p,
      shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(f() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
      some: (arr, n) => R.shuffle(arr).slice(0, n),
    };
    return R;
  }

  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const big = (R) => {
    const n = R.int(1, 3);
    if (n === 1) return R.int(120, 999).toString();
    if (n === 2) return (R.int(10, 99) / 10).toFixed(1) + 'K';
    return R.int(1, 99) + 'K';
  };
  const huge = (R) => (R.chance(0.5) ? R.int(1, 9) + '.' + R.int(1, 9) + 'M' : R.int(100, 999) + 'K');
  const hashtag = (s) => '#' + s.replace(/[^a-z0-9 ]/gi, '').split(' ').map(cap).join('');

  // ------------------------------------------------------------------ words

  const FIRST = ['Chad', 'Brayden', 'Kayleigh', 'Tanner', 'Jaxon', 'Brittany', 'Greg', 'Skyler', 'Madison', 'Trevor', 'Dirk', 'Tiffani', 'Bryce', 'Kendall', 'Logan', 'Ashleigh', 'Garrett', 'Brooklyn'];
  const LAST = ['Thoughtleader', 'Synergy', 'Hustleton', 'Grindsworth', 'McScale', 'Pivotson', 'Disruptman', 'Vibesworth', 'Leverage', 'Growthhacker', 'Brandwell', 'Moonshot', 'Visionstone', 'Bandwidth'];
  const BOOMERS = ['Linda Hoffman', 'Gary Pruitt', 'Barbara Kowalski', 'Deborah Mills', 'Ron Tanner', 'Sharon Diaz', 'Carol Beecham', 'Dennis Whitlock', "Patty O'Brien", 'Gloria Fenske', 'Earl Dobbins', 'Marlene Kuntz', 'Doug Raymond', 'Brenda Lyle'];
  const TOPICS = ['B2B sales', 'leadership', 'AI', 'personal branding', 'remote work', 'the hustle', 'crypto', 'cold outreach', 'product management', 'venture capital', 'growth hacking', 'prompt engineering', 'synergy', 'company culture'];
  const BIGCO = ['Google', 'Meta', 'McKinsey', 'Amazon', 'Apple', 'NASA', 'Tesla', 'Netflix'];

  const SLOP_EMOJI = ['🚀', '✨', '🔥', '💡', '🙌', '💯', '📈', '🧠', '🎯', '🙏', '💪', '⚡', '🌟', '👀', '🤯'];


  S.hashString = hashString;
  S.makeRand = makeRand;
  S._ = { cap, big, huge, hashtag, FIRST, LAST, BOOMERS, TOPICS, BIGCO, SLOP_EMOJI };
})(typeof window !== 'undefined' ? window : globalThis);
