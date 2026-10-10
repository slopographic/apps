# 🍲 Slopographic

**Fresh AI slop. Served infinitely.** Live at [slopographic.com](https://slopographic.com).

A meme site about AI slop. It has two halves:

- **The Slop Feed**: an endless doomscroll of generated AI slop across nine genres:
  - 💼 LinkedIn gurus
  - 🙏 Facebook "miracles" (Shrimp Jesus, made-of-bread elephants, 104th birthdays nobody wished)
  - 📈 SEO blogspam
  - 📦 Amazon listing word salad
  - 😱 YouTube bait with thumbnails
  - 🧵 thread guys
  - 📧 cold emails
  - 🤖 "Certainly! 😊" chatbot replies
  - 🌅 misattributed inspo quotes

  Filter by genre, set the slop level (Mild / Industrial / Maximum), and on any post:
  - **🔥 Sloppier** regenerates it with more slop, up to level 5
  - **📋 Copy** copies the text
  - **🖼️ Meme** saves it as a PNG card for posting
  - **🔗 Share** copies a permalink that reproduces that exact post
- **The Slop Detector**: paste any text to get a slop score, a verdict (from *Artisanal Human Prose* to *Industrial-Grade Slop*), a tally of tells, and the text annotated wherever it delved.

Everything runs in the browser. There's no backend, no API keys and no build step, and the "AI images" are painted on a canvas with emoji.

## Files

| File | What it does |
|---|---|
| `docs/index.html` | Page shell |
| `docs/style.css` | Styles |
| `docs/slop.js` | Content engine: seeded generators for each genre, the slop intensifier, and the detector rules. No DOM; also runs in Node. |
| `docs/app.js` | UI: feed, infinite scroll, canvas image painters, meme-card export, detector, routing (`#p=<post-id>`, `#detector`) |
| `docs/CNAME` | Custom domain for GitHub Pages |

Run it locally:

```sh
npx http-server docs -p 8080   # or: python3 -m http.server -d docs 8080
```

## Deploy (GitHub Pages)

1. **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch `main`, folder `/docs` → Save.**
2. **Custom domain:** `slopographic.com` (already in `docs/CNAME`). Tick **Enforce HTTPS** once the certificate is issued.
3. **DNS** at your registrar:

   | Type | Name | Value |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA (optional) | `@` | `2606:50c0:8000::153` · `2606:50c0:8001::153` · `2606:50c0:8002::153` · `2606:50c0:8003::153` |
   | CNAME | `www` | `slopographic.github.io` |

4. Optional but recommended: verify the domain under **Organization settings → Pages → Verified domains** so nobody else can claim it.

Since it's all static files, Netlify, Cloudflare Pages or Vercel also work. Set the publish directory to `docs` and leave the build command empty.
