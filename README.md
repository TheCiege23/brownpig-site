# Brown Pig LLC — studio site

Five pages, no build step, no framework, no dependencies. Plain HTML with one
shared stylesheet, plus a tiny Node server so Railway can host it and so the
contact form has somewhere to POST.

```
index.html        home — positioning, three divisions, featured work, the why
work.html         the full portfolio
services.html     B2B + B2C + pricing/process + FAQ
headless.html     the white-label division
contact.html      enquiry form
404.html
server.js         zero-dependency static server + /api/contact
assets/site.css   the whole design system
assets/site.js    nav, live site previews
assets/logo.webp  logo used across the site (37 KB)
assets/logo.png   original 1254px export — source file, not referenced
assets/favicon.png
```

## Run it locally

```bash
node server.js
# http://localhost:3000
```

Node 18+ (uses global `fetch`). Nothing to install.

## Deploy to Railway

Railway deploys from a GitHub repo, so this needs to live in one first.

**1. Create the repo**

```bash
cd brownpig
git init
git add .
git commit -m "Brown Pig LLC site"
git branch -M main
git remote add origin https://github.com/TheCiege23/brownpig-site.git
git push -u origin main
```

(Create `brownpig-site` on GitHub first — empty, no README.)

**2. Point Railway at it**

New project → Deploy from GitHub repo → `TheCiege23/brownpig-site`. Railway
detects Node from `package.json` and runs `npm start`. No build command needed.

**3. Add the custom domain**

In the service → Settings → Networking → Custom Domain → `brownpigllc.com`.
Railway gives you a CNAME. Add it at your DNS provider.

> **Note:** `brownpigllc.com` currently serves a different placeholder site
> ("Apps That Work" over a stock photo). Whatever is hosting that needs the DNS
> pointed away from it before Railway can take the domain.

## Environment variables

Only one, and the site works without it.

| Variable | Required | What it does |
|---|---|---|
| `RESEND_API_KEY` | no | Emails contact submissions. Without it they're written to the Railway logs instead and the form still says thank you. |
| `CONTACT_TO` | no | Where enquiries land. Default `support@brownpigllc.com`. |
| `CONTACT_FROM` | no | Sender. Default is Resend's shared test sender — swap to a verified `@brownpigllc.com` address once the domain is verified in Resend. |
| `PORT` | no | Railway sets this automatically. |

## Changing the portfolio

Each project on `work.html` and `index.html` is one `<article class="proj">`.
The preview image comes from the `data-site` attribute:

```html
<div class="shot" data-site="https://allfantasy.ai" data-label="AllFantasy"></div>
```

`assets/site.js` renders a live screenshot of that URL through a third-party
screenshot service, falls back to a second service, then to a branded tile with
the label on it. It never shows a broken image.

**To use your own screenshots instead** — better quality, no third-party
dependency, and recommended once you have time to take them:

```html
<div class="shot" data-site="https://allfantasy.ai" data-label="AllFantasy"
     data-local="assets/shots/allfantasy.png"></div>
```

Drop the file at `assets/shots/allfantasy.png` (1000×700 or similar 10:7 crop).
The local file is tried first and the services stay as the fallback.

## Design tokens

Everything is CSS custom properties at the top of `assets/site.css`, pulled off
the logo: cream ground, dark cocoa type, clay accent. Dark mode is handled —
the palette flips under `prefers-color-scheme: dark`.

## Still to do

- [ ] Add the logo's actual typeface if it isn't Montserrat (currently the
      closest widely-available match)
- [ ] Replace live screenshot services with local images in `assets/shots/`
- [ ] Verify `brownpigllc.com` in Resend so the contact form sends from your
      own domain rather than Resend's shared sender
- [ ] Confirm the Headless positioning matches how you actually sell it
