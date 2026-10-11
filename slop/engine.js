/* Slopographic content engine, part 4 of 5: genres, intensify and generate. */
(function (root) {
  'use strict';
  const S = root.Slop;
  const { SLOP_EMOJI } = S._;
  const { makeRand, hashString } = S;
  const { linkedin, facebook, seo, amazon, youtube, thread, email, chatbot, quote } = S._.gen;

  // -------------------------------------------------------------- genres

  const GENRES = [
    { key: 'linkedin', label: 'LinkedIn Guru', emoji: '💼', make: linkedin },
    { key: 'facebook', label: 'Facebook Miracle', emoji: '🙏', make: facebook },
    { key: 'seo', label: 'SEO Blogspam', emoji: '📈', make: seo },
    { key: 'amazon', label: 'Amazon Listing', emoji: '📦', make: amazon },
    { key: 'youtube', label: 'YouTube Bait', emoji: '😱', make: youtube },
    { key: 'thread', label: 'Thread Guy', emoji: '🧵', make: thread },
    { key: 'email', label: 'Cold Email', emoji: '📧', make: email },
    { key: 'chatbot', label: 'Chatbot Reply', emoji: '🤖', make: chatbot },
    { key: 'quote', label: 'Inspo Quote', emoji: '🌅', make: quote },
  ];
  const GENRE = Object.fromEntries(GENRES.map((g) => [g.key, g]));

  // ----------------------------------------------------------- intensify

  const SWAPS = [
    [/\buse\b/g, 'leverage'], [/\bimportant\b/g, 'pivotal'], [/\bchange\b/g, 'revolutionize'], [/\bexplore\b/g, 'delve into'],
    [/\bworld\b/g, 'landscape'], [/\bbig\b/g, 'game-changing'], [/\bgood\b/g, 'transformative'], [/\bmake\b/g, 'craft'],
    [/\bshow\b/g, 'showcase'], [/\bnew\b/g, 'cutting-edge'], [/\bhelp\b/g, 'empower'], [/\bthings\b/g, 'synergies'],
    [/\bpeople\b/g, 'stakeholders'], [/\bidea\b/g, 'paradigm'], [/\bwork\b/g, 'journey'], [/\bgreat\b/g, 'unparalleled'],
  ];
  const SINK = ['Let that sink in. 🧠', 'Read that again. 👀', 'Wild, right? 🤯', 'Game-changer. 🚀', 'And that’s the tea. ☕', 'It’s not just content—it’s a movement. ✨'];

  function intensify(text, level, R) {
    if (level <= 1) return text;
    const out = [];
    for (let line of text.split('\n')) {
      const blank = !line.trim();
      if (!blank) {
        if (level >= 3) for (const [re, w] of SWAPS) line = line.replace(re, w);
        if (level >= 4) line = line.split(' ').map((w) => (R.chance(0.06) ? w.toUpperCase() : w)).join(' ');
        if (R.chance(0.3 * (level - 1))) line += ' ' + R.pick(SLOP_EMOJI) + (level >= 4 ? R.pick(SLOP_EMOJI) : '');
        if (level >= 5 && !line.startsWith('## ')) line = '✨ ' + line;
      }
      out.push(line);
      if (!blank && level >= 4 && R.chance(0.12)) out.push('', R.pick(SINK));
    }
    if (level >= 5) out.push('', '🚀🚀🚀 Generated with 100% organic slop™ 🤖✨');
    return out.join('\n');
  }

  // -------------------------------------------------------------- generate

  const MAX_LEVEL = 5;

  function generate(genre, seed, level) {
    const g = GENRE[genre];
    const R = makeRand(hashString(genre + ':' + seed));
    const post = g.make(R);
    const IR = makeRand(hashString(genre + ':' + seed + ':' + level));
    post.body = intensify(post.body, level, IR);
    if (post.title && level >= 4) post.title = intensify(post.title, level - 2, IR);
    post.genre = genre;
    post.genreLabel = g.label;
    post.genreEmoji = g.emoji;
    post.seed = seed;
    post.level = level;
    post.id = `${genre}-${seed.toString(36)}-${level}`;
    post.hue = hashString(post.author.name) % 360;
    return post;
  }

  function parseId(id) {
    const m = /^([a-z]+)-([0-9a-z]+)-([1-5])$/.exec(id || '');
    if (!m || !GENRE[m[1]]) return null;
    return { genre: m[1], seed: parseInt(m[2], 36), level: +m[3] };
  }

  function plainText(post) {
    const parts = [];
    parts.push(`${post.author.name}${post.author.sub ? ' — ' + post.author.sub : ''}`);
    if (post.title) parts.push(post.title);
    parts.push(post.body.replace(/^## /gm, ''));
    if (post.image && post.image.kind === 'quote') parts.push(`“${post.image.text}” — ${post.image.who}`);
    return parts.join('\n\n');
  }

  Object.assign(S, { GENRES, GENRE, MAX_LEVEL, generate, parseId, plainText });
})(typeof window !== 'undefined' ? window : globalThis);
