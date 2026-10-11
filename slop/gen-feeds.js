/* Slopographic content engine, part 2 of 5: LinkedIn, Facebook, SEO and Amazon generators. */
(function (root) {
  'use strict';
  const S = root.Slop;
  const { cap, big, huge, hashtag, FIRST, LAST, BOOMERS, TOPICS, BIGCO, SLOP_EMOJI } = S._;

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

  S._.gen = Object.assign(S._.gen || {}, { linkedin, facebook, seo, amazon });
})(typeof window !== 'undefined' ? window : globalThis);
