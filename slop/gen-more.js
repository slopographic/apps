/* Slopographic content engine, part 3 of 5: YouTube, thread, cold email, chatbot and quote generators. */
(function (root) {
  'use strict';
  const S = root.Slop;
  const { cap, big, huge, hashtag, FIRST, LAST, BOOMERS, TOPICS, BIGCO, SLOP_EMOJI } = S._;

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

  S._.gen = Object.assign(S._.gen || {}, { youtube, thread, email, chatbot, quote });
})(typeof window !== 'undefined' ? window : globalThis);
