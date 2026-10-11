# Brand: making your own copy

Everything a visitor sees as "Slopographic" (the page title, header name and logo, colours, footer and
support links) comes from `brand/brand.json`. Apps and the homepage read it through `brand/brand.js`.

## Fork in three steps

1. **Copy the site.** Copy the whole folder to your own repository. There is no build step: the site is
   plain HTML, CSS and JavaScript, so it runs from any static host.
2. **Edit `brand/brand.json`.**
   - `name`, `tagline`: the header name and the line under the homepage title.
   - `logo`: a path from the site root to your logo (SVG or PNG). Replace `brand/logo.svg`, or point to a new file.
     An empty string keeps the built-in mark.
   - `home`: where the logo links (`/` for the site root, or a full `https://` URL).
   - `colors`: `ink` (background), `paper` (text), `accent` (highlight). Use `#rgb`, `#rrggbb` or `#rrggbbaa`.
   - `footer`: the footer line on the homepage.
   - `links.patreon`, `links.support`: `https://` or `mailto:` links. An empty value hides that link.
   - `appOrder`: the default order of apps in the switcher and the app drawer (app ids from `shared/apps.js`).
     Apps not listed follow in registry order.
3. **Deploy the folder** to your host (for example GitHub Pages or any static server). Update your domain
   in `CNAME` and the canonical and `og:` tags in `index.html` if you use them.

If `brand.json` is missing or invalid, the built-in defaults are used and the site still works.
Bad values (for example a `javascript:` link or a malformed colour) fall back to their defaults.

## What the brand touches

| Where | What |
| --- | --- |
| Page title | The word "Slopographic" is replaced by `name`. |
| `[data-brand-name]`, header `.brand-name` | Text: `name` |
| `[data-brand-tagline]` | Text: `tagline` |
| `[data-brand-logo]`, or the first svg in a header `.brand` link | The logo image from `logo` |
| `[data-brand-home]` | `href`: `home` |
| `[data-brand-footer]` | Text: `footer` |
| `[data-brand-link="patreon"]`, `[data-brand-link="support"]` | `href`, hidden when empty |
| `--brand-ink`, `--brand-paper`, `--brand-accent` on `:root` | Colours for the shell and any page that uses them |
| `<html data-brand-tokens>` | Also sets `--ink`, `--bone`, `--slop`, which the homepage uses |

To put a brand hook on a new page, add one of the attributes above to the element you want changed.

## Using it from code

```js
SlopBrand.ready.then((config) => console.log(config.name));   // resolves after brand.json is read
SlopBrand.apply({ name: 'Preview Co' });                      // apply any config again (for live previews)
SlopBrand.order;                                              // the default app order
```

## Offline use

`tools/pwa-precache.mjs` lists the files a page loads at boot so the service worker can cache them. It
follows static `<script src>` tags. The shell (`shell/`) and `brand/` files are loaded from script code,
so they are not in that list yet. Add them to the list and regenerate it before you rely on offline use.
