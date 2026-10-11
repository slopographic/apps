// What Sloppo says. One pool per mood; the same line never comes up twice in a row.
export const LINES = {
  hello: ['Hi! Pet me.', 'oh hi. slop.', 'no watermarks. ever. slop is free.', 'I am Sloppo. Hello.', 'pet the slop.'],
  pet: ['hehe', 'more slop pls', 'purr…', 'squish!', 'HAHAHHEHEHE', 'best day', 'slop.', 'again again', 'i am jelly happy', '<3'],
  thrown: ['Wheee!', 'Yeet!', 'AAAAAA', 'I CAN FLY', 'slop in flight', 'weeeeeee'],
  ouch: ['OUCH!', 'ouch…', 'my goo!', 'oof.', 'that was my face'],
  annoyed: ['WHY YOU TREAT SLOP LIKE THIS', 'do that again. I dare you.', 'rude.', 'I have feelings. sticky ones.', 'not cool.'],
  dizzy: ['@_@', 'which way is up', 'seeing stars', 'blorp…', 'five of you'],
  rage: ['I AM THE SLOP', 'RAAAAAGH', 'NOW YOU DID IT', 'SLOP SMASH', 'EVERYTHING IS GOO NOW', 'YOU WANTED CHAOS?'],
  calm: ['…ok i\'m fine', 'phew.', 'sorry about the page.', 'deep slop breaths', 'it was the goo talking'],
  chaos: ['RAAAH!', 'chaos time', 'unleashed.', 'hehehe. goo.'],
  eat: ['SLURP!', 'nom', 'tasty letters', 'crunchy font', 'mmm, kerning'],
  bite: ['CHOMP', 'nom nom', 'crispy card', 'tastes like pixels'],
  knock: ['Oops.', 'Mine.', 'Bye!', 'Down you go.', 'gravity test'],
  blast: ['PEW', 'GOO BLAST', 'BLORP!', 'ka-SPLAT', 'eat goo'],
  hole: ['behold: the void', 'black hole go brrr', 'it hungers', 'into the slop dimension'],
  stillmad: ['…still mad. snacks?', 'phew. but i remember.', 'i calmed down. a bit. cookie?', 'deep slop breaths. bring snacks.'],
  shake: ['STOP SHAKING ME', 'my slop is SLOSHING', 'BLEEUGH', 'i will be sick. on your page.', 'SLOSH SLOSH SLOSH'],
  woozy: ['BLEEUGH', 'urp.', 'the room is wobbly', 'slosh…'],
  giggle: ['hehe wobble', 'wiggle wiggle', 'tickles!', 'wheee'],
  snack: ['nom. better.', 'thank slop', 'ok i forgive you. a bit.', 'mmm. less mad.'],
  hug: ['…soft.', 'hug accepted', 'i love him already'],
  spit: ['BLEH. not that.', 'ptooey!', 'who gave me THIS', 'i hate this one. madder now.'],
  nopets: ['no pets. only snacks.', 'do NOT pet the angry slop', 'snacks first.'],
  calmed: ['ok. we good.', 'all better. thanks for the snack.', 'happy slop again'],
  power: ['POWER-UP! big brain slop.', 'SLURP. I am the slop. now with BRAIN.', 'my goo is THINKING'],
  tipsoff: ['fine. no tips. i will just sit here.', 'ok. silent slop mode.'],
  fall: ['WHOA—', 'NOOOO—', 'not again', 'the floor is gone', 'aaaaa—', 'who ate my floor'],
  idle: ['no watermarks. ever. slop is free.', 'slop.', 'is it lunch', '…', 'hmm.', 'nice website', 'drag me. I dare you.', 'I could eat a heading'],
  level: ['LEVEL UP', 'stronger slop', 'I feel taller'],
  restore: ['All better.', 'good as new', 'I didn\'t do it'],
  poke: ['STOP POKING ME', 'ow. poke. poke. POKE.', 'you poke too much', 'hey! ouch-ish', 'quit it'],
  offpage: ['you threw me OFF the page', 'that was NOT a landing', 'off the page AGAIN?!'],
  askcandy: ['i am angry. candy please?', 'make me a sweet. i will calm down.', 'angry slop needs candy', 'bring candy. or make some.'],
  candymade: ['candy! drag it on me.', 'gimme the sweet.', 'put it on me. gently.'],
  candyyes: ['sweet! i am calm.', 'ok. candy works.', 'mmm candy. we good.'],
  repair: ['I fixed it. sorry.', 'good as new. sorry about that.', 'tidying up. I was happy, so.', 'the page is back. i feel better.'],
};

let last = '';
const lastOf = {};
/** A random line from a pool, never the line said last. */
export function line(kind) {
  const pool = LINES[kind] || LINES.idle;
  const choices = pool.filter((l) => l !== last && l !== lastOf[kind]);
  const l = (choices.length ? choices : pool)[Math.floor(Math.random() * (choices.length || pool.length))];
  last = l;
  lastOf[kind] = l;
  return l;
}
