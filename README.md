# Slopographic — Maison de Slop

**Slop so nice. You need ze slop.** Live at [slopographic.com](https://slopographic.com).

A fake luxury fashion house for AI slop: black, bone and one acid "slop green", a chrome wordmark with goo drips, a gallery of featured "pieces", and a scrolling house ticker. It has two halves:

- **The Collection**: an endless doomscroll of generated AI slop across nine genres:
  - 💼 LinkedIn gurus
  - 🙏 Facebook "miracles" (Shrimp Jesus, made-of-bread elephants, 104th birthdays nobody wished)
  - 📈 SEO blogspam
  - 📦 Amazon listing word salad
  - 😱 YouTube bait with thumbnails
  - 🧵 thread guys
  - 📧 cold emails
  - 🤖 "Certainly! 😊" chatbot replies
  - 🌅 misattributed inspo quotes

  Filter by collection, set the slop level (Prêt-à-Slop / Industrial / Haute Slop), and on any post:
  - **Sloppier ↑** regenerates it with more slop, up to level 5
  - **Copy** copies the text
  - **Save** downloads it as a branded PNG card for posting
  - **Share** copies a permalink that reproduces that exact post
- **The Authenticator**: paste any text and ze Maison issues a certificate of authenticity: slop score, verdict (from *Artisanal Human Prose* to *Industrial-Grade Slop*), a "Genuine Slop" or "Counterfeit · Human Made" stamp, a tally of tells, and the text annotated wherever it delved.

Everything runs in the browser. There's no backend, no API keys and no build step, and the "AI images" are painted on a canvas with emoji.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell |
| `style.css` | Styles |
| `slop.js` | Content engine: seeded generators for each genre, the slop intensifier, and the detector rules. No DOM; also runs in Node. |
| `app.js` | UI: feed, infinite scroll, canvas image painters, meme-card export, detector, routing (`#p=<post-id>`, `#detector`) |
| `CNAME` | Custom domain for GitHub Pages |

Run it locally:

```sh
npx http-server . -p 8080   # or: python3 -m http.server 8080
```

## Deploy (GitHub Pages)

1. **Settings → Pages → Build and deployment → Source: Deploy from a branch → pick the branch, folder `/ (root)` → Save.**
2. **Custom domain:** `slopographic.com` (already in `CNAME`). Tick **Enforce HTTPS** once the certificate is issued.
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

Since it's all static files, Netlify, Cloudflare Pages or Vercel also work. Set the publish directory to the repo root and leave the build command empty.
