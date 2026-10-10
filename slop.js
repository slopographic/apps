/* Slopographic content engine: seeded generators for every flavour of AI slop,
 * plus the rules behind the Slop Detector. Pure functions, no DOM, so it also
 * runs under Node for quick testing.
 */
(function (root) {
  'use strict';

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

  // ------------------------------------------------------------- linkedin

  function linkedin(R) {
    const topic = R.pick(TOPICS);
    const teacher = R.pick(['my 4-year-old', 'my barista', 'my golden retriever', 'my Uber driver', 'a failed startup', 'a single tweet', 'a Waffle House cook', 'my Peloton instructor', 'a pigeon outside my office', 'the guy who fixed my AC', 'my divorce lawyer', 'a fortune cookie', 'my son’s Little League coach']);
    const opener = R.pick([
      `${cap(teacher)} taught me more about ${topic} than my MBA ever did.`,
      `I’m humbled to announce that ${R.pick(['I’ve been named a Top Voice in ' + topic, 'our pre-seed startup just raised $0 from 14 investors', 'I’m starting a new position as Chief Vibes Officer', 'I finally read the first page of Atomic Habits', 'my last post got 3 likes (one was my mom)', 'after 47 rejections, I’ve been accepted into a free webinar'])}.`,
      'I almost didn’t post this.',
      'Yesterday, I fired my best employee.',
      `I cried in a ${R.pick(['Chipotle', 'board meeting', 'Tesla', 'WeWork phone booth', 'Costco parking lot'])} today.`,
      `I got rejected from ${R.int(40, 400)} jobs this year.`,
      `Unpopular opinion: ${R.pick(['sleep is a growth blocker', 'weekends are a mindset', 'your wedding is a networking event', 'lunch breaks are for the unambitious', 'cover letters should be 9 pages'])}.`,
    ]);
    const story = [
      ...R.some(['I sat in my car for 45 minutes.', 'I was 3 coffees deep.', 'It was 4:30 AM. Obviously.', 'I had just closed a $0 deal.'], R.int(0, 1)),
      `Then ${teacher} looked at me and said:`,
      `"${R.pick(['Why are you still on your phone?', 'Daddy, what’s EBITDA?', 'Sir, this is a Wendy’s.', 'Woof.', 'You can’t scale what you don’t celebrate.', 'Is that your car?', 'The juice is in the squeeze.', 'Did you even read the email?'])}"`,
      ...R.some(['That hit different.', 'I froze.', 'And honestly? They were right.', 'I’ve never felt so seen.', 'I wasn’t ready for that.', 'Chills.', 'No one is talking about this.', 'It changed everything.'], R.int(1, 2)),
    ];
    const LESSONS = [
      'Your network is your net worth.',
      'Fail fast. Then fail faster.',
      'Culture eats strategy for breakfast. Then it eats lunch.',
      'Nobody cares about your 9-5. They care about your 5-9.',
      'Hustle in silence. Post about it loudly.',
      `Be the CEO of your own ${topic}.`,
      'Leaders don’t take breaks. They take ownership.',
      'You miss 100% of the posts you don’t write.',
      'Gratitude is a KPI.',
      'Your vibe attracts your pipeline.',
      'Every “no” is just a “yes” that hasn’t been monetized.',
      'Rest is just productivity in disguise. Monetize it.',
    ];
    const bullet = R.pick(['→ ', '✅ ', '👉 ', 'num']);
    const lessons = R.some(LESSONS, R.int(3, 5)).map((l, i) => (bullet === 'num' ? `${i + 1}. ` : bullet) + l);
    const tags = R.some(['#Leadership', '#Grateful', '#GrowthMindset', '#Hustle', '#AI', '#Humbled', '#Blessed', '#NeverStopLearning', '#ThoughtLeadership', '#OpenToWork', '#Agree'], 4);
    const body = [
      opener, '', ...story.flatMap((s) => [s, '']),
      `Here’s what it taught me about ${topic}:`, '',
      ...lessons, '',
      R.pick(['Let that sink in.', 'Read that again.', 'Simple. But not easy.', 'It’s not about the money. It’s about the impact (and the money).']), '',
      R.pick(['Agree? 👇', 'Thoughts? ♻️ Repost to help someone in your network.', 'What would you add? Drop it below 👇', `Follow me for more ${topic} insights 🔔`, 'If this resonated, you know what to do ♻️']), '',
      [hashtag(topic), ...tags].join(' '),
    ].join('\n');
    const name = `${R.pick(FIRST)} ${R.pick(LAST)}`;
    return {
      author: {
        name,
        sub: [
          R.pick(['Chief Vibes Officer', 'Founder & CEO (team of 1)', 'Serial Entrepreneur', 'Top Voice in Breathing', 'Visionary', 'Keynote Speaker (Zoom)', 'Growth Ninja', 'Forbes 30 Under 30 (nominee’s cousin)']),
          `Ex-${R.pick(BIGCO)} (${R.pick(['interviewed', 'visited the campus', 'used the Wi-Fi', 'summer camp', 'rejected'])})`,
          R.pick(['Helping founders scale to 7 figures', 'Helping you 10x your inner CEO', 'Turning coffee into thought leadership', 'Disrupting disruption', 'Building in public (mostly posting)']),
        ].join(' | '),
        avatar: R.pick(['👔', '🧑‍💼', '😎', '🦁', '🚀']),
      },
      meta: `${R.int(1, 23)}h • Edited • 🌐`,
      body,
      stats: `👍❤️👏 ${big(R)} · ${R.int(40, 900)} comments · ${R.int(10, 400)} reposts`,
      comments: R.some(['Great insight! 🙌', 'This. 💯', 'So powerful. Thanks for sharing!', 'Needed this today 🙏', 'Agree! 👇', 'Congrats!! (didn’t read)', 'Love this! Let’s connect 🤝', 'I would add: hustle.', 'Wow. Just wow.'], 3)
        .map((text) => ({ name: `${R.pick(FIRST)} ${R.pick(LAST)}`, text })),
    };
  }

  // ------------------------------------------------------------- facebook

  const SUBJECTS = [['Jesus', '😇'], ['an angel', '👼'], ['a majestic elephant', '🐘'], ['a loyal dog', '🐕'], ['a mermaid', '🧜‍♀️'], ['a giant owl', '🦉'], ['a brave soldier', '💂'], ['a sea turtle', '🐢'], ['a lion', '🦁'], ['the Pope', '👴']];
  const MATERIALS = [['shrimp', '🦐'], ['bread', '🍞'], ['watermelons', '🍉'], ['crabs', '🦀'], ['cabbage', '🥬'], ['pancakes', '🥞'], ['wood', '🪵'], ['bananas', '🍌'], ['broccoli', '🥦'], ['cheese', '🧀'], ['sushi', '🍣'], ['croissants', '🥐']];

  function facebook(R) {
    const birthday = R.chance(0.2);
    let caption, main, part;
    if (birthday) {
      const age = R.int(96, 112);
      main = R.pick(['👵', '👴']);
      part = '🎂';
      caption = R.pick([
        `Today is my ${age}th birthday 🎂 but nobody wished me 😞`,
        `I turned ${age} today. My family forgot. Can I get some birthday wishes? 🥺🎂`,
        `${age} years young today! 🎉 I baked this cake myself but no one came 😢`,
      ]);
    } else {
      const [subject, sEmoji] = R.pick(SUBJECTS);
      const [material, mEmoji] = R.pick(MATERIALS);
      main = sEmoji;
      part = mEmoji;
      caption = R.pick([
        `${cap(subject)} made of ${material}. Amen? 🙏`,
        `My ${R.pick(['son', 'grandson', 'daughter', 'neighbor'])} made ${subject} out of ${material} but nobody liked it 😢`,
        `Why don’t pictures like this ever trend? 😔 ${cap(subject)} made of ${material}.`,
        `Type 'Amen' if you can see ${subject} in the ${material} 🙏🙏`,
        `This ${R.int(6, 11)}-year-old carved ${subject} from ${material} 😍 can we get some love for him? ❤️`,
        `Scroll past if you don’t love ${subject} made of ${material} 🙏`,
        `Built ${subject} with ${R.int(2000, 9000)} ${material} using my bare hands. 6 months of work. Be honest, rate 1-10?`,
      ]);
    }
    return {
      author: {
        name: R.pick(['Jesus Is My Savior 🙏', 'Amazing Art Daily', 'Heavenly Blessings 777', 'Nature Is Beautiful 🌲', 'Crafty Grandmas of America', 'Wholesome Content Only', 'God’s Plan Daily']),
        sub: `Page · ${huge(R)} followers`,
        avatar: R.pick(['🙏', '🕊️', '🌻', '❤️']),
      },
      meta: `${R.int(2, 20)}h · 🌎`,
      body: caption,
      image: { kind: 'miracle', main, part, palette: R.int(0, 4) },
      stats: `😍👍😮 ${huge(R)} · ${big(R)} comments · ${big(R)} shares`,
      comments: R.some(['Amen 🙏', 'Amen', 'AMEN 🙏🙏🙏', 'Beautiful work 😍', 'God bless you 🙏', 'Wow so talented!!', birthday ? 'Happy birthday!!! 🎂' : 'Is this real??', 'Amen from Ohio 🙏', 'Great job son', 'This is REAL art 👏👏', 'What a time to be alive', 'I see it!! Amen'], 3)
        .map((text) => ({ name: R.pick(BOOMERS), text })),
    };
  }

  // ------------------------------------------------------------------ seo

  function seo(R) {
    const t = R.pick(['air fryers', 'crypto wallets', 'houseplants', 'blockchain gardening', 'gluten-free water', 'standing desks', 'mindful spreadsheets', 'artisanal ice', 'LED toothbrushes', 'cold plunges', 'smart forks', 'AI-powered socks']);
    const T = t.split(' ').map(cap).join(' ');
    const thing = R.pick(['Life', 'Business', 'Morning Routine', 'Kitchen', 'Workflow', 'Mindset', 'Marriage']);
    const n = R.int(7, 23);
    const title = R.pick([
      `${n} Game-Changing Ways ${T} Will Revolutionize Your ${thing} in 2026`,
      `The Ultimate Guide to ${T}: Everything You Need to Know`,
      `Are ${T} Worth It? A Comprehensive Deep Dive`,
      `Unlocking the Power of ${T}: A Complete Guide`,
      `${T} vs. ${R.pick(['Toasters', 'Feelings', 'The Metaverse', 'Your Ex'])}: Which Is Right for You?`,
    ]);
    const benefits = R.some([
      ['Enhanced Productivity', `By harnessing the power of ${t}, you can unlock your full potential.`],
      ['Seamless Integration', `${cap(t)} seamlessly integrate into your daily routine, fostering a sense of harmony.`],
      ['Holistic Wellness', `Many experts agree that ${t} may or may not improve your well-being.`],
      ['Unparalleled Versatility', `From the kitchen to the boardroom, ${t} are a testament to versatility.`],
      ['Cost-Effective Solutions', `Investing in ${t} can be a game-changer for your bottom line.`],
      ['Future-Proof Innovation', `In an ever-evolving world, ${t} stand as a beacon of innovation.`],
    ], R.int(3, 4));
    const body = [
      `In today’s fast-paced, ever-evolving digital landscape, ${t} have emerged as a true game-changer. But what exactly are ${t}, and why do they matter? Whether you’re a seasoned professional or just starting your journey, this comprehensive guide will delve into everything you need to know.`,
      `## What Are ${T}?`,
      `At their core, ${t} are a multifaceted solution that plays a pivotal role in the rich tapestry of modern life. It’s important to note that ${t} are not just a trend—they’re a lifestyle.`,
      `## Key Benefits of ${T}`,
      ...benefits.map(([h, d], i) => `${i + 1}. ${h} — ${d}`),
      '## Frequently Asked Questions',
      `Q: Are ${t} right for me?`,
      'A: It depends on your unique needs, goals, and circumstances. Ultimately, the choice is yours.',
      `Q: Where can I buy ${t}?`,
      'A: Click any of the 37 affiliate links above. 🛒',
      '## Conclusion',
      `In conclusion, ${t} are a testament to human ingenuity. By embracing ${t}, you can elevate your ${thing.toLowerCase()} and embark on a transformative journey. The possibilities are endless! 🚀`,
    ].join('\n');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return {
      author: {
        name: R.pick(['BestTopReviews10.net', 'UltimateGuideHub.io', 'TopPicksDaily.biz', 'ExpertsChoice247.com', 'ReviewNerdz.info']),
        sub: `By SEO Content Team · Updated ${R.pick(months)} ${R.int(1, 28)}, 2026 · ${R.int(9, 31)} min read · Contains affiliate links`,
        avatar: '📈',
      },
      meta: '',
      title,
      body,
      stats: 'Was this article helpful? 👍 👎 · 0 comments · 🍪 This site uses 412 cookies',
    };
  }

  // --------------------------------------------------------------- amazon

  function amazon(R) {
    const brand = R.pick(['XUNVOLK', 'QWOPRTZ', 'ZHANGLIFE', 'BIGSTRONG', 'HOMIEPRO', 'VEEPEEZ', 'LUXNOVAA', 'GOODTHING', 'YOUMEIKA', 'DEEPWAVVE', 'FUNNYGO', 'KKOOLLEE']);
    const [product, emoji] = R.pick([['Toaster Cover', '🍞'], ['Banana Holder', '🍌'], ['Phone Stand', '📱'], ['Sock Organizer', '🧦'], ['Self-Stirring Mug', '☕'], ['Cat Hat', '🐱'], ['Shower Speaker', '🚿'], ['Garlic Press', '🧄'], ['Pet Rock', '🪨'], ['Smart Spoon', '🥄'], ['LED Pickle', '🥒'], ['Duck Lamp', '🦆'], ['Avocado Saver', '🥑']]);
    const feats = R.some(['Waterproof', 'Anti-Slip', 'Heavy Duty', 'Ultra-Thin', 'Ergonomic', 'Food Grade', 'BPA Free', 'Military Grade', 'Non-Toxic', 'Portable', 'Foldable', 'Magnetic', 'Smart', 'Premium', 'Upgraded'], 4);
    const title = `${brand} ${product} for Women Men Kids Unisex, ${feats.join(' ')} ${product} ${R.pick(['Holder', 'Organizer', 'Accessories', 'Tool', 'Kit'])} Gift for Mom Dad Him Her Birthday Christmas Valentine’s Day, Upgraded 2026 Version, ${R.pick(['Black', 'Rose Gold', 'Navy Blue', 'Random Color', 'Transparent Beige'])}`;
    const price = R.int(9, 39) + 0.99;
    const list = Math.round(price * R.int(3, 6)) + 0.99;
    const bullets = R.some([
      '【PREMIUM MATERIAL】 Made of high quality material, very durable and sturdy, not easy to break, can use long time.',
      '【MULTI-PURPOSE】 Perfect for kitchen, bathroom, office, car, camping, wedding, funeral and more. Your best choice!',
      '【UPGRADED DESIGN】 Compared with other product, our product is more better. Give you the excellent experience.',
      '【PERFECT GIFT】 Great gift for wife, husband, boss, landlord, enemies. Make your life more convenience.',
      '【WORRY-FREE SERVICE】 If you have any problem, please contact us, we will reply within 24 hours and make you satisfy 100%.',
      '【EASY TO USE】 No installation needed. Just open box and enjoy the happy time.',
      '【SAFE & HEALTHY】 Non-toxic, odorless, no harm to human body probably.',
    ], 5);
    return {
      author: { name: `Visit the ${brand} Store`, sub: `Amazon’s Choice for "${product.toLowerCase()} for men women"`, avatar: '📦' },
      meta: '',
      title,
      body: [
        `${'⭐'.repeat(4)}☆ 4.${R.int(1, 6)} (${R.int(1, 40)},${R.int(100, 999)} ratings) | ${R.int(1, 20)}K+ bought in past month`,
        `$${price.toFixed(2)}   List Price: $${list.toFixed(2)} (-${Math.round((1 - price / list) * 100)}%)`,
        '',
        'About this item',
        ...bullets,
      ].join('\n'),
      image: { kind: 'product', emoji, badge: R.pick(['BEST SELLER', '#1 NEW RELEASE', 'LIMITED DEAL', '2026 UPGRADED']) },
      stats: 'FREE delivery Tomorrow · Only 2 left in stock (more on the way)',
      comments: R.some([
        '★★★★★ Works as expected. Product arrived.',
        `★☆☆☆☆ It came with no ${product.toLowerCase()}. Just a smaller box.`,
        '★★★★★ I received this product free in exchange for an honest review. Five stars!',
        '★★★★☆ Haven’t opened it yet but great packaging.',
        '★☆☆☆☆ Smells like a printer.',
        '★★★★★ My husband loves it. My husband is a cat.',
      ], 2).map((text) => ({ name: R.pick(BOOMERS), text })),
    };
  }

  // -------------------------------------------------------------- youtube

  function youtube(R) {
    const days = R.pick([7, 30, 50, 100, 365]);
    const stunt = R.pick(['Only Eating Gas Station Sushi', 'Letting ChatGPT Run My Life', 'Becoming a Sigma Male', 'Waking Up at 3AM', 'Doing 1,000 Pushups a Day', 'Speaking Only in Corporate Buzzwords', 'Living in a Costco', 'Investing in Memecoins', 'Drinking Only Prime', 'Replacing Sleep with Cold Plunges']);
    const title = R.pick([
      `I Tried ${stunt} for ${days} Days (SHOCKING Results) 😱`,
      `${stunt} for ${days} Days Changed My Life FOREVER (not clickbait)`,
      `I Survived ${days} Days ${stunt}… 🤯`,
      `Why Nobody Is Talking About ${stunt}…`,
      `Doctors HATE This: ${stunt} 😳`,
    ]);
    const channel = R.pick(['MrSlop', 'Brayden Vlogs', 'SigmaGrindset TV', 'Tech With Kyle', 'Daily Hustle Bros', 'Kayleigh Tries Stuff', 'ALPHA MINDSET 24/7']);
    return {
      author: { name: channel, sub: `${huge(R)} subscribers`, avatar: R.pick(['😱', '🤯', '😳', '🔥']) },
      meta: `${huge(R)} views · ${R.int(1, 6)} days ago`,
      title,
      body: [
        `In this video I tried ${stunt.toLowerCase()} for ${days} days and you WON’T BELIEVE what happened on day ${R.int(3, days)} 😳😳`,
        '',
        'Make sure to SMASH that like button 👍 and SUBSCRIBE 🔔 so you never miss an upload!!',
        '',
        `🔥 Use code SLOP for 10% off ${R.pick(['protein powder', 'a VPN', 'mobile games', 'a mattress', 'meal kits'])}`,
        '',
        `0:00 Intro\n0:47 Sponsor\n9:12 Day 1\n9:13 Day ${days}\n9:14 I cried`,
        '',
        '#shorts #viral #fyp #challenge',
      ].join('\n'),
      image: {
        kind: 'thumb',
        face: R.pick(['😱', '🤯', '😳', '😭', '🥵']),
        obj: R.pick(['🍣', '🤖', '🧊', '💰', '🏪', '💪', '⏰', '🪙']),
        text: R.pick([`DAY ${days}`, 'IT WORKED??', 'NOT CLICKBAIT', 'GONE WRONG', 'I’M SHOOK', '$0 → $1M??']),
        palette: R.int(0, 3),
      },
      stats: `👍 ${big(R)}   👎   💬 ${big(R)} comments`,
      comments: R.some(['First!!', 'Who’s watching in 2026? 👇', `Day ${R.int(1, 300)} of asking for a shoutout`, 'The editing on this is insane 🔥', 'Bro really did it 💀', 'He’s so real for this'], 2)
        .map((text) => ({ name: '@' + R.pick(FIRST).toLowerCase() + R.int(10, 9999), text })),
    };
  }

  // --------------------------------------------------------------- thread

  function thread(R) {
    const first = R.pick(FIRST);
    const handle = first.toLowerCase() + R.pick(['_ai', 'builds', 'gpt', '_growth', 'ships', 'xyz']);
    const n = R.int(5, 9);
    const tools = R.some([
      ['Slopify.ai', 'writes your emails, texts and wedding vows'],
      ['DelveGPT', 'turns one tweet into 400 LinkedIn posts'],
      ['Synergizr', 'replaces your entire marketing team (and your friends)'],
      ['PromptBro', 'summarizes books you’ll pretend to read'],
      ['HustleBot 9000', 'generates 10,000 blog posts while you sleep'],
      ['Tapestry.io', 'makes your face look more “founder”'],
      ['ThoughtLeadr', 'replies “Great insight!” to every post automatically'],
      ['CopeAI', 'explains why your startup failed (it was the market)'],
      ['VibeStack', 'ships your SaaS without you knowing how to code (or what it does)'],
      ['GrindOS', 'schedules your burnout for maximum engagement'],
      ['Ghostwritr', 'writes this thread for you'],
    ], n);
    const topic = R.pick(['AI', 'This new model', 'Agents', 'Prompt engineering', 'Vibe coding']);
    return {
      author: { name: `${first} 🚀 | AI`, sub: `@${handle} · ✔️ (paid)`, avatar: '🧵' },
      meta: `${R.int(1, 59)}m`,
      body: [
        `🧵 ${topic} just changed everything.`,
        '',
        'Most people won’t realize it until it’s too late.',
        '',
        `Here are ${n} AI tools that feel illegal to know: 👇`,
        '',
        ...tools.flatMap(([name, what], i) => [`${i + 1}/ ${name} — ${what}`, '']),
        'That’s a wrap! 🎬 If you found this helpful:',
        `1. Follow me @${handle} for more`,
        '2. RT the first tweet ♻️',
        '3. Bookmark this 🔖 (you won’t read it)',
      ].join('\n'),
      stats: `💬 ${big(R)}   🔁 ${big(R)}   ❤️ ${big(R)}   📊 ${huge(R)}`,
      comments: R.some(['This is gold 🔥', 'Bookmarked!', 'Ratio', 'Saving this for later (never)', 'Insane value bro', 'Which one do you use the most?'], 2)
        .map((text) => ({ name: '@' + R.pick(FIRST).toLowerCase() + R.int(10, 99) + 'ai', text })),
    };
  }

  // ---------------------------------------------------------------- email

  function email(R) {
    const me = `${R.pick(FIRST)} ${R.pick(LAST)}`;
    const them = R.chance(0.3) ? '{{FirstName}}' : R.pick(['Sarah', 'Mike', 'Jen', 'Dave', 'there', 'Friend']);
    return {
      author: { name: me, sub: `to me · ${R.int(5, 7)}:0${R.int(1, 9)} AM`, avatar: '📧' },
      meta: '',
      title: 'Subject: ' + R.pick(['Quick question 🙂', 'Re: Re: Re: Following up', `${them === '{{FirstName}}' ? 'Hey' : them}, synergy opportunity?`, 'Circling back 🔄', 'Saw your post 👀', '15 mins this week?']),
      body: [
        `Hi ${them},`,
        '',
        'I hope this email finds you well!',
        '',
        `I came across your ${R.pick(['LinkedIn profile', 'company website', 'recent podcast appearance', 'GitHub', 'wedding registry'])} and was truly blown away by your ${R.pick(['commitment to excellence', 'passion for innovation', 'thought leadership', 'headshot'])}. It’s clear you’re passionate about ${R.pick(TOPICS)}.`,
        '',
        `I’m reaching out because we help companies like yours ${R.pick(['leverage AI to 10x their pipeline', 'unlock seamless synergies', 'streamline their workflows end-to-end', 'harness the power of the cloud (the computer one)'])}. Our clients have seen a ${R.int(140, 900)}% increase in ${R.pick(['revenue', 'engagement', 'synergy', 'meetings about meetings'])}.`,
        '',
        `Would you be open to a quick 15-minute call ${R.pick(['Tuesday', 'Thursday', 'tomorrow', 'Christmas Day'])} at ${R.int(1, 12)}:${R.pick(['00', '15', '30'])} to explore potential synergies?`,
        '',
        'Looking forward to connecting!',
        '',
        'Best,',
        me,
        `${R.pick(['Senior Partnerships Ninja', 'Head of Growth', 'Account Executive', 'Founder'])} @ ${R.pick(['Synergizr', 'LeadGenius.ai', 'PipelinePros', 'OutreachHQ'])}`,
        '',
        'P.S. ' + R.pick(['Just bumping this to the top of your inbox! 🙂', 'If you’re not the right person, could you point me to who is?', 'I’ve sent this to 4,000 people but you’re special.', 'Not sure if you saw my last 6 emails.', 'This email was written by a human (me) (an AI).']),
      ].join('\n'),
      stats: '📎 0 attachments · ⚠️ Gmail moved similar messages to Spam',
    };
  }

  // -------------------------------------------------------------- chatbot

  function chatbot(R) {
    const ask = R.pick(['what’s 2+2', 'write a haiku about my cat', 'how do I boil an egg', 'say something human', 'name my goldfish', 'is a hot dog a sandwich', 'what time is it', 'summarize this one-word text: "hi"']);
    const points = R.some([
      '🧠 Mindset: Approach this with curiosity and an open heart.',
      '📊 Context: Every situation is unique, much like a snowflake or a startup.',
      '🌱 Growth: Embrace the journey, not just the destination.',
      '⚖️ Balance: Consider both sides, and then a third side.',
      '🔍 Nuance: The answer is nuanced, and that nuance is itself nuanced.',
      '🤝 Collaboration: Consider consulting stakeholders, experts, and your inner child.',
      '🌍 Impact: Think about how this affects the broader ecosystem.',
    ], 3);
    return {
      author: { name: 'SlopGPT-5 Turbo Max ✨', sub: 'AI assistant · may produce slop', avatar: '🤖' },
      meta: `You asked: “${ask}”`,
      body: [
        `Certainly! 😊 Great question! “${cap(ask)}” is a multifaceted question that touches on the rich tapestry of human experience.`,
        '',
        `It’s important to note that ${R.pick(['as an AI language model, I don’t have personal opinions, feelings, or a cat', 'results may vary depending on your specific circumstances', 'you should always consult a qualified professional, such as a lawyer, a doctor, or a different chatbot', 'there is no one-size-fits-all answer'])}.`,
        '',
        'Here are a few key considerations:',
        '',
        ...points,
        '',
        `In summary, the answer to “${ask}” is complex, nuanced, and deeply personal. ${R.pick(['Ultimately, the choice is yours.', 'It’s not just a question—it’s a journey.', 'Both perspectives have merit.'])}`,
        '',
        R.pick(['I hope this helps! Let me know if you’d like me to adjust the tone, length, or level of delve. 🌟', 'Would you like me to turn this into a table, a poem, or a 12-part LinkedIn series? ✨', 'Is there anything else I can help you with today? 😊']),
      ].join('\n'),
      stats: '👍 👎 🔄 Regenerate · 📋 Copy',
    };
  }

  // ---------------------------------------------------------------- quote

  function quote(R) {
    const text = R.pick([
      'Your vibe attracts your tribe.',
      'Be the energy you want to attract.',
      'Don’t count the days. Make the days count your content.',
      'Hustle until your haters ask if you’re hiring.',
      'The grind doesn’t stop. Neither does my podcast.',
      'Stars can’t shine without darkness. Neither can my ring light.',
      'A river cuts through rock not because of its power, but because it posted every day.',
      'Normalize normalizing things.',
      'Sometimes the real treasure was the synergy we made along the way.',
      'If plan A doesn’t work, the alphabet has 25 more letters.',
      'Be a voice, not an echo. Then repost this.',
      'Your only limit is your Wi-Fi.',
    ]);
    const who = R.pick(['Albert Einstein', 'Elon Musk (allegedly)', 'Marcus Aurelius, probably', 'Steve Jobs (on LinkedIn)', 'My Uber driver', 'Abraham Lincoln (he tweeted it)', 'Gandhi (citation needed)', 'Sun Tzu, The Art of Hustle', 'Oprah (unverified)', 'Shakespeare, Hamlet 2']);
    return {
      author: { name: R.pick(['Daily Motivation 💯', 'Mindset Mondays', 'Grindset Quotes', 'Positive Vibes Only ✨', 'Alpha Wisdom']), sub: `Page · ${huge(R)} followers`, avatar: '🌅' },
      meta: `${R.int(1, 12)}h · 🌎`,
      body: `${R.pick(['Morning reminder ☀️', 'Read this twice. 🙏', 'Tag someone who needs this 👇', 'Save this for later 📌'])}\n\n#mindset #grindset #motivation #quotes #${R.pick(['success', 'hustle', 'blessed', 'entrepreneur'])}`,
      image: { kind: 'quote', text, who, palette: R.int(0, 3) },
      stats: `❤️ ${huge(R)} · ${big(R)} comments · ${big(R)} shares`,
      comments: R.some(['So true 🙏', 'Needed this today 💯', 'Einstein was a genius', 'Wow deep', 'Facts 🔥', 'Sharing to my story'], 2).map((text) => ({ name: R.pick(BOOMERS), text })),
    };
  }

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

  // -------------------------------------------------------------- detector

  const VOCAB = ['delve', 'delves', 'delving', 'tapestry', 'testament', 'realm', 'landscape', 'multifaceted', 'intricate', 'pivotal', 'robust', 'seamless', 'seamlessly', 'elevate', 'unlock', 'unleash', 'harness', 'harnessing', 'foster', 'fostering', 'embark', 'vibrant', 'bustling', 'cutting-edge', 'ever-evolving', 'synergy', 'synergies', 'leverage', 'paradigm', 'holistic', 'transformative', 'meticulous', 'meticulously', 'nuanced', 'showcase', 'showcasing', 'boasts', 'resonate', 'resonates', 'beacon', 'symphony', 'labyrinth', 'navigate', 'navigating', 'underscore', 'underscores', 'commendable', 'invaluable', 'unparalleled', 'game-changer', 'game-changing', 'empower', 'empowering', 'streamline', 'revolutionize', 'journey'];

  const RULES = [
    { label: 'Slop vocabulary', w: 3, re: new RegExp(`\\b(${VOCAB.join('|')})\\b`, 'gi') },
    { label: '“In today’s fast-paced world”', w: 10, re: /in today['’]s (fast[- ]paced|digital|ever[- ]evolving|modern)[^.,]*/gi },
    { label: '“It’s important to note”', w: 7, re: /it['’]?s (important|worth|crucial) (to note|noting|to remember)|it is (important|worth) (to note|noting)/gi },
    { label: '“In conclusion”', w: 5, re: /\bin (conclusion|summary)\b/gi },
    { label: 'Email opener', w: 9, re: /i hope (this|that) (email|message|note) finds you well/gi },
    { label: 'Chatbot tell', w: 10, re: /as an ai( language model)?|certainly!|great question!?|i hope this helps|let me know if you['’]d like/gi },
    { label: '“Let’s dive in”', w: 6, re: /let['’]s (dive|delve) in(to)?|dive (deep )?into/gi },
    { label: '“Not just X, it’s Y”', w: 8, re: /\b(is|are|was|it['’]s)\s+not\s+(just|only|merely)\b[^.!?\n]{1,60}?(it['’]s|they['’]re|but)\b/gi },
    { label: '“Whether you’re a…”', w: 5, re: /whether you['’]re an? [^,]{1,40}(,| or)/gi },
    { label: '“Unlock the power”', w: 7, re: /unlock(ing)? (the|your) (full )?(power|potential|secrets?)/gi },
    { label: '“Plays a pivotal role”', w: 6, re: /plays? an? (crucial|pivotal|vital|key|significant) role/gi },
    { label: '“Rich tapestry”', w: 8, re: /rich tapestry|a testament to|stands? as a (testament|beacon)/gi },
    { label: 'LinkedIn broetry', w: 6, re: /let that sink in|read that again|agree\?|thoughts\?|here['’]s the thing|that hit different|i['’]m (humbled|thrilled|excited|honou?red) to (announce|share)/gi },
    { label: 'Engagement bait', w: 8, re: /type ['‘’"]?amen|why don['’]t pictures like this ever trend|scroll past if|nobody (liked|wished)|repost (to|if)|smash that like/gi },
    { label: 'Em dash', w: 2, re: /—/g },
    { label: 'Slop emoji', w: 1.5, re: /🚀|✨|🔥|💡|🙌|💯|📈|🧠|👇|🎯|🙏|♻️|🌟/gu },
    { label: 'Hashtag', w: 1, re: /(^|\s)#[A-Za-z]\w+/g },
    { label: '【LISTING BRACKETS】', w: 5, re: /【[^】]*】/g },
  ];

  const TIERS = [
    { max: 12, name: 'Artisanal Human Prose', emoji: '🧑‍🌾', blurb: 'Hand-typed, small-batch, possibly with typos. Treasure it.' },
    { max: 30, name: 'Slightly Moist', emoji: '💧', blurb: 'A light glaze of slop. Could be a human who reads too much LinkedIn.' },
    { max: 55, name: 'Slop-Adjacent', emoji: '🥣', blurb: 'Something in here was microwaved. Proceed with a spoon.' },
    { max: 80, name: 'Certified Slop', emoji: '✅', blurb: 'This text has delved. Multiple tells detected.' },
    { max: 101, name: 'Industrial-Grade Slop', emoji: '🏭', blurb: 'Produced at scale in a content refinery. Do not ingest.' },
  ];

  function analyze(text) {
    const hits = [];
    const tally = {};
    let total = 0;
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(text))) {
        if (!m[0].length) { rule.re.lastIndex++; continue; }
        const lead = rule.label === 'Hashtag' ? m[1].length : 0;
        hits.push({ start: m.index + lead, end: m.index + m[0].length, label: rule.label });
        tally[rule.label] = (tally[rule.label] || 0) + 1;
        total += rule.w;
      }
    }
    // Broetry: lots of one-sentence paragraphs.
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const short = lines.filter((l) => l.length < 70).length;
    if (lines.length >= 6 && short / lines.length > 0.7) {
      tally['One-line paragraphs'] = 1;
      total += 8;
    }
    const words = (text.match(/\S+/g) || []).length;
    const score = words ? Math.round(100 * (1 - Math.exp((-total * 10) / (words + 40)))) : 0;
    const tier = TIERS.find((t) => score < t.max);

    // Merge overlapping highlight spans, keeping the first label.
    hits.sort((a, b) => a.start - b.start || b.end - a.end);
    const spans = [];
    for (const h of hits) {
      const last = spans[spans.length - 1];
      if (last && h.start < last.end) {
        if (h.end > last.end) last.end = h.end;
      } else spans.push({ ...h });
    }
    return { score, tier, tally, spans, words };
  }

  root.Slop = { GENRES, GENRE, MAX_LEVEL, generate, parseId, plainText, analyze, TIERS, makeRand, hashString };
})(typeof window !== 'undefined' ? window : globalThis);
